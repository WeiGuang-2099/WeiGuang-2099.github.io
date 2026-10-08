---
title: "DDIA Reading Notes 08: The Trouble with Distributed Systems"
description: "Notes on Chapter 8 of Designing Data-Intensive Applications, first edition: networks drop packets and delay them indefinitely, clocks drift and jump, processes pause anywhere; in such an environment, what a node can know, whom it should trust, and how to reason about algorithm correctness with system models."
sourceHash: "8070f4e4ddf1df6c"
---

This is the eighth post in my DDIA reading notes. The [seventh post](/en/posts/ddia-07/) covered transactions, mostly on a single machine. Earlier chapters actually already discussed plenty of faults: leader failure, replication lag, concurrent conflicts. Chapter 8 says these are still too optimistic—let's just assume everything that can go wrong will go wrong, and look at what exactly cannot be relied upon in a distributed system. This post is organized along a few main threads as I understand them, not in the order of the book's sections. English quotations in the text are from the original book; the rest is my own summary.

The chapter opens with a quote from Kyle Kingsbury's 2013 *Carly Rae Jepsen and the Perils of Network Partitions*, adapted from the pop song Call Me Maybe:

> Hey I just met you\
> The network's laggy\
> But here's my data\
> So store it maybe

Kingsbury's series of tests, which specifically check whether distributed databases honor their promises under faults like network partitions, is called Jepsen. The line "here's my data, so store it maybe" more or less sets the tone of the chapter.

## Partial failure

A single computer behaves deterministically: when the hardware is healthy, the same operation always produces the same result; when hardware fails, the whole machine usually crashes outright rather than returning a wrong result. This is deliberate design: better to die than to give a wrong answer.

Distributed systems don't get this luxury. Several machines connected by a network may well have some parts broken while others are perfectly fine—this is called **partial failure**. What's worse is that it is **nondeterministic**: an operation involving multiple nodes may sometimes succeed, sometimes fail, and you may not even know whether it succeeded at all.

Different systems take different attitudes toward this. Supercomputers escalate partial failure into total failure: they checkpoint periodically, and if any node fails, the whole job stops and restarts from the checkpoint once the node is repaired. Internet services can't do this: they need to serve users online with low latency at all times, they use ordinary commodity machines with higher failure rates, and they operate at a scale where something is always broken. So the only option is to tolerate partial failure in software and build a reliable system out of unreliable components. This is not a contradiction: TCP provides reliable transport on top of IP, which drops and reorders packets—it can hide packet loss, but not latency.

The book's attitude for this chapter is:

> In distributed systems, suspicion, pessimism, and paranoia pay off.

## The network: silence cannot be explained

This book discusses shared-nothing systems, where the only connection between machines is the network, and both data centers and the internet use **asynchronous packet networks**: the network guarantees neither when a packet will arrive nor whether it will arrive at all.

You send a request and hear nothing back for a long time. The request may have been lost on the way, may still be sitting in some queue, the other side may have crashed, may be stuck in a long garbage collection pause, may have processed it and the response was lost on the way back, or the response may simply be slow. From the sender's perspective, all these cases look identical:

> If you send a request to another node and don't receive a response, it is impossible to tell why.

Network faults are also more common than one might think. One study found that a medium-sized data center experiences about 12 network faults per month; adding redundant network equipment helps only so much, because many faults come from human configuration errors. There are even stranger ones: sharks biting through undersea cables, and network cards that drop only incoming packets while outgoing packets work fine.

### There is no right answer for timeouts

In the end, detecting faults almost always comes down to **timeouts**. Sometimes you get an explicit signal, such as the other side's operating system sending an RST packet to refuse a connection, but you can't count on it: even if TCP acknowledges that a packet was delivered, the application may crash before processing it.

How long to set the timeout is a dilemma: too long, and you wait a long time to discover a node has really died; too short, and a node that is merely slow for a moment gets wrongly declared dead. The cost of a false positive is significant: the work it was doing may be redone by another node (an email sent twice, for example); its load gets shifted to other nodes, and if everyone is already overloaded, this can trigger a **cascading failure**.

If the network guaranteed every packet would be delivered within time d, and nodes guaranteed to process a request within time r, you could just set the timeout to 2d + r. But in reality neither guarantee holds; network latency is **unbounded**. Latency variation comes mainly from queueing: switches queue packets heading to the same destination at the same time, the operating system queues when the target machine's CPU is busy, the hypervisor queues when a virtual machine is paused, and TCP flow control can even queue packets before they are sent. In a shared cloud environment, a neighboring tenant's batch job can wreck your latency.

