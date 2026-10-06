---
title: "DDIA Reading Notes 05: Replication"
description: "Notes on Chapter 5 of Designing Data-Intensive Applications, first edition: how single-leader, multi-leader, and leaderless replication work, what anomalies replication lag can cause, what quorums can and cannot guarantee, and how to tell whether two writes happened one before the other or were concurrent."
sourceHash: "3507a30dbca4a12c"
---

This is the fifth post in my DDIA reading notes. The first four chapters form Part I of the book, all about what happens when data lives on a single machine. [The fourth post](/en/posts/ddia-04/) finished encoding and evolution, and with that Part I came to an end. From Chapter 5 on, we are in Part II, "Distributed Data," and the question changes to: what happens when storing and retrieving data involves multiple machines. This post briefly notes the opening of Part II, then gets into Chapter 5: replication. English quotations in the text are from the original book; the rest is my own retelling and organization.

## Distributed data

Wanting to distribute a database across multiple machines usually comes from one of these reasons:

- **Scalability**: when the data volume, read load, or write load is too much for one machine to handle, spread the load across multiple machines;
- **Fault tolerance and high availability**: when one machine (or several machines, the network, or an entire data center) fails, the application should keep working, so use multiple machines for redundancy—when one goes down, another takes over;
- **Latency**: when users are spread around the world, put servers in many places so each user is served by a nearby data center, avoiding network packets traveling halfway around the globe.

### Shared-memory, shared-disk, and shared-nothing

The simplest way to handle higher load is to buy a more powerful machine—what [the first post](/en/posts/ddia-01/) called scaling up. Many CPUs, memory sticks, and disks connected under one operating system, where any CPU can access any piece of memory or disk, is called a **shared-memory architecture**. Its problem is that cost grows faster than linearly: a machine with twice the CPUs, memory, and disks usually costs far more than twice as much; and limited by various bottlenecks, a machine twice as large may not handle twice the load. High-end machines have hot-swappable components, which provides a bit of fault tolerance, but the whole machine can only be in one place.

Another option is a **shared-disk architecture**: several machines each have their own CPUs and memory, but data is stored on a disk array they share, connected over a fast network (NAS or SAN). Some data warehouse workloads use it, but contention and locking overhead limit its scalability.

Part II focuses on the third option, the **shared-nothing architecture**, which is scaling out. Each machine or virtual machine running the database software is called a **node**, independently using its own CPUs, memory, and disks, with all coordination between nodes done in software over an ordinary network. It needs no special hardware, so you can pick machines with the best price-performance; you can also distribute data across multiple geographic regions to reduce user latency and even survive the loss of an entire data center. With virtual machines in the cloud, this architecture is now available even at scales far smaller than Google's—small companies can do multi-region distributed deployments today.

The book takes care to explain that it chooses this architecture not because it is best for every scenario, but because it demands the most care from application developers: when data is distributed across multiple nodes, there is a set of constraints and trade-offs that the database cannot magically hide. It often adds complexity to the application and sometimes limits the data models you can use. In some cases, a simple single-threaded program can vastly outperform a cluster with hundreds of CPU cores.

### Replication and partitioning

There are two common ways to distribute data across multiple nodes:

- **Replication**: keep copies of the same data on several different nodes (possibly in different places). It provides redundancy—when some nodes are unavailable, data can still be read from other nodes—and can also improve performance. This is the subject of Chapter 5;
- **Partitioning**: split a large database into smaller subsets called **partitions**, which can be placed on different nodes; this is also called **sharding**. This is the subject of Chapter 6.

The two are different mechanisms, but they are often used together: a database is split into several partitions, and each partition is stored as a copy on several nodes. After these two chapters, Chapter 7 covers transactions, and Chapters 8 and 9 cover the fundamental limits of distributed systems.

## Why replicate

Chapter 5 opens with a line from Douglas Adams's novel *Mostly Harmless*:

> The major difference between a thing that might go wrong and a thing that cannot possibly go wrong is that when a thing that cannot possibly go wrong goes wrong it usually turns out to be impossible to get at or repair.

Replication is meant to be the fallback for when things go wrong, yet this chapter spends a good deal of space on how the fallback itself goes wrong.

Replication means keeping copies of the same data on several machines connected by a network. Reasons to do this:

- Keep data geographically close to users, reducing latency;
- Allow the system as a whole to keep working when part of it fails, improving availability;
- Increase the number of machines that can serve read requests, improving read throughput.

This chapter assumes the dataset is small enough that each machine can hold a full copy; the case where it is too large and must be split is left to Chapter 6.

If the data being replicated never changed, replication would be simple: copy the data to each node once and you are done. The book pinpoints the difficulty in one sentence:

> All of the difficulty in replication lies in handling changes to replicated data.

There are three popular algorithms for replicating changes between nodes: **single-leader**, **multi-leader**, and **leaderless** replication. Almost all distributed databases use one of them, and each has its pros and cons. Replication also involves many trade-offs, such as synchronous versus asynchronous replication and how to handle failed replicas. These are usually configuration options of the database, with details varying from one product to another, but the principles are broadly the same.

Database replication is an old topic; the principles have barely changed since the 1970s, because the fundamental constraints of networks have not changed. Outside research, though, many developers long assumed a database had only one node, and distributed databases becoming mainstream is a relatively recent thing. So many application developers are still unfamiliar with replication, and concepts like eventual consistency are often misunderstood. Later in this chapter the book makes it more precise and introduces guarantees like read-your-writes and monotonic reads.

## Leaders and followers

A node that stores a copy of the database is called a **replica**. With multiple replicas, an immediate question arises: how do you make sure all the data ends up on all the replicas? Every write must be processed by every replica, otherwise the replicas would no longer contain the same data. The most common solution is **leader-based replication**, also called active/passive replication or master–slave replication:

1. One of the replicas is designated the **leader** (also called master or primary). When clients want to write to the database, they must send their requests to the leader, which first writes the new data to its local storage;
2. The other replicas are called **followers** (also called read replicas, slaves, secondaries, or hot standbys). Whenever the leader writes new data, it sends the data change to all followers as part of a **replication log** or **change stream**. Each follower takes the log from the leader and applies all writes to its local copy in the same order as the leader processed them;
3. When a client reads from the database, it can query the leader or any follower; but only the leader accepts writes, so from the client's perspective followers are read-only.

Many relational databases have this kind of replication built in, such as PostgreSQL (since version 9.0), MySQL, Oracle Data Guard, and SQL Server's AlwaysOn availability groups; some nonrelational databases use it too, such as MongoDB, RethinkDB, and Espresso. It is not limited to databases either: distributed message brokers like Kafka and RabbitMQ's highly available queues use it, as do some network filesystems and replicated block devices like DRBD.

### Synchronous versus asynchronous replication

An important detail of a replication system is whether replication is **synchronous** or **asynchronous**. In relational databases this is usually a configuration option; other systems often hard-code one or the other.

The book's example is a user updating their profile picture: the client sends the request to the leader, the leader forwards the data change to the followers, and finally tells the client the update succeeded. Suppose there are two followers: the leader waits for follower 1 to acknowledge receiving the write before reporting success to the user, so follower 1 is synchronous; the leader sends the change to follower 2 and does not wait for its response, so follower 2 is asynchronous.

