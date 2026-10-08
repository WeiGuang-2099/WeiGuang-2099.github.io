---
title: "DDIA Reading Notes 07: Transactions"
description: "Notes on Chapter 7 of Designing Data-Intensive Applications, first edition: what each letter of ACID actually promises, which races read committed and snapshot isolation block and which they miss, why write skew and phantoms are hard to prevent, and three ways to implement serializability."
sourceHash: "bcf73be9a40e0943"
---

This is the seventh post in my DDIA reading notes. The [sixth post](/en/posts/ddia-06/) covered partitioning and ended with a question: an operation writes to several partitions, some writes succeed and others fail—what do you do? Chapter 7 steps back to a more basic question: an application needs to read and write several things, something may fail halfway through, and other people are reading and writing at the same time—how do you keep the data from getting messed up? The answer is transactions. This post is organized around a few threads as I understand them, not in the order of the book's sections. English quotations are from the original book; the rest is my own summary.

The chapter opens with a quote from Google's Spanner paper (James Corbett et al., 2012):

> Some authors have claimed that general two-phase commit is too expensive to support, because of the performance or availability problems that it brings. We believe it is better to have application programmers deal with performance problems due to overuse of transactions as bottlenecks arise, rather than always coding around the lack of transactions.

This comes from a database spanning multiple data centers around the globe. At that scale, Google still believes transactions are worth keeping: optimize when performance actually becomes a bottleneck, rather than making programmers code around the lack of transactions everywhere.

## What problems do transactions solve?

Many things can go wrong in a data system: the database or the machine can crash at any time, possibly right in the middle of a write; the application can also crash, possibly halfway through a sequence of operations; the network can go down; several clients modifying the same data at the same time can overwrite each other, or read something someone else has half-modified.

The idea of a transaction is to package a group of reads and writes into a single unit with only two outcomes: all of it takes effect (**commit**), or none of it does (**abort**). When something goes wrong, abort, and the application can retry the whole transaction without having to clean up a half-modified intermediate state. Transactions guard against two kinds of trouble: **faults** and **concurrency**.

Transactions are not a given; they were designed to simplify the programming model for applications. In the NoSQL wave of the late 2000s, many new systems dropped transactions or kept only much weaker versions[^mongodb], and "you can't have scalability and transactions" became a popular claim for a while; on the other side, database vendors marketed transactions as essential for "serious applications." Both claims are exaggerated. Transactions have costs, and they also save applications a lot of trouble. First we need to understand what they actually guarantee.

### The four letters of ACID

The guarantees of transactions are often summarized as ACID. But the four letters do not carry equal weight:

| Letter | Name | What it actually means | Who guarantees it |
| --- | --- | --- | --- |
| A | Atomicity | On error, the whole thing aborts and all writes already made are undone. "Abortability" is a better name; it is not the same as atomic operations in multithreaded programming | The database |
| C | Consistency | The application's invariants always hold, such as debits equaling credits in accounting | The application. The database can only check limited constraints like foreign keys and uniqueness |
| I | Isolation | Concurrently executing transactions do not interfere with each other. The textbook definition is serializability; real systems mostly use weaker levels | The database |
| D | Durability | Once committed, data is not lost: written to disk, or replicated to other nodes | The database, but there is no absolute durability |

C is really a property of the application; including it in ACID is a bit of padding. And different databases implement ACID differently, especially isolation, so the book's assessment is:

> ACID has unfortunately become mostly a marketing term.

Durability can only reduce risk. Write to disk, and if the machine breaks, the data is temporarily unavailable; replicate to several nodes, and a power outage, or a bug triggered simultaneously on all nodes, can take them all down together; SSDs can violate their own promises on power loss, and data on disk can silently rot. What you can do is stack disk writes, replication, and backups together.

### Single-object and multi-object

