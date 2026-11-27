---
title: "DDIA Reading Notes 11: Stream Processing"
description: "Notes on Chapter 11 of Designing Data-Intensive Applications, first edition: how traditional message brokers differ from log-based ones, how change data capture and event sourcing turn a database into a stream, how stream processing handles time, windows, and joins, and how to achieve exactly-once semantics when things fail."
sourceHash: "a6d7c3d7ae9ed3cd"
---

This is the eleventh post in my DDIA reading notes. The batch processing in the [tenth post](/en/posts/ddia-10/) rests on one premise: the input is bounded, and the job knows when it has read everything. But plenty of data is produced continuously—there is some today, there will be more tomorrow, and the dataset is never complete. Process one day's data each day, and the results have to wait until the next day; slice it finer, or process each event as soon as it arrives, and you have stream processing. This chapter still belongs to Part III, "Derived Data." This post is organized around a few threads as I understand them, not in the order of the book's sections. English quotations are from the original book; the rest is my own summary.

The chapter opens with a quote from John Gall's 1975 book *Systemantics*:

> A complex system that works is invariably found to have evolved from a simple system that works. The inverse proposition also appears to be true: A complex system designed from scratch never works and cannot be made to work.

A complex system that works always evolves from a simple system that works; a complex system designed from scratch never runs. Placed at the start of the stream processing chapter, it seems to say: stream processing was not invented out of thin air. It grew out of things that already worked—batch processing, logs, and replication.

## Messaging systems: from producers to consumers

In stream processing, a record is usually called an **event**: a small, self-contained, immutable object recording that something happened at a particular moment, usually with a timestamp. A user viewing a page, a sensor reporting a temperature—both are events. An event is produced once by a **producer** and may be processed by multiple **consumers**; related events are grouped into a **topic**.

A producer could write events into a database and have consumers poll it periodically for new ones, but the lower the latency required, the more frequent the polling, and most queries come up empty. A better approach is to notify consumers when a new event arrives, which is exactly what a messaging system does. Messaging systems come in many shapes; the book says two questions are the most useful for telling them apart:

- What happens when producers send faster than consumers can process? The system can drop messages, buffer them in a queue (and what happens when the queue no longer fits in memory?), or apply **backpressure**, making producers wait—as Unix pipes and TCP do;
- Will messages be lost if a node crashes or goes offline temporarily? Durability requires writing to disk and replicating, both of which have a cost. If occasional message loss is tolerable, the same hardware can deliver higher throughput and lower latency. Losing one periodic sensor reading is harmless, but an event used for counting must not be lost.

Some systems have producers send messages directly to consumers—the financial industry pushes market data over UDP multicast, and webhooks call the consumer's HTTP endpoint directly—but these assume that both sides are always online. More common is a **message broker**: a database optimized specifically for message streams. Producers and consumers are both its clients, and durability is the broker's problem. Compared with a database, a traditional message broker (standards like JMS and AMQP, implementations like RabbitMQ) deletes a message once it has been delivered, keeps queues short by default, and does not support arbitrary queries—but it notifies clients when data changes.

When multiple consumers read the same topic, there are two patterns: **load balancing**, where each message is delivered to only one of the consumers and they share the work; and **fan-out**, where each message is delivered to all consumers, each processing it independently. To avoid losing messages, a consumer sends an **acknowledgment** after processing; if the broker does not receive one in time, it redelivers the message to another consumer. Load balancing plus redelivery can reorder messages: consumer 2 crashes while processing m3, m3 is redelivered to consumer 1, which is already processing m4, so its processing order becomes m4, m3, m5. When messages have causal dependencies, this becomes a problem.

## Partitioned logs: storing messages as a log

Sending a network packet or calling a service usually leaves no permanent trace; even when a traditional message broker writes messages to disk, it deletes them soon after delivery. Databases and filesystems are the opposite: what is written stays by default. This difference matters a lot. Batch processing can be rerun and experimented with freely precisely because the input is not destroyed, but in an AMQP/JMS-style system, receiving a message is destructive—acknowledgment means deletion—so running the same consumer twice does not give the same result, and a newly added consumer only sees messages that arrive after it registers. Can we have the durability of a database and the low-latency notification of a messaging system at once? That is what a **log-based message broker** does.

