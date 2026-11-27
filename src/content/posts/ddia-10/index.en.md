---
title: "DDIA Reading Notes 10: Batch Processing"
description: "Notes on Chapter 10 of Designing Data-Intensive Applications, first edition: how the design of Unix pipes scales to thousands of machines, how MapReduce brings related data together for joins and grouping, why batch processing should output immutable datasets, and what dataflow engines like Spark and Flink improve."
sourceHash: "e9ec311704f025a4"
---

This is the tenth post in my DDIA reading notes. The [ninth post](/en/posts/ddia-09/) finished consistency and consensus, which closed out Part II of the book, "Distributed Data"; Chapter 10 is the first chapter of Part III, "Derived Data." This post is organized around a few threads as I understand them, not in the order of the book's sections. English quotations are from the original book; the rest is my own summary.

Part III starts by shifting perspective. The first two parts assume an application has a single database, but real applications usually use several systems at once: a database, a cache, a full-text index, an analytical data warehouse. The book divides systems that store and process data into two kinds: a **system of record** (also called the source of truth) holds the authoritative version of the data, where new data is written first and each fact is recorded once; **derived data** is the result of taking data from another system and transforming or processing it—caches, indexes, and materialized views, for example—and can be recomputed from the source if lost. Derived data is redundant, but it is often what makes fast reads possible. Whether a database counts as one kind or the other depends not on the database itself but on how the application uses it. The three chapters of Part III are all about how derived data is produced and maintained: this chapter is batch processing, Chapter 11 is stream processing, and Chapter 12 discusses how to build reliable, scalable, and maintainable applications with these tools.

The chapter opens with a quotation from Donald Knuth about TeX:

> A system cannot be successful if it is too strongly influenced by a single person. Once the initial design is complete and fairly robust, the real test begins as people with many different viewpoints undertake their own experiments.

A system only succeeds if it can withstand many different people running their own experiments on it. This chapter moves from Unix tools to MapReduce and then to Spark and Flink, and what it describes is exactly that kind of system: the input is immutable, the output can be recomputed at any time, and anyone can safely experiment with the data.

The book first distinguishes three kinds of systems:

| Type | How it runs | What matters most |
| --- | --- | --- |
| Services (online systems) | Wait for client requests and respond as quickly as possible | Response time, availability |
| Batch processing (offline systems) | Run a job over a large batch of input, usually on a schedule, taking minutes to days, with no one waiting | Throughput |
| Stream processing (near-real-time systems) | Process events shortly after they happen, somewhere in between | Latency |

Batch processing is actually very old: the punched-card tabulating machines used for the 1890 US Census were a kind of semi-mechanized batch processing. MapReduce was published by Google in 2004 and later implemented by systems like Hadoop. The book says its importance has been declining, but it explains clearly why batch processing is useful, so it is worth a close look.

## Unix pipes: batch processing in miniature

The book starts with a simple example: find the five most visited pages in a web server's access log. With Unix tools, it is a one-liner:

```bash
cat /var/log/nginx/access.log |
  awk '{print $7}' |
  sort             |
  uniq -c          |
  sort -r -n       |
  head -n 5
```

`awk` extracts the seventh field of each line, which is the requested URL; `sort` puts identical URLs next to each other; `uniq -c` counts how many times each URL appears consecutively; finally the counts are sorted in descending order and the top five are taken. This seemingly cryptic command can process several gigabytes of logs in seconds, and changing it to count client IPs is just a matter of changing one argument.

The same thing could be done with a small program that keeps a hash table in memory to count each URL. The difference between the two approaches is the **working set**, meaning how much memory needs to be randomly accessed. A hash table has to hold every distinct URL, and fails if there are too many; sorting, by contrast, can write sorted runs to disk in batches and then merge the sorted files, the same idea as the SSTables and LSM-trees in [the third post](/en/posts/ddia-03/), with all sequential disk I/O. GNU `sort` automatically spills data that does not fit in memory to disk and uses multiple CPU cores. So the sorting approach can handle data much larger than memory, and the bottleneck is usually just disk read speed.