For reads and writes of a single object, storage engines almost always guarantee atomicity and isolation: use a log to prevent half-written writes, and use a lock to prevent others from reading a half-written value. Some databases also provide single-object operations like atomic increment and **compare-and-set** (write only if the value has not been changed by someone else). They are useful, but they are not transactions; calling them "lightweight transactions" is marketing.

What actually needs transactions is when several objects must change together:

- In the relational model, one row references another through a foreign key, and several rows need to be inserted together;
- The document model lacks joins and encourages denormalization, so the same information lives in several documents that need updating together, such as an email and a separately stored unread count;
- With secondary indexes, changing a value means changing the index too, and from a transaction's point of view the index is just another object.

Without multi-object transactions, all of this can still be done, but error handling and concurrency control become the application's job.

### Retrying is not so simple

The point of aborting is that you can safely retry, but retrying itself has pitfalls:

- The transaction actually committed, but the acknowledgment was lost; retrying executes it twice, unless the application does its own deduplication;
- If the error was caused by overload, retrying only makes it worse; you need to limit attempts and use exponential backoff;
- Only transient errors (deadlock, network blips, failover) are worth retrying; retrying a permanent error like a constraint violation is pointless;
- Side effects of the transaction outside the database (such as an email already sent) do not roll back with it;
- If the client itself crashes while retrying, the data it was going to write is lost.

Many ORM frameworks just throw the exception upward on abort and do not retry, giving up the benefit of aborting for nothing.

## The shapes of concurrency errors

If two transactions do not touch the same data, they can safely run in parallel. Trouble arises when one transaction reads data that another is modifying, or two transactions modify the same data at the same time. These race conditions are hard to test for; they only appear when the timing happens to line up.

The ideal isolation is **serializability**: the database guarantees that the result is exactly the same as if the transactions had run one after another. But it has a performance cost, so many databases default to weaker isolation levels. Bugs caused by weak isolation have cost real money, and "just use an ACID database" does not solve the problem, because many relational databases that claim ACID also default to weak isolation.

I think the best way to remember these anomalies is to classify them by the "shape" of the read-write conflict, and then see which isolation level blocks which:

| Anomaly | Shape | Read committed | Snapshot isolation | Serializable |
| --- | --- | --- | --- | --- |
| Dirty read | Reading another transaction's uncommitted write | Blocked | Blocked | Blocked |
| Dirty write | Overwriting another transaction's uncommitted write | Blocked | Blocked | Blocked |
| Read skew | Several pieces of data read in one go come from different points in time | Not blocked | Blocked | Blocked |
| Lost update | Two transactions read, modify, and write back the same object; one clobbers the other | Not blocked | Some implementations detect it automatically | Blocked |
| Write skew | Two transactions read the same set of data, each modifies a different object, and together they violate a constraint | Not blocked | Not blocked | Blocked |
| Phantom | One transaction's write changes the result of another transaction's query, such as querying "does not exist" and then inserting | Not blocked | Blocked in read-only queries | Blocked |

The first two involve touching uncommitted data; the third is reading data that is not from a single point in time; the last three are read-then-write, where the basis for the write has already changed. The further down, the harder to notice and the harder to prevent.

### Read committed: only see committed data

**Read committed** is the most basic isolation level. It guarantees no **dirty reads** and no **dirty writes**. Oracle, PostgreSQL, and SQL Server all default to it[^read-uncommitted].

Dirty writes are prevented with row-level locks: to modify a row, first acquire its write lock, and hold it until the transaction ends. The consequences of a dirty write can be absurd: two people buy a used car at the same time; buying the car requires updating two tables, vehicle information and invoice, and the car ends up going to one person while the invoice is sent to the other.

Dirty reads, however, are not prevented with read locks, because a long-running write transaction would block all readers. The common approach is that for each object being modified, the database keeps both the old committed value and the new value; other transactions that read it get the old value until the new one commits.

### Snapshot isolation: each transaction sees a frozen moment