A log is simply an append-only sequence of records on disk, used by the storage engines in the [third post](/en/posts/ddia-03/) and by replication in the [fifth post](/en/posts/ddia-05/). Producers append messages to the end of the log, and consumers read the log sequentially, waiting at the end for new messages—much like `tail -f`. To scale, the log is partitioned as in the [sixth post](/en/posts/ddia-06/) and spread across machines; a topic is a set of partitions. Within each partition, the broker assigns each message a monotonically increasing **offset**, so messages within a partition are totally ordered, while there is no ordering guarantee across partitions. Apache Kafka, Amazon Kinesis Streams, and Twitter's DistributedLog all work this way; although every message is written to disk, partitioning and replication still yield throughput of millions of messages per second.

![Two partitions of a topic, each drawn as a row of cells labeled with offsets: partition 0 has offsets 0 through 8, partition 1 has 0 through 6, and each row ends with a dashed cell labeled as new messages being appended. Consumer 1 of group A points at offset 6 in partition 0, consumer 2 of group A points at offset 4 in partition 1; a consumer of group B points from below at offset 2 in partition 0](./log-offsets.en.svg "Figure 1: Partitioned logs and consumer offsets. The two consumers in group A each handle one partition and have read up to offsets 6 and 4; group B is another application, rereading partition 0 from offset 2. Reading a message does not delete it; each consumer only needs to remember how far it has read.")

Reading a message does not delete it, so fan-out comes naturally. Load balancing, in turn, works at the granularity of partitions: within a consumer group, each partition is assigned to only one consumer, which processes all messages in that partition in order, single-threaded. The cost is that a topic can be shared by at most as many consumers as there are partitions, and a slow message blocks all later messages in the same partition. So when message processing is expensive, you want to parallelize message by message, and ordering does not matter, use a JMS/AMQP-style broker; when throughput is high, each message is cheap to process, and ordering matters, use a log.

Another benefit of ordered consumption is simple bookkeeping: all messages before the current offset have been processed, so the broker does not need to track acknowledgments one by one—it only needs to record each consumer's offset periodically. This is the same idea as the log sequence number in single-leader replication: the message broker is like the leader, and the consumers are like followers. If a consumer crashes, another node in the same group resumes from the last recorded offset; if some messages were processed but their offset was not yet recorded, those messages will be processed twice.

A log keeps appending, so the disk will eventually fill up. Logs are therefore divided into segments, and old segments are periodically deleted or archived. The log is effectively a large ring buffer: when it fills up, the oldest messages are discarded. The book does a rough calculation: a 6 TB disk, written sequentially at 150 MB/s, fills up in about 11 hours; in practice writes rarely run at full speed continuously, so a log can usually retain several days or even weeks of messages[^tiered]. If a consumer falls too far behind and the messages it needs have been deleted, it will miss them, so you need to monitor how far consumers have fallen behind; but a lagging consumer only hurts itself, not other consumers. This makes it safe to use production logs for development, testing, and debugging.

More importantly, you can **replay**. A consumer's offset is under its own control: start a new consumer at yesterday's offset, write its output elsewhere, and you can reprocess the last day's messages; change the processing code and run it again and again. This returns to the nature of batch processing: derived data is clearly separated from input data, connected by a repeatable transformation.

## Databases are streams too

An event can also be a database write. A database's replication log is, after all, a stream of write events produced by the leader, which followers apply in the same order to get an identical copy—the state machine replication discussed in the [ninth post](/en/posts/ddia-09/).

### The problem with dual writes

Real applications combine several systems: an OLTP database handles user requests, a cache speeds up common requests, a full-text index handles search, a data warehouse does analytics. Each system holds a copy of the data optimized for its own purpose, and when data changes, all of them must follow. Data warehouses usually rely on ETL doing periodic full imports; when a full import is too slow, people sometimes use **dual writes**: the application itself writes the data to each system whenever it changes.