What makes this pipeline possible is the Unix philosophy. The book quotes the 1978 summary by Doug McIlroy and others, one line of which is:

> Expect the output of every program to become the input to another, as yet unknown, program.

The output of every program should be able to become the input of another program, even one that does not exist yet. The other lines are: a program should do one thing well; get software into use early, and throw away and rewrite clumsy parts without hesitation; build tools first, to lighten the burden of programming. This sounds much like today's agile and DevOps, and has changed little in forty years. In design terms, it comes down to three characteristics:

- **Uniform interface**: every program reads and writes files, that is, an ordered sequence of bytes, conventionally treated as newline-delimited text records. Disk files, pipes, devices, and TCP connections all look like this, so any two programs can be connected. The cost is ambiguous parsing: `{print $7}` is far less readable than `{print $request_url}`;
- **Separation of logic and wiring**: a program only reads from standard input and writes to standard output, without caring where the data comes from or goes; how things are connected is up to the shell user. This becomes awkward when a program needs multiple inputs or outputs;
- **Transparency, good for experimentation**: input files are never modified, so you can run things repeatedly and try different arguments; you can insert `less` anywhere in the pipeline to inspect intermediate results; save the output of one step to a file, and the next step can be rerun on its own.

The biggest limitation of Unix tools is that they run on a single machine, which is where Hadoop came in.

## MapReduce: a pipeline across thousands of machines

A MapReduce job is much like a Unix process: it reads one or more inputs and produces one or more outputs, does not modify the input, and has no side effects other than the output. The difference is that it reads and writes files on a **distributed filesystem**, not local files.

Hadoop uses HDFS, the open-source implementation of Google's GFS, and it follows the **shared-nothing architecture** from [the fifth post](/en/posts/ddia-05/): each machine runs a daemon that serves files from its local disks, and a central server called the NameNode records which machines hold each file block. File blocks are replicated across machines, or stored with **erasure coding** such as Reed–Solomon codes, which uses less space than full replication. At the time of writing, the largest HDFS deployments ran on tens of thousands of machines with a total capacity of hundreds of petabytes.

### How a job runs

Returning to the log example, a MapReduce job has four steps:

1. Read the input files and break them into records; here, one line is one record;
2. Call the **mapper** on each record to extract a key and a value; here, the key is the URL and the value is empty, equivalent to `awk '{print $7}'`;
3. Sort all key-value pairs by key, equivalent to the first `sort`;
4. Call the **reducer** on the sorted key-value pairs; identical keys are adjacent, and all values for one key are processed together, equivalent to `uniq -c`.

Steps 2 and 4 are user-written code; the sort in step 3 is implicit. A mapper processes one record at a time, may emit any number of key-value pairs, and keeps no state between records; the framework collects all values for a key and hands them to the reducer as an iterator. The mapper's job is to shape the data into a form suitable for sorting, and the reducer's job is to process the sorted data. To sort by visit count as well, you need a second job.

Compared with a Unix pipeline, the biggest difference is that MapReduce runs in parallel across many machines, without the user writing any parallel code. The basis for parallelism is the partitioning from [the sixth post](/en/posts/ddia-06/): each input file block is processed by one map task, and the scheduler tries to place the task on the machine that holds that block, saving network transfer; the framework hashes the key to decide which reduce task each key-value pair goes to. Map tasks write their output as sorted files on local disk, partitioned by reducer, and reduce tasks fetch their own share and merge them. This process of partitioning by reducer, sorting, and copying from mappers to reducers is called the **shuffle**; despite the name, there is nothing random about it.

### Workflows