Read committed does not prevent **read skew**. The book's example: Alice has two accounts, each with $500, and a transfer is moving $100 from account 2 to account 1. She first checks account 1; the transfer has not committed yet, so she sees $500. Then she checks account 2; the transfer has now committed, so she sees $400. Both reads saw committed data, yet the total is only $900.

![Four timelines, top to bottom: Alice first queries account 1 and reads 500; the transfer transaction adds 100 to account 1, then subtracts 100 from account 2, then commits; Alice then queries account 2 and reads 400. A dimension line at the bottom spans Alice's two queries, labeled with the total she sees: 500 plus 400 equals 900](./read-skew.en.svg "Figure 1: Read skew. Alice's first query is before the transfer commits, her second after it commits; each read sees committed values, yet together they are short by 100.")

For Alice, refreshing the page fixes it; but for backups and large-scale analytical queries, this inconsistency is unacceptable: if a backup is half old data and half new, restoring from it makes the vanished money vanish for good.

The fix is **snapshot isolation**: each transaction reads from a **consistent snapshot**, seeing everything committed before it started and nothing that changes afterward. It is implemented with **multi-version concurrency control** (MVCC): the database does not modify data in place; every modification creates a new version, and the same object may have several committed versions at once.

The book uses PostgreSQL as an example. Each transaction gets an increasing transaction ID when it starts; each row records the transaction that created it (`created_by`) and the transaction that deleted it (`deleted_by`), and an update is split into "delete the old version, insert a new version." When reading, writes from three kinds of transactions are treated as if they never happened: transactions still in progress when this transaction started, transactions that aborted, and transactions that started later than this one. What remains is visible.

![The horizontal axis is transaction ID. Four horizontal bars are four row versions in the table: the version of account 1 with balance 500 lives from transaction 3 to transaction 13, the version with balance 600 starts at transaction 13; the version of account 2 with balance 500 lives from transaction 5 to transaction 13, the version with balance 400 starts at transaction 13. A vertical line at transaction 12 crosses each row, passing only through the two versions with balance 500, so transaction 12 reads both accounts as 500](./mvcc.en.svg "Figure 2: A consistent snapshot implemented with multi-version concurrency control (following the book's PostgreSQL example). Each row version lives from the transaction that created it to the transaction that deleted it; transaction 12's snapshot only sees versions still alive at its position. The figure assumes that by the time transaction 12 starts, all transactions with smaller numbers have committed.")

I find Figure 2 the most intuitive way to see it: each version is an interval from "created" to "deleted," a snapshot is a vertical line, and the versions the line crosses are what it can see. The transfer, transaction 13, started later than transaction 12, so its deletion and insertion do not exist for transaction 12, and transaction 12 reads both accounts as $500, totaling $1000.

The slogan for snapshot isolation is **readers don't block writers, and writers don't block readers**: writes still take locks to prevent dirty writes, but reads take no locks at all. Another implementation is the copy-on-write B-tree used by CouchDB and LMDB: every write produces a new tree root, and each root is a snapshot.

The naming of snapshot isolation across vendors is a mess: Oracle calls it serializable, PostgreSQL and MySQL call it repeatable read. The reason is that the SQL standard's isolation levels come from System R's 1975 definitions, which predate snapshot isolation, and the standard's definition of "repeatable read" is itself vague. Hence:

> As a result, nobody really knows what repeatable read means.

### Lost updates: read-modify-write clobbering each other

Two transactions increment a counter at the same time: both read 42, both write back 43, and two increments only add up to one. Any "read it, modify it, write it back" operation has this problem: updating an account balance, adding an item to a list in a JSON document, two people editing a wiki page at the same time.

The remedies, roughly in order of preference:

1. **Atomic write operations**: let the database do the read-modify-write itself, such as `UPDATE counters SET value = value + 1 WHERE key = 'foo'`. Use them when you can, though ORMs make it easy to accidentally bypass them;
2. **Explicit locking**: use `SELECT ... FOR UPDATE` to lock the rows to be modified, then do the read-modify-write in the application. Suitable when the rules are complex and cannot be written as a single statement, such as checking whether a chess move is legal; the cost is that it is easy to forget a lock;
3. **Automatic detection**: let read-modify-writes run in parallel, and have the database abort one of them when it detects a lost update. PostgreSQL's repeatable read, Oracle's serializable, and SQL Server's snapshot isolation do this; MySQL/InnoDB's repeatable read does not[^mariadb]. The benefit is that the application does nothing;
4. **Compare-and-set**: write only if the value is the same as what was previously read. The caveat is that if the database allows the condition to be read from an old snapshot, it does not prevent lost updates.

With replication, locks and compare-and-set both assume there is a single latest copy of the data, which does not hold in multi-leader and leaderless replication. The approach there is to allow concurrent writes to produce several versions and merge them afterward; commutative operations like incrementing or adding an element to a set are best suited to such environments. Last write wins (LWW), on the other hand, loses updates (see the [fifth post](/en/posts/ddia-05/)).

### Write skew and phantoms: read-then-write on a stale basis

The subtlest category is **write skew**. The book's example: a hospital requires at least one doctor on call per shift. Alice and Bob are on the same shift, both feel unwell, and both request leave at almost the same time. Both transactions first query the current number of on-call doctors; each sees 2 in its own snapshot, so each takes itself off call, and both commit. Now nobody is on call.

![Four timelines: Alice's and Bob's transactions start at almost the same time, each queries the current number of on-call doctors and gets 2, so each concludes that taking leave is fine; then Alice sets herself to off call and commits, and Bob also sets himself to off call and commits. A dimension line at the bottom right marks the state after both transactions commit: nobody is on call](./write-skew.en.svg "Figure 3: Write skew. Under snapshot isolation, Alice's and Bob's transactions each see two doctors on call in their own snapshots, each modifies its own row, and neither touches the object the other wrote, so both commit successfully—yet the hospital has nobody on call.")

It is neither a dirty write nor a lost update, because the two transactions modify different rows. It can be seen as a generalization of lost updates: two transactions read the same set of objects, then each modifies part of it. Atomic operations do not help, and snapshot isolation's automatic detection cannot see it.

This pattern is everywhere, and the structure is always three steps: first query, check whether some condition holds; decide whether to proceed based on the result; if proceeding, write, and that write happens to change the condition from the first step. Meeting room booking (query for overlapping bookings before inserting), multiplayer games (two players move different pieces to the same square), claiming a username, and preventing double spending (several payments checking the balance at the same time) are all like this.

In the doctors example, what the first step queries is exactly the rows the third step modifies, so you can lock them with `SELECT ... FOR UPDATE`. But the other examples check for **absence**: no overlapping booking, no one using this name. The query returns nothing, so there is nothing to lock. One transaction's write changes the result of another transaction's query; this is called a **phantom**. Snapshot isolation hides phantoms from read-only queries, but in read-then-write transactions, phantoms cause write skew.

There is not much you can do:

- Use serializable isolation; this is the fundamental fix;
- If the condition can be written as a database constraint (such as a unique username), leave it to a uniqueness constraint;
- As a last resort, **materialize conflicts**: create a table of "meeting room × time slot" in advance, specifically for locking, turning rows that do not exist into real rows that can be locked. The book says this is a last resort because it leaks concurrency control details into the data model.

## Three ways to implement serializability

The problem with weak isolation is that the meaning of each level varies across vendors, it is hard to tell from code whether some logic is safe at a given level, and there are no good tools for finding race conditions. Researchers' answer for decades has been: use serializability. It guarantees that a transaction that runs correctly on its own also runs correctly under concurrency. There are three main ways to implement it:

| Approach | How it works | Cost | Used in |
| --- | --- | --- | --- |
| Actual serial execution | A single thread runs one transaction at a time, data lives in memory, and transactions are written as stored procedures submitted all at once | Throughput limited to one CPU core; cross-partition transactions are slow | VoltDB/H-Store, Redis, Datomic |
| Two-phase locking (2PL) | Reads take shared locks, writes take exclusive locks, all held until the transaction ends | Readers and writers block each other, deadlocks are common, high-percentile latency is poor | The standard approach for thirty years; MySQL and SQL Server's serializable |
| Serializable snapshot isolation (SSI) | Execute normally on snapshots; at commit, check whether the premises read are still valid, and abort if they are stale | High abort rate under heavy contention; read-write transactions need to be short | PostgreSQL's serializable since 9.1, FoundationDB[^foundationdb] |

### Why serial execution is viable again

One thread executing all transactions in order eliminates concurrency problems at the root. This idea was not taken seriously until around 2007, because two things changed: memory became cheap enough to hold the entire active dataset, and people realized that OLTP transactions are usually short, while long-running analytical queries can run outside the serial loop, on a snapshot.

The key is that a transaction cannot keep going back and forth with the application while executing. Interactive transactions spend most of their time on network round trips, and a single thread cannot afford to wait. So these systems require writing the whole transaction as a **stored procedure**, submitted to the database in one go. Stored procedures have a bad reputation: each vendor has its own antiquated language, and the code is hard to debug, test, and deploy. But modern takes like VoltDB using Java and Redis using Lua improve on this considerably. VoltDB also requires stored procedures to be deterministic, because it replicates by re-executing the same procedure on every replica.

To use multiple cores and multiple machines, you have to partition so that each transaction touches only one partition. Cross-partition transactions require all involved partitions to execute in lockstep; VoltDB reports cross-partition writes at only about 1,000 per second.

### Two-phase locking

The rules of **two-phase locking** (2PL) are simple: reading an object requires a shared lock, writing requires an exclusive lock, and locks are held until the transaction ends. "Two-phase" means the transaction only acquires locks during execution and releases them all together at the end. It has nothing to do with two-phase commit (2PC) from Chapter 9.

Compared with snapshot isolation, the difference is that writes block reads, and reads block writes. This is exactly why it prevents write skew, and also why it is slow: whenever two transactions might race, one of them has to wait; one slow transaction, or one that locks a lot of data, can make other transactions queue up; deadlocks are far more frequent, and an aborted transaction has to start over from scratch.

Preventing phantoms also requires **predicate locks**: what is locked is not a particular row, but all rows matching some query condition, including rows that do not yet exist. Checking predicates one by one is too slow, so real databases approximate it with **index-range locking**: lock a range of the index used by the query, such as "meeting room 123" or "noon to 1 pm." The locked range is larger than necessary, but much cheaper; if no suitable index exists, fall back to locking the whole table.

### Serializable snapshot isolation

**Serializable snapshot isolation** (SSI) is an algorithm proposed only in 2008. It adds modest overhead on top of snapshot isolation while providing full serializability.

Two-phase locking is **pessimistic**: if something might go wrong, wait first. SSI is **optimistic**: execute normally, check at commit whether anything went wrong, and abort and retry if it did. The optimistic approach performs badly under heavy contention, where aborts and retries add further load; but as long as contention is not too intense, it is usually faster than the pessimistic approach.

What SSI checks is exactly the "premise" in the write skew pattern: does the data the transaction read still hold at the time it commits? There are two cases:

- While reading, the snapshot's visibility rules ignored some uncommitted write, and that write has now committed;
- After reading, another transaction wrote data that this transaction had read. The database records in the index who read which range, and on write, it follows these records to find the readers and notify them that their premise may be stale. This acts like a tripwire; it blocks no one.

Back to the doctors example: under SSI, Alice's and Bob's transactions each discover that the other modified data they had read; the first to commit succeeds, the second is aborted. The check happens only at commit because a read-only transaction does not need to be aborted even if it read stale data; concluding too early would cause unnecessary aborts.

SSI keeps snapshot isolation's benefit that readers and writers do not block each other, has much more stable latency than two-phase locking, and is not limited to a single core. Its weak point is the abort rate, so read-write transactions need to be short.

## Summary

What I take away from this chapter:

- A transaction is an abstraction that reduces a large class of problems caused by faults and concurrency to "abort, then retry";
- In ACID, what the database is really responsible for is atomicity, isolation, and durability; consistency is up to the application, and the meaning of isolation varies across vendors;
- Choosing an isolation level depends on the shape of the application's reads and writes: read-only reports care about read skew, read-modify-writes care about lost updates, and "query then write" business rules need to watch out for write skew and phantoms;
- Only serializability blocks all of these races. It is not necessarily slow: with small data you can execute serially, and with read-heavy workloads you can use SSI.

This chapter mostly discusses transactions on a single machine. Once data is distributed across multiple machines, things get harder, as the next two chapters will show.

## Glossary

| English | Chinese | Meaning |
| --- | --- | --- |
| transaction | 事务 | A group of reads and writes packaged into a single unit, either all committed or all aborted |
| commit / abort | 提交 / 中止 | The two outcomes of a transaction |
| atomicity / abortability | 原子性 / 可中止性 | Undoing all writes a transaction has made when something goes wrong |
| consistency / invariants | 一致性 / 不变式 | Conditions specified by the application that must always hold |
| isolation | 隔离性 | Concurrently executing transactions do not interfere with each other |
| durability | 持久性 | Committed data is not lost |
| compare-and-set | 比较并设置 | A single-object atomic operation that writes only if the value has not been changed |
| race condition | 竞态条件 | The outcome depends on the timing of concurrent operations |
| read committed | 读已提交 | No dirty reads and no dirty writes |
| dirty read / dirty write | 脏读 / 脏写 | Reading / overwriting another transaction's uncommitted write |
| read skew | 读偏斜 | Several pieces of data read in one go come from different points in time |
| snapshot isolation | 快照隔离 | Each transaction reads from a consistent snapshot taken when it starts |
| multi-version concurrency control (MVCC) | 多版本并发控制 | Keeping several committed versions of an object at the same time |
| repeatable read | 可重复读 | An isolation level name in the SQL standard, with varying meanings across vendors |
| lost update | 丢失更新 | Two read-modify-write cycles clobbering each other |
| write skew | 写偏斜 | Reading the same set of data, each writing a different object, and together violating a constraint |
| phantom | 幻读 | One transaction's write changes the result of another transaction's query |
| materializing conflicts | 物化冲突 | Creating a table specifically for locking, turning phantoms into conflicts on concrete rows |
| serializability | 可串行化 | Concurrent execution produces the same result as some serial execution |
| stored procedure | 存储过程 | An entire transaction submitted to the database in one go |
| two-phase locking (2PL) | 两阶段锁 | Both reads and writes take locks, held until the transaction ends |
| predicate lock / index-range locking | 谓词锁 / 索引范围锁 | Locking all rows matching a condition / its approximation on an index |
| serializable snapshot isolation (SSI) | 可串行化快照隔离 | Snapshot isolation plus conflict detection at commit |
| pessimistic / optimistic concurrency control | 悲观 / 乐观并发控制 | Wait when there is risk / execute normally and check at commit |

[^mongodb]: The book was written in 2017. MongoDB has supported multi-document transactions on replica sets since version 4.0 (2018), extended to sharded clusters in 4.2 (2019).

[^read-uncommitted]: There is an even weaker level called read uncommitted, which only prevents dirty writes, not dirty reads.

[^mariadb]: The book was written in 2017. MySQL is still like this today. MariaDB, which forked from MySQL, added an `innodb_snapshot_isolation` option in 2024: when enabled, if a row a transaction wants to lock under repeatable read has been modified by another transaction after its snapshot, an error is raised and the whole transaction is aborted, which prevents lost updates. Since version 11.6.2 (2024), this option is enabled by default.

[^foundationdb]: The book was written in 2017. FoundationDB stopped being publicly available after Apple acquired it in 2015; Apple open-sourced it in 2018.
