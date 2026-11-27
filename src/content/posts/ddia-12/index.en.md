---
title: "DDIA Reading Notes 12: The Future of Data Systems"
description: "Notes on the last chapter of Designing Data-Intensive Applications, first edition: why combining data systems should rely on derived data rather than distributed transactions, what unbundling databases means, how to guarantee correctness in asynchronous dataflows, and what responsibility the people who build data systems owe their users."
sourceHash: "cd455fab3df72d52"
---

This is the twelfth and final post in my DDIA reading notes. The [eleventh post](/en/posts/ddia-11/) finished stream processing, and only the last chapter of the book remains. The earlier chapters mostly describe what data systems look like today; this chapter turns to the future and discusses what they should look like. The author notes that these are personal views and speculation, so the chapter is written in the first person, and readers are welcome to disagree. This post is organized around a few threads as I understand them, not in the order of the book's sections. English quotations are from the original book; the rest is my own summary.

The chapter opens with a quotation from Thomas Aquinas, *Summa Theologica*:

> If a thing be ordained to another as to its end, its last end cannot consist in the preservation of its being. Hence a captain does not intend as a last end, the preservation of the ship entrusted to him, since a ship is ordained to something else as its end, viz. to navigation.

If a thing exists for some other purpose, its final end cannot be to preserve itself: the captain's final end is not to keep the ship safe, because the ship exists to sail. Placed at the very end of the book, it is probably a reminder that data systems do not exist to preserve data for its own sake; they exist to serve people, which is exactly the subject of the chapter's last section.

## Data integration: derived data, not distributed transactions

A recurring theme of this book is that every problem has several solutions, each with its own trade-offs. Every piece of software, including so-called general-purpose databases, is designed for particular access patterns, and a complex application uses data in many different ways, so combining several pieces of software is inevitable: an OLTP database plus a full-text index, plus a data warehouse, a cache, and a recommendation system.

When the same data has to be kept in several systems, you must be very clear about where data is written first and which representations are derived from which sources. For example, data is first written to the database that serves as the system of record, and then CDC, from [the eleventh post](/en/posts/ddia-11/), applies it to the search index in the same order; if this is the only way the index is updated, you can be confident that the index is entirely derived from the database and consistent with it. Conversely, allowing the application to write directly to both sides at once produces the race condition in Figure 2 of the previous post. The key is to funnel all inputs into one system that decides a total order of writes, and derive every other representation in that order; this is state machine replication. Whether you use CDC or an event sourcing log does not matter.

This and distributed transactions are two ways to achieve the same goal:

| | Distributed transactions | Derived data |
| --- | --- | --- |
| How the order of writes is decided | Mutual exclusion through locks (two-phase locking) | A log |
| How exactly-once effect is guaranteed | Atomic commit | Deterministic retry plus idempotence |
| What reads see | Usually linearizable | Usually updated asynchronously, without the same timing guarantees |

The author thinks XA has poor fault tolerance and poor performance. In the absence of a good, widely supported distributed transaction protocol, log-based derived data is the most promising approach to integrating different data systems. But guarantees like read-your-writes are still useful, and simply telling people "eventual consistency is inevitable, deal with it" is not constructive. Later in the chapter, the book discusses how to provide stronger guarantees on top of asynchronous derived systems.

### The limits of total order

When a system is small, a totally ordered event log is perfectly workable; as it grows, limits appear: throughput beyond one machine requires partitioning, data centers usually each have their own leader, microservices each manage their own state, and offline clients modify local state directly. In all these cases there is no definite total order among events. Deciding a total order is equivalent to consensus, and a consensus algorithm that can exceed single-node throughput while working across geographic regions is still an open research problem.

For events with no causal relationship, order does not matter, but causal dependencies are sometimes deeply hidden. The book's example: a person unfriends their ex and then sends a message to their remaining friends complaining about the ex; the friend list and the messages live in different places, and if the notification service processes the message before the unfriending, the ex will receive the notification. The book admits this problem has no simple answer.

## Batch and stream processing: always ready to rederive

The goal of data integration, in the author's words, is to make sure the data ends up in the right form in all the right places. Batch and stream processing are the tools for achieving it. The only difference between them is whether the input is bounded, and even that boundary is blurring: Spark does stream processing with microbatching on a batch engine, while Flink does batch processing on a stream engine.