A single job can only do so much, so jobs are often chained into a **workflow**: the output directory of one job is the input directory of the next. Hadoop itself knows nothing about the relationship between two jobs, and a job's output only counts once the job has completed successfully, so a **workflow scheduler** such as Oozie, Azkaban, Luigi, or Airflow is needed to arrange the order. A workflow for building a recommender system commonly has 50 to 100 MapReduce jobs. Higher-level tools like Pig, Hive, and Cascading chain multiple stages into workflows automatically.

Jobs chained this way do not pass data directly through a small in-memory buffer between processes the way a Unix pipeline does; it is more like each command writing its output to a temporary file and the next command reading it. This difference will come up again later.

## Bringing related data together: joins and grouping

In a database, looking up a small number of records relies on indexes, but MapReduce has no concept of an index: reading input means a full scan. That is wasteful when you only want one record, but batch processing is precisely about aggregating over a large number of records, and a parallel full scan across many machines is reasonable. So a join in batch processing means resolving all occurrences of an association in one pass, processing all users at once, rather than looking up one user.

The book's example is the **star schema** from [the third post](/en/posts/ddia-03/): user activity events are the fact table, and the user database is a dimension table. To find out which pages people of different ages view most, you need to join the two. Processing events one by one and querying a remote database for each event limits throughput by network round-trips, can overwhelm the database, and the remote data can change at any time, making the job's result nondeterministic. A better approach is to put a copy of the user database (extracted from a backup by ETL, for example) into the distributed filesystem, and use MapReduce to bring related records to the same place.

### Reduce-side sort-merge joins

Two sets of mappers read the two inputs: the activity event mappers emit (user ID, event), and the user database mappers emit (user ID, date of birth). After partitioning and sorting by user ID, all records for one user are adjacent and go to the same reducer call. The sort can also be arranged so the user record comes first, followed by the events in time order; this is called a **secondary sort**.

![Two inputs: on the left, activity events, each with a user ID, URL, and time; on the right, the user database, each with a user ID and birth year. Each side goes through a map step, then down into a shuffle band spanning the full width, labeled partition and sort by user ID. Below the shuffle band are two reducer calls: the one for user 104 first receives the user record 1989, then the events /a 10:01 and /b 10:05 in time order; the one for user 173 receives the user record 1992 and the event /x 10:03](./sort-merge-join.en.svg "Figure 1: A reduce-side sort-merge join. The mappers for both inputs use the user ID as the key; after the shuffle partitions and sorts by key, records for the same user arrive at the same reducer call. The secondary sort puts the user record first, so the reducer only has to remember the birth year and then process the events one by one.")

The reducer first reads the date of birth, stores it in a local variable, then iterates over the user's events and emits (URL, visitor age). It only ever needs one user record in memory at a time, and it never makes a network request. This is a **sort-merge join**: the mapper outputs are sorted by key, and the reducer merges the sorted lists from both sides of the join.

From another angle, mappers are "sending messages" to reducers: the key is the address, and all messages with the same key are delivered to the same place. MapReduce separates the physical network communication (getting data to the right machine) from the application logic (what to do with the data once it arrives). The framework handles all the communication, and when a node crashes it quietly retries the failed task; the application code does not have to worry about any of it.

### Grouping and skew

Another use of bringing related data together is **grouping**, the equivalent of SQL's `GROUP BY`: use the grouping key as the mapper's output key, and partitioning and sorting will send all records in a group to the same reducer, which can then count, sum, or take the top few. So in MapReduce, grouping and joining look almost identical. A common example is **sessionization**: one user's clicks are scattered across the logs of many web servers, and grouping by session cookie or user ID reconstructs the user's sequence of actions, which can be used to analyze the effect of A/B tests.