So timeouts can only be set empirically: measure the distribution of round-trip times over many machines and a long period, then trade off detection speed against the risk of false positives. A better approach is to continuously observe response times and adjust the timeout automatically, as the Phi Accrual failure detector does (used by both Akka and Cassandra).

### Why not make the network predictable

The landline telephone network is very predictable: when you make a call, a fixed amount of bandwidth is reserved along the route for the duration of the call (a **circuit**), there is no queueing, and the maximum latency is fixed. Why don't computer networks do this?

Because data center and internet traffic is bursty: requesting a web page or transferring a file has no fixed bandwidth requirement, you just want it done as quickly as possible. If you reserve bandwidth for it, too little makes the transfer slow and too much wastes capacity. Packet switching lets everyone dynamically contend for bandwidth, at the cost of queueing and latency variation, in exchange for line utilization—that is, lower cost. CPUs dynamically shared among threads follow the same logic.

> Variable delays in networks are not a law of nature, but simply the result of a cost/benefit trade-off.

Environments with guaranteed latency can be built; they're just expensive. In multi-tenant data centers and public clouds, you can only assume that network congestion, queueing, and unbounded delays will all happen.

## Clocks: every machine has its own time

Applications use clocks for two kinds of things: measuring a duration (has the request timed out? what is the response time?), and marking a point in time (when was this article published, when does this cache expire). In distributed systems, both are harder than they look.

### Two kinds of clocks

Computers have at least two kinds of clocks, and their uses must not be mixed up:

| | Time-of-day clock | Monotonic clock |
| --- | --- | --- |
| What it returns | The current date and time, e.g. seconds since January 1, 1970 | Time elapsed since some arbitrary starting point |
| Examples | `clock_gettime(CLOCK_REALTIME)`, `System.currentTimeMillis()` | `clock_gettime(CLOCK_MONOTONIC)`, `System.nanoTime()` |
| Can it jump backward | Yes: if NTP finds it has drifted too far ahead, it may step it back | No, it only moves forward (NTP can at most speed it up or slow it down by 0.05%) |
| Good for | Marking points in time, comparable across machines (ideally) | Measuring durations, such as timeouts; values from different machines are not comparable |

Using a monotonic clock for timeouts is usually fine in distributed systems; the trouble comes from relying on the time-of-day clock and assuming that clocks on different machines are synchronized.

### How inaccurate synchronization is

Time-of-day clocks are synchronized with external time servers via NTP, but this is far less reliable than one might think:

- Quartz clocks **drift**. Google assumes a server drift of 200 ppm, which means a difference of 6 milliseconds if synchronized every 30 seconds, and 17 seconds if synchronized once a day;
- Synchronizing via NTP over the internet has an error of at least tens of milliseconds, spiking to hundreds of milliseconds or even a second under network congestion;
- NTP servers can be misconfigured, machines can be blocked by firewalls, and a clock can go unsynchronized for a long time without anyone noticing;
- Leap seconds make a minute 59 or 61 seconds long, and have crashed quite a few major systems[^leap];
- When a virtual machine is paused, its clock appears to jump forward from the application's perspective; and on users' phones and computers, the user can set the clock to whatever they like.

Getting it very accurate is not impossible. The EU's MiFID II regulation requires high-frequency trading firms to keep their clocks within 100 microseconds of UTC[^mifid], achieved with GPS receivers, the Precision Time Protocol (PTP), and careful monitoring—at considerable cost.

Clock inaccuracy has a particularly dangerous property: it doesn't crash the system, it just fails silently. A dead CPU or a cut cable is discovered quickly; a clock that slowly drifts away leaves most functionality working while data quietly goes wrong. So systems that rely on synchronized clocks must monitor clock skew across all machines, and nodes whose skew is too large must be kicked out of the cluster.

### You can't order events with timestamps

The most dangerous use is ordering events by time-of-day timestamps. The book's example takes place in a multi-leader replicated database: client A writes x = 1 on node 1, and this write is replicated to node 3; client B reads it on node 3 and increments x to 2. Both writes eventually replicate to node 2, which uses **last write wins** (LWW) to decide which one to keep. Node 3's clock is less than 3 milliseconds behind node 1's, so the later write gets the smaller timestamp.