Batch processing has a strong functional flavor: deterministic pure functions, output depending only on input, immutable inputs, append-only outputs; stream processing adds fault-tolerant state. Thinking of an organization's entire data flow as "pipelines that derive one thing from another" makes things much clearer. Derived systems could in principle be maintained synchronously, just as a database updates secondary indexes in the same transaction, but asynchrony is exactly what makes log-based systems robust: failures are confined to one place, whereas in a distributed transaction the failure of any participant aborts the whole transaction and spreads the failure outward.

### Reprocessing, and evolving gradually

Stream processing lets changes in the input be reflected quickly in derived views, while batch processing can reprocess all the accumulated historical data and derive new views. Without reprocessing, the schema evolution discussed in [the fourth post](/en/posts/ddia-04/) is limited to small changes like adding an optional field; with it, you can restructure a dataset into a completely different model.

The book tells a story about railways. In nineteenth-century Britain there were several competing track gauges. After the standard gauge was fixed in 1846, lines with other gauges were first laid as mixed gauge with three rails, so trains of both gauges could run; once all trains had been converted to the standard gauge, the extra rail was removed. Derived views can evolve gradually in the same way: maintain the old schema and the new schema side by side as two views over the same data, switch a small number of users to the new view first, gradually increase the proportion, and finally discard the old view. Every step can be rolled back, which reduces the risk of irreversibility and gives you the confidence to improve the system faster.

### The lambda architecture

The **lambda architecture**, proposed by Nathan Marz, combines the two: input is continuously appended as immutable events, while batch processing (say Hadoop) and stream processing (say Storm) run in parallel; stream processing quickly gives approximate results, and batch processing later gives accurate results. It popularized the idea of deriving views over immutable events and reprocessing when needed, but the same logic has to be written twice in two frameworks, and the outputs of the two pipelines have to be merged; full reprocessing is too expensive, so batch processing is often made incremental, which brings back the time problems of stream processing. A better approach is to do both in one system: replay historical events with the same engine, support exactly-once, and window by event time. Apache Beam provides such an API.

## Unbundling databases

At the most abstract level, databases, Hadoop, and operating systems do the same thing: store data and let you process and query it. But Unix and relational databases have opposite philosophies: Unix gives programmers a fairly low-level abstraction of the hardware, hence pipes, and files that are just sequences of bytes; relational databases give a high-level abstraction, hence SQL and transactions. The author reads the NoSQL movement as applying Unix-style low-level abstractions to distributed OLTP storage. This section tries to reconcile the two.

When you run `CREATE INDEX`, the database scans a consistent snapshot of the table, extracts the indexed fields, sorts them, writes out the index, then processes the writes that accumulated while the index was being built, and from then on keeps the index up to date on every write to the table. This is strikingly similar to setting up a new follower in [the fifth post](/en/posts/ddia-05/) and to starting CDC in the previous post: in essence, reprocess an existing dataset and derive a new view. Seen this way, an organization's entire data flow is like one giant database: batch processing, stream processing, and ETL are like triggers, stored procedures, and materialized view maintenance routines, and the derived data systems they maintain are like different kinds of indexes—except that they are no longer features of one integrated product, but are provided by different software, running on different machines, managed by different teams.

The author speculates that there are two paths to composing different storage and processing tools into a whole:

| | Federated database | Unbundled database |
| --- | --- | --- |
| What is unified | Reads: a unified query interface over multiple storage engines, such as PostgreSQL's foreign data wrappers | Writes: CDC and event logs reliably connect storage systems so that data changes reach all the places they should |
| Intellectual tradition | Relational databases: one integrated system, a high-level query language, complex implementation | Unix: small tools each doing one thing well, composed through a uniform low-level interface |

The two are two sides of the same coin. The author thinks keeping writes synchronized across multiple systems is the harder problem, and that distributed transactions across heterogeneous storage systems are the wrong solution: when data crosses the boundary between different technologies, an asynchronous event log with idempotent writes is far more robust and practical. The loose coupling that a log provides works at two levels: at the system level, if one consumer is slow or down, the log buffers messages for it while the rest of the system keeps running, and it catches up after being fixed; at the human level, different teams can develop, improve, and maintain their own components independently. The log is an interface strong enough to carry fairly strong consistency (durable and ordered) yet general enough to apply to almost any kind of data.