This pattern breaks down when a single key has an unusually large amount of data. On a social network, most users have a few hundred friends, but a celebrity has millions of followers; such keys are called **hot keys**. Sending all of a celebrity's activity to one reducer causes **skew**: that reducer has far more work than the others, and the whole job waits for the slowest reducer to finish. The remedy follows the same idea as the hot-spot mitigation in [the sixth post](/en/posts/ddia-06/): use randomization to spread hot keys out. Pig's skewed join first runs a sampling job to find hot keys, then during the join sends records with a hot key to one of several reducers chosen at random, while replicating the related records on the other side to all of those reducers. When grouping and aggregating by a hot key, you can first send records randomly to several reducers for partial aggregation, and a second job combines the intermediate values into one value per key.

### Map-side joins

The joins above all happen in reducers, so they are called **reduce-side joins**. Their advantage is that they make no assumptions about the input; their disadvantage is that sorting, copying to reducers, and merging are all expensive, and the data may be written to disk several times. If you can make some assumptions about the input, the join can be done on the map side: no reducers, no sorting, each mapper reads one block of input and writes one output file.

![Two panels, one above the other. Top: a broadcast hash join. A full-width bar at the top is the user database, the small input, all records, feeding down into mapper 1 and mapper 2, each of which holds a hash table of all users; at the bottom, blocks 1 and 2 of activity events each feed up into one mapper. Bottom: a partitioned hash join. At the top are two partitions of users, those whose user ID ends in 0–4 and those ending in 5–9; at the bottom are activity event partitions divided the same way. Mapper 1 loads only users ending in 0–4, mapper 2 only those ending in 5–9](./map-side-joins.en.svg "Figure 2: Two kinds of map-side hash joins. A broadcast hash join loads the entire small input into each mapper's memory, and the large input can be partitioned any way; a partitioned hash join requires both inputs to be partitioned by the same key in the same way (here by the last digit of the user ID), and each mapper loads only the users in its own partition.")

| Join type | Requirement | How it works |
| --- | --- | --- |
| Reduce-side sort-merge join | None | Mappers partition and sort by the join key; reducers merge the sorted lists from both sides |
| Broadcast hash join | One input is small enough to fit in memory | Each mapper reads the entire small input into a hash table, then scans its block of the large input |
| Partitioned hash join | Both inputs are partitioned by the same key in the same way into the same number of partitions | Each mapper reads only the corresponding partition of the small input into a hash table |
| Map-side merge join | Both inputs are partitioned the same way and sorted by key | Mappers merge the two inputs sequentially, like reducers |

The **broadcast hash join** in the table is called MapJoin in Hive; the **partitioned hash join** is called a bucketed map join in Hive, and its requirement is easy to satisfy if the inputs were produced by earlier jobs that did the same grouping. The choice of join also affects the structure of the output: a reduce-side join's output is partitioned and sorted by the join key, while a map-side join's output follows the partitioning and ordering of the large input. So when optimizing joins, you also need to know how many partitions a dataset has and by what key it is partitioned and sorted; in the Hadoop ecosystem this metadata lives in HCatalog and the Hive metastore.

## Output: immutable datasets

Batch processing is neither transaction processing nor exactly analytics. Like analytics, it scans large inputs, but its output is often not a report but another data structure.

### Search indexes and key-value files

Google originally used MapReduce to build indexes for its search engine, as a workflow of five to ten jobs. The core of a full-text index is a dictionary that maps each keyword to the IDs of all documents containing it. For a fixed set of documents, building the index with batch processing is a natural fit: mappers partition the documents as needed, and each reducer builds the index for its partition and writes it back to the distributed filesystem. Once built, the index is read-only; when documents change, the whole workflow can be rerun periodically to replace the old index wholesale, or, like Lucene in [the third post](/en/posts/ddia-03/), new segments can be written incrementally and merged in the background. A full rebuild is computationally expensive, but very easy to reason about: documents go in, an index comes out.