![A sequence diagram read from top to bottom, with four vertical lifelines from left to right: client 1, database, search index, and client 2. Client 1 first writes X equals A to the database, then client 2 writes X equals B to the database; then client 2 writes X equals B to the search index, and finally client 1 writes X equals A to the search index. At the bottom it is marked that the database ends up with X equals B and the search index with X equals A—permanently inconsistent, with no error raised](./dual-writes.en.svg "Figure 2: A race condition with dual writes. Both clients write to the database first and the search index second, but the two writes arrive at the two systems in opposite orders: the database ends up with B, the search index with A.")

Dual writes have two serious problems. One is race conditions (Figure 2): two clients concurrently update the same data, and the writes may arrive at the two systems in different orders, leaving them permanently inconsistent—with no error raised. The other is partial failure: one system's write succeeds and the other's fails, and guaranteeing that both succeed or both fail together requires expensive atomic commit. The root cause is that the database and the search index each have their own leader, and neither follows the other—it is equivalent to multi-leader replication. If the database could be the sole leader and the search index its follower, the problem would be much simpler.

### Change data capture

**Change data capture** (CDC) does exactly that: observe all changes written to a database and extract them into a stream that can be replicated to other systems. As long as this change stream is applied in the same order, the data in the search index, cache, and data warehouse stays consistent with the database; they are all just consumers of the change stream—the derived data systems mentioned at the start of Part III. A log-based message broker is well suited to carrying change streams because it preserves order.

CDC can be implemented with database triggers, but they tend to be fragile and expensive; a more robust approach is to parse the database's replication log, as LinkedIn's Databus and Maxwell and Debezium on MySQL do. CDC is usually asynchronous: adding a slow consumer barely affects the source database, at the cost that all the replication lag problems from the [fifth post](/en/posts/ddia-05/) apply.

A log cannot be kept forever, so when building a new derived system (say, a new full-text index), you must start from a consistent snapshot of the database. The snapshot must correspond to a known position in the change log; after processing the snapshot, you apply changes from that point onward. Another approach is **log compaction**: as with the storage engines in the [third post](/en/posts/ddia-03/), keep only the most recent write for each key, and represent deletion with a tombstone. As long as every change carries a primary key and new values overwrite old ones, the compacted log always contains the latest value for every key, and a new consumer reading from offset 0 gets a complete copy of the database's contents. Kafka supports log compaction, which lets a message broker also serve as durable storage.

More and more databases are making change streams a first-class interface: RethinkDB can subscribe to changes in query results, Firebase and CouchDB synchronize data based on change streams, and Kafka Connect hooks up CDC tools for various databases to Kafka.

### Event sourcing

**Event sourcing** comes from the domain-driven design community and also stores all changes to application state as a log of change events, but at a different level of abstraction. In CDC, the application uses the database mutably as usual, and the log is a low-level record of state changes extracted from underneath the database; in event sourcing, the application logic itself is built on immutable events written to an event log. Events record what happened at the application level, and updates and deletions are discouraged or even forbidden.

The book's example: recording the event "student cancelled their course registration" clearly expresses the intent of the action, whereas its side effects—"delete a row from the registration table, add a cancellation reason to the feedback table"—bake in many assumptions about how the data will be used later. If you later add a feature such as "give the freed-up seat to the next person on the waiting list," you simply attach a new side effect to the existing event.

What users usually want to see is the current state—what is in the shopping cart right now—not the history of changes, so a deterministic transformation derives the current state from the event log. Unlike CDC, the events in event sourcing express intent, later events do not overwrite earlier ones, the log cannot be compacted, and rebuilding state requires the full history; snapshots of the current state are merely an optimization to speed up reads and recovery.