Unbundling will not replace databases: stream processors need them to maintain state, and so does answering queries. Running many different pieces of infrastructure is itself complex, and building for a scale you do not need is a form of premature optimization. The goal of unbundling is not to beat a single database on some particular workload, but to combine multiple databases so that the whole performs well across a much wider range of workloads: breadth, not depth. So if one technology meets all your needs, just use it.

The author thinks one piece is still missing: the unbundled database world does not yet have its own Unix shell. Ideally, you could simply write `mysql | elasticsearch` and have the documents in MySQL indexed into Elasticsearch, with subsequent changes applied continuously, without writing custom code; materialized views, too, could be defined declaratively and maintained automatically. Research like differential dataflow is a start.

## Designing applications around dataflow

This approach of composing storage and processing systems with application code is what the author, in a 2014 talk, called "turning the database inside out." The spreadsheet is a model: a cell's formula references other cells, and when an input changes, the result is recomputed automatically. This is exactly what we want at the data system level: when a record changes, its indexes, the caches that depend on it, and the aggregates all update automatically. The author says most data systems still have things to learn from VisiCalc of 1979.

For a standard derived function like a secondary index, one `CREATE INDEX` is enough; but the derived functions for a full-text index, a machine learning model, or a cache require custom code. Running application code inside a database makes dependency management, rolling upgrades, and monitoring awkward, so it is reasonable to have some systems dedicated to durable storage and others dedicated to running stateless application code. The problem is that you cannot subscribe to changes in a mutable variable; you can only poll it periodically, and databases have inherited this passivity. The dataflow idea is to have application code respond to a change in one piece of state by triggering a change in another. This requires stable message ordering and fault-tolerant processing: lose one message, and the derived data is permanently out of step with its source. These requirements are demanding, but far cheaper than distributed transactions.

This resembles the currently popular microservices, except that the communication mechanism is completely different: one-way, asynchronous message flows rather than synchronous requests and responses. The book's example is a purchase paid in another currency, which needs the current exchange rate. The microservices approach is to call an exchange rate service when processing the purchase; the dataflow approach is to subscribe to exchange rate updates in advance, store them in a local database, and only query locally when processing the purchase. The latter is not only faster but also more robust to failures of the other service:

> The fastest and most reliable network request is no network request at all!

The former remote call becomes a stream-table join between purchase events and exchange rate updates. Of course, this join is time-dependent: when reprocessing purchase events later, you need the exchange rate as it was at the time of the purchase.

### Write path and read path

After data is written into the system, it may pass through several batch and stream processing stages until every derived dataset has been updated; this is the **write path**. When a user makes a request, the derived datasets are read and a response is constructed; this is the **read path**. The write path is done ahead of time, whether or not anyone will look at it; the read path is done only when someone asks. In functional programming terms, the write path is like eager evaluation, the read path like lazy evaluation, and derived datasets are where the two meet.

![Three rows of bars for comparison. The legend above explains that black is the write path, done ahead of time; gray is the read path, done at request time. First row, no index: black occupies only a small segment at the far left, labeled below as doing nothing at write time and scanning all documents at query time; second row, full-text index: black and gray each take about half, updating the index at write time and querying the index at query time; third row, caching results of common queries: black takes most of the row, updating the cache at write time and fetching results directly at query time](./read-write-paths.en.svg "Figure 1: The boundary between the write path and the read path can move. With no index, nothing is done at write time and all documents are scanned at query time; with a full-text index, each side does part of the work; with cached results of common queries, the write path does much more work so that the query has almost nothing to do.")

Full-text search is an example (Figure 1): with no index, the write path does nothing and the read path scans all documents; with an index, writes update the index and queries consult it; going further, precompute the results for the most common queries, and the read path has almost nothing to do while the write path must update those results as new documents arrive. The role of caches, indexes, and materialized views is actually simple: they move the boundary between the read path and the write path, making the write path do more precomputation to save work on the read path. The Twitter example in [the first post](/en/posts/ddia-01/) was exactly about this, and the boundary for celebrities and ordinary users can be drawn in different places—five hundred pages later, we have come full circle.