Another common kind of output is a database that machine learning applications such as recommenders need to query, for example looking up people you might know by user ID. The most direct approach is to call a database client from the mapper or reducer and write records one by one; the book says this is a bad idea. Each record costs a network round-trip, several orders of magnitude slower than normal batch throughput; many tasks writing simultaneously can easily overwhelm the database; and MapReduce guarantees all-or-nothing—a failed job produces no output—whereas writing to an external system from within a job means partially completed results are visible to others, and task retries and speculative execution cause duplicate writes.

A better approach is to generate a brand-new database inside the job: write the data files into the output directory as if building an index, then load them in bulk onto servers that answer read-only queries. Voldemort, Terrapin, ElephantDB, and HBase's **bulk loading** all support this[^voldemort]. Sorting by key is already most of the work of building an index, and since the files are read-only, no write-ahead log is needed. When Voldemort loads new data, it keeps serving requests from the old files, copies the new files locally, then atomically switches over; if anything goes wrong, it can switch back at any time.

### Why outputs should be immutable

This follows from the Unix philosophy: immutable inputs, no side effects, and each new output replaces the old one wholesale. The benefits go beyond performance:

- **Tolerance for human error**: if the code has a bug and the output is wrong, roll back the code and rerun, or switch back to the old output directory. A read-write database does not have this property: data written incorrectly will not be restored just because the code was rolled back;
- **Faster development**: when mistakes are easy to undo, you can try new features more quickly. The book calls this **minimizing irreversibility**;
- **Retries are safe**: if a task fails, the framework reruns it elsewhere, and the failed task's output is simply discarded, because the input was never modified;
- **One dataset, many uses**: the same files can feed several jobs, including monitoring jobs that compare against the previous run's results.

Unlike Unix, Hadoop usually does not use untyped text but schemaful formats like Avro and Parquet (see [the fourth post](/en/posts/ddia-04/)), avoiding low-value parsing.

## Hadoop and MPP databases

Hadoop is a bit like a distributed version of Unix: HDFS is the filesystem, and MapReduce is a peculiar kind of Unix process that always runs a `sort` between map and reduce. When the MapReduce paper was published, it was in a sense not new at all: the parallel join and processing algorithms described above had already been implemented more than a decade earlier in **massively parallel processing** (MPP) databases such as Gamma, Teradata, and Tandem NonStop SQL. The difference is that MPP databases are specialized for executing analytical SQL in parallel on a cluster, whereas MapReduce plus a distributed filesystem provides something more like a general-purpose operating system that can run arbitrary programs.

| | MPP database | Hadoop (MapReduce) |
| --- | --- | --- |
| Storage | Data is carefully modeled before import, stored in a proprietary format | Files are just sequences of bytes; any format can be stored first |
| Processing | SQL, a monolithic, tightly coupled piece of software, well optimized | Arbitrary code, multiple processing models sharing one cluster |
| Faults | A node crash aborts the entire query | Only the failed tasks are rerun |
| Memory and disk | Tries to keep data in memory | Writes to disk eagerly |

### Store first, think later

Hadoop lets you dump data into HDFS first and decide how to process it later. A purist might argue that careful modeling up front is better, but in practice, making data available quickly—even in an awkward, hard-to-use format—is often more valuable than settling on the ideal data model first. This approach is called a **data lake** or enterprise data hub: collect data from everywhere in its raw form, shifting the burden of interpreting the data from producers to consumers, which is the **schema-on-read** from [the second post](/en/posts/ddia-02/). Different teams can transform the same raw data into whatever shape they need; this is called the **sushi principle**: raw data is better. Hadoop is often used for ETL: dump raw data from transactional systems into the distributed filesystem, use MapReduce to clean it up and transform it into relational form, then import it into an MPP data warehouse for analysis. Modeling still happens; it is just decoupled from data collection.

The same applies to processing. Recommender systems, full-text indexes with relevance ranking, and image analysis cannot be written in SQL alone; they require code. Hive implements SQL on top of MapReduce, and the same cluster can also run a random-access database like HBase and an MPP-style analytics engine like Impala, all sharing the same files on HDFS, without moving data around.