![One write drawn as a set of time bars. The client's request, from sending the update to receiving success, is the longest bar; the leader first writes locally; follower 1 is synchronous—only after it writes and acknowledges does the leader return success to the client; follower 2 is asynchronous—the change reaches it and its write completes much later than the client receives success, and during that time reads from follower 2 return the old value](./sync-async.en.svg "Figure 1: The synchronous follower 1 makes the client wait a little longer; the asynchronous follower 2 does not make the client wait, at the cost that for some time after the client receives success, follower 2 still has the old value.")

Normally replication is quite fast—most database systems can apply changes to followers in well under a second—but there is no guarantee. A follower can fall minutes or more behind the leader: it might be recovering from a failure, the system might be near capacity, or the network between nodes might be having problems.

The advantage of synchronous replication is that the follower is guaranteed to have an up-to-date copy consistent with the leader; if the leader suddenly fails, the data is still there on the follower. The disadvantage is that if the synchronous follower does not respond (because it crashed, the network failed, or for any other reason), the write cannot be processed: the leader must block all writes and wait for that synchronous replica to recover.

So making all followers synchronous is impractical—a failure of any one node would stop the whole system. In practice, enabling synchronous replication on a database usually means one follower is synchronous and the rest are asynchronous; if that synchronous follower becomes unavailable or slow, one of the asynchronous followers is made synchronous. This guarantees that at least two nodes (the leader and one synchronous follower) have the latest data. This configuration is sometimes called **semi-synchronous**.

Leader-based replication is also often configured to be fully asynchronous. In that case, if the leader fails and cannot be recovered, any writes that have not yet been replicated to followers are lost: a write is not guaranteed durable even after it has been acknowledged to the client. The benefit is that the leader can continue processing writes even if all followers have fallen behind. Weakening durability sounds like a bad trade-off, but asynchronous replication is still widely used, especially when there are many followers or they are geographically distributed.

Losing data in asynchronous replication is a serious problem, and researchers have been looking for replication methods that do not lose data while still performing well and staying available. **Chain replication**, for example, is a variant of synchronous replication: a write travels down a chain of nodes from the head, and is not complete until it reaches the tail. It has been successfully implemented in a few systems such as Microsoft Azure Storage. Consistency in replication is closely related to **consensus** (getting several nodes to agree on a value), which Chapter 9 returns to.

### Setting up new followers

Sometimes you need to add a new follower—to increase the number of replicas, or to replace a failed node. How do you ensure the new follower gets an accurate copy of the leader's data?

Simply copying data files from one node to another is usually not enough: clients keep writing, the data keeps changing, and different parts of the copied file will be snapshots from different moments. You could lock the database to stop writes temporarily, but that defeats the goal of high availability. Fortunately, it can usually be done without downtime:

1. Take a consistent snapshot of the leader's database at some point in time, ideally without locking the whole database. Most databases have this feature for backups anyway, sometimes with the help of third-party tools such as MySQL's innobackupex;
2. Copy the snapshot to the new follower node;
3. The follower connects to the leader and requests all the data changes since the snapshot. This requires the snapshot to correspond to an exact position in the leader's replication log—called the **log sequence number** (LSN) in PostgreSQL and the **binlog coordinates** in MySQL;
4. Once the follower has processed the backlog of changes since the snapshot, it has **caught up** with the leader and can continue processing new changes as they happen on the leader.

The exact steps vary by database; some systems do it fully automatically, while others require an administrator to go through a rather arcane multi-step process by hand.

### Handling node outages

Any node in the system can go down, whether due to a fault or to planned maintenance (such as rebooting a machine to install a kernel security patch). Being able to restart individual nodes without downtime is a big operational benefit. The goal is to keep the whole system running when a single node fails, and to minimize the impact of a node outage.

#### Follower failure: catch-up recovery

Each follower keeps a log on its local disk of the data changes it has received from the leader. If a follower crashes and restarts, or if the network between it and the leader is temporarily interrupted, recovery is easy: from its log it knows the last transaction it processed before the failure, so it connects to the leader and requests all the data changes during the disconnection, applies them, and catches up. This is called **catch-up recovery**.

#### Leader failure: failover

Leader failure is much more troublesome: one of the followers must be promoted to be the new leader, clients need to be reconfigured to send their writes to the new leader, and the other followers need to start receiving data changes from the new leader. This process is called **failover**.

Failover can be done manually (an administrator is notified that the leader has failed and steps in to establish a new leader) or automatically. Automatic failover usually consists of three steps:

1. **Determining that the leader has failed.** Many things can go wrong—crashes, power outages, network problems—and there is no foolproof way to detect failure, so most systems simply use a timeout: nodes frequently send messages to each other, and if a node does not respond for some period (say 30 seconds), it is assumed to be dead. (When planned maintenance deliberately takes the leader offline, this step is skipped.)
2. **Choosing a new leader.** This can be done through an election (the new leader is chosen by a majority of the remaining replicas) or by a previously appointed **controller node**. The best candidate is usually the replica with the most up-to-date data from the old leader, to minimize data loss. Getting all the nodes to agree on a new leader is a consensus problem, discussed in detail in Chapter 9.
3. **Reconfiguring the system to use the new leader.** Clients need to send their write requests to the new leader (Chapter 6 discusses how this is done when it covers request routing). If the old leader comes back, it may still believe it is the leader, not realizing the other replicas have deposed it; the system needs to make sure it becomes a follower and recognizes the new leader.

Each step of failover can go wrong:

- With asynchronous replication, the new leader may not have received all the writes from the old leader before it failed. When the old leader rejoins the cluster after the new leader has been chosen, what should happen to those writes? The new leader may have received conflicting writes in the meantime. The most common approach is simply to discard the old leader's unreplicated writes, which may violate clients' expectations of durability.
- Discarding writes is especially dangerous when other storage systems outside the database need to stay consistent with the database's contents. The book gives the example of an incident at GitHub: an out-of-date MySQL follower was promoted to leader. The database used an auto-incrementing counter to assign primary keys to new rows, and the new leader's counter lagged behind the old leader's, so it reused some primary keys that the old leader had already assigned. Those primary keys were also used in a Redis store, and the key reuse caused the MySQL and Redis data to become inconsistent—as a result, some private data was leaked to the wrong users.
- In certain fault scenarios (Chapter 8), two nodes may both believe they are the leader, a situation called **split brain**. Both leaders accept writes, and without a mechanism to resolve conflicts, data is likely to be lost or corrupted. As a safety measure, some systems shut down one node when they detect two leaders; this is sometimes called **fencing**, or more bluntly STONITH (Shoot The Other Node In The Head). But if this mechanism is not designed carefully, you may end up with both nodes being shut down.
- How long should the timeout be before declaring the leader dead? A longer timeout means slower recovery when the leader fails; a timeout that is too short causes unnecessary failovers. For example, a temporary load spike could make a node's response time exceed the timeout, or a network glitch could delay packets. If the system is already struggling with high load or network problems, an unnecessary failover only makes things worse.

There are no easy solutions to these problems. That is why some operations teams prefer to perform failovers manually even when the software supports automatic failover. Node failures, unreliable networks, and the trade-offs between replica consistency, durability, availability, and latency are fundamental problems in distributed systems, discussed in depth in Chapters 8 and 9.

### Implementation of replication logs

How does leader-based replication work under the hood? Several methods are used in practice.

#### Statement-based replication

The simplest approach is for the leader to record every write request (every **statement**) it executes and send that statement log to its followers. For a relational database, this means forwarding every INSERT, UPDATE, or DELETE statement to the followers, and each follower parses and executes that SQL statement as if it had received it from a client.

This sounds reasonable, but there are several situations where it can break replication:

- Statements that call nondeterministic functions, such as `NOW()` for the current time or `RAND()` for a random number, are likely to produce different values on each replica;
- Statements that use auto-incrementing columns, or that depend on existing data in the database (such as `UPDATE … WHERE <some condition>`), must be executed in exactly the same order on every replica, otherwise they may have different effects. This becomes a constraint when multiple transactions execute concurrently;
- Statements with side effects (triggers, stored procedures, user-defined functions) may produce different side effects on each replica unless the side effects are completely deterministic.

These problems can be worked around—for example, when the leader records a statement, it can replace nondeterministic function calls with their determined return values, so all followers get the same value. But there are so many edge cases that other replication methods are now generally preferred.

MySQL used statement-based replication before version 5.1. It is compact, which is why it is still sometimes used today, but the book notes that MySQL now defaults to row-based replication when a statement has any nondeterminism[^binlog]. VoltDB also uses statement-based replication, and it requires transactions to be deterministic to make this safe.

#### Shipping the write-ahead log

As [the third post](/en/posts/ddia-03/) discussed, storage engines typically append every write to a log:

- In log-structured storage engines (SSTables and LSM-trees), the log is the main storage; log segments are compacted and garbage-collected in the background;
- In B-trees, which overwrite disk blocks in place, every modification is first written to a write-ahead log so that the index can be restored to a consistent state after a crash.

Either way, the log is an append-only sequence of bytes containing all writes to the database. So the same log can be used to build a replica on another node: besides writing the log to disk, the leader sends it over the network to its followers, and the followers process this log to build a copy of exactly the same data structures. PostgreSQL and Oracle, among others, use this approach, called **WAL shipping**.

Its main disadvantage is that the log describes data at a very low level: the write-ahead log records which bytes in which disk blocks were changed. This tightly couples replication to the storage engine, so if the database's storage format changes between versions, it is typically not possible to run different versions of the database software on the leader and the followers.

This may seem like an implementation detail, but it has a big operational impact. If the replication protocol allows followers to run a newer software version than the leader, you can upgrade the followers first, then perform a failover so that one of the upgraded nodes becomes the new leader—achieving a zero-downtime upgrade of the database software. If the replication protocol does not allow version mismatches (as WAL shipping often does not), such an upgrade requires downtime.

#### Logical log replication

Another approach is to use a different log format for replication and for the storage engine, decoupling the replication log from the storage engine's internal implementation. This kind of replication log is called a **logical log**, to distinguish it from the storage engine's (physical) data representation.

A logical log for a relational database is usually a sequence of records describing writes to tables at the granularity of rows:

- For an inserted row, the log contains the new values of all columns;
- For a deleted row, the log contains enough information to uniquely identify the row, usually the primary key; if the table has no primary key, the old values of all columns need to be logged;
- For an updated row, the log contains enough information to uniquely identify the row, plus the new values of all columns (or at least the new values of all changed columns).

A transaction that modifies several rows generates several such records, followed by a record indicating that the transaction was committed. MySQL's binlog, when configured for row-based replication, works this way.

Because a logical log is decoupled from the storage engine internals, it is easier to keep backward compatible, allowing the leader and followers to run different versions of the database software, or even different storage engines. It is also easier for external applications to parse: you can send the contents of the database to external systems, such as a data warehouse for offline analysis, or to build custom indexes and caches. This technique is called **change data capture**, and Chapter 11 returns to it.

#### Trigger-based replication

The replication approaches described so far are all done by the database system itself, without involving application code, which is often exactly what you want. But some situations need more flexibility: you may want to replicate only a subset of the data, or replicate from one kind of database to another, or you may need conflict resolution logic (see "Handling write conflicts" later). In these cases, replication may need to move up to the application layer.

Some tools (such as Oracle GoldenGate) can read the database log and hand data changes to an application. Another approach uses **triggers** and stored procedures, available in many relational databases. A trigger lets you register custom application code that is automatically executed when a data change (a write transaction) occurs in the database. The trigger can record the change in a separate table, and an external process reads the changes from that table, performs the necessary application logic, and replicates the data change to another system. Oracle's Databus and Postgres's Bucardo work this way.

Trigger-based replication typically has greater overhead than other replication methods and is more prone to bugs and limitations than the database's built-in replication. But it is flexible, so it still has its uses.

## Problems with replication lag

Tolerating node failures is only one reason to want replication; the other two are scalability (handling a request volume that one machine cannot handle) and latency (placing replicas closer to users).

Leader-based replication requires all writes to go through a single node, but read-only queries can go to any replica. For workloads that are mostly reads with only a small fraction of writes (very common on the web), an attractive approach is to create many followers and distribute read requests among them: this reduces the load on the leader and lets replicas close to users serve their reads.

In this **read-scaling** architecture, you can increase capacity for read-only requests simply by adding followers. But it only really works with asynchronous replication: if you replicated synchronously to all followers, a failure of any one node or a network interruption would make the whole system unable to write. The more nodes you have, the more likely it is that one will be down, so a fully synchronous configuration would be very unreliable.

But when you read from an asynchronous follower, you may see outdated information if the follower has fallen behind. Running the same query on the leader and a follower at the same time may give different results, because not all writes have been reflected on the follower yet. This inconsistency is only temporary: stop writing and wait a while, and the followers will eventually catch up and become consistent with the leader. This is called **eventual consistency**[^eventual].

The word "eventually" is deliberately vague: in general, there is no limit to how far a replica can fall behind. In normal operation, the **replication lag** between a write to the leader and its reflection on a follower may be only a fraction of a second, imperceptible in practice. But when the system is near capacity or the network has problems, the lag can easily grow to seconds or even minutes.

When the lag is that large, the inconsistencies it causes are not just a theoretical concern but a real problem for applications. The book gives three examples.

### Reading your own writes

Many applications let users submit some data and then view what they submitted—a record in a customer database, or a comment on a discussion thread. The new data must be sent to the leader, but when the user views it, the read may go to a follower. This is especially appropriate when data is viewed often and only occasionally written.

Asynchronous replication has a problem here: if the user reads right after writing, the new data may not have reached the replica they are reading from. To the user, it looks as though the data they just submitted was lost, and they are understandably unhappy.

What is needed here is **read-after-write consistency**, also called **read-your-writes**: when a user reloads the page, they always see any updates they submitted themselves. It makes no promises about other users—their updates may take a while to become visible—but it reassures the user that their own input has been saved correctly.

In a leader-based replication system, there are several ways to implement it:

- When reading something the user may have modified, read from the leader; otherwise read from a follower. This requires a way to know whether something may have been modified without actually querying it. For example, user profiles on a social network are normally only editable by their owner, so a simple rule is: always read the user's own profile from the leader, and other people's profiles from followers;
- If most things in the application can be edited by the user, the above approach does not work—most things would have to be read from the leader, negating the benefits of read scaling. In that case you can use other criteria, such as recording the time of the last update and routing all reads within one minute of an update to the leader; or monitoring the replication lag on followers and preventing any follower that is more than one minute behind the leader from serving queries;
- The client can remember the timestamp of its most recent write, and the system ensures that the replica serving reads for this user has at least reflected updates up to that timestamp. If the replica is not sufficiently up to date, the read can be sent to another replica, or the query can wait until the replica catches up. The timestamp can be a **logical timestamp** (something that indicates the ordering of writes, such as the log sequence number) or the actual system clock, in which case clock synchronization becomes critical (Chapter 8);
- When replicas are distributed across multiple data centers (for proximity to users or for availability), there is additional complexity: any request that needs to be served by the leader must be routed to the data center containing the leader.

When the same user accesses the service from multiple devices—say a browser on a laptop and an app on a phone—there is another layer of difficulty. What is needed here is **cross-device** read-after-write consistency: if the user enters some information on one device, they should also see it on another device. Issues to consider:

- Remembering the timestamp of the user's last update becomes harder, because code on one device does not know what updates happened on another device; this metadata needs to be stored centrally;
- If replicas are distributed across different data centers, there is no guarantee that connections from different devices will be routed to the same data center (for example, the laptop uses home broadband while the phone uses the cellular network, and their network routes may be completely different). If your approach requires reading from the leader, you may need to route all requests from the same user's devices to the same data center first.

### Monotonic reads

The second example is a user seeing time move backward. This can happen when a user reads from different replicas several times.

For example, user 2345 makes the same query twice, first to a follower with little lag, then to a follower with greater lag (this is quite likely if the user refreshes a web page and each request is randomly routed to some server). The first query returns a comment that user 1234 just added, but the second query returns nothing, because the lagging follower has not received that write yet. What the second query sees is actually an earlier state of the system than the first query. If the first query had also returned nothing, it would not be a big deal—user 2345 probably would not know the comment existed at all; but a comment appearing and then disappearing is very confusing.

**Monotonic reads** guarantee that this anomaly does not occur. It is weaker than strong consistency but stronger than eventual consistency: reads may see old values, but monotonic reads only guarantee that when the same user makes several reads in sequence, they will not see time move backward—that is, after reading newer data, they will not later read older data.

One way to implement it is to make sure each user always reads from the same replica (different users can read from different replicas), for example by choosing the replica based on a hash of the user ID rather than randomly. However, if that replica fails, the user's queries will need to be rerouted to another replica.

### Consistent prefix reads

The third example violates causality. The book uses a conversation between Mr. Poons and Mrs. Cake. Mr. Poons asks: "Mrs. Cake, how far into the future can you see?" Mrs. Cake replies: "About ten seconds usually, Mr. Poons."

There is a causal relationship between the two sentences: Mrs. Cake replies only after hearing the question. Now suppose a third person is observing this conversation through followers. Mrs. Cake's words go through a follower with little lag, while Mr. Poons's words go through a follower with greater lag, so the observer hears the answer before the question—as if Mrs. Cake had answered before Mr. Poons even spoke. This kind of foresight may be impressive, but it is baffling.

![Two time bars: Mr. Poons's question is written to partition 1, with very high replication lag, so it reaches the follower very late; Mrs. Cake's answer is written to partition 2 after the question, with very low replication lag, so it reaches the follower quickly. The observer reads from the follower and sees the answer before the question](./consistent-prefix.en.svg "Figure 2: The two sentences are written to two different partitions; each horizontal bar runs from the write to the leader to its replication on the follower. The answer is written later, but because it replicates faster, the observer reads it first.")

Preventing this anomaly requires another guarantee, called **consistent prefix reads**: if a sequence of writes happens in some order, anyone reading those writes sees them in the same order.

This is especially a problem in partitioned (sharded) databases. If the database always applies writes in the same order, reads always see a consistent prefix, so this anomaly cannot occur. But in many distributed databases, different partitions operate independently, so there is no global ordering of writes: when you read from the database, you may see some parts in an older state and others in a newer state.

One solution is to make sure any causally related writes are written to the same partition, but some applications cannot do this efficiently. There are also algorithms that explicitly track causal dependencies, which we will come to when discussing the "happens-before" relationship.

### Solutions for replication lag

When working with an eventually consistent system, it is worth thinking about what happens to the application if the replication lag increases to minutes or even hours. If the answer is "no problem," that is fine; if the user experience would be bad, design the system to provide stronger guarantees, such as read-after-write consistency. The book puts it bluntly:

> Pretending that replication is synchronous when in fact it is asynchronous is a recipe for problems down the line.

An application can provide stronger guarantees than the underlying database, for example by routing certain reads to the leader. But handling these issues in application code is complex and error-prone. It would be much better if application developers did not have to worry about these subtle replication issues and could simply trust that the database will "do the right thing." This is exactly why **transactions** exist: they are a way for the database to provide stronger guarantees so that applications can be simpler.

Transactions on a single node have existed for a long time. But in the move to distributed (replicated and partitioned) databases, many systems abandoned transactions, claiming that they are too expensive in performance and availability, and that eventual consistency is inevitable in scalable systems. There is some truth to this, but it is overly simplistic, and the book develops a more nuanced view later: Chapters 7 and 9 return to transactions, and Part III discusses some other mechanisms.

## Multi-leader replication

Leader-based replication has one major downside: there is only one leader, and all writes must go through it[^partition-leader]. If you cannot connect to the leader for any reason (for example, the network between you and the leader is down), you cannot write to the database.

A natural extension is to allow more than one node to accept writes. Replication still works the same way: each node that processes a write must forward the data change to all the other nodes. This is called a **multi-leader** configuration, also known as master-master or active/active replication. In this setup, each leader is simultaneously a follower of the other leaders.

### Use cases for multi-leader replication

Using multi-leader replication within a single data center is almost always not worth it: the benefits rarely outweigh the added complexity. But there are several situations where it is reasonable.

#### Multiple data centers

Suppose the database's replicas are spread across several data centers (perhaps to tolerate the loss of an entire data center, or to be closer to users). With ordinary leader-based replication, the leader can only be in one of the data centers, and all writes must go through that data center.

A multi-leader configuration can have one leader in each data center: within each data center, regular leader–follower replication is used; between data centers, each data center's leader replicates its changes to the leaders of the other data centers.

A comparison of the two configurations in a multi-data-center deployment:

| | Single-leader | Multi-leader |
| --- | --- | --- |
| Performance | Every write must travel over the internet to the data center with the leader, which can add significant write latency and defeats the purpose of having multiple data centers | Every write is processed in the local data center and then replicated asynchronously to the other data centers, so users do not feel the inter-data-center network latency |
| Tolerance of data center outages | If the data center with the leader fails, a failover is needed to promote a follower in another data center to leader | Each data center can continue operating independently of the others, and replication catches up when the failed data center recovers |
| Tolerance of network problems | Traffic between data centers usually goes over the public internet, which is less reliable than the local network within a data center; writes must go through this link synchronously, making them very sensitive to its problems | Asynchronous replication usually tolerates network problems better; a temporary network interruption does not prevent writes |

Some databases support multi-leader configurations by default, but it is also often implemented with external tools, such as Tungsten Replicator for MySQL, BDR for PostgreSQL, and GoldenGate for Oracle.

Multi-leader replication has many benefits, but it also has a big downside: the same data may be modified concurrently in two data centers, and these **write conflicts** must be resolved (see "Handling write conflicts" below). Moreover, in many databases multi-leader replication is a feature added later, often with subtle configuration pitfalls, and it can interact with other database features (such as auto-incrementing keys, triggers, and integrity constraints) in surprising ways. For these reasons, multi-leader replication is often considered dangerous territory that should be avoided if possible.

#### Clients with offline operation

Another situation is when an application needs to keep working while disconnected from the network. For example, calendar apps on phones, laptops, and other devices: regardless of whether the device currently has a network connection, you need to be able to view meetings (read requests) and add new meetings (write requests) at any time. Changes made while offline need to be synced with the server and other devices the next time the device connects to the network.

In this case, every device has a local database that acts as a leader (it accepts writes), and there is an asynchronous multi-leader replication process (the sync) among the calendar replicas on all devices. The replication lag may be hours or even days, depending on when the device can get online.

Architecturally, this is essentially the same as multi-leader replication between data centers, taken to an extreme: each device is a "data center," and the network connections between them are extremely unreliable. The long history of broken calendar sync implementations shows how hard multi-leader replication is to get right. Some tools aim to make this kind of multi-leader configuration easier—CouchDB, for example, is designed for this mode of operation.

#### Collaborative editing

**Real-time collaborative editing** applications allow several people to edit a document simultaneously, such as Etherpad and Google Docs. We do not usually think of collaborative editing as a database replication problem, but it has a lot in common with the offline editing case: when one user edits a document, the changes are applied instantly to their local replica (the document state in the browser or client application) and then asynchronously replicated to the server and to any other users editing the same document.

To guarantee no editing conflicts, the application must obtain a lock on the document before a user can edit it; if another user wants to edit, they must wait until the first user commits their changes and releases the lock. This collaboration model is equivalent to single-leader replication with transactions on the leader. But for faster collaboration, you may want the unit of change to be very small (a single keystroke, for example) and avoid locking. This allows multiple users to edit simultaneously, but it also brings all the challenges of multi-leader replication, including the need to resolve conflicts.

### Handling write conflicts

The biggest problem with multi-leader replication is that write conflicts can occur, so conflict resolution is needed.

For example, suppose a wiki page is edited simultaneously by two users: user 1 changes the page title from A to B, and user 2 changes it from A to C at the same time. Each user's change is successfully applied to their respective local leader, but when the changes are asynchronously replicated, a conflict is discovered. A single-leader database would not have this problem.

#### Synchronous versus asynchronous conflict detection

In a single-leader database, the second writer either blocks and waits for the first write to complete, or is aborted and must retry. In a multi-leader setup, both writes succeed, and the conflict is only detected asynchronously at some later time—by which point it may be too late to ask the user to resolve it.

In principle, conflict detection could be made synchronous: wait until the write has been replicated to all replicas before telling the user it succeeded. But that would lose the main advantage of multi-leader replication, which is allowing each replica to accept writes independently. If you want synchronous conflict detection, you might as well just use single-leader replication.

#### Conflict avoidance

The simplest strategy for dealing with conflicts is to avoid them: if the application can ensure that all writes to a particular record go through the same leader, conflicts cannot occur. Since many multi-leader replication implementations handle conflicts quite poorly, conflict avoidance is often the recommended approach.

For example, in an application where users edit their own data, you can ensure that requests from a particular user are always routed to the same data center and use that data center's leader for both reads and writes. Different users may have different "home" data centers (perhaps chosen by geographic proximity), but from any one user's perspective, the configuration is essentially single-leader.

However, sometimes you need to change the designated leader for a record—for example, if a data center fails and you need to reroute traffic to another data center, or if a user has moved and is now closer to a different data center. In these situations, conflict avoidance breaks down, and you must deal with the possibility of concurrent writes on different leaders.

#### Converging toward a consistent state

A single-leader database applies writes in order: if the same field is updated several times, the last write determines its final value. In a multi-leader configuration, writes have no defined order, so it is unclear what the final value should be. In the wiki example, the title becomes B and then C on leader 1, and C and then B on leader 2—neither order is more "correct" than the other.

If each replica simply applies writes in the order it sees them, the database will end up in an inconsistent state: leader 1 has C and leader 2 has B. This is unacceptable—any replication scheme must ensure that the data is eventually the same on all replicas. So the database must resolve conflicts in a **convergent** way: after all changes have been replicated, all replicas arrive at the same final value. There are several ways to achieve convergent conflict resolution:

- Give each write a unique ID (such as a timestamp, a long random number, a UUID, or a hash of the key and value), pick the write with the highest ID as the winner, and discard the others. When timestamps are used, this is called **last write wins** (LWW). It is popular, but it is prone to losing data;
- Give each replica a unique ID, and let writes that originated at a higher-numbered replica always take precedence. This also implies data loss;
- Somehow merge the values together—for example, sort them alphabetically and concatenate them (in the wiki example, the merged title might be "B/C");
- Record the conflict in an explicit data structure that preserves all information, and write application code to resolve the conflict at some later time (perhaps by prompting the user).

#### Custom conflict resolution logic

The most appropriate way to resolve a conflict often depends on the application, so most multi-leader replication tools let you write conflict resolution logic in application code. This code may be executed on write or on read:

- **On write**: as soon as the database system detects a conflict in the replicated change log, it calls the conflict handler. For example, Bucardo allows you to write a snippet of Perl for this purpose. This handler typically cannot prompt the user—it runs in a background process and must execute quickly;
- **On read**: when a conflict is detected, all the conflicting writes are stored. The next time the data is read, these multiple versions are returned to the application. The application may prompt the user or automatically resolve the conflict, and then write the result back to the database. CouchDB works this way.

Note that conflict resolution usually applies to a single row or document, not to an entire transaction. If a transaction atomically makes several writes (Chapter 7), each write is still considered separately for conflict resolution.

#### Automatic conflict resolution

Conflict resolution rules can quickly become complicated, and custom code is error-prone. Amazon is a frequently cited example: for a while, the conflict resolution logic for shopping carts preserved items added to the cart but not items removed from it, so customers would sometimes see deleted items reappear in their carts.

There is research into automatically resolving conflicts caused by concurrent modifications to data:

| Direction | Approach |
| --- | --- |
| Conflict-free replicated datatypes (CRDTs) | A family of data structures that can be concurrently edited by multiple users—sets, maps, ordered lists, counters, and so on—which can resolve conflicts automatically in sensible ways. Riak 2.0 implements some of them |
| Mergeable persistent data structures | Track history explicitly, like Git, and use a three-way merge function (CRDTs use two-way merges) |
| Operational transformation (OT) | The conflict resolution algorithm behind collaborative editing applications such as Etherpad and Google Docs, designed specifically for concurrent editing of an ordered list (such as the list of characters that make up a text document) |

At the time the book was written, these algorithms were still young in database implementations, but they are likely to be integrated into more replicated data systems. Automatic conflict resolution could make multi-leader data synchronization much simpler for applications to handle.

#### What is a conflict?

Some conflicts are obvious. In the wiki example, two writes concurrently modified the same field of the same record, setting it to two different values.

Other conflicts are more subtle. Consider a meeting room booking system that tracks which room is booked by which group at what time. The application needs to ensure that each room is only booked by one group at any given time—that is, bookings for the same room must not overlap. In this case, two different bookings for the same room at the same time are a conflict. Even if the application checks whether the room is free before allowing a booking, the conflict still occurs when the two bookings are made on two different leaders.

There is no quick ready-made answer to this problem. Chapter 7 shows more examples of conflicts, and Chapter 12 discusses scalable approaches to detecting and resolving conflicts in replicated systems.

### Multi-leader replication topologies

A **replication topology** describes the communication paths along which writes are propagated from one node to another. With only two leaders, there is only one topology: leader 1 sends all its writes to leader 2, and vice versa. With more than two leaders, several topologies are possible:

- **All-to-all**: every leader sends its writes to every other leader. This is the most general topology;
- **Circular**: each node receives writes from one node and forwards those writes (plus its own writes) to another node. MySQL by default supports only a circular topology;
- **Star**: one designated root node forwards writes to all other nodes. The star can be generalized to a tree.

In circular and star topologies, a write may need to pass through several nodes before it reaches all replicas, so nodes need to forward data changes received from other nodes. To prevent infinite replication loops, each node is given a unique identifier, and each write in the replication log is tagged with the identifiers of all the nodes it has passed through. When a node receives a data change tagged with its own identifier, it knows the change has already been processed and ignores it.

The problem with circular and star topologies is that if just one node fails, it can interrupt the flow of replication messages between other nodes until the failed node is fixed. The topology can be reconfigured to route around the failed node, but in most deployments this has to be done manually. More densely connected topologies (such as all-to-all) are more fault-tolerant because messages can travel along different paths, avoiding a single point of failure.

But the all-to-all topology has its own problems: some network links may be faster than others (due to network congestion, for example), so some replication messages may "overtake" others. For instance, client A inserts a row into a table on leader 1, and client B updates that row on leader 3. Leader 2 may receive the two writes in the opposite order: first the update (which, from its perspective, updates a row that does not exist in the database), then the corresponding insert (which should have come before the update).

This is a causality problem, similar to the one in consistent prefix reads: the update depends on the prior insert, so we need to ensure that all nodes process the insert before the update. Simply attaching a timestamp to each write is not enough, because there is no guarantee that clocks are synchronized well enough to correctly order these two events on leader 2 (Chapter 8).

To order these events correctly, a technique called **version vectors** can be used, discussed later in this chapter. But conflict detection in many multi-leader replication systems is poorly implemented. For example, at the time the book was written, PostgreSQL BDR did not provide causal ordering of writes, and MySQL's Tungsten Replicator did not even attempt to detect conflicts.

If you use a system with multi-leader replication, it is worth being aware of these issues, reading the documentation carefully, and thoroughly testing the database to make sure it really provides the guarantees you think it does.

## Leaderless replication

The single-leader and multi-leader replication approaches discussed so far are based on the same idea: clients send write requests to one node (the leader), and the database system takes care of replicating the write to the other replicas. The leader decides the order in which writes are processed, and followers apply the leader's writes in the same order.

Some data stores take a different approach: they abandon the concept of a leader and allow any replica to accept writes from clients directly. Some of the earliest replicated data systems were leaderless, but the idea was mostly forgotten during the era when relational databases dominated. After Amazon used it in its internal Dynamo system, it became a fashionable database architecture again[^dynamo]. Riak, Cassandra, and Voldemort are open source data stores inspired by Dynamo that use leaderless replication, so this class of databases is also called **Dynamo-style** databases[^riak].

In some leaderless implementations, the client sends its writes directly to several replicas; in others, a **coordinator node** sends them on behalf of the client. Unlike a leader, however, the coordinator does not enforce a particular ordering of writes. As we will see, this design difference has profound consequences for how the database is used.

### Writing to the database when a node is down

Imagine a database with three replicas, one of which is temporarily unavailable—perhaps it is rebooting to install a system update. In a leader-based configuration, you might need a failover to continue processing writes. In a leaderless configuration, failover does not exist: the client (user 1234) sends its writes to all three replicas in parallel, and the two available replicas accept the write while the unavailable one misses it. Suppose it is sufficient for two of the three replicas to acknowledge the write: user 1234 receives two ok responses and considers the write successful, and the fact that one replica missed the write is simply ignored by the client.

Now suppose the unavailable node comes back online, and clients start reading from it. It does not have any of the writes that happened while it was down, so reads from it may return stale (outdated) values.

To solve this problem, when a client reads from the database, it does not just send its request to one replica: it sends the read request to several nodes in parallel. The client may get different responses from different nodes—one node may have the latest value while another has a stale one—and it uses **version numbers** to determine which value is newer (see "Detecting concurrent writes" later).

#### Read repair and anti-entropy

A replication scheme should ensure that all data is eventually copied to every replica. When an unavailable node comes back, how does it catch up on the writes it missed? Dynamo-style data stores often use two mechanisms:

- **Read repair**: when a client reads from several nodes in parallel, it can detect stale responses. For example, user 2345 reads a value at version 6 from replica 3 and a value at version 7 from replicas 1 and 2; the client then knows that replica 3 has a stale value and writes the newer value back to that replica. This approach works well for values that are frequently read;
- **Anti-entropy**: some data stores also have a background process that constantly looks for differences in the data between replicas and copies any missing data from one replica to another. Unlike the replication log in leader-based replication, the anti-entropy process does not copy writes in any particular order, and there may be a significant delay before data is copied.

Not all systems implement both mechanisms; Voldemort, for example, had no anti-entropy process at the time. Without an anti-entropy process, values that are rarely read may be missing from some replicas indefinitely, reducing durability, because read repair only happens when an application reads the value.

### Quorums for reading and writing

In the example above, the write was considered successful even though it was processed on only two of the three replicas. What if only one replica had accepted the write? How low can this number go?

If we know that every successful write is guaranteed to be present on at least two of the three replicas, that means at most one replica can be stale. So by reading from at least two replicas, we can be sure that at least one of them is up to date. If the third replica is down or slow to respond, reads can still return an up-to-date value.

More generally, if there are n replicas, every write must be confirmed by w nodes to be considered successful, and every read must query at least r nodes. (In the example above, n = 3, w = 2, r = 2.) As long as w + r > n, we expect to get an up-to-date value when reading, because at least one of the r nodes we read from must be up to date. Reads and writes that obey these r and w values are called **quorum** reads and writes[^strict]. You can think of r and w as the minimum number of votes required for the read or write to be valid.

In Dynamo-style databases, the parameters n, w, and r are typically configurable. A common choice is to make n an odd number (typically 3 or 5) and set w = r = (n + 1) / 2 (rounded up). But you can vary the numbers as you see fit. For example, a workload with few writes and many reads may benefit from setting w = n and r = 1, which makes reads faster, but has the downside that just one failed node causes all writes to fail[^n-nodes].

The quorum condition w + r > n allows the system to tolerate unavailable nodes as follows:

- If w < n, we can still process writes if a node is unavailable;
- If r < n, we can still process reads if a node is unavailable;
- With n = 3, w = 2, r = 2, we can tolerate one unavailable node;
- With n = 5, w = 3, r = 3, we can tolerate two unavailable nodes.

![Five nodes in a row: nodes 1 through 3 have the new value v7, while nodes 4 and 5 missed this write and still have the old value v6. A dimension line above marks the three nodes the write succeeded on (nodes 1 through 3), and a dimension line below marks the three nodes that answered the read (nodes 3 through 5). The two overlap at node 3, so the read responses are guaranteed to include v7](./quorum.en.svg "Figure 3: n = 5, w = 3, r = 3. The nodes the write succeeded on and the nodes that answered the read overlap in at least one node, so among the read responses, the one with the highest version number is the latest value.")

Normally, reads and writes are always sent to all n replicas in parallel; the parameters w and r determine how many nodes we wait for—that is, how many of the n nodes need to report success before we consider the read or write successful.

If fewer than the required w or r nodes are available, the write or read returns an error. A node can be unavailable for many reasons: it is down (crashed, powered off), an operation on it failed (for example, the disk is full and the write cannot be completed), the network between the client and the node is interrupted, and so on. We only care about whether the node returned a successful response; we do not need to distinguish between the kinds of faults.

### Limitations of quorum consistency

If you have n replicas and choose w and r such that w + r > n, you can generally expect every read to return the most recent value written for a key, because the set of nodes written to and the set of nodes read from must overlap—at least one of the nodes you read from has the latest value.

Often, r and w are chosen to be a majority (more than n/2) of nodes, because that ensures w + r > n while still tolerating up to n/2 node failures. But quorums do not necessarily have to be majorities—it only matters that the sets of nodes used by the read and write operations overlap in at least one node. Other assignments are possible, which gives some flexibility in the design of distributed algorithms.

You can also set w and r to smaller numbers, so that w + r ≤ n, meaning the quorum condition is not satisfied. In this case, reads and writes will still be sent to n nodes, but fewer successful responses are required. With smaller w and r, you are more likely to read stale values, because it is more likely that your read did not include the node with the latest value. On the upside, this configuration allows lower latency and higher availability: if a network interruption makes many replicas unreachable, there is a better chance that reads and writes can still be processed—only if fewer than w or r replicas are reachable does the database become unavailable for writes or reads, respectively.

However, even with w + r > n, there are edge cases where stale values can be returned. Depending on the implementation, these include:

1. If a sloppy quorum is used (see the next section), the w writes may end up on different nodes than the r reads, so there is no longer a guaranteed overlap between the read and write sets;
2. If two writes occur concurrently, it is not clear which one happened first. The only safe solution is to merge the concurrent writes (see "Handling write conflicts" earlier). If a winner is picked based on a timestamp (last write wins), writes can be lost due to clock skew, as discussed in "Detecting concurrent writes" later;
3. If a write happens concurrently with a read, the write may be reflected on only some of the replicas, and it is undetermined whether the read returns the old or the new value;
4. If a write succeeds on some replicas but fails on others (for example, because the disks on some nodes are full), and the total number of successful replicas is less than w, the replicas where it succeeded will not be rolled back. This means that a write that was reported as failed may or may not be visible to subsequent reads;
5. If a node carrying a new value fails, and its data is restored from a replica carrying an old value, the number of replicas with the new value may fall below w, breaking the quorum condition;
6. Even if everything is working correctly, there are edge cases with unfortunate timing, as we will see in Chapter 9 on linearizability and quorums.

Thus, although quorums appear to guarantee that a read returns the latest written value, in practice it is not so simple. Dynamo-style databases are generally optimized for use cases that can tolerate eventual consistency. The parameters w and r allow you to adjust the probability of reading stale values, but it is wise not to treat them as absolute guarantees.

In particular, the guarantees discussed earlier in "Problems with replication lag" (read-your-writes, monotonic reads, consistent prefix reads) usually do not hold here, and those anomalies can still occur in applications. Stronger guarantees generally require transactions or consensus, discussed in Chapters 7 and 9.

#### Monitoring staleness

From an operational perspective, it is important to monitor whether your databases are returning up-to-date results. Even if your application can tolerate stale reads, you need to understand the health of your replication: if it falls significantly behind, it should alert you so you can investigate the cause (for example, a problem in the network or an overloaded node).

For leader-based replication, the database typically exposes metrics for the replication lag, which can be fed into a monitoring system. This is possible because writes are applied to the leader and followers in the same order, and each node has a position in the replication log (the number of writes it has applied locally). By subtracting a follower's current position from the leader's current position, you can measure the amount of replication lag.

In systems with leaderless replication, there is no fixed order in which writes are applied, which makes monitoring more difficult. Moreover, if the database only uses read repair (no anti-entropy), there is no limit to how old a value might be: if a value is only rarely read, the value returned by a stale replica may be very old.

There has been some research on measuring replica staleness in databases with leaderless replication and predicting the proportion of stale reads based on the parameters n, w, and r[^pbs], but it is not yet common practice. The book's view is that staleness should be a standard metric in databases: eventual consistency is a deliberately vague guarantee, but for operability, it should be possible to quantify "eventually."

### Sloppy quorums and hinted handoff

Quorums that are appropriately configured allow the database to tolerate the failure of individual nodes without needing failover; they can also tolerate individual slow nodes, because requests do not have to wait for all n nodes to respond—they can return once w or r nodes have responded. These characteristics make databases with leaderless replication appealing for use cases that require high availability and low latency, and that can tolerate occasional stale reads.

However, quorums as described so far are not as fault-tolerant as they could be. A network interruption can easily cut off a client from a large number of database nodes. Those nodes may still be alive, and other clients may be able to reach them, but to the client that is cut off, they might as well be dead. In this situation, it is quite likely that fewer than w or r reachable nodes remain, so the client can no longer reach a quorum.

In a large cluster (with significantly more than n nodes), it is likely that the client can still connect to some database nodes during a network interruption, just not to the nodes that it needs to assemble a quorum for a particular value. In that case, the database designers face a trade-off:

- Is it better to return errors to all requests for which we cannot reach a quorum of w or r nodes?
- Or should we accept writes anyway, and write them to some nodes that are reachable but are not among the n nodes on which the value usually lives?

The latter is known as a **sloppy quorum**: writes and reads still require w and r successful responses, but those may include nodes that are not among the designated n "home" nodes for a value. By analogy, if you lock yourself out of your house, you may knock on the neighbor's door and ask whether you may stay on their couch temporarily.

Once the network interruption is fixed, any writes that one node temporarily accepted on behalf of another node are sent to the appropriate "home" nodes. This is called **hinted handoff**. (Once you find the keys to your house, your neighbor politely asks you to get off their couch and go home.)

Sloppy quorums are particularly useful for increasing write availability: as long as any w nodes are available, the database can accept writes. However, this means that even when w + r > n, you cannot be sure to read the latest value for a key, because the latest value may have been temporarily written to some nodes outside the set of n.

Thus, a sloppy quorum is not actually a quorum at all in the traditional sense. It is only an assurance of durability, namely that the data is stored on w nodes somewhere. There is no guarantee that a read of r nodes will see it until the hinted handoff has completed.

In common Dynamo implementations, sloppy quorums are optional: Riak enables them by default, while Cassandra and Voldemort disable them by default.

#### Multi-data-center operation

Earlier we discussed cross-data-center replication as a use case for multi-leader replication. Leaderless replication is also suitable for multi-data-center operation, since it is designed to tolerate conflicting concurrent writes, network interruptions, and latency spikes.

Cassandra and Voldemort implement multi-data-center support within the normal leaderless model: the number of replicas n includes nodes in all data centers, and in the configuration you can specify how many of the n replicas you want to have in each data center. Each write from a client is sent to all replicas, regardless of data center, but the client usually only waits for acknowledgment from a quorum of nodes within its local data center, so that it is not affected by delays and interruptions on the cross-data-center link. The higher-latency writes to other data centers are often configured to happen asynchronously, although there is some flexibility in configuration.

Riak, on the other hand, keeps all communication between clients and database nodes local to one data center, so n describes the number of replicas within one data center. Cross-data-center replication between database clusters happens asynchronously in the background, in a style similar to multi-leader replication.

### Detecting concurrent writes

Dynamo-style databases allow several clients to concurrently write to the same key, which means that conflicts will occur even if a strict quorum is used. The situation is similar to multi-leader replication, but in Dynamo-style databases, conflicts can also arise during read repair and hinted handoff.

The problem is that events may arrive in a different order at different nodes, due to variable network delays and partial failures. For example, suppose two clients, A and B, simultaneously write to a key X in a three-node data store:

- Node 1 receives the write from A, but never receives the write from B due to a transient outage;
- Node 2 first receives the write from A, then the write from B;
- Node 3 first receives the write from B, then the write from A.

If each node simply overwrote the value for the key whenever it received a write request, the nodes would become permanently inconsistent: node 2 thinks the final value of X is B, while the other nodes think it is A.

In order to become eventually consistent, the replicas should converge toward the same value. How do they achieve that? One might hope that replicated databases would handle this automatically, but unfortunately most implementations are quite poor: if you want to avoid losing data, you—the application developer—need to know a lot about the internals of your database's conflict handling. The "Handling write conflicts" section earlier briefly covered some techniques for conflict resolution; before this chapter ends, let's look at the problem in a bit more detail.

#### Last write wins

One approach to achieving eventual convergence is to declare that each replica need only store the most "recent" value and allow "older" values to be overwritten and discarded. Then, as long as we have some way of unambiguously determining which write is more "recent," and every write is eventually copied to every replica, the replicas will eventually converge to the same value.

The word "recent" is in quotes because this idea is actually quite misleading. In the example above, neither client knew about the other one when it sent its write request, so it is unclear which one happened first. In fact, it does not really make sense to say which one "happened first": the two writes are **concurrent**, and their order is undefined.

Even though the writes do not have a natural ordering, we can impose an arbitrary order on them. For example, we can attach a timestamp to each write, pick the biggest timestamp as the most "recent," and discard any writes with an earlier timestamp. This conflict resolution algorithm is called **last write wins** (LWW), and it is the only conflict resolution method supported in Cassandra, and an optional feature in Riak.

LWW achieves the goal of eventual convergence, but at the cost of durability: if there are several concurrent writes to the same key, even if they were all reported as successful to the client (because they were written to w replicas), only one of the writes will survive and the others will be silently discarded. Moreover, as Chapter 8 will show, LWW may even drop writes that are not concurrent.

There are some situations, such as caching, in which lost writes are acceptable. If losing data is not acceptable, LWW is a poor choice for conflict resolution. The only safe way of using a database with LWW is to ensure that a key is only written once and then treated as immutable, thus avoiding any concurrent updates to the same key. For example, a recommended way of using Cassandra is to use a UUID as the key, thus giving each write operation a unique key.

#### The "happens-before" relationship and concurrency

How do we decide whether two operations are concurrent or not? Consider two examples:

- In the insert-and-update example from the all-to-all topology earlier, the two writes are not concurrent: A's insert happened before B's update, because B's update was applied to the row that A inserted. In other words, B's operation was built upon A's operation, so B's operation must have occurred later. We can also say that B is **causally dependent** on A;
- In the example with key X, the two writes are concurrent: when each client started its operation, it did not know that another client was also performing an operation on the same key, and there is no causal dependency between the two operations.

An operation A **happens before** another operation B if B knows about A, or depends on A, or builds upon A in some way. Whether one operation happens before another is the key to defining what concurrency means: if neither operation knows about the other, they are said to be concurrent.

Thus, for any two operations A and B, there are only three possibilities: A happened before B, B happened before A, or A and B are concurrent. We need an algorithm to determine whether two operations are concurrent: if one happened before the other, the later operation should overwrite the earlier one; if the operations are concurrent, we have a conflict that needs to be resolved.

"Concurrent" sounds like it means "happened at the same time," but whether the operations actually overlapped in time does not matter. Because of the problems with clocks in distributed systems (Chapter 8), it is actually quite difficult to tell whether two things happened at exactly the same time. For defining concurrency, exact time does not matter: we simply call two operations concurrent if they are unaware of each other, regardless of the physical time at which they occurred. People sometimes make a connection between this principle and special relativity: information cannot travel faster than the speed of light, so two events that are far apart in space cannot affect each other if the time between them is shorter than the time it takes light to travel the distance. In computer systems, two operations might be concurrent even when the speed of light would in principle have allowed one operation to affect the other: for example, if the network was slow or interrupted at the time, two operations can occur some time apart and still be concurrent, because the network problems prevented one operation from knowing about the other.

#### Capturing the happens-before relationship

Let's look at an algorithm for determining whether two operations are concurrent, or whether one happened before another. For simplicity, start with a database with only one replica, figure out how it works on a single replica, and then generalize to a leaderless database with multiple replicas.

The book's example is two clients concurrently adding items to the same shopping cart (if this example seems too mundane, imagine two air traffic controllers concurrently adding aircraft to the sector they are tracking). The cart starts out empty, and the two clients make a total of five writes to the database:

| Step | Client's write | Version number carried | Value on the server after the write |
| --- | --- | --- | --- |
| 1 | Client 1 adds milk: [milk] | none | v1 [milk] |
| 2 | Client 2 adds eggs: [eggs], unaware that client 1 added milk | none | v1 [milk], v2 [eggs] |
| 3 | Client 1 adds flour: [milk, flour] | 1 | v2 [eggs], v3 [milk, flour] |
| 4 | Client 2 merges the two values it received last time and adds ham: [eggs, milk, ham] | 2 | v3 [milk, flour], v4 [eggs, milk, ham] |
| 5 | Client 1 merges the two values it received last time and adds bacon: [milk, flour, eggs, bacon] | 3 | v4 [eggs, milk, ham], v5 [milk, flour, eggs, bacon] |

After each write, the server returns all current values together with the latest version number to the client. In step 3, the server sees from version number 1 that [milk, flour] supersedes [milk] but is concurrent with [eggs], so it overwrites v1 and keeps v2; in step 4, version number 2 shows that [eggs, milk, ham] supersedes [eggs] but is concurrent with [milk, flour]; step 5 is similar. In this example, the clients are never fully caught up with the data on the server, since there is always another operation going on concurrently. But old versions of the value are eventually overwritten, and no writes are lost.

Note that the server can determine whether two operations are concurrent by looking at the version numbers alone—it does not need to interpret the value itself (so the value can be any data structure). The algorithm works as follows:

- The server maintains a version number for every key, increments the version number every time that key is written, and stores the new version number along with the value written;
- When a client reads a key, the server returns all values that have not been overwritten, as well as the latest version number. A client must read a key before writing;
- When a client writes a key, it must include the version number from the prior read, and it must merge together all values that it received in the prior read. (The response from a write request can be like a read, returning all current values, which allows you to chain several writes like in the shopping cart example.)
- When the server receives a write with a particular version number, it can overwrite all values with that version number or below (since it knows that they have been merged into the new value), but it must keep all values with a higher version number (because those values are concurrent with the incoming write).

When a write includes the version number from a prior read, it tells us which previous state the write is based on. A write without a version number is concurrent with all other writes, so it will not overwrite anything—it will just be returned as one of the values on subsequent reads.

#### Merging concurrently written values

This algorithm ensures that no data is silently dropped, but unfortunately it requires some work on the part of the client: if several operations happen concurrently, clients have to clean up afterward by merging the concurrently written values. Riak calls these concurrent values **siblings**.

Merging sibling values is essentially the same problem as conflict resolution in multi-leader replication, which we discussed earlier. A simple approach is to just pick one of the values based on a version number or timestamp (last write wins), but that implies losing data, so you may need to do something more intelligent in application code.

With the example of a shopping cart, a reasonable approach to merging siblings is to just take the union. In the example above, the final two sibling values are [milk, flour, eggs, bacon] and [eggs, milk, ham]; note that milk and eggs appear in both, even though each of them was only written once. The merged value might be something like [milk, flour, eggs, bacon, ham], without duplicates.

However, if you also allow people to remove things from their carts, taking the union of siblings may not yield the right result: if an item has been removed in only one of the sibling carts, then it will reappear in the union of the siblings. To prevent this problem, an item cannot simply be deleted from the database when it is removed; instead, the system must leave a marker with an appropriate version number to indicate that the item has been removed when merging siblings. Such a deletion marker is known as a **tombstone**, which we saw in the third post when discussing log compaction for hash indexes.

Merging siblings in application code is complex and error-prone, so there are efforts to design data structures that can perform this merging automatically, as discussed in "Automatic conflict resolution" earlier. For example, Riak's datatype support uses a family of data structures called CRDTs that can automatically merge siblings in sensible ways, including preserving deletions.

#### Version vectors

The example with the shopping cart used only a single replica. How does the algorithm change when there are multiple replicas, but no leader?

The shopping cart example used a single version number to capture dependencies between operations, but that is not sufficient when there are multiple replicas accepting writes concurrently. Instead, we need a version number per replica as well as per key: each replica increments its own version number when processing a write, and also keeps track of the version numbers it has seen from each of the other replicas. This information indicates which values to overwrite and which values to keep as siblings.

The collection of version numbers from all the replicas is called a **version vector**. A few variants of this idea are in use, but the most interesting is probably the **dotted version vector**, which is used in Riak 2.0. The book does not go into the details, but the way it works is quite similar to what we saw in the shopping cart example.

Like the version numbers in the shopping cart example, version vectors are sent from the database replicas to clients when values are read, and need to be sent back to the database when a value is subsequently written. (Riak encodes the version vector as a string called the **causal context**.) The version vector allows the database to distinguish between overwrites and concurrent writes.

Also like in the single-replica example, the application may need to merge siblings. The version vector structure ensures that it is safe to read from one replica and subsequently write back to another replica. Doing so may result in siblings being created, but no data is lost as long as siblings are merged correctly.

Version vectors are sometimes also called **vector clocks**, even though they are not quite the same. The difference is subtle, and the book refers readers to the references; in brief, when comparing the state of replicas, version vectors are the right data structure to use.

## Summary

This chapter was about replication. Replication can serve several purposes:

- **High availability**: keeping the system running even when one machine (or several machines, or an entire data center) goes down;
- **Continued operation during network interruptions**: allowing the application to keep working when the network is interrupted;
- **Latency**: placing data geographically close to users, so that users can interact with it faster;
- **Scalability**: being able to handle a higher volume of reads than a single machine could process, by serving reads on replicas.

Keeping copies of the same data on several machines sounds like a simple goal, but replication turns out to be a remarkably tricky problem. It requires carefully thinking about concurrency and about all the things that can go wrong, and dealing with the consequences of those faults. At a minimum, we need to deal with unavailable nodes and network interruptions, and that is not even considering more subtle faults, such as silent data corruption due to software bugs.

The three main approaches to replication:

| Approach | How it works |
| --- | --- |
| Single-leader replication | Clients send all writes to a single node (the leader), which sends a stream of data change events to the other replicas (followers). Reads can be performed on any replica, but reads from followers might be stale |
| Multi-leader replication | Clients send each write to one of several leader nodes, any of which can accept writes. The leaders send streams of data change events to each other and to any followers |
| Leaderless replication | Clients send each write to several nodes, and read from several nodes in parallel in order to detect and correct nodes with stale data |

Each approach has advantages and disadvantages. Single-leader replication is popular because it is fairly easy to understand and there is no conflict resolution to worry about. Multi-leader and leaderless replication can be more robust in the presence of faulty nodes, network interruptions, and latency spikes, at the cost of being harder to reason about and providing only very weak consistency guarantees.

Replication can be synchronous or asynchronous, which has a profound effect on the system behavior when there is a fault. Although asynchronous replication can be fast when the system is running smoothly, it is important to figure out what happens when replication lag increases and servers fail: if a leader fails and you promote an asynchronously updated follower to be the new leader, recently committed data may be lost.

This chapter also looked at some strange effects that can be caused by replication lag, and a few consistency models that help decide how an application should behave under replication lag:

- **Read-after-write consistency**: users should always see data that they submitted themselves;
- **Monotonic reads**: after users have seen the data at one point in time, they should not later see the data from an earlier point in time;
- **Consistent prefix reads**: users should see the data in a state that makes causal sense, for example seeing a question before its answer.

Finally, multi-leader and leaderless replication allow multiple writes to happen concurrently, so conflicts can occur. This chapter examined an algorithm that a database might use to determine whether one operation happened before another, or whether they happened concurrently; it also briefly touched on methods for resolving conflicts by merging together concurrent updates.

In the next chapter we will continue looking at data that is distributed across multiple machines, through the counterpart of replication: splitting a large dataset into partitions.

## Glossary

| English | Chinese | Meaning |
| --- | --- | --- |
| shared-memory / shared-disk architecture | 共享内存 / 共享磁盘架构 | All components used as one machine / several machines sharing a disk array |
| shared-nothing architecture | 无共享架构 | Each node independently uses its own hardware, coordinating only over an ordinary network |
| node | 节点 | A machine or virtual machine running database software in a shared-nothing architecture |
| replication | 复制 | Keeping copies of the same data on several nodes |
| partitioning / sharding | 分区 / 分片 | Splitting a large database into subsets and placing them on different nodes |
| replica | 副本 | A node that stores a copy of the database |
| leader / follower | 领导者 / 追随者 | The replica that accepts writes / a read-only replica that applies the leader's writes according to the replication log |
| replication log / change stream | 复制日志 / 变更流 | The data changes the leader sends to its followers |
| synchronous / asynchronous replication | 同步复制 / 异步复制 | The leader does / does not wait for follower acknowledgment before reporting success to the client |
| semi-synchronous | 半同步 | One follower is synchronous, the rest asynchronous |
| chain replication | 链式复制 | A variant of synchronous replication where a write travels down a chain of nodes in sequence |
| log sequence number / binlog coordinates | 日志序列号 / binlog 坐标 | A position in the replication log, as called in PostgreSQL and MySQL respectively |
| catch-up recovery | 追赶恢复 | A follower uses its local log to request from the leader the changes it missed while disconnected |
| failover | 故障转移 | Promoting a follower to be the new leader |
| split brain | 脑裂 | Two nodes both believing they are the leader |
| fencing / STONITH | 隔离 | Shutting down one node when two leaders are detected |
| statement-based replication | 基于语句的复制 | Sending write statements to followers for execution |
| WAL shipping | 传输预写日志 | Sending the storage engine's write-ahead log to followers |
| logical (row-based) log | 逻辑日志（基于行） | A replication log that describes writes at row granularity and is decoupled from the storage engine |
| change data capture | 变更数据捕获 | Handing database changes to external systems |
| trigger-based replication | 基于触发器的复制 | Using triggers to record changes in a table, replicated by an external process |
| read-scaling architecture | 读扩展架构 | Scaling read capacity by adding followers |
| replication lag | 复制延迟 | The time from a write to the leader to its reflection on a follower |
| eventual consistency | 最终一致性 | After writes stop, the replicas will eventually become consistent |
| read-after-write consistency / read-your-writes | 写后读一致性 / 读己之写 | Users always see updates they submitted themselves |
| monotonic reads | 单调读 | After reading newer data, a user will not later read older data |
| consistent prefix reads | 一致前缀读 | Writes that happen in some order are seen by readers in that same order |
| multi-leader replication | 多领导者复制 | Allowing multiple nodes to accept writes; also called master-master replication |
| write conflict | 写冲突 | Concurrent modifications to the same data on different leaders |
| conflict avoidance | 避免冲突 | Routing all writes to a record through the same leader |
| convergent conflict resolution | 收敛的冲突解决 | After all changes have been replicated, all replicas arrive at the same value |
| last write wins (LWW) | 最后写入胜出 | Keeping the most "recent" write by timestamp and discarding the rest |
| CRDT | 无冲突复制数据类型 | Data structures that can automatically and sensibly merge concurrent modifications |
| operational transformation | 操作变换 | The conflict resolution algorithm behind collaborative editing applications |
| replication topology | 复制拓扑 | The paths along which writes propagate between nodes: all-to-all, circular, star |
| leaderless replication / Dynamo-style | 无领导者复制 / Dynamo 风格 | Any replica directly accepts writes from clients |
| coordinator node | 协调节点 | A node that sends reads and writes to replicas on behalf of a client, without enforcing a write order |
| read repair | 读修复 | Detecting a stale replica during a read and writing the new value back to it |
| anti-entropy | 反熵 | A background process that compares differences between replicas and copies missing data |
| quorum | 法定人数 | Reads and writes satisfying w + r > n, so the read and write node sets must overlap |
| sloppy quorum | 宽松的法定人数 | Using other reachable nodes to make up the numbers when the home nodes cannot be reached |
| hinted handoff | 提示移交 | Sending temporarily accepted writes back to their home nodes once the network recovers |
| staleness | 陈旧程度 | How far a replica's value lags behind the latest value |
| concurrent | 并发 | Two operations, neither of which knows about the other |
| happens-before | 先于 | If B knows about, depends on, or builds upon A, then A happens before B |
| causal dependency | 因果依赖 | One operation building upon another |
| siblings | 兄弟值 | The values of several concurrent writes to the same key |
| tombstone | 墓碑 | A marker indicating that something has been deleted |
| version vector / dotted version vector | 版本向量 / 点版本向量 | A collection of version numbers, one per replica, used to distinguish overwrites from concurrent writes |
| causal context | 因果上下文 | Riak's encoding of a version vector as a string |
| vector clock | 向量时钟 | Often conflated with version vectors, but not the same |

[^binlog]: What the book describes is actually MySQL's MIXED format: statements are logged as statements in normal cases, and only unsafe statements are switched to row-based logging. Since MySQL 5.7.7 (2015), the default value of `binlog_format` has been ROW, meaning row-based replication in all cases; since 8.0.34 (2023), the option itself has been marked deprecated, and row-based logging will eventually be the only format.

[^eventual]: The term was coined by Douglas Terry et al., popularized by Werner Vogels, and became the battle cry of many NoSQL projects. But eventual consistency is not unique to NoSQL databases: followers in asynchronously replicated relational databases have the same property.

[^partition-leader]: Once a database is partitioned (Chapter 6), each partition has one leader. Different partitions may have their leaders on different nodes, but each partition still has only one leader node.

[^dynamo]: Dynamo is not available to users outside Amazon. Confusingly, DynamoDB, the managed database offered by AWS, uses a completely different architecture based on single-leader replication. Amazon's 2022 DynamoDB paper confirms this: the replicas of each partition form a replication group, a leader is elected using Multi-Paxos, and only the leader can process writes and strongly consistent reads.

[^riak]: In 2017, the year the book was published, Basho, the company behind Riak, went out of business. After bet365 bought its assets, it open-sourced Riak along with features that had previously been enterprise-only, and Riak has been community-maintained ever since.

[^strict]: This kind of quorum is sometimes called a strict quorum, to distinguish it from the sloppy quorum discussed later.

[^n-nodes]: A cluster may have more than n nodes, but any given value is stored on only n of them. This allows the dataset to be partitioned, supporting datasets larger than can fit on one node; Chapter 6 covers partitioning.

[^pbs]: For example, the 2012 paper *Probabilistically Bounded Staleness for Practical Partial Quorums* by Peter Bailis et al. proposes the model of probabilistically bounded staleness (PBS).