This boundary can be pushed all the way to the user's device. Single-page applications and mobile apps can keep a large amount of state locally, which has renewed interest in **offline-first** applications: they work with a local database on the device as much as possible and sync with the server in the background when online. The state on the device can be seen as a cache of the server's state, and the pixels on the screen as a materialized view of the client-side model objects. Server-sent events (EventSource) and WebSocket let the server push changes proactively, extending the write path to the end user; when the device is offline, it reconnects and continues reading, just as the consumer in the previous post remembers its offsets[^local-first]. The difficulty is that the "request plus response" assumption is deeply embedded in databases, frameworks, and protocols. The book's advice: when designing data systems, besides querying the current state, remember that subscribing to changes is also an option.

The author goes even further: read requests can also be represented as an event stream and fed into the stream processor together with write events, making a read a stream-table join between the stream of read requests and the database. Recording read events also lets you know what users saw before making a decision—for example, the delivery date an online shop displays may well influence whether a customer buys.

## End-to-end correctness

When a stateless service goes wrong, you fix the bug and restart it; stateful systems are designed to remember things forever, so when they go wrong, the effects may last forever. The atomicity, isolation, and durability of transactions are the main tools for building correct applications, but these foundations are weaker than they look, and Jepsen tests have repeatedly revealed gaps between the guarantees products claim and their actual behavior; serializability and atomic commit also usually only work within one data center.

### The end-to-end argument

Even if the database provides serializable transactions, the application does not necessarily avoid losing data or making mistakes: if the application has a bug and writes wrong data, transactions cannot save you. Consider a subtler example, the book's Example 12-1:

```sql
BEGIN TRANSACTION;
UPDATE accounts SET balance = balance + 11.00 WHERE account_id = 1234;
UPDATE accounts SET balance = balance - 11.00 WHERE account_id = 4321;
COMMIT;
```

The client sends `COMMIT`, the network drops, the connection times out, and the client does not know whether the transaction committed. Retrying after reconnecting is already beyond the scope of TCP duplicate suppression, and 22 dollars may be transferred instead of 11. The book says this standard example of atomicity is actually wrong: real banks do not work this way. Two-phase commit does not help either: a user submits a form in the browser, the signal is too weak to receive the response, they click "resubmit"—to the web server this is another request, and to the database another transaction.