### Designed for frequent task termination

Why does MapReduce retry only at the task level, and why does it write to disk so eagerly? Machines do fail, but not so often that most jobs would be affected. Is the overhead of fault tolerance worth it?

You have to look at its original operating environment. Google's data centers are shared: online production services and offline batch processing run on the same machines, each task has a resource quota and a priority, and when a high-priority task needs resources, it can terminate (preempt) lower-priority tasks on the same machine. This makes it safe to oversell low-priority compute resources, and machine utilization is higher than if production and non-production workloads were separated. MapReduce jobs run at low priority, using the resources left over by higher-priority processes, and can be preempted at any time. At Google, a MapReduce task running for an hour has about a 5% chance of being terminated, more than an order of magnitude higher than the failure rate from hardware faults, machine restarts, and other causes. At that rate, a job with 100 tasks running 10 minutes each has a greater than 50% chance of having at least one task terminated midway.

So MapReduce tolerates frequent, unexpected task termination not because the hardware is especially unreliable, but because the ability to terminate processes at will is what makes the cluster's resources more fully utilized. At the time of writing, open-source schedulers rarely did this: YARN's CapacityScheduler could preempt to balance resources between queues, but YARN, Mesos, and Kubernetes did not support general priority-based preemption[^k8s]. In environments where tasks are not terminated often, these MapReduce design choices make less sense.

## Beyond MapReduce

The book spends so much time on MapReduce because it is easy to understand and a good learning tool; but it is not pleasant to use, and writing any kind of join with the native API means implementing it from scratch. Higher-level tools like Pig and Hive solved the usability problem, but the problems with the MapReduce execution model itself cannot be fixed by adding another layer of abstraction.

### The cost of materializing intermediate state

If a job's output is to be published to other teams in the organization, writing it as files on the distributed filesystem is reasonable. But often a job's output is only used by the next job of the same team; it is just **intermediate state**. Writing intermediate state to files is called **materialization**, the same word as the materialized views in [the third post](/en/posts/ddia-03/): computing the result ahead of time and writing it out, rather than computing it on demand. A Unix pipeline does not materialize intermediate state; it uses a small in-memory buffer and streams output bit by bit to the next program.

MapReduce materializes all intermediate state completely, which has three drawbacks:

- The next job has to wait for all tasks of the previous job to finish before it can start, and skew or uneven machine load often makes a few tasks much slower than the rest, slowing down the whole workflow;
- Mappers are often redundant: they just read back the files the previous reducers just wrote, to prepare for the next partitioning and sorting; this code could have been folded into the previous reducers;
- Intermediate state stored in the distributed filesystem is replicated across several nodes, which is excessive for temporary data.

