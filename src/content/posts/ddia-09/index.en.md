---
title: "DDIA Reading Notes 09: Consistency and Consensus"
description: "Notes on Chapter 9 of Designing Data-Intensive Applications, first edition: what linearizability guarantees and what it costs, how causal order differs from total order, why total order broadcast is equivalent to consensus, why two-phase commit can get stuck, and what consensus algorithms and coordination services like ZooKeeper can do."
sourceHash: "4866a7b09888aee4"
---

This is the ninth post in my DDIA reading notes. The [eighth post](/en/posts/ddia-08/) laid out the unreliable parts of distributed systems: networks, clocks, processes, and nodes' judgments about themselves. Chapter 9 turns to solutions: in such an environment, how to make a system's behavior predictable, and how to get several nodes to agree on something. This is also the last chapter of Part II of the book, "Distributed Data." This post is organized around a few threads as I understand them, not in the order of the book's sections. English quotations are from the original book; the rest is my own summary.

The chapter opens with a quote from Jay Kreps's 2013 article *A Few Notes on Kafka and Jepsen*:

> Is it better to be alive and wrong or right and dead?

Alive but wrong, or correct but dead? When the network fails, should the system keep responding and risk giving wrong results, or stop rather than compromise correctness? This question runs through the whole chapter.

The approach is the same as with transactions in the [seventh post](/en/posts/ddia-07/): find useful abstractions, implement them once, and let applications rely on their guarantees instead of facing the underlying faults themselves. The most important abstraction in this chapter is **consensus**: getting several nodes to agree on something, without going back on it. It sounds simple, but it is one of the subtlest problems in distributed systems.

## Strong and weak consistency

The [fifth post](/en/posts/ddia-05/) on replication lag mentioned that most replicated databases provide only **eventual consistency**: stop writing, wait long enough, and all replicas will eventually agree—"converge" might be a more accurate word. It is too weak: it does not say how long to wait, and before the replicas converge a read can return anything; it may not even see a value you just wrote. The database looks like a variable you can read and write, but behaves nothing like a variable in a program. These bugs do not appear in normal operation; they only surface during network faults or high concurrency.

Stronger consistency models are easier to use, at the cost of performance or fault tolerance. The ones covered in this chapter can be roughly ranked like this:

| Model | What it guarantees | Cost |
| --- | --- | --- |
| Eventual consistency | After writes stop, replicas eventually converge to the same value | Almost no coordination needed |
| Causal consistency | Causally related operations appear in the same order everywhere; concurrent operations are unconstrained | Not slowed by network delays, remains available during network partitions |
| Linearizability | The system behaves as if there were only one copy of the data; reads always see the latest write | Slow, and some replicas are unavailable during a network partition |

These are about consistency among replicas, a different thing from the transaction isolation levels in the seventh post: isolation levels are about how concurrent transactions avoid interfering with each other, while consistency models are about how replicas coordinate under delays and faults. The two are only somewhat similar.

## Linearizability: pretending there is only one copy

**Linearizability**, also called atomic consistency, strong consistency, immediate consistency, or external consistency, works like this: even if the data actually has many replicas, the system behaves as if there were only one copy, and every operation on it is atomic. Once a client's write completes, all subsequent reads must see that value:

> In other words, linearizability is a recency guarantee.

The book's example: Alice and Bob are in the same room watching the result of the World Cup final. Alice refreshes the page, sees the final score, and shouts it out; Bob hears her and then refreshes, but his request lands on a lagging replica, and the page shows the match still in progress. Bob's query clearly happened after Alice's, yet he reads something older than what she saw. That violates linearizability.

More precisely, the object being read and written can be called a **register**, such as a key. Each read or write request spans a period from when it is sent to when the response is received, and the database processes it at some moment within that period. A read that overlaps in time with a write may see the old value or the new one; but once one read has returned the new value, no read that starts after it may return the old value, as if the value flipped atomically from old to new at some instant.