The solution is to give the operation a unique ID, such as a UUID generated into the form, carried from the client all the way to the database, and then rely on a uniqueness constraint to ensure the same ID is executed only once (the book's Example 12-2):

```sql
ALTER TABLE requests ADD UNIQUE (request_id);

BEGIN TRANSACTION;
INSERT INTO requests (request_id, from_account, to_account, amount)
  VALUES ('0286FDB8-D7E1-423F-B40B-792B3608036C', 4321, 1234, 11.00);
UPDATE accounts SET balance = balance + 11.00 WHERE account_id = 1234;
UPDATE accounts SET balance = balance - 11.00 WHERE account_id = 4321;
COMMIT;
```

The `requests` table is actually a kind of event log, and the balance updates can perfectly well be derived downstream from these request events, as long as each event is processed exactly once.

This is an example of the **end-to-end argument** proposed by Saltzer, Reed, and Clark in 1984: certain functions can be completely and correctly implemented only at the endpoints of a communication system, with the participation of the application. TCP deduplicates within a connection, and stream processors achieve exactly-once, but neither can stop a user from resubmitting after a timeout; checksums in Ethernet and TLS cannot catch bugs in the software at either end; only end-to-end encryption protects against a compromised server. Lower-level features are still useful, but they cannot be relied on alone. The author hopes for an abstraction that would let applications easily obtain end-to-end correctness, but worries that we have not found it yet.

### Enforcing constraints with logs

Uniqueness constraints require consensus: if several requests want the same username at the same time, the system must decide which one to accept. The most common approach is to have one leader make all the decisions; to scale, partition by the value that needs to be unique. The same can be done in a log-based system: append each username request to the partition chosen by hashing the username, have a stream processor read this partition sequentially in a single thread, use a local database to remember which names are taken, and write a success or rejection message to an output stream, with clients waiting for their own result. This is basically how [the ninth post](/en/posts/ddia-09/) used total order broadcast to implement linearizable storage. The principle is: route potentially conflicting writes to the same partition and process them in order.

Operations involving multiple partitions can also be done this way, without atomic commit. In Example 12-2, the request ID, the payee account, and the payer account may be in three different partitions:

![A top-to-bottom flow. The top bar is the request log, partitioned by request ID, containing one message: r42, A transfers 11.00 to B. Below, it enters a stream processor, labeled as splitting into two instructions, both carrying r42; the lines split left and right, the left entering account A's partition as a debit of 11.00 r42, the right entering account B's partition as a credit of 11.00 r42; further down, each side has a consumer deduplicating by request ID, one decreasing A's balance and the other increasing B's balance](./transfer.en.svg "Figure 2: A transfer without atomic commit. The request is first written to the log as a single message; writing a single object is atomic in almost all data systems. The stream processor deterministically derives the debit and credit instructions from it and sends them to the two accounts' partitions; if the stream processor crashes and reprocesses, it only emits the same instructions with the same IDs, and downstream consumers deduplicate by request ID so each account changes exactly once.")

The key is to first durably write the request to the log as a single message: writing a single object is atomic in almost all data systems, so the request is either in the log or not. The subsequent split is deterministic, so a crash and retry only produces the same instructions, and downstream consumers deduplicate with the end-to-end request ID. To prevent the payer's account from going overdrawn, add another stream processor, partitioned by payer account and maintaining balances, to validate before the request is written to the log.

### Timeliness and integrity

Transactions are usually linearizable: after commit, all readers see the result immediately. A system split into multiple asynchronous stages is different. The author thinks the word "consistency" conflates two requirements:

| | Timeliness | Integrity |
| --- | --- | --- |
| Meaning | Users see the latest state of the system | No corruption: no data lost, no contradictory or false data |
| When violated | Temporary; wait a moment and read again | Permanent; must be explicitly checked and repaired |
| Corresponds to | The "consistency" in CAP, i.e. linearizability | The "consistency" in ACID, usually some application-specific integrity |

In most applications, integrity is far more important than timeliness. No one is surprised that a credit card statement does not include the most recent day's transactions; but if the statement balance does not equal the sum of the transactions, or money was taken from you without being paid to the merchant, that is a serious problem. ACID transactions provide both at once, while event-based dataflow systems separate them: without explicitly waiting, timeliness is not guaranteed, but integrity is the very core of stream processing systems—exactly-once semantics exist to preserve integrity. Represent a write as a single message that is easy to write atomically, derive all other state updates with deterministic functions, let the client-generated request ID pass through all processing layers, and make messages immutable and reprocessable: together, these preserve integrity without distributed transactions.

Many real applications can actually accept looser constraints: if two people book the same seat at the same time, you can apologize to one of them and ask them to choose another—a change that corrects a mistake like this is called a **compensating transaction**; if you sell more goods than you have in stock, you can restock, apologize, and offer a discount—not so different from a forklift crushing goods in the warehouse; airlines and hotels deliberately overbook anyway. Whether the cost of apologizing is acceptable is a business decision. If it is, you can write optimistically first and check constraints afterwards, as long as validation completes before anything hard to undo. These applications need integrity, but not timeliness of constraint enforcement.

Thus, dataflow systems can provide data management for many applications without coordination, while preserving integrity. Such **coordination-avoiding** systems perform better and tolerate faults better than systems that need synchronous coordination; for example, they can run across data centers in a multi-leader fashion, each working independently. Synchronous coordination can still be introduced where needed—say, before an irreversible operation—but there is no need for every operation to pay the cost of coordination for the sake of a small subset of requirements. Coordination reduces the apologies caused by inconsistency, but it may increase the apologies caused by downtime, through degraded performance and availability; the goal is to find the balance between the two.

## Trust, but verify

When discussing correctness, we always assume some things can go wrong and others cannot: processes crash, but memory does not corrupt. In reality this is more a matter of probability. The author used to collect crash reports from clients, and some could only be explained by random bit flips in memory: with enough devices, even the extremely unlikely happens; memory access patterns like Rowhammer can flip bits even in memory that is not faulty. Software is even more error-prone: the author has personally seen MySQL fail to maintain a uniqueness constraint and PostgreSQL's serializable isolation exhibit write skew, and application code receives far less scrutiny than databases.

So audit. HDFS and Amazon S3 do not fully trust disks: background processes continuously read files back and compare them with other replicas; to be sure data is still there, you have to actually read it, and backups should be periodically test-restored. The author worries that the culture of ACID databases has made us accustomed to blindly trusting technology, and later NoSQL made weaker guarantees the norm without audit mechanisms developing alongside.

Event-based systems are easier to audit: all state updates are deterministically derived from immutable events, so you can check the event store for corruption with hashes, rerun the derivation process to see whether the result is the same, and when something unexpected happens, reproduce exactly what occurred. Checking the entire derivation pipeline end to end includes the disks, networks, and services along the path in the check, and continuous auditing makes people unafraid of change. The author is skeptical of blockchain's Byzantine fault tolerance and proof of work, but the integrity-checking tools they and Certificate Transparency rely on, such as Merkle trees, may one day be more widely used in ordinary data systems.

## Doing the right thing

The book's last section steps back: every system is built for some purpose, and every action we take has intended and unintended consequences. We talk about data as something abstract, but many datasets are about people: their behavior, their interests, their identity. The author believes it is not enough for software engineers to focus only on the technology and ignore the consequences; the ethical responsibility is ours too.

### Predictive analytics

Using data to predict the weather is one thing; predicting whether a person will reoffend, default on a loan, or file a large insurance claim is another. Organizations naturally tend toward caution, saying "no" when unsure, but a person labeled high-risk by an algorithm (accurately or not) may be blocked at every turn, excluded from jobs, air travel, insurance, housing, and financial services—what has been called an "algorithmic prison." Criminal justice insists on the presumption of innocence, yet automated systems can exclude people from society without any proof and with almost no recourse.

The patterns algorithms learn from data are opaque, and if the input contains systematic bias, the algorithm will learn and amplify it. A zip code or even an IP address can be a strong predictor of race, and the idea that fair algorithms can be trained on biased data is almost absurd; someone quipped that machine learning is like money laundering for bias. Predictive systems can only extrapolate from the past; where the past was discriminatory, they lock the discrimination in. Making the future better than the past requires the moral imagination that only humans can provide:

> Data and models should be our tools, not our masters.

When an algorithm makes a mistake, who is responsible? A credit score is at least based on a person's own borrowing record, and errors can be corrected; a machine learning score looks at "what people similar to you did in the past," which amounts to labeling a person with a stereotype, and someone put in the wrong bucket has almost no remedy. Recommendation systems can create echo chambers; employers use credit scores to screen job applicants, and one unexpected financial difficulty can trap a person in a spiral of not finding work and worsening credit. Many consequences can be foreseen through systems thinking: is this system amplifying the gaps that already exist between people, or is it working against injustice?

### Privacy and tracking

Data that users actively hand over to a system serves the users; but when a service is supported by advertising and users' behavior is tracked as a by-product, the advertiser is the real customer. The author thinks this relationship should be called surveillance. The book offers a thought experiment: replace "data" with "surveillance" in the usual phrases—in our surveillance-driven organization, we collect real-time surveillance streams and store them in a surveillance warehouse. We have built the most extensive surveillance infrastructure the world has ever seen; even the most totalitarian regime could only dream of putting a microphone in every room.

Saying that users consented to data collection by agreeing to the terms of service does not hold up: users do not really understand how their data is processed; one person's data often reveals information about others; and when a service is practically required for social participation, refusing is an option only for the privileged few. Some say privacy is dead, but this is a misunderstanding: privacy is not hiding everything, but the freedom to decide what to reveal to whom. Surveillance transfers that decision from the individual to the company. For services that profit from targeted advertising, data is a core asset; precisely because it is valuable, companies, governments, and criminals all want it, which is why some call data a "toxic asset." When collecting data, you must consider not only today's political climate but all possible future governments.

The book compares today to the Industrial Revolution: it brought economic growth and rising living standards, but also severe pollution, terrible working conditions, and child labor, and it took a long time for environmental regulations, safety rules, and laws against child labor to be established. The book quotes Bruce Schneier:

> Data is the pollution problem of the information age, and protecting privacy is the environmental challenge.

Legislation may help. The EU's 1995 Data Protection Directive, for example, requires personal data to be collected only for specific, explicit, and legitimate purposes—the exact opposite of big data's philosophy of "collect as much as possible and explore for new insights." When the book was written, a newer regulation had not yet taken effect[^gdpr]. Ultimately, the author believes the tech industry's attitude toward personal data needs a cultural shift: stop treating users as metrics to be optimized, and treat them as people worthy of respect, dignity, and autonomy; let each person retain control over their own data, like national parks, which will be destroyed if not deliberately protected. One starting point is to stop retaining data forever and delete it as soon as it is no longer needed; another direction is to enforce access control with cryptographic protocols, not just policies.

## Summary

A few things I take away from this chapter:

- When combining multiple systems, rather than distributed transactions across systems, designate a system of record and derive all other data from it asynchronously and deterministically through logs, with the ability to rederive when needed, letting applications evolve gradually;
- Unbundling databases means taking apart features like indexes and materialized views and composing them across systems with event logs, pursuing breadth rather than depth;
- Caches, indexes, and materialized views all move the boundary between the write path and the read path, and this boundary can be pushed all the way to the user's device;
- Correctness must be guaranteed end to end: request IDs carried all the way through, potentially conflicting writes processed in order in the log; integrity matters more than timeliness, and many constraints can be checked afterwards and corrected with an apology;
- Do not trust blindly; audit continuously. Data systems affect real people, and those who build them have a responsibility to consider the consequences.

The book's last paragraph says: software and data have such a large impact on the world that we engineers have a responsibility to work toward the world we want, one that treats people with humanity and respect. This concludes my DDIA reading notes.

## Glossary

| English | Chinese | Meaning |
| --- | --- | --- |
| data integration | 数据集成 | Making sure data ends up in the right form in all the right places |
| total order | 全序 | All events arranged in a single order |
| reprocessing | 重新处理 | Rerunning transformations over all existing data to derive a new view |
| lambda architecture | Lambda 架构 | An architecture running batch and stream processing in parallel and merging the results |
| unbundling databases | 拆解数据库 | Taking database features apart and composing different systems with event logs |
| federated database | 联邦数据库 | Providing a unified query interface over multiple storage engines |
| database inside-out | 把数据库里外翻过来 | Composing storage and processing systems with application code around dataflow |
| write path / read path | 写路径 / 读路径 | Processing done ahead of time after a write / processing done only at request time |
| offline-first | 离线优先 | Working with local data on the device as much as possible, syncing when online |
| end-to-end argument | 端到端论证 | Certain functions can be correctly implemented only at the two ends of a communication, with the application's participation |
| duplicate suppression | 重复抑制 | Recognizing and discarding duplicate requests or messages |
| uniqueness constraint | 唯一性约束 | A value may appear only once, which requires consensus |
| request ID | 请求 ID | An operation identifier carried from the client all the way to the database |
| timeliness / integrity | 及时性 / 完整性 | Seeing the latest state / data not being corrupted |
| compensating transaction | 补偿事务 | An operation that corrects a mistake afterwards, such as an apology and a refund |
| coordination-avoiding | 避免协调 | Preserving integrity without synchronous coordination |
| auditing | 审计 | Checking the integrity of data |
| Merkle tree | Merkle 树 | A hash tree that can efficiently prove a record is in a dataset |
| predictive analytics | 预测分析 | Using data to predict individuals' behavior and making decisions based on it |
| surveillance | 监控 | Tracking and recording people's behavior for someone else's benefit |

[^local-first]: The book was written in 2017. The author and colleagues at Ink & Switch later developed this direction into "local-first software": data is stored primarily on the user's own device, the cloud only handles sync and backup, and concurrent offline edits are merged with CRDTs. The article was published on Ink & Switch's website in April 2019 and also appeared as a paper at the Onward! conference that year.

[^gdpr]: The book was written in 2017. The newer regulation mentioned here is the EU's General Data Protection Regulation (GDPR): adopted in April 2016, applicable from May 25, 2018, replacing the 1995 directive.