![Two horizontal axes. The top one shows the actual order: A writes x = 1 on node 1 first, then B increments x to 2 on node 3. The bottom one shows the timestamp order: B's timestamp 42.003 comes first, A's timestamp 42.004 comes after. Each write has a line connecting the top axis to the bottom axis, and the two lines cross in the middle. A note at the bottom: last write wins kept x = 1, and B's increment was lost](./lww-clock.en.svg "Figure 1: Clock skew makes the timestamp order the reverse of the actual order. Node 3's clock is slightly behind node 1's, so the later write gets the smaller timestamp, and last write wins discards it.")

B's increment is silently lost, with no error at all. LWW has two more problems: it can't distinguish whether two writes happened one after another or were truly concurrent; and timestamps can collide. Even with well-synchronized clocks, NTP's precision is itself limited by network round-trip time, so going by the two machines' clocks, a packet can "arrive before it was sent." To order events, one should use counter-based **logical clocks**, which Chapter 9 will cover.

### A clock reading is an interval

Rather than treating a clock reading as a precise point in time, it's better to treat it as a **confidence interval**, such as "with 95% confidence, the time now is between 10.3 and 10.5 seconds past the minute." A timestamp with microsecond precision does not mean it is accurate to the microsecond. Yet most systems don't tell you how wide the interval is.

Google Spanner's TrueTime API is an exception: ask it what time it is, and it returns two values, `[earliest, latest]`. If two events' intervals don't overlap, their order is certain; if they overlap, you can't tell which came first.

![Two groups of dimension lines. The top group is labeled non-overlapping: A's interval is on the left, B's interval is on the right, and the two do not intersect, so B must have happened after A. The bottom group is labeled overlapping: A's and B's intervals overlap in the middle, highlighted with a light background, and within this region you cannot tell which came first](./truetime.en.svg "Figure 2: Treating clock readings as confidence intervals. If two events' intervals don't overlap, their order is certain; if the intervals overlap, you can't tell which came first. Before committing a read-write transaction, Spanner deliberately waits for the length of a confidence interval, ensuring that later transactions' intervals cannot overlap with its own.")

Spanner uses this to implement snapshot isolation across data centers: before committing a read-write transaction, it deliberately waits for the length of a confidence interval, so that later transactions cannot have intervals overlapping with its own, and the timestamp order then matches causality. The shorter the wait, the better, so Google deploys GPS receivers or atomic clocks in every data center, squeezing the uncertainty down to about 7 milliseconds. At the time of writing, no mainstream database outside Google had done this[^clockbound].

## Process pauses: a node doesn't even know how long it slept

Imagine a node that confirms its leadership through a **lease**: a lease is like a lock with a timeout, and it must be renewed before it expires. Before processing each request, the node checks how much time is left on the lease, renews it if it's running low, and then processes the request. The problem is that if the thread is paused for 15 seconds right after checking the lease and before processing the request, by the time it wakes up the lease has long expired, another node may have taken over as leader, and it has no idea—it just goes ahead and processes the request.

Can a thread really be paused for that long? Yes. There are plenty of reasons:

- Garbage collection "stop-the-world" pauses, sometimes lasting minutes[^cms];
- A virtual machine being suspended or live-migrated to another host, a laptop lid being closed;
- The operating system or hypervisor switching to another thread or virtual machine, which under heavy load can take a long time to come back around;
- Synchronous disk I/O, including the unexpected kind, such as Java loading a class the first time it is used; if the disk is network-attached, network latency adds on top;
- Paging when memory is short; in extreme cases the system is so busy swapping in and out that it can barely do anything;
- Someone sending SIGSTOP to the process.

So a node must assume that its execution can be paused for a long time at any moment, even in the middle of a function; meanwhile the world keeps moving, and others may have already declared it dead. Writing multithreaded programs on a single machine, you have tools like mutexes and atomic variables; a distributed system has no shared memory, so none of these tools apply.

Can pauses be eliminated outright? **Hard real-time** systems have done it, such as the systems controlling airbags, but that requires a real-time operating system, restrictions on dynamic memory allocation, and knowledge of the worst-case execution time of every library function—at great cost, and often with lower throughput. Server-side data systems won't do this; they can only mitigate the impact of pauses: for example, treating GC as a planned brief outage and routing requests away from the node before GC, or only garbage-collecting short-lived objects and restarting processes periodically.

## What a node can believe

All a node can know is the messages it has received (or not received). A node may think it is perfectly healthy while other nodes have already decided it is dead: the network may be broken in only one direction, so it receives messages but everything it sends is lost; or it may have just gone through a one-minute GC pause and woken up thinking nothing happened. So a node cannot fully trust its own judgment of the situation.

### The truth is decided by the majority

Distributed algorithms therefore often rely on **quorum** voting: a decision requires enough nodes to agree, usually more than half (see the [fifth post](/en/posts/ddia-05/)). If a majority of nodes declare a node dead, then it is dead—even if it believes it is still alive, it must comply and step down. The nice property of a majority is that two majorities cannot exist at the same time, so there cannot be two conflicting decisions.

### Fencing tokens

Systems often have things of which "there can be only one": a partition can have only one leader, a lock can have only one holder, a username can be registered by only one person. Even if a node believes it is that one, that doesn't mean a majority of nodes agree. The book mentions a bug in HBase of this kind: a client holding a lease was paused for too long, the lease expired and someone else acquired it, and when it woke up it still thought the lease was valid—two clients wrote to the same file at the same time and corrupted it.

The solution is **fencing**. We saw this word in the [fifth post](/en/posts/ddia-05/) when discussing split brain, where it meant shutting down the extra leader. Here the approach is: every time the lock service grants a lock or lease, it attaches a monotonically increasing **fencing token**; the client must include it in every write to storage; the storage service remembers the largest token it has seen and rejects any smaller one.

![Five time bars: client 1 holds the lease with token 33, and the lease expires about 40% along the timeline; client 1 hits a GC pause that starts before the lease expires and continues past it, without noticing the lease has expired; client 2 holds the lease after it expires, with token 34; client 2 writes with token 34 and succeeds; client 1 wakes up and writes with token 33, and is rejected. A note at the bottom: the storage has already processed token 34, and rejects anything smaller](./fencing.en.svg "Figure 3: Fencing tokens. Paused client 1 doesn't know its lease has expired, and after waking up it tries to write with the old token 33; the storage service has seen the larger token 34, so it rejects the write.")

The key point is that the check must be performed by the resource itself; you can't count on the client to behave. When using ZooKeeper as a lock service, the transaction ID `zxid` or the node version `cversion` can serve as a fencing token.

### Byzantine faults

Fencing tokens defend against nodes that make mistakes unintentionally, but not against nodes that deliberately lie: they can just forge a token. A node may send arbitrary wrong or even malicious messages; this is called a **Byzantine fault**, named after the Byzantine Generals Problem: a group of generals must agree on a battle plan, and some of them are traitors spreading false messages.

This book assumes nodes are unreliable but honest. Byzantine fault tolerance is only needed in aerospace (radiation can corrupt memory) and in systems with mutually untrusting parties (such as blockchains like Bitcoin). In a company's own data center, all nodes are under its control, and Byzantine fault tolerant protocols are complex and expensive, usually requiring more than two-thirds of nodes to be healthy. They also don't protect against software bugs, because all nodes run the same code—unless you have several independent implementations.

Still, it's worth defending against "small lies": add checksums at the application layer to catch corrupted network packets that slip past TCP's checksum; validate user input carefully; configure NTP clients with multiple servers and treat the one reporting an obviously wrong time as an outlier to be excluded.

## System models: reasoning amid uncertainty

Faced with so much uncertainty, the correctness of an algorithm must be discussed within a **system model**—that is, a written-down set of assumptions about which faults can happen. Commonly used models have two dimensions:

| Dimension | Model | Assumptions |
| --- | --- | --- |
| Timing | Synchronous | Network latency, process pauses, and clock error all have fixed upper bounds (unrealistic) |
| Timing | Partially synchronous | Behaves like a synchronous system most of the time, occasionally exceeds the bounds, and the excess can be arbitrarily large |
| Timing | Asynchronous | No timing assumptions at all, not even clocks |
| Nodes | Crash-stop | Nodes only crash, and never come back after crashing |
| Nodes | Crash-recovery | Nodes may crash and come back after a while; memory is lost, data on disk is preserved |
| Nodes | Byzantine | Nodes may do anything, including lying |

The combination closest to reality is partially synchronous plus crash-recovery.

Within a model, correctness is defined in terms of the algorithm's properties. Take fencing tokens as an example: tokens are unique, and tokens increase monotonically—these two are **safety** properties, meaning bad things never happen; once violated, the violation is irreparable, and you can point to the exact moment it happened. A node requesting a token will eventually receive a response as long as it hasn't crashed—this is **liveness**, meaning good things eventually happen; the definition often carries the word "eventually" (eventual consistency is a liveness property). Distributed algorithms usually require safety to hold under all circumstances, while liveness may come with conditions, such as "a majority of nodes have not crashed, and the network eventually recovers."

Models are, after all, simplifications of reality. The crash-recovery model assumes data on disk is never lost, but disks do fail, and firmware bugs can make a server fail to recognize its own disks after a reboot; quorum algorithms assume nodes remember what they have stored, and a node that "forgets" breaks their correctness. So real implementations still have to handle situations that "theoretically shouldn't happen." Theoretical analysis can uncover deeply hidden problems, and practical testing can uncover surprises outside the model—both are indispensable.

## Summary

This chapter is all bad news. I'd boil it down to three kinds of uncertainty, and a few tools for coping with them:

| Uncertainty | How it shows up | How to cope |
| --- | --- | --- |
| Network | Packets get lost and delayed; when there's no reply, you can't tell why | Timeouts (measured empirically, adaptive), but accept false positives |
| Clocks | They drift and jump; a reading is an interval | Use monotonic clocks for durations, logical clocks for ordering, monitor clock skew |
| Process pauses | Can stop for a long time at any moment, without the node itself knowing | Don't trust your own judgment: quorums, leases plus fencing tokens |

Partial failure is the defining characteristic of distributed systems. If a problem can be solved on one machine, it's best solved on one machine; when you distribute, it's usually for fault tolerance and low latency, and then you just have to accept these uncertainties and build fault tolerance into the software. Networks with bounded latency and real-time response guarantees are achievable—they're just too expensive, and most systems choose cheap and unreliable.

The next chapter turns to solutions: in such an environment, how nodes reach agreement on something.

## Glossary

| English | Chinese | Meaning |
| --- | --- | --- |
| partial failure | 部分失效 | Part of the system is broken while the rest keeps working |
| nondeterministic | 不确定的 | The same operation sometimes succeeds and sometimes fails |
| asynchronous packet network | 异步分组网络 | A network that guarantees neither when a packet arrives nor whether it arrives |
| timeout | 超时 | After waiting for a while with no reply, assume none is coming |
| cascading failure | 级联失效 | Falsely declaring a node dead, and the shifted load overwhelms other nodes |
| unbounded delay | 无界延迟 | Latency with no upper bound |
| Phi Accrual failure detector | Phi Accrual 故障检测器 | Adjusts the timeout automatically based on observed response times |
| circuit | 电路 | A connection with fixed bandwidth reserved along the route, with bounded latency |
| time-of-day clock | 日历时钟 | Returns the current date and time, and may jump backward |
| monotonic clock | 单调时钟 | Only moves forward, used for measuring durations |
| clock drift / clock skew | 时钟漂移 / 时钟偏差 | A clock running fast or slow / the difference between two clocks |
| last write wins (LWW) | 最后写入胜出 | Keeps the write with the largest timestamp and discards the others |
| logical clock | 逻辑时钟 | Orders events with an incrementing counter |
| confidence interval | 置信区间 | A clock reading is a range, not a point |
| lease | 租约 | A lock with a timeout, which the holder must renew periodically |
| stop-the-world | 全局停顿 | Garbage collection stopping all threads |
| hard real-time | 硬实时 | Must respond before a specified deadline |
| quorum | 法定人数 | The minimum number of votes required to make a decision, usually a majority |
| fencing / fencing token | 防护 / 防护令牌 | A number incremented each time a lock is granted; the resource rejects older tokens |
| Byzantine fault | 拜占庭故障 | A node lies, sending arbitrary wrong or malicious messages |
| system model | 系统模型 | Formalized assumptions about which faults can happen |
| partially synchronous | 部分同步 | Latency is bounded most of the time, occasionally arbitrarily large |
| crash-recovery | 崩溃-恢复 | A node may come back after crashing, with data on disk preserved |
| safety / liveness | 安全性 / 活性 | Bad things never happen / good things eventually happen |

[^leap]: The book was written in 2017. The last leap second was inserted on December 31, 2016, and there have been none since. In 2022, the 27th General Conference on Weights and Measures passed a resolution to relax the allowed gap between UTC and Earth's rotation time by 2035 at the latest, which in practice means leap seconds will no longer be inserted.

[^mifid]: The book was written in 2017, when MiFID II was still a draft. It officially took effect on January 3, 2018.

[^clockbound]: The book was written in 2017. Other cloud providers have since offered similar capabilities: starting in 2021, AWS made the open-source ClockBound available for reading the current time and its error bounds, and from 2023, supported EC2 instances can keep clock error within tens of microseconds.

[^cms]: The book was written in 2017. It says that even the HotSpot JVM's "concurrent" collector CMS needs stop-the-world pauses from time to time. CMS was marked deprecated in JDK 9 and removed in JDK 14 (2020); the later ZGC has been production-ready since JDK 15, performing most of its collection concurrently with application threads and with much shorter pauses—but still not zero, and all the other causes of process pauses remain.