Event sourcing also draws a careful distinction between a **command** and an event: a user's request is a command when it first arrives, and it may fail—the username is taken, the seat is already booked. Only after validation and acceptance does it become an event: durable, immutable, a fact. Even if the user later cancels the reservation, "this seat was booked" remains true; the cancellation is another event. A consumer of the event stream cannot reject an event, because other consumers may already have seen it, so validation of a command must happen synchronously before it becomes an event. Alternatively, split it into two events: first a "provisional booking," then, after validation, a "confirmation."

## State is the integral of events

Batch processing benefits from immutable inputs, and this is also why event sourcing and CDC are powerful. But a database stores current state, and state by nature changes—how does that square with immutability?

Any state that changes is the result of the events that changed it over time: the seats available are the result of the bookings processed, the account balance is the result of deposits and withdrawals. The book draws an analogy: application state is the integral of the event stream over time, and the change stream is the derivative of state with respect to time. If you keep the change log durably, state can be reproduced at any time. The book quotes Pat Helland:

> The truth is the log. The database is a cache of a subset of the log.

The truth is the log; the database is a cache of part of the log—specifically, the latest value of each record. Log compaction is a bridge between the log and the database state.

### The benefits of immutability

Accounting has worked this way for centuries: when a transaction happens, it is recorded in an append-only ledger, and the income statement and balance sheet are derived from the ledger; when a mistake is made, you do not erase the wrong entry but record an offsetting transaction. An immutable event log is the same: when buggy code writes bad data, diagnosis and recovery are far easier than when the data has been overwritten. It also preserves more information than the current state: a customer adds an item to the cart and then removes it—the two actions cancel out for fulfillment, but they are useful for analytics, and a database that deletes the record on removal loses that information.

Once mutable state is separated from the immutable event log, the same log can derive multiple read views—the analytics database Druid, for example, ingests directly from Kafka. When a new feature needs to present existing data in a new way, build another view from the event log and run it alongside the existing system; this is far easier than a complex schema migration.

Much of the complexity of schema design, indexing, and storage engines exists to support particular queries. Separating the form in which data is written from the form in which it is read is **CQRS** (command query responsibility segregation). Traditional design assumes data must be written in the form it will later be queried; once you can transform a write-optimized event log into read-optimized state, the normalization-versus-denormalization debate matters less. Read views can be denormalized as much as you like, because the transformation keeps them consistent with the log—the Twitter home timeline in the [first post](/en/posts/ddia-01/) is an example.

### Concurrency control and limitations

The biggest drawback of event sourcing and CDC is that consumers are usually asynchronous: a user writes something and then reads the derived view, and may not yet see their own write. Either the view's update must happen synchronously with appending the event, or you need total order broadcast. On the other hand, an event log simplifies concurrency control: many multi-object transactions arise because one user action changes several pieces of data, but in event sourcing, one user action is one self-contained event, written to one place—naturally atomic. If the event log and the application state are partitioned the same way, and each partition is processed by a single-threaded consumer, you do not even need concurrency control for writes: the log imposes a serial order on the events in each partition.

Immutability also has limits. Some datasets are updated and deleted very frequently, and the complete immutable history becomes enormous; the performance of compaction and garbage collection then becomes critical. More troublesome is that sometimes data must really be deleted: privacy regulations require erasing a user's personal information, or sensitive information is accidentally leaked. Appending an event saying "treat this as deleted" is not enough; you have to rewrite history and pretend the data was never written. Datomic calls this excision; Fossil calls it shunning. And truly deleting data is surprisingly hard: copies may lurk in storage engines, filesystems, SSDs, and backups; deletion mostly just makes the data harder to retrieve.

## Processing streams: uses and time

Once you have a stream, you can write events into a database, cache, or index for other clients to query; you can push them to people, such as alert emails or real-time dashboards; or you can process them to produce new streams. The code that processes a stream is called an operator or a job, much like the MapReduce jobs in the [tenth post](/en/posts/ddia-10/): it consumes input read-only, writes output append-only, and partitions and parallelizes the same way. The key difference is that a stream never ends: sorting makes no sense on unbounded data, so sort-merge joins are out; a failed batch job can be rerun from the beginning, but a stream job that has been running for years cannot.

Stream processing has several common uses:

- **Complex event processing** (CEP): just as a regular expression finds character patterns in a string, CEP finds particular event patterns in an event stream. It inverts the relationship between query and data: in a database, data is stored long-term and queries are fleeting; in CEP, queries are stored long-term and events flow past them;
- **Stream analytics**: not concerned with particular event sequences, but computing aggregations and statistics over large numbers of events, such as the average requests per second over the last five minutes. It sometimes uses probabilistic algorithms like HyperLogLog to save memory, but that is only an optimization—stream processing itself is not approximate;
- **Maintaining materialized views**: keeping derived systems like caches and search indexes up to date with the source data. What is needed here is not a time window but all events since the beginning of time; Samza and Kafka Streams support this using Kafka's log compaction;
- **Search on streams**: for example, storing search criteria in advance and notifying users when a new listing matches; Elasticsearch's percolator does this.

### Event time and processing time

Stream analytics often needs to window by time, and "the last five minutes" sounds clear but is surprisingly tricky. Batch processing looks at the timestamps carried in the events, and the result is deterministic; many stream processing frameworks, however, use the processing machine's local clock—**processing time**—to define windows. But events may be queued before processing, hit network faults, or wait out a consumer restart, and delays can also reorder them. The book uses *Star Wars* as an analogy: episodes IV, V, and VI were released from 1977 to 1983, while episodes I, II, and III came out from 1999 to 2005; if you watch in release order, the order of processing does not match the order of the narrative. Confusing **event time** with processing time produces wrong data: if a stream processor is down for a minute and then works through the backlog, the request rate computed by processing time shows a spike, while the actual request rate was steady.

Windowing by event time brings another difficulty: you can never be certain that all events for a window have arrived. Counting requests per minute, most events arriving now belong to minutes 38 and 39—when is the window for minute 37 complete? There will always be **stragglers** buffered elsewhere or delayed by a network outage. Either ignore them and monitor how many are dropped, or publish a corrected value when they arrive. Sometimes a special message can say "from now on, there will be no more events earlier than t," but with multiple producers, each one must be tracked separately.

The timestamps themselves may not be trustworthy. A mobile app offline buffers events locally and sends them hours or even days later; a device's clock may be set wrong, deliberately or not. One approach is to record three timestamps: when the event happened (device clock), when it was sent (device clock), and when the server received it (server clock). Use the difference between the last two to estimate the device clock's offset, then correct the first with it.

### Four kinds of windows

![Four kinds of windows drawn over the same set of events, with the horizontal axis being event time from 10:00 to 10:12. The top row shows nine event dots, each with a faint dashed line extending downward. The tumbling window is three back-to-back segments: 10:00 to 10:04, 10:04 to 10:08, 10:08 to 10:12; the hopping window is 4-minute windows starting every 2 minutes, drawn staggered in two rows; the sliding window is a single segment spanning two events at 10:03:30 and 10:07:00; the session window is two segments separated by a gap of more than 2 minutes with no events, marked as a timeout](./windows.en.svg "Figure 3: Four kinds of windows. Tumbling windows are back-to-back and non-overlapping; hopping windows have a fixed length and overlap; the two events at 10:03:30 and 10:07:00 fall into different tumbling windows but are less than 4 minutes apart, so they are in the same 4-minute sliding window; session windows have no fixed length and end when more than 2 minutes pass with no events.")

- **Tumbling window**: fixed length; each event belongs to exactly one window. Just round the timestamp down to the window boundary;
- **Hopping window**: fixed length, but overlapping—for example, a 5-minute window starting every minute, used to smooth results;
- **Sliding window**: contains all events within a certain interval of each other, with no fixed boundaries; the implementation maintains a buffer of events ordered by time;
- **Session window**: no fixed length; groups together events from the same user that are close in time, ending when the user is inactive for some period (say, 30 minutes). Common in website analytics.

## Stream joins

The [tenth post](/en/posts/ddia-10/) joined datasets by key in batch processing; stream processing has the same need, but new events can appear at any moment, which makes it harder. The book distinguishes three kinds:

- **Stream-stream join**: a website wants to compute the click-through rate of search results, so it joins search events with click events by session ID. The user may never click, or may click days later; due to network delays, the click event may even arrive before the search event. So you choose a window—say, only join events within an hour of each other—and maintain that hour's events in the stream processor, indexed by session ID. Note that you cannot simply embed the search information in the click event, because then you would not know which searches were not clicked;
- **Stream-table join**: supplementing activity events with user profiles is called **enrichment**. Querying a remote database once per event is too slow; a better approach is to load a copy of the database into the stream processor locally, like the hash joins in the [tenth post](/en/posts/ddia-10/). The difference is that the database changes, so the stream processor also subscribes to the profile database's change stream and uses CDC to keep its local copy current. This is really a join of two streams, except that for the change stream, the window reaches all the way back to the beginning of time;
- **Table-table join**: the Twitter home timeline in the [first post](/en/posts/ddia-01/) is an "inbox" maintained for each user. When someone tweets, the tweet is added to the timeline of each of their followers; when a tweet is deleted or someone follows or unfollows, the timelines change accordingly. This is equivalent to maintaining a materialized view of a query joining the tweets table with the follows table; the timeline is a cache of that query's result, updated whenever either table changes.

All three joins require maintaining state based on one input and then looking up that state for each message from the other input, so event order matters a lot: follow then unfollow gives a different result from unfollow then follow. But a partitioned log only guarantees order within a single partition; across streams and across partitions there is no guarantee. If state changes over time, which moment's state does the join use? For example, when calculating tax on an invoice, the tax rate changes, and when reprocessing historical data you should use the rate in effect at the time of sale. Data warehouses call this a **slowly changing dimension** (SCD); a common approach is to give each version of the joined record a unique ID—say, a new ID each time the tax rate changes—and record the ID at the time of sale in the invoice. The join then becomes deterministic, at the cost of keeping all versions of the record, and the log can no longer be compacted.

## Fault tolerance: exactly once

Fault tolerance in batch processing is easy: if a task fails, rerun it on another machine, and simply discard the failed task's output—because the input is immutable and output only becomes visible after the task succeeds. The result looks as if each input record was processed exactly once; this is called **exactly-once semantics**, though the book says "effectively-once" is more accurate, because records may actually be processed several times. A stream never finishes processing, so "make output visible only when the job completes" is not an option.

One approach is **microbatching**: chop the stream into small chunks of about a second and treat each chunk as a small batch job, as Spark Streaming does. Too small a batch means high scheduling overhead; too large a batch means long result latency. Another approach is Flink's: periodically checkpoint the state of operators into durable storage, with checkpoints triggered by barriers in the message stream. When an operator crashes, restart from the most recent checkpoint and discard any output after it. Within a stream processing framework, both approaches can achieve exactly-once; but once output leaves the framework—written to a database, an email sent—it cannot be taken back, and restarting a failed task will cause those external side effects to happen twice.

To behave like exactly-once even under failures, all the effects of processing one event—messages sent downstream, database writes, changes to operator state, acknowledgment of the input message (advancing the offset, in a log broker)—must take effect atomically, all together or not at all. This is precisely the atomic commit discussed in the [ninth post](/en/posts/ddia-09/). Distributed transactions across heterogeneous systems are problematic, but inside a stream processing framework, which manages its own state and messages, they can be implemented efficiently—Google Cloud Dataflow and VoltDB do this, and Kafka planned to add similar capabilities[^kafka-eos].

Another approach relies on **idempotence**: an operation has the same effect whether executed once or many times. Setting a key to a value is idempotent; incrementing a counter is not. A non-idempotent operation can often be made idempotent with a little metadata: when consuming Kafka messages, write the offset of the message that triggered this write into the external database along with the value, and you can tell whether this update has already been applied. This depends on several premises: the restarted task replays the same messages in the same order, the processing is deterministic, and no other node is concurrently updating the same value; during failover, you may also need the fencing tokens from the [eighth post](/en/posts/ddia-08/) to block an old node wrongly declared dead.