![Two timelines, one above the other, with time on the horizontal axis. Top: MapReduce. Job 1 has three tasks, the slowest of which runs a bit past halfway; then a short segment labeled write to HDFS, replicated three times; a dashed line marks where job 2's two tasks begin, and the whole workflow finishes near the right edge. Bottom: a dataflow engine. Operator 1's three tasks look the same as above, and operator 2's two tasks start almost immediately, processing data as it arrives; once the slowest task finishes, the workflow completes soon after](./materialization.en.svg "Figure 3: The same two-step workflow. In MapReduce, job 2 cannot start until job 1's slowest task finishes and the output has been written to HDFS and replicated. In a dataflow engine, operators that do not need sorting can process upstream output as it arrives. Operators that need sorting still have to wait for all their input, but intermediate data does not have to be written to HDFS.")

### Dataflow engines

**Dataflow engines** such as Spark, Tez, and Flink emerged to solve these problems. They treat the whole workflow as a single job, still calling user-defined functions on each record and parallelizing by partitioning, except that these functions are called **operators** and do not have to strictly alternate between map and reduce. Between operators, data can be repartitioned and sorted by key (like a shuffle), or repartitioned without sorting, or one output can be broadcast to all partitions. The benefits: sorting happens only where it is actually needed; there are no redundant map tasks; the scheduler sees the whole workflow and can place tasks that consume data on the machines that produce it; intermediate state lives in memory or on local disk, not in HDFS, so it does not need to be replicated; an operator can start as soon as its input is ready, without waiting for the entire previous stage to finish. Workflows written in Pig or Hive can be switched from MapReduce to Tez or Spark with a configuration change.

Without HDFS, fault tolerance needs a different approach: when a machine dies and its intermediate state is lost, the lost data is recomputed from whatever is still available. To do this, the framework must remember how each piece of data was computed; Spark records this **lineage** in RDDs, while Flink checkpoints operator state. When recomputing, whether an operator is **deterministic** matters a lot: if part of the lost data has already been sent downstream, and the recomputed data differs from the original, downstream cannot reconcile the old and new data and must be rerun too. Hash tables with nondeterministic iteration order, random numbers, and the system clock can all quietly introduce nondeterminism; random numbers, for example, should be generated from a fixed seed. Recomputing is not always cheaper either: when intermediate data is small, or the computation is very CPU-intensive, materializing it may be cheaper.

Returning to the Unix analogy: MapReduce is like writing each command's output to a temporary file, while dataflow engines are more like Unix pipes, and Flink in particular is designed around pipelined execution. Of course, sorting cannot produce its first output until it has read all its input, so operators that need sorting always have to hold some state temporarily. The job's inputs and final outputs still live on HDFS, and the principle of immutable inputs and wholesale output replacement is unchanged.

### Graphs and iterative processing

The graph model in [the second post](/en/posts/ddia-02/) is an OLTP-style use; batch processing is concerned with offline analysis over an entire graph, such as PageRank, the algorithm that ranks web pages by their links. Algorithms like this propagate information along edges step by step, repeating until some condition is met, whereas each round of MapReduce has to read the entire input and write a brand-new output, even if only a small part of the graph changed.

This led to the **bulk synchronous parallel** (BSP) model, popularized by Google's Pregel paper and implemented by Apache Giraph, Spark's GraphX, and Flink's Gelly. The idea is similar to mappers sending messages to reducers: vertices send messages to other vertices along edges, and in each round a function is called once for each vertex, given the messages it received; the difference is that vertices keep their state across rounds in memory, and parts of the graph that received no messages do no work at all. Fault tolerance comes from checkpointing the state of all vertices at the end of each round. Graphs are usually partitioned arbitrarily by vertex ID, so there are many cross-machine messages; the book therefore cautions that when a graph fits in the memory of one machine, a single-machine or even single-threaded algorithm is likely to be faster than distributed batch processing.

### High-level APIs: increasingly like databases

Writing MapReduce jobs by hand is too much work, which is why high-level languages like Hive and Pig became popular, and Spark and Flink have their own dataflow APIs. They mostly express computation with relational building blocks: joins, grouping, filtering, aggregation, using exactly the algorithms described in this chapter. When a join is declared with relational operators, the framework can analyze the characteristics of the inputs and choose the join algorithm automatically; Hive, Spark, and Flink all have cost-based query optimizers that can even reorder joins, which is the declarative querying from [the second post](/en/posts/ddia-02/). At the same time, they can still call arbitrary code and use existing libraries in various languages, which has always been the difference between these systems and MPP databases.

If simple filtering and column selection are also written declaratively, the query optimizer can take advantage of column-oriented storage to read only the needed columns, and can use the **vectorized processing** from [the third post](/en/posts/ddia-03/): Spark generates JVM bytecode, and Impala uses LLVM to generate native code, processing data in tight loops that are friendly to CPU caches. Batch processing frameworks are thus becoming more and more like MPP databases, with comparable performance, while retaining the flexibility to run arbitrary code and read and write arbitrary formats; MPP databases, in turn, are becoming more programmable. In the end, both sides are just systems for storing and processing data.

## Summary

A few things I took away from this chapter:

- The core of batch processing is immutable inputs and no side effects. Because mappers and reducers are constrained to be stateless callback functions, the framework can safely retry and discard the output of failed tasks, hiding the two hardest problems—partitioning and fault tolerance—behind an abstraction;
- Joins and grouping are, at heart, both about bringing related data to the same place. When no assumptions can be made, use a reduce-side sort-merge join; when one side is small or both sides are already partitioned the same way, use a map-side join;
- The product of batch processing is derived datasets, such as indexes and read-only key-value files, replaced wholesale and rollback-able;
- MapReduce writes to disk eagerly and retries only individual tasks because it was designed for an environment where low-priority tasks can be preempted at any time;
- Dataflow engines no longer materialize all intermediate state, at the cost of requiring deterministic operators for recomputation; with declarative APIs, batch processing frameworks and MPP databases are converging.

The book's summary is:

> The distinguishing feature of a batch processing job is that it reads some input data and produces some output data, without modifying the input—in other words, the output is derived from the input.

A batch processing job reads input and writes output, never modifying the input; the output is derived from the input, which ties directly into the theme of Part III. Its input is **bounded**: the size is known and fixed, such as a set of log files at a point in time or a snapshot of a database, so the job knows when it has finished reading the input and will eventually terminate. Chapter 11 covers stream processing, where the input is **unbounded** and never ends; change that one premise, and many aspects of system design change with it.

## Glossary

| English | Chinese | Meaning |
| --- | --- | --- |
| system of record | 记录系统 | The system that holds the authoritative version of the data |
| derived data | 派生数据 | Data transformed or processed from another system's data, recomputable if lost |
| working set | 工作集 | The memory that needs to be randomly accessed |
| uniform interface | 统一接口 | In Unix, the file: an ordered sequence of bytes |
| separation of logic and wiring | 逻辑与布线分离 | Programs only read and write; how they are connected is decided externally |
| distributed filesystem | 分布式文件系统 | A filesystem built from the disks of many machines, such as HDFS |
| mapper / reducer | mapper / reducer | The function that extracts key-value pairs from records / the function that processes all values for one key |
| shuffle | 混洗 | Partitioning by reducer, sorting, and copying from mappers to reducers |
| secondary sort | 二次排序 | Making values for the same key arrive in a particular order |
| sort-merge join | 排序合并连接 | Merging two inputs after sorting them by the join key |
| hot key | 热键 | A key with an unusually large amount of data, causing skew |
| broadcast hash join | 广播哈希连接 | Loading the entire small input into every mapper's hash table |
| partitioned hash join | 分区哈希连接 | Both inputs partitioned the same way, each partition hash-joined separately |
| bulk loading | 批量加载 | Loading data files produced by batch processing into a database wholesale |
| data lake | 数据湖 | Data stored centrally in its raw form |
| materialization | 物化 | Computing an intermediate result ahead of time and writing it down |
| dataflow engine / operator | 数据流引擎 / 算子 | An engine that runs a whole workflow as one job / a processing function within it |
| lineage | 血缘 | Which inputs and operators a piece of data was computed from |
| bulk synchronous parallel (BSP) | 批量同步并行 | A graph computation model that passes messages between vertices in rounds |
| bounded / unbounded | 有界 / 无界 | Input of fixed size / input that never ends |

[^voldemort]: The book was written in 2017. LinkedIn later replaced Voldemort's read-only storage with its own Venice: by 2018, roughly 500 such use cases had all been migrated, with batch jobs still pushing data wholesale. Venice was open-sourced in 2022.

[^k8s]: The book was written in 2017. Kubernetes later added Pod priority and preemption: alpha in version 1.8 in 2017, enabled by default (beta) in 1.11 in 2018, and generally available (GA) in 1.14 in March 2019.