![Three timelines: client C's write(x, 1) is a long bar; client A reads three times, seeing 0 before the write begins, 1 during the write, and 1 after it ends; client B's read starts only after A's second read returns, with an arrow from the end of A's read to the start of B's read, and B must also read 1](./linearizability.en.svg "Figure 1: A linearizable register. During the write, A's read has already returned the new value 1, so B's read, which starts after it, must not return the old value 0 even though the write has not finished.")

Linearizability is easily confused with **serializability** from the seventh post, but they are two different guarantees:

- Serializability is an isolation property of transactions. A transaction can read and write multiple objects, and the result is guaranteed to be the same as some serial order, which may differ from the order in which things actually happened;
- Linearizability is a recency guarantee for reads and writes of a single object. It does not group operations into transactions, so it cannot prevent write skew.

Satisfying both at once is called **strict serializability**. Serializability implemented with two-phase locking or serial execution is usually also linearizable; serializable snapshot isolation is not, because reading from a snapshot means you cannot see writes after the snapshot anyway.

### When you need it

Linearizability is not just about refreshing the score promptly. Several kinds of things cannot be done correctly without it:

- **Locks and leader election**: all nodes must agree on who holds the lock or who the leader is, otherwise you get split brain. ZooKeeper and etcd use consensus algorithms to provide linearizable operations precisely for this[^zk-reads];
- **Uniqueness constraints**: a username must be unique, a balance must not go negative, a seat must not be sold twice. All of these need a "latest value" that all nodes agree on;
- **Cross-channel timing dependencies**: for example, a website stores an uploaded image in file storage, then notifies a background worker through a message queue to generate a thumbnail. If the file storage is not linearizable, the message may outrun the storage's internal replication, and the worker fetches an old image, or nothing at all. The problem is a race between two channels—Alice shouting the score is another channel.

### Which replication methods can provide it

| Replication method | Linearizable? | Why |
| --- | --- | --- |
| Single-leader | Possibly | Reading from the leader or synchronously updated followers can do it; but a node may wrongly believe it is still the leader, and failover with asynchronous replication can lose committed writes |
| Consensus algorithms | Yes | The protocol has measures to prevent split brain and stale reads; ZooKeeper and etcd work this way |
| Multi-leader | No | Multiple nodes accept writes concurrently and replicate asynchronously, producing conflicts |
| Leaderless | Mostly no | Last write wins based on clocks and sloppy quorums break it; even with strict quorums (w + r > n), uneven network delays can let one reader see a new value while a later reader sees an old one |

To make leaderless quorums linearizable, reads must perform read repair synchronously, and writes must first read the latest state from a quorum. The cost is high, and it only gives linearizable reads and writes, not compare-and-set. So the safest assumption is: Dynamo-style systems do not provide linearizability.

### The cost: CAP and latency

Suppose an application is deployed across two data centers, and the network between them goes down. If linearizability is required, the side that cannot reach the leader (or a majority of replicas) can only wait or return errors—it is unavailable. If it is not required, both sides can keep handling requests, for example with multi-leader replication, but the behavior is no longer linearizable.

This is the essence of the **CAP theorem**. It is often stated as "consistency, availability, partition tolerance: pick two," which is misleading: a network partition is a fault, not something you can choose to have or not. The correct reading is: when the network is fine, you can have both; once a partition happens, you must choose between linearizability and full availability. Moreover, CAP's scope is narrow: it only concerns linearizability and network partitions as a fault, and says nothing about network delays, node crashes, or other problems. Its definition of "availability" also does not match the usual meaning. The book's verdict is that the term is mainly of historical interest today: "CAP is best avoided."

In fact, linearizability is expensive not mainly during partitions, but all the time. Even the memory of a multi-core CPU is not linearizable: each core has its own cache, writes are flushed to main memory asynchronously, and another core may not see them immediately unless memory barriers are used. This design is for performance, not fault tolerance. Many distributed databases do not provide linearizability for the same reason. Attiya and Welch proved that linearizable reads and writes have response times at least proportional to the uncertainty of network delays; no faster algorithm exists.

## Ordering: causal and total

Behind linearizability is an order: all operations are placed on a single timeline. Ordering appears repeatedly in this book: single-leader replication relies on the leader to decide the order of writes, serializability makes transactions behave as if executed in some order, and timestamps try to order events. It matters mainly because it preserves **causality**: a question comes before its answer, a row must be created before it can be updated, and Bob refreshed the page only after hearing Alice shout the score.

### Causality is a partial order; linearizability is a total order

Causality only orders related events: A happens before B (B may know about A or depend on A), or the reverse, or the two are **concurrent**, neither knowing about the other, in which case there is no before or after between them. So causality is a **partial order**, like Git's commit history, which branches and merges. Linearizability is a **total order**: any two operations can be ordered, and there is only one timeline.

Linearizability implies causality: a linearizable system automatically preserves causality. But the reverse is not true—preserving causality does not require linearizability:

> In fact, causal consistency is the strongest possible consistency model that does not slow down due to network delays, and remains available in the face of network failures.

Many scenarios that seem to need linearizability actually only need **causal consistency**, which can be implemented far more efficiently. At the time of writing, research in this area was still new, and few production systems had adopted it[^causal].

### Ordering with sequence numbers

To maintain causal consistency, you need to know which operation happened before which. Tracking all causal dependencies precisely is too expensive (a write may depend on anything previously read), so a more practical approach is to give each operation a **sequence number** whose order is consistent with causality: if A causally precedes B, A's sequence number is smaller; concurrent operations can be ordered arbitrarily.

Single-leader replication naturally has such sequence numbers: the positions in the replication log. Without a single leader, the common ways of generating them all fail: each node using odd or even numbers means the counters on the two sides drift apart as nodes have different workloads; timestamps from physical clocks suffer from clock skew (Figure 1 of the eighth post); each node pre-allocating a range of numbers means a later operation may get a smaller range.

**Lamport timestamps** solve this. A Lamport timestamp is a pair (counter, node ID), where the node ID only breaks ties when the counters are equal. The key idea: every node and client remembers the largest counter value it has seen and includes it in every request; when a node receives a larger value, it sets its own counter directly to that value.

![Three horizontal lifelines, from top to bottom: node 1, client A, and node 2. Client A first sends a write to node 2; node 2's counter goes from 4 to 5, and it returns timestamp (5, 2) to A. A then sends a write to node 1, carrying max = 5; node 1's counter jumps from 1 to 5 and then increments to 6, returning timestamp (6, 1) to A](./lamport.en.svg "Figure 2: Lamport timestamps. Client A brings the largest counter it has seen, 5, to node 1; node 1's counter immediately jumps to 5, so this operation gets 6, ordered after A's earlier operation (5, 2).")

In this way, every causal dependency makes the timestamp larger, so the total order of timestamps is consistent with causality. Compared with the version vectors in the [fifth post](/en/posts/ddia-05/), Lamport timestamps are more compact, but they always produce a total order and cannot tell whether two operations are concurrent or causally related.

### A total order alone is not enough

With a total order consistent with causality, can we implement "username must be unique"? After the fact, yes: collect all registration requests, and the one with the smallest timestamp wins. But when a node receives a registration request, it needs to decide success or failure **on the spot**, and it does not know whether another node is right now registering the same name with a smaller timestamp. To be sure, it would have to ask every node, and if one node is unreachable, the system gets stuck.

The problem is that the total order of timestamps only counts once all operations have been collected; you do not know when it is **finalized**. To know when the order is finally settled, you need total order broadcast.

## Total order broadcast, linearizability, and consensus

**Total order broadcast**, also called atomic broadcast, is a protocol for delivering messages between nodes, with two properties that must always hold:

- **Reliable delivery**: no message is lost; if a message is delivered to one node, it is delivered to all nodes;
- **Totally ordered delivery**: all nodes receive messages in the same order.

From another angle, total order broadcast is an append-only log that all nodes can read: delivering a message means appending a record to the log, and once a message is delivered, no other message can be inserted before it. This is what makes it stronger than timestamp ordering. With it, you can do state machine replication (every replica executes the same writes in the same order), serializable transactions (each message is a deterministic stored procedure), and generate fencing tokens (positions in the log are naturally monotonically increasing; ZooKeeper's `zxid` comes from this).

Total order broadcast and linearizable storage can be implemented in terms of each other:

- **Implementing linearizable compare-and-set with total order broadcast**: to register a username, append a message saying "I want this name" to the log, then read the log and wait until your own message is delivered back to you. If the first claim message for this name is yours, you succeed; otherwise you fail. All nodes see the same order, so they all agree on who won. Writes made this way are linearizable; making reads linearizable requires an extra step, such as syncing through the log before reading;
- **Implementing total order broadcast with a linearizable register**: use an integer that supports an atomic "increment-and-get" to assign a sequence number to each message, and receivers deliver messages in sequence-number order. Unlike Lamport timestamps, such sequence numbers have no gaps: you must wait for 5 before you can receive 6.

And to reliably implement a linearizable "increment-and-get," considering that nodes fail and networks break, you inevitably end up at consensus algorithms. It can be proved that a linearizable compare-and-set register, total order broadcast, and consensus are equivalent: if you can solve one, you can turn it into a solution for the others. Following this thread, more equivalent problems can be found:

| Problem | What needs to be decided |
| --- | --- |
| Linearizable compare-and-set | Whether the current value equals the expected value, and whether to write |
| Total order broadcast | The order in which messages are delivered |
| Atomic commit | Whether a distributed transaction commits or aborts |
| Locks and leases | When several clients contend, who gets it |
| Membership and coordination services | Which nodes are alive, and which are considered dead by timeout |
| Uniqueness constraints | When several transactions insert the same key, who succeeds |

## Atomic commit and two-phase commit

Let us look at the most common one first: **atomic commit**. When a transaction involves several nodes (for example, a transaction spanning partitions, or a secondary index on another node), you cannot let each node commit on its own: some node may need to abort due to a constraint violation, a commit request may be lost on the network, or a node may crash before writing its commit record. If some nodes commit and others abort, atomicity is gone. And once a commit happens, it cannot be undone, because other transactions may already have read the committed data.

### How two-phase commit works

**Two-phase commit** (2PC) introduces a **coordinator** and splits the commit into two steps:

1. After the application has finished reading and writing on each **participant**, the coordinator sends a **prepare** request to all participants. Upon receiving it, a participant must make sure it can commit no matter what (data written to disk, constraints and conflicts checked), then answer "yes";
2. The coordinator collects all the answers. If all are "yes," it decides to commit; otherwise it aborts. It first writes the decision to its own log, then sends commit or abort to all participants, retrying forever if delivery fails.

Its atomicity rests on two points of no return: when a participant answers "yes," it gives up the right to abort unilaterally and promises it will be able to commit later; the moment the coordinator writes the decision to its log is the **commit point**, after which the decision can never change. The book compares it to a wedding: before saying "I do," you can back out; after saying it, you cannot. Even if you faint right after saying it and never hear the priest pronounce you married, the marriage has already happened.

### Stuck in doubt

The problem arises when the coordinator crashes. After a participant has answered "yes," it can only wait for the coordinator to tell it the outcome: aborting on its own might be inconsistent with participants that have committed; committing on its own might be inconsistent with those that have aborted. This state is called **in doubt**.

![A sequence diagram read from top to bottom, with three vertical lifelines: the coordinator, database 1, and database 2. The coordinator sends prepare requests to both databases, and both answer yes; the coordinator marks the commit point on its own lifeline, then sends commit to database 2, which commits; then the coordinator crashes, and its lifeline becomes dashed. After voting yes, both databases have a thick bar on their lifelines representing the in-doubt state: database 2's ends when it receives commit, while database 1's continues to the bottom of the diagram](./two-phase-commit.en.svg "Figure 3: In two-phase commit, the coordinator crashes after the commit point. Database 2 has received the commit request, but database 1 has not. Having already voted yes, it can neither abort unilaterally nor commit unilaterally; it can only remain in doubt until the coordinator recovers.")

The only way out is to wait for the coordinator to recover and read its log, so 2PC is a **blocking** protocol. Three-phase commit attempts to be nonblocking, but it assumes bounded network delays and bounded node response times, which cannot guarantee atomicity in real networks; a nonblocking atomic commit requires a perfect failure detector, and timeouts are not one.

### Distributed transactions in practice

Distributed transactions have a bad reputation: MySQL's distributed transactions are reportedly more than ten times slower than single-node transactions, and many cloud services simply do not offer them. Two kinds must be distinguished:

- **Database-internal distributed transactions**: all participants are nodes of the same kind of database (such as VoltDB or MySQL Cluster's NDB). They can be optimized for that specific system and usually work well;
- **Heterogeneous distributed transactions**: the participants are different systems, such as a database plus a message queue. The standard is XA, which enables "exactly once" message processing: the acknowledgment of a message and the database write that processes it commit together in one transaction; if it fails, both abort, and the message can be safely redelivered.

The practical troubles of heterogeneous transactions are real:

- An in-doubt transaction holds locks, blocking other transactions. If the coordinator takes 20 minutes to restart, locks are held for 20 minutes; if the coordinator's log is lost, the locks are never released, and an administrator must resolve them manually, or use "heuristic decisions" that break atomicity to force a conclusion;
- The coordinator is often a library embedded in the application server, so its log becomes persistent state as important as the database's. The application server is no longer stateless, and the coordinator itself becomes a single point of failure;
- XA can only be the lowest common denominator across systems: it cannot detect deadlocks across systems, for example, nor use serializable snapshot isolation;
- 2PC requires all participants to respond before committing, so if any part fails, the transaction fails—a local fault is amplified.

The book says Chapters 11 and 12 will cover ways to keep several systems consistent without heterogeneous distributed transactions.

## Consensus algorithms

2PC is actually a form of consensus, just not a very good one: when the coordinator dies, the whole system gets stuck. A fault-tolerant consensus algorithm must satisfy four properties:

- **Uniform agreement**: no two nodes decide different values;
- **Integrity**: no node decides twice;
- **Validity**: the decided value must have been proposed by some node;
- **Termination**: every node that has not crashed eventually decides.

The first three are safety properties; the last is a liveness property, and it is the formalization of fault tolerance: the system must not wait forever because some node died. It can be proved that any consensus algorithm needs a majority of nodes to be working to guarantee termination; but safety must hold under all circumstances—even if a majority of nodes die, the system merely stops, and never makes a wrong decision.

The famous **FLP result** proves that in an asynchronous model with no clocks or timeouts, if even one node may crash, no deterministic algorithm can always reach consensus. Practical algorithms get around this limitation using timeouts (or randomness).

### Which comes first: the leader or consensus

The best-known consensus algorithms—Viewstamped Replication, Paxos, Raft, and Zab—do not actually decide a single value, but a sequence of values; that is, they implement total order broadcast: each round of consensus decides the next message to deliver. Internally they all have a leader, much like single-leader replication. But single-leader replication needs to elect a leader, which in turn needs consensus:

> It seems that in order to elect a leader, we first need a leader. In order to solve consensus, we must first solve consensus.

The way out of this loop is the **epoch number** (called ballot number in Paxos, term number in Raft). The protocol does not guarantee that there is only one leader globally, only that there is one per epoch. If a leader is suspected to be dead, a new election is started, the epoch number is incremented, and the leader with the higher number wins. Before a leader can make any decision, it must send its proposal to a quorum of nodes, and only nodes that have not seen a higher epoch will vote yes. The quorums used for electing a leader and for approving a proposal necessarily overlap, so if a proposal is approved, no leader with a higher epoch can exist, and this leader can safely make the decision.

This resembles 2PC, but the differences are crucial: the leader is elected and can be replaced if it fails; only a majority of nodes need to agree, not all participants; and there is a procedure for a newly elected leader to bring all nodes back to a consistent state.

### The cost of consensus

Consensus brings definite safety into an environment full of uncertainty, without sacrificing fault tolerance. Yet it is not used everywhere, because it has costs:

- Voting on proposals is a form of synchronous replication, slower than asynchronous replication;
- It requires a strict majority to function: tolerating one node failure needs at least three nodes, tolerating two needs five; during a network partition, only the majority side can continue;
- Most algorithms assume a fixed set of voting nodes; dynamically adding or removing members is much more complicated;
- Leader failure is detected by timeouts, so when network delays fluctuate, false detections and re-elections happen frequently, and the system spends all its time electing leaders;
- Some algorithms are particularly sensitive to network problems. For example, Raft can get into a situation where leadership changes hands repeatedly and the system makes no progress when one particular link is flaky[^cloudflare].

## Coordination services: outsourcing consensus

Application developers rarely implement consensus directly; more often they use it indirectly through a **coordination service** such as ZooKeeper or etcd. Systems like HBase, Hadoop YARN, and Kafka all depend on ZooKeeper behind the scenes[^kafka].

They look like key-value stores, but they are only suitable for small amounts of data that fit entirely in memory and change infrequently, such as "the node at 10.1.1.23 is the leader of partition 7." This data is replicated to all nodes using fault-tolerant total order broadcast. ZooKeeper, modeled on Google's Chubby lock service, provides a set of features that are particularly useful for building distributed systems:

- **Linearizable atomic operations**: compare-and-set for implementing locks, usually as leases with expiration times;
- **Total ordering of operations**: every operation has a monotonically increasing `zxid`, which can be used directly as a fencing token (Figure 3 of the eighth post);
- **Failure detection**: clients and servers maintain sessions with periodic heartbeats; when a session times out, the locks it holds (**ephemeral nodes**) are automatically released;
- **Change notification**: clients can watch a value and be notified immediately when nodes join or fail, without polling.

Only the atomic operations truly require consensus, but it is the combination of these features that makes it so useful for coordination: leader election, assigning partitions to nodes, and reassigning them when nodes join or fail. ZooKeeper votes among only a fixed three or five nodes, yet can serve thousands of clients.

Whether **service discovery** (finding the IP address of a service) needs consensus is less certain: DNS is not linearizable, and reading a slightly stale result is usually fine. **Membership services** (determining which nodes in a cluster are alive) combine failure detection with consensus, so that at least all nodes agree on who is in the cluster, even if a live node is occasionally misjudged as dead.

The book's advice is clear:

> If you find yourself wanting to do one of those things that is reducible to consensus, and you want it to be fault-tolerant, then it is advisable to use something like ZooKeeper.

Finally, not every system needs consensus. Leaderless and multi-leader replication usually do not use global consensus; their conflicts are precisely the result of not having consensus. Perhaps that is acceptable: learn to live with data that is not linearizable and whose version history branches and merges.

## Summary

What I take away from this chapter:

- Linearizability makes a system behave as if there were only one copy of the data. It is easy to reason about, but slow, and it becomes unavailable during network partitions;
- Many scenarios really only need causal consistency, which is not slowed by network delays and is not afraid of partitions. Lamport timestamps give a total order consistent with causality, but they do not tell you when the order is finalized, so they cannot implement uniqueness constraints;
- Total order broadcast, linearizable compare-and-set, atomic commit, locks, and uniqueness constraints all come down to consensus;
- Two-phase commit can do atomic commit, but it gets stuck when the coordinator dies. Algorithms like Raft and Paxos use epoch numbers and overlapping quorums to make decisions as long as a majority of nodes survive;
- Implementing consensus yourself is hard; when you need it, use a proven service like ZooKeeper or etcd.

A single-leader database may seem not to need consensus, but it has merely deferred the consensus to the moment of electing a leader. When the leader dies, you either wait for it to recover, switch over manually, or use a consensus algorithm to elect a new leader automatically. Only the last option is truly fault-tolerant.

Part II ends here: replication, partitioning, transactions, the faults of distributed systems, and finally consistency and consensus. Part III turns to more concrete systems, discussing how to compose various components into complete applications.

## Glossary

| English | Chinese | Meaning |
| --- | --- | --- |
| consensus | 共识 | Getting several nodes to agree on something, without going back on it |
| eventual consistency | 最终一致性 | Replicas eventually converge after writes stop |
| linearizability | 线性一致性 | The system behaves as if there were only one copy of the data; reads see the latest write |
| recency guarantee | 新近性保证 | What you read is guaranteed to be the latest written value |
| register | 寄存器 | A single object being read and written |
| strict serializability | 严格可串行化 | Satisfying both serializability and linearizability |
| CAP theorem | CAP 定理 | During a partition, you must choose between linearizability and full availability |
| causality / causal consistency | 因果关系 / 因果一致性 | Causally related operations appear in the same order everywhere |
| total order / partial order | 全序 / 偏序 | Any two elements are comparable / some elements are incomparable |
| sequence number | 序列号 | A number that imposes a total order on operations |
| Lamport timestamp | Lamport 时间戳 | A (counter, node ID) pair, carrying the largest counter seen to preserve causal consistency |
| total order broadcast | 全序广播 | Messages delivered reliably and in the same order to all nodes |
| state machine replication | 状态机复制 | All replicas execute the same writes in the same order |
| atomic commit | 原子提交 | All nodes agree on whether a distributed transaction commits or aborts |
| two-phase commit (2PC) | 两阶段提交 | An atomic commit protocol with a prepare phase followed by a commit phase |
| coordinator / participant | 协调者 / 参与者 | The component that makes the decision in 2PC / the nodes involved in the transaction |
| commit point | 提交点 | The moment the coordinator writes the decision to its log |
| in doubt | 存疑 | A participant that has voted "yes" but does not yet know the outcome |
| XA | XA | The standard for two-phase commit across heterogeneous systems |
| uniform agreement / integrity / validity / termination | 一致同意 / 完整性 / 有效性 / 终止 | The four properties of a consensus algorithm |
| FLP result | FLP 结论 | In an asynchronous model, no deterministic algorithm can always reach consensus |
| epoch number | 纪元编号 | The leader is unique within each epoch; the higher number wins |
| coordination service | 协调服务 | Such as ZooKeeper or etcd, providing consensus, failure detection, and membership management |
| ephemeral node | 临时节点 | A ZooKeeper node that is automatically deleted when the session times out |

[^zk-reads]: Strictly speaking, ZooKeeper's and etcd's writes are linearizable, but reads may be stale, because by default any replica can answer them; ZooKeeper requires calling `sync()` before a read to guarantee the latest value. The book refers to etcd's v2 API; in the v3 API released in 2016, reads are linearizable by default, and if you want faster but possibly stale reads, you must specify serializable in the request.

[^causal]: The book was written in 2017. MongoDB 3.6, released at the end of that year, provided causal consistency in client sessions: the driver records the cluster time returned in each response and includes it in subsequent requests, so later reads see the client's own earlier writes and do not read older data. However, Jepsen's 2018 tests found that it only truly holds with majority read/write concerns.

[^cloudflare]: The book was written in 2017. Something like this really happened later: on November 2, 2020, a switch at Cloudflare partially failed. In a three-node etcd cluster, node 1 could not reach the leader, node 3, but could still reach node 2. Node 1 repeatedly started elections and voted for itself; node 2 each time voted for node 3, which it could still reach. No leader that node 1 could reach was ever elected, and since Raft elections block all writes, the cluster was read-only for several minutes until the switch recovered. The resulting cascade affected Cloudflare's API and dashboard for over six hours.

[^kafka]: The book was written in 2017. Kafka later replaced ZooKeeper with its own Raft-based KRaft protocol, and Kafka 4.0, released in 2025, no longer supports ZooKeeper at all (see the [sixth post](/en/posts/ddia-06/)).