Finally, the state used for windowed aggregation counters and local join tables must be recoverable after a failure. It is usually kept locally and replicated periodically: Flink writes snapshots of operator state to HDFS; Samza and Kafka Streams send state changes to a log-compacted Kafka topic, much like CDC. When the state is an aggregation over a short window, replaying that stretch of input can recompute it.

## Summary

A few things I take away from this chapter:

- Stream processing is batch processing run continuously over unbounded input; message brokers and event logs are the filesystems of the stream world;
- Traditional message brokers delete messages after acknowledgment, suiting task queues where order does not matter; log-based brokers keep messages on disk and let consumers track their own offsets, enabling replay, which suits derived data;
- Database writes are a stream too: CDC captures it implicitly, event sourcing makes it explicitly the foundation of the application, and log compaction lets one stream hold the complete contents of a database;
- State is the integral of events; the truth is in the log, and all kinds of read views can be derived and rebuilt from it;
- Distinguish event time from processing time, accept that a window can never be certain to be complete, and consider which point in time's state a join should use;
- Stream processing output never ends, so exactly-once can only be achieved at a finer granularity through microbatching, checkpoints, transactions, or idempotent writes.

Chapter 12, the book's final chapter, will bring batch processing, stream processing, and this chapter's log-based thinking together to discuss what data systems might look like in the future.

## Glossary

| English | Chinese | Meaning |
| --- | --- | --- |
| event | 事件 | An immutable object recording that something happened at a moment |
| producer / consumer | 生产者 / 消费者 | The side that produces events / the side that processes events |
| topic | 主题 | A group of related events |
| backpressure | 背压 | Making producers wait when consumers cannot keep up |
| message broker | 消息代理 | A database optimized for message streams, through which clients send and receive messages |
| fan-out | 扇出 | Delivering each message to all consumers |
| acknowledgment | 确认 | A consumer telling the broker a message has been processed |
| log-based message broker | 基于日志的消息代理 | Storing messages as a partitioned append-only log |
| offset | 偏移量 | A message's sequence number within a partition, used by consumers to track progress |
| dual writes | 双写 | The application writing data to multiple systems itself |
| change data capture (CDC) | 变更数据捕获 | Extracting all changes to a database into a stream |
| log compaction | 日志压实 | Keeping only the most recent write for each key |
| event sourcing | 事件溯源 | Building application logic on immutable events |
| command | 命令 | A user request not yet validated, which may fail |
| CQRS | 命令查询职责分离 | Separating the form of writes from the form of reads |
| complex event processing (CEP) | 复杂事件处理 | Searching for event patterns in an event stream |
| event time / processing time | 事件时间 / 处理时间 | When an event happened / when it was processed |
| straggler | 掉队者 | An event that arrives after its window has already been computed |
| tumbling / hopping / sliding / session window | 滚动 / 跳跃 / 滑动 / 会话窗口 | Four ways of dividing time into windows |
| enrichment | 扩充 | Supplementing events with information from a database |
| slowly changing dimension (SCD) | 缓慢变化维度 | Giving each version of a record an ID so joins are deterministic |
| exactly-once / effectively-once | 恰好一次 / 有效一次 | Results looking as if each record was processed only once |
| microbatching | 微批 | Chopping a stream into small chunks, each treated as a small batch |
| idempotence | 幂等性 | Having the same effect whether executed once or many times |

[^tiered]: The book was written in 2017. Kafka later added tiered storage: old log segments can be moved to object storage, so how long a log is retained is no longer limited by local disk. The feature was introduced as early access in version 3.6 in 2023 and became production-ready in version 3.9 in 2024.

[^kafka-eos]: The book was written in 2017. Kafka 0.11, released in June of that year, implemented this plan: idempotent producers, transactions across partitions, and consumers that read only committed transactions, which let Kafka Streams achieve exactly-once within Kafka. Flink 1.4, released at the end of the year, also provided a two-phase commit output interface, enabling end-to-end exactly-once with external systems that support transactions.
