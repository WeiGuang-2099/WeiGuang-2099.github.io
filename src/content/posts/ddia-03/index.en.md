---
title: "DDIA Reading Notes 03: Storage and Retrieval"
description: "Notes on Chapter 3 of the first edition of Designing Data-Intensive Applications: how hash indexes, SSTables and LSM-trees, and B-trees store data on disk and find it again, the costs of the two families of storage engines, and why data warehouses turn to column-oriented storage."
sourceHash: "6748fce57eb5e79f"
---

This is the third post in my DDIA reading notes. [The second post](/en/posts/ddia-02/) covered data models and query languages—what the data an application hands to a database looks like and how to ask for it. Chapter 3 goes one level deeper, looking at how a database itself stores data on disk and finds it again when needed. The English quotations in the text are from the original book; the rest is my own retelling and organization.

The chapter opens with a German proverb:

> Wer Ordnung hält, ist nur zu faul zum Suchen.
> (If you keep things tidily ordered, you're just too lazy to go searching.)

The gist is: people who keep things neatly ordered are just too lazy to go looking for them. It fits this chapter well, because an index is ultimately about organizing data in advance so you don't have to rummage around when you need to find something.

At the most fundamental level, a database does only two things: you hand it data, and it stores it; later you come back for it, and it gives it back. Application developers rarely write their own storage engines—they usually pick one from the shelf—but it's still worth knowing roughly how one works internally: that's how you choose the right engine for your application and know how to tune it when needed. In particular, engines optimized for transactional workloads and engines optimized for analytical workloads differ greatly, and the second half of this chapter is devoted to the latter.

The first half covers two families of storage engines: **log-structured** storage engines, and **page-oriented** storage engines, represented by B-trees.

## Data structures that power your database

The book starts by building the simplest possible key-value database out of two Bash functions:

```bash
db_set () {
    echo "$1,$2" >> database
}

db_get () {
    grep "^$1," database | sed -e "s/^$1,//" | tail -n 1
}
```

`db_set` appends a key-value pair to the end of a file in the form `key,value`. When the same key is written again, the old line is not overwritten; the new value is simply appended after it, so `db_get` uses `tail -n 1` to take the last occurrence.

This "database" is actually quite fast to write to, because appending to the end of a file is a very efficient operation, and many real databases have an append-only data file like this internally. The book's term **log** is this general sense of the word: a sequence of records that can only be appended to, not necessarily a human-readable application log—it can also be a binary format meant only for programs to read.

Reading is another matter: `db_get` has to scan the entire file from beginning to end every time, at O(n) cost—double the number of records, double the lookup time. To find a value by key efficiently, you need another data structure: an **index**. An index is some extra metadata maintained alongside the main data, like signposts that help you find the data you want; if you want to query the same data in several different ways, you may need to build several different indexes on different parts of it.

An index is an additional structure derived from the primary data. Adding or removing an index does not change the contents of the database; it only affects the performance of queries. But maintaining an index has a cost: every write has to update the index as well, and it's hard to find any kind of write that is faster than simply appending to the end of a file. This is an important trade-off in storage systems:

> well-chosen indexes speed up read queries, but every index slows down writes.

So databases generally don't index everything by default; instead, they let the application developer or database administrator choose indexes manually, based on the application's typical query patterns, to get the most benefit for the least extra overhead.

### Hash indexes

Let's start with indexes for key-value data. The hash map found in most programming languages can be used to index data on disk.

The simplest approach: data is still only appended to the end of a file, while an in-memory hash map maps each key to the byte offset of its value in the data file. When writing a key-value pair, in addition to appending to the file, you update the key's offset in the hash map to the new position (for both new and existing keys); when looking up, you first look up the offset in the hash map, then jump to that position in the file and read the value.

This sounds too simple to work, but it does—**Bitcask**, the default storage engine in Riak, does exactly this. It requires all keys to fit in memory; values can be larger than memory and live on disk, and reading a value usually takes just one disk seek. If the relevant part of the data file is already in the filesystem cache, there's no disk I/O at all. This kind of engine suits workloads where each key's value is updated frequently—for example, the key is the URL of a cat video and the value is how many times it has been played: lots of writes, but not so many distinct keys that they don't fit in memory.

#### Segments and merging

If you keep appending to the same file forever, you'll eventually run out of disk space. The solution is to break the log into **segments** of a certain size: when the current segment file reaches a certain size, close it and direct subsequent writes to a new segment file. Then perform **compaction** on these segments: throw away duplicate keys in the log, keeping only the most recent value for each key.

Compaction usually makes segments much smaller (a key is often overwritten several times), so you can also **merge** several segments into one at the same time. Once a segment is written, it is never modified again, and the result of a merge is written to a new file, so merging can be done in a background thread: while it's running, read requests continue to read the old segments and write requests continue to write to the current segment; once the merge is complete, read requests switch to the new segment and the old segment files can be deleted.

Each segment has its own in-memory hash map. To look up a key, check the hash map of the newest segment first, then the next newest, and so on. Merging keeps the number of segments small, so a lookup doesn't have to check too many hash maps.

#### Details of a real implementation

Turning this idea into a usable engine involves quite a few details:

| Problem | Approach |
| --- | --- |
| File format | Not CSV, but a binary format: write the byte length of the string first, followed by the raw string, no escaping needed |
| Deleting records | Append a special deletion record called a **tombstone**; when merging encounters a tombstone, discard all previous values for that key |
| Crash recovery | After a restart, the in-memory hash maps are gone. You can rebuild them by reading each segment from start to finish, but that's too slow for large segments; Bitcask stores a snapshot of each segment's hash map on disk, which loads much faster |
| Partially written records | The database may crash in the middle of appending a record; Bitcask's files include checksums that allow such corrupted parts to be detected and ignored |
| Concurrency control | Writes must be appended strictly in order, so there's usually only one writer thread; segment files are append-only and immutable once written, so they can be read by multiple threads concurrently |

#### Why append-only?

At first glance, append-only seems wasteful: why not overwrite the old value in place in the file? The book gives several reasons:

- Appending and merging segments are both **sequential writes**, which are generally much faster than random writes, especially on spinning disks; on flash-based solid-state drives (SSDs), sequential writes are also somewhat better;
- Segment files being append-only or even immutable makes concurrency and crash recovery much simpler—for example, you don't have to worry about a crash happening exactly in the middle of overwriting a value, leaving half the old value and half the new one;
- Merging old segments avoids data files becoming fragmented over time.

#### Limitations of hash indexes

Hash table indexes have two limitations:

- **The hash table must fit in memory.** If there are a huge number of keys, this doesn't work. In principle you could put the hash table on disk, but hash tables on disk are hard to do well: they require a lot of random I/O, resizing a full table is expensive, and handling hash collisions requires a lot of fiddly logic;
- **Range queries are inefficient.** If you want to find all keys between `kitty00000` and `kitty99999`, a hash table doesn't help—you'd have to look up each key individually.

The next index structure has neither of these limitations.

### SSTables and LSM-trees

Make one small change to the segment file format above: require the key-value pairs in a segment to be **sorted by key**. This format is called a **Sorted String Table**, or **SSTable** for short. It also requires each key to appear only once in each merged segment file, which compaction already guarantees.

Sorting by key might seem to make sequential writes impossible—we'll get to that later. First, let's look at three benefits that sorting brings.

First, **merging segments is simple and efficient**, even when the files are larger than available memory. The approach is the merge from merge sort: open several input files at once, read the first key from each, write the smallest one along with its value to the output file, then read the next key from the file it came from, and repeat. Every key in every input segment ends up in the output, and the new output segment is also sorted by key. If the same key appears in several input segments, keep the value from the newest segment and discard the values from older ones: each segment contains only writes from a certain period of time, so the value in a newer segment is definitely newer than the one in an older segment.

Second, **you no longer need an index of all keys in memory**. Suppose you're looking for `handiwork`, and you don't know its exact offset in the segment file, but you do know the offsets of `handbag` and `handsome`; since the file is sorted, `handiwork` must be between those two, so you can scan forward a short distance from the position of `handbag` to find it, or confirm it doesn't exist. So the in-memory index can be **sparse**: one key every few kilobytes of segment file is enough, because scanning a few kilobytes of data is very fast.

Third, since read requests have to scan over a range of key-value pairs anyway, you can **group those records into blocks, compress them, and write them to disk**, with each entry in the sparse index pointing to the start of a compressed block. This saves both disk space and I/O bandwidth.

#### Constructing and maintaining SSTables

Writes arrive in arbitrary order; how do you get the data sorted by key? Maintaining a sorted structure on disk is possible (B-trees, coming up, do this), but maintaining it in memory is much easier: balanced trees like red-black trees or AVL trees can insert keys in any order and read them back in sorted order. So the storage engine works like this:

1. When a write comes in, insert it into an in-memory balanced tree called the **memtable**;
2. When the memtable exceeds some threshold (usually a few megabytes), write it to disk as an SSTable file. Since the tree is already sorted, this step is efficient. The new SSTable becomes the newest segment of the database; while it's being written, new writes go into a new memtable;
3. A read request checks the memtable first, then the newest segment on disk, then the next newest, and so on down to the oldest segment;
4. In the background, merge and compact segment files from time to time, discarding overwritten or deleted values.

This scheme has only one problem: if the database crashes, the most recent writes still in the memtable, not yet written to disk, are lost. So you also keep a separate log on disk, to which every write is appended immediately. This log doesn't need to be sorted, because its only purpose is to rebuild the memtable after a crash; once a memtable has been written out as an SSTable, the corresponding log can be discarded. It plays the same role as the write-ahead log in B-trees, coming up, and Figure 1 calls it that too.

![Writes are first appended to the write-ahead log on disk and inserted into the in-memory memtable, sorted by key; when the memtable exceeds a threshold, it is written to disk as a new SSTable; in the background, multiple SSTables are merged and compacted; reads check the memtable first, then the SSTables from newest to oldest](./lsm-tree.en.svg "Figure 1: The write and read paths of an LSM-tree storage engine. The write-ahead log is used only to rebuild the memtable after a crash; once the memtable is written out as an SSTable, the corresponding log can be discarded.")

#### From SSTables to LSM-trees

The algorithm above is essentially what LevelDB and RocksDB use. Both are key-value storage engine libraries designed to be embedded in other applications, and LevelDB can also replace Bitcask in Riak. Cassandra and HBase have similar storage engines, all inspired by Google's Bigtable paper—the terms memtable and SSTable come from that paper.

This index structure was first described by Patrick O'Neil and others in 1996 under the name Log-Structured Merge-Tree, or **LSM-tree**, building on earlier research on log-structured file systems. Storage engines based on the principle of "merging and compacting sorted files" are usually called LSM storage engines.

The full-text search engine Lucene (used by Elasticsearch and Solr) uses a similar approach for its term dictionary. A full-text index is much more complex than a key-value index, but the basic idea is similar: given a word in a query, find all the documents that mention it. This can be implemented as a key-value structure where the key is a term and the value is the list of IDs of all documents containing that term (the postings list). In Lucene, the mapping from terms to postings lists is stored in sorted files similar to SSTables, merged in the background as needed.

#### Performance optimizations

Looking up a key that doesn't exist can be slow in an LSM-tree: you have to check the memtable, then all the segments down to the oldest one (each potentially requiring a disk read) before you can be sure it doesn't exist. To address this, storage engines usually add a **Bloom filter**. It's a memory-efficient data structure for approximately representing a set: it can tell you that a key is **definitely not** in the database, saving many unnecessary disk reads for nonexistent keys.

There are also different strategies for deciding when and in what order SSTables are compacted and merged. The two most common are:

- **Size-tiered**: newer, smaller SSTables are successively merged into older, larger SSTables;
- **Leveled**: the key range is split into many smaller SSTables, and older data is moved into separate "levels," allowing compaction to proceed more incrementally and use less disk space.

LevelDB and RocksDB use leveled compaction (hence LevelDB's name), HBase uses size-tiered, and Cassandra supports both.

Despite all the details, the basic idea of LSM-trees—continuously merging a series of SSTables in the background—is both simple and effective: it works well even when the dataset is far larger than memory; data is sorted by key, so range queries are efficient; and disk writes are all sequential, so it can sustain very high write throughput.

### B-trees

Log-structured indexes are becoming more common, but the most widely used index structure is a different one: the **B-tree**. Introduced in 1970, it was called "ubiquitous" less than a decade later, and it is the standard index implementation in almost all relational databases, as well as many nonrelational ones.

Like SSTables, B-trees keep key-value pairs sorted by key, so key lookups and range queries are efficient, but the design philosophy is quite different. Log-structured indexes break the database into segments of variable size, typically several megabytes or more, and always write them sequentially; B-trees break the database into **fixed-size** blocks, or **pages**, traditionally 4 KB (sometimes larger), and read or write one page at a time. This is closer to the underlying hardware, since disks are themselves made up of fixed-size blocks.

Each page has an address, and pages can reference one another, like pointers, except on disk rather than in memory. These references organize the pages into a tree. A lookup starts at the **root page**: the root page contains several keys and several references to child pages, each child responsible for a continuous range of keys, with the keys between the references marking the boundaries of those ranges.

For example, to look up key 251: in the root page, it falls between the boundaries 200 and 300, so you follow the reference between those two keys; the page at the next level splits the range 200–300 into smaller subranges, and you follow the corresponding reference down again, eventually reaching a **leaf page** that holds individual keys. In a leaf page, each key either carries its value directly or carries a reference to the page where the value is stored.

![A three-level B-tree: the root page contains keys 100, 200, 300, 400 and child page references between them; looking up 251 follows the reference between 200 and 300 to a page at the middle level, then the reference between 240 and 260 to a leaf page, where 251 is found](./btree-lookup.en.svg "Figure 2: Looking up key 251 in a B-tree. Two adjacent keys in a page delimit the range a child page is responsible for; at each level you pick one range and go down, eventually reaching the leaf page that holds 251.")

The number of child page references in a page is called the **branching factor**. In Figure 2, to keep it drawable, each page has only 5 references; in practice the branching factor depends on how much space page references and range boundaries take up, and is typically several hundred.

To update the value of an existing key, find the leaf page containing it, change the value, and write the whole page back to disk; all references to that page remain valid. To insert a new key, find the page whose range includes it and add the key; if the page doesn't have room, split it into two half-full pages and update the parent page to reflect the new range boundaries.

This ensures the tree is always **balanced**: a B-tree with n keys always has depth O(log n). Most databases have B-trees only three or four levels deep, so lookups don't have to follow too many references. The book gives a number: a four-level B-tree with 4 KB pages and a branching factor of 500 can store up to 256 TB.

#### Making B-trees reliable

The basic write operation of a B-tree is **overwriting a page on disk with new data**, with the assumption that the overwrite does not change the page's location, so all references to it remain valid after the overwrite. This is the opposite of LSM-trees: LSM-trees only append to files (and eventually delete obsolete files), never modify them in place.

Overwriting a page can be seen as a real hardware operation: on a spinning disk, the head has to move to the right position, wait for the platter to rotate to that position, and then overwrite the appropriate sector with new data; SSDs are more complicated, because an SSD must erase and rewrite a fairly large block of the storage chip at a time.

Some operations have to overwrite several pages. For example, when an insert causes a page split, you have to write the two split pages and also overwrite the parent page to update its references. This is dangerous: if the database crashes after only some of those pages have been written, the index is corrupted—for example, leaving an orphan page that no parent points to.

To recover from crashes, B-tree implementations usually maintain an additional **write-ahead log** (WAL, also called a redo log) on disk. It's an append-only file, and every modification to the B-tree must be written to this log before it can be applied to the tree's pages. After a crash and restart, the log is used to restore the B-tree to a consistent state.

Updating pages in place also brings concurrency headaches: if multiple threads access a B-tree at the same time without careful concurrency control, one thread may see the tree in an inconsistent intermediate state. The usual approach is to protect the tree's data structures with **latches** (lightweight locks). The log-structured approach is much simpler in this regard: merging happens in the background without disturbing incoming queries, and when it's done, the new segment atomically replaces the old one.

#### B-tree optimizations

B-trees have been around for a long time and have accumulated many optimizations. The book lists these:

- Some databases (such as LMDB) don't use "overwrite pages + write-ahead log" for crash recovery; instead they use **copy-on-write**: a modified page is written to a new location, and a new version of the parent page is created pointing to that new location. This also helps with concurrency control, as we'll see in Chapter 7 on snapshot isolation;
- **Abbreviate keys** to save space in pages. Especially in internal pages of the tree, keys only need to serve as range boundaries; they don't need to be stored in full. More keys per page means a higher branching factor and fewer tree levels;
- Pages can in principle be anywhere on disk; pages with adjacent ranges are not necessarily adjacent on disk. If a query often scans a large range of keys in order, reading page by page may require many seeks, so many B-tree implementations try to lay out leaf pages on disk in key order—but the tree keeps growing, making this hard to maintain. LSM-trees rewrite a large chunk of data at once during merging, so it's much easier to keep adjacent keys close together on disk;
- Add extra pointers to the tree, such as each leaf page having references to its left and right sibling pages, so scanning keys in order doesn't have to jump back to parent pages;
- Variants of B-trees such as **fractal trees** borrow some ideas from log-structured approaches to reduce disk seeks.

### Comparing B-trees and LSM-trees

B-tree implementations are generally more mature than LSM-trees, but the performance characteristics of LSM-trees are also attractive. A rule of thumb is that LSM-trees are typically faster for writes, while B-trees are considered faster for reads. Reads are slower on LSM-trees because they have to check several different data structures and multiple SSTables at different stages of compaction.

However, benchmark results are often inconclusive and highly sensitive to the details of the workload—you need to test with your own actual workload for the comparison to be meaningful. Here are a few points worth considering when evaluating storage engine performance.

#### Advantages of LSM-trees

Every piece of data in a B-tree index is written at least twice: once to the write-ahead log and once to the tree page itself (and again if a page split occurs). And even if only a few bytes in a page change, you pay the cost of writing the whole page. Some storage engines even write the same page twice to avoid leaving a half-updated page in the event of a power failure.

Log-structured indexes also rewrite data multiple times, because SSTables are repeatedly compacted and merged. One database write causing multiple disk writes over the lifetime of the database is called **write amplification**. It's especially worth paying attention to on SSDs, because SSD blocks can only be overwritten a limited number of times before they wear out.

For write-heavy applications, the bottleneck is likely to be the rate at which the database can write to disk, and write amplification directly affects performance: the more the storage engine writes to disk, the fewer writes per second it can handle within the available disk bandwidth.

LSM-trees can usually sustain higher write throughput than B-trees. One reason is that they sometimes have lower write amplification (depending on engine configuration and workload), and another is that they sequentially write compact SSTable files rather than overwriting several pages in a tree. The second point matters especially on spinning disks, where sequential writes are much faster than random writes.

LSM-trees also compress better, and their files on disk are usually smaller than B-trees. B-trees leave some disk space unused due to fragmentation: when a page splits, or when a row doesn't fit in an existing page, part of a page is left empty. LSM-trees are not page-oriented and periodically rewrite SSTables to remove fragmentation, so they have lower storage overhead, especially with leveled compaction.

On many SSDs, the firmware internally uses a log-structured algorithm to turn random writes into sequential writes on the underlying storage chips, so the storage engine's write pattern matters less on SSDs. But lower write amplification and less fragmentation still help on SSDs: the more compactly data is represented, the more read and write requests can be handled within the same I/O bandwidth.

#### Disadvantages of LSM-trees

One downside of log-structured storage is that compaction can sometimes interfere with ongoing reads and writes. Disk resources are limited, and a request can easily have to wait for the disk to finish an expensive compaction. The impact on throughput and average response time is usually small, but at higher percentiles (see Chapter 1 on response time percentiles), queries on log-structured storage engines can sometimes be much slower, while B-trees behave more predictably.

There's another problem at high write throughput: the disk's finite write bandwidth has to be shared between the initial writes (writing the log, writing the memtable to disk) and the background compaction threads. When the database is still empty, all the bandwidth can go to initial writes; the larger the database gets, the more bandwidth compaction needs.

If write throughput is high and compaction is not carefully configured, compaction can fall behind writes. In that case, the number of unmerged segments on disk keeps growing until disk space runs out; reads also get slower, because there are more segment files to check. The book says that SSTable-based storage engines typically don't limit the rate of writes when compaction can't keep up, so this situation needs to be monitored specifically[^stall].

One advantage of B-trees is that each key exists in exactly one place in the index, whereas in a log-structured storage engine the same key may have several copies in different segments. This makes B-trees attractive in databases that need strong transactional semantics: many relational databases use locks on key ranges to implement transaction isolation, and in a B-tree index those locks can be attached directly to the tree. Chapter 7 will go into this.

Putting the trade-offs side by side:

| Aspect | LSM-tree | B-tree |
| --- | --- | --- |
| Write pattern | Sequentially writes SSTables, merges and compacts in the background | Writes the write-ahead log first, then overwrites fixed-size pages in place |
| Write throughput | Usually higher | Usually lower |
| Reads | Has to check the memtable and multiple SSTables, usually slower | Considered faster |
| Disk space | Compresses better, less fragmentation | Pages have fragmentation, space not fully used |
| Response time | Compaction can push up high-percentile response times | More predictable |
| Same key | May have one copy in each of several segments | In only one place, so range locks can be attached directly to the tree |

B-trees are deeply rooted in database architecture and deliver stable, good performance under many workloads, so they won't disappear any time soon; but log-structured indexes are becoming increasingly popular in new data stores. As for which one suits your application:

> There is no quick and easy rule for determining which type of storage engine is better for your use case, so it is worth testing empirically.

### Other indexing structures

Everything so far has been key-value indexes, which correspond to **primary key** indexes in the relational model: a primary key uniquely identifies a row in a relational table, a document in a document database, or a vertex in a graph database, and other records in the database can reference it by primary key (or ID), with the index resolving those references.

**Secondary indexes** are also very common. In relational databases, you can use `CREATE INDEX` to create several secondary indexes on the same table, and they are often crucial for executing joins efficiently. A secondary index can also be built with a key-value index; the main difference is that keys are not unique: many rows may have the same value in the indexed field. There are two solutions: make each value in the index a list of identifiers of all matching rows (like the postings list in a full-text index), or append a row identifier to each key to make it unique. Both B-trees and log-structured indexes can be used for secondary indexes.

#### Storing values within the index

The key in an index is what a query searches for; the value can be one of two things: either the row (document, vertex) itself, or a reference to the row stored elsewhere. In the latter case, the place where rows are stored is called a **heap file**, and the data in it is in no particular order (it may be append-only, or it may keep track of deleted rows and overwrite them with new data later). The heap file approach is common because it avoids duplicating data when there are multiple secondary indexes: each index just references a location in the heap file, and the actual data is stored only once.

When updating a value without changing the key, the heap file is efficient: as long as the new value is no larger than the old one, the record can be overwritten in place. If the new value is larger, it gets tricky—the record may have to be moved to a new location in the heap with enough space: either update all indexes to point to the new location, or leave a forwarding pointer at the old location.

Sometimes the extra hop from the index to the heap file is too costly for reads, in which case the indexed row can be stored directly in the index, called a **clustered index**. For example, in MySQL's InnoDB storage engine, the primary key of a table is always a clustered index, and secondary indexes reference the primary key rather than a location in the heap file; SQL Server allows one clustered index to be specified per table.

Between a clustered index (the whole row stored in the index) and a nonclustered index (only a reference stored in the index) there's a compromise called a **covering index**, or index with included columns: it stores some of the table's columns in the index, so some queries can be answered by the index alone—the index is said to "cover" the query.

As with any duplication of data, clustered and covering indexes speed up reads but require extra storage and add overhead to writes. Databases also have to work harder to maintain transactional semantics, because applications shouldn't see inconsistent results due to data duplication.

#### Multi-column indexes

The indexes above all map a single key to a value. That's not enough if you want to query by multiple columns of a table (or multiple fields of a document) at the same time.

The most common multi-column index is the **concatenated index**, which combines several fields into one key in the order specified in the index definition. An old-fashioned paper phone book is such an index, sorted by (last name, first name): it can be used to find everyone with a certain last name, or to find a specific combination of names; but it's useless for finding everyone with a certain first name.

**Multi-dimensional indexes** are a more general way to query several columns at once, and they're especially important for geospatial data. For example, a restaurant-finding website where the user is looking at a rectangular area on a map and wants to find all restaurants in it needs a two-dimensional range query like this:

```sql
SELECT * FROM restaurants
WHERE latitude  > 51.4946 AND latitude  < 51.5079
  AND longitude > -0.1162 AND longitude < -0.1004;
```

A standard B-tree or LSM-tree index can't answer this efficiently: it can find all restaurants with latitude in the range (any longitude), or all restaurants with longitude in the range (any latitude), but it can't narrow down by both conditions at once. One approach is to use a space-filling curve to convert the two-dimensional location into a single number and then use a regular B-tree index; more commonly, specialized spatial indexes such as R-trees are used. PostGIS implements geospatial indexes as R-trees using PostgreSQL's Generalized Search Tree (GiST) mechanism.

Multi-dimensional indexes are useful beyond geographic locations. An e-commerce site can index products on the three dimensions (red, green, blue) to search by color range; weather observations can be indexed in two dimensions (date, temperature) to efficiently find all observations in 2013 with temperatures between 25 and 30 °C. With only one-dimensional indexes, you'd have to scan all records from 2013 (regardless of temperature) and then filter by temperature, or vice versa; a two-dimensional index can narrow down by date and temperature at the same time. HyperDex uses this technique.

#### Full-text search and fuzzy indexes

All the indexes so far assume the data is exact: you can only look up the exact value of a key, or a range of sorted keys. They can't be used to find **similar** keys, such as misspelled words—such fuzzy queries need different techniques.

Full-text search engines typically allow a search for one word to be expanded to include its synonyms, ignore grammatical variations of words, find words that occur near each other in the same document, and support various features that depend on linguistic analysis. To handle typos in documents or queries, Lucene can search for words within a certain **edit distance** (an edit distance of 1 means one letter added, removed, or changed).

As mentioned earlier, Lucene's term dictionary uses an SSTable-like structure, and it needs a small in-memory index that tells a query at which offset in the sorted file to look for a key. In LevelDB, this in-memory index is a sparse set of keys; in Lucene, it's a finite state automaton over the characters of the keys, similar to a trie. This automaton can be transformed into a **Levenshtein automaton**, which efficiently searches for words within a given edit distance.

#### Keeping everything in memory

The data structures in this chapter so far have all been about coping with the limitations of disks. Compared to memory, disks are awkward to use: whether spinning disks or SSDs, data has to be laid out carefully for read and write performance to be good. We put up with this because disks have two important advantages: they are durable, so their contents survive a power failure, and they cost less per gigabyte than memory.

As memory gets cheaper, the cost argument is becoming weaker. Many datasets are actually not that large and can fit entirely in memory, distributed across several machines if necessary—hence **in-memory databases**.

Some in-memory key-value stores, such as Memcached, are used only as caches, where it's fine if data is lost when a machine restarts. Other in-memory databases aim for durability, using approaches such as special hardware (like battery-backed memory), writing a log of changes to disk, writing periodic snapshots to disk, or replicating the in-memory state to other machines. On restart, it has to reload its state from disk or over the network from a replica (unless special hardware is used). Even though it writes to disk, it's still an in-memory database: the disk is only for durability, with writes appended to a log, and read requests are served entirely from memory. Writing to disk also has operational benefits—files on disk can easily be backed up, inspected, and analyzed with external tools.

VoltDB, MemSQL[^memsql], and Oracle TimesTen are in-memory databases with a relational model, and their vendors claim big performance gains from removing the overhead of managing on-disk data structures. RAMCloud is an open-source, durable in-memory key-value store that uses a log-structured approach for both in-memory and on-disk data. Redis and Couchbase write to disk asynchronously and provide only weaker durability.

Why are in-memory databases fast? The book's answer is somewhat counterintuitive:

> Counterintuitively, the performance advantage of in-memory databases is not due to the fact that they don't need to read from disk.

If there's enough memory, a disk-based storage engine may never need to read from disk either, because the operating system caches recently used disk blocks in memory anyway. The real reason in-memory databases are faster is that they don't need to encode in-memory data structures into a format that can be written to disk, avoiding that overhead.

Beyond performance, in-memory databases can offer data models that are hard to implement with disk-based indexes. For example, Redis provides a database-like interface to various data structures such as priority queues and sets; with all data in memory, these are relatively easy to implement.

Research has also shown that in-memory database architectures can be extended to support datasets larger than available memory without incurring the overhead of disk-centric architectures. This **anti-caching** approach works by evicting the least recently used data from memory to disk when memory runs low, and loading it back into memory when it's accessed again. This is similar to operating system virtual memory and swap files, but the database can manage memory at the granularity of individual records rather than whole memory pages, making it more efficient than the OS. However, this approach still requires the entire index to fit in memory.

If **non-volatile memory** (NVM) technologies become more widely adopted, storage engine design may change further[^nvm].

## Transaction processing or analytics?

In the early days of business data processing, a database write usually corresponded to a real commercial transaction: selling an item, placing an order with a supplier, paying an employee's salary. Later, databases came to be used in areas that don't involve money changing hands, but the word **transaction** stuck, referring to a group of reads and writes that form a logical unit.

A transaction doesn't necessarily have the ACID properties (atomicity, consistency, isolation, durability)—that's a topic for Chapter 7. Transaction processing here just means that clients can make low-latency reads and writes, as opposed to batch jobs that run only periodically.

Later, databases came to store all sorts of things—blog comments, actions in games, contacts in an address book—but the basic access pattern is still similar to processing business transactions: an application typically uses an index to look up a small number of records by some key, and inserts or updates records based on user input. These applications are interactive, so this access pattern is called **online transaction processing** (OLTP).

Databases are also increasingly used for **data analytics**, whose access pattern is very different: an analytic query usually scans a huge number of records, reading only a few columns per record, and calculates aggregate statistics such as counts, sums, or averages, rather than returning raw data to the user. For example, on a sales transaction table, an analyst might want to know: what was the total revenue of each store in January? During the latest promotion, how many more bananas than usual were sold? Which brand of baby food is most often bought together with which brand of diapers? These queries are usually written by business analysts, and the reports they produce help management make decisions—this is called **business intelligence**. To distinguish it from transaction processing, this usage pattern is called **online analytic processing** (OLAP).

The book compares the two in a table:

| Property | Transaction processing systems (OLTP) | Analytic systems (OLAP) |
| --- | --- | --- |
| Main read pattern | Small number of records per query, fetched by key | Aggregate over a large number of records |
| Main write pattern | Random-access, low-latency writes from user input | Bulk import (ETL) or event stream |
| Primarily used by | End users/customers, via web applications | Internal analysts, for decision support |
| What data represents | Latest state of data (current point in time) | History of events that happened over a period of time |
| Dataset size | Gigabytes to terabytes | Terabytes to petabytes |

At first, transaction processing and analytic queries used the same database, and SQL was flexible enough to express both kinds of queries. But starting in the late 1980s and early 1990s, more and more companies stopped running analytics on their OLTP systems and moved analytics to a separate database called a **data warehouse**.

### Data warehousing

An enterprise may have dozens of different transaction processing systems: the customer-facing website, the checkout system in physical stores, inventory tracking in the warehouse, route planning for vehicles, supplier management, employee management, and so on. Each system is complex and usually maintained by its own team, running largely independently of the others.

These OLTP systems are usually expected to be highly available and low-latency, because the business depends on them. So database administrators guard their OLTP databases closely and are reluctant to let business analysts run ad hoc analytic queries on them: such queries are often expensive, scanning a large part of the dataset, and can slow down concurrently executing transactions.

A data warehouse, by contrast, is a separate database that analysts can query to their heart's content without affecting OLTP operations. It contains a read-only copy of the data in all the company's OLTP systems: data is extracted from the OLTP databases (via periodic data dumps or a continuous stream of updates), transformed into an analysis-friendly schema, cleaned up, and then loaded into the data warehouse. This process is called **Extract–Transform–Load** (ETL).

Almost all large enterprises have data warehouses, but small companies rarely do: they have few OLTP systems and small amounts of data, so querying a regular SQL database is enough—or even a spreadsheet suffices for analysis.

A big advantage of having a separate data warehouse, rather than querying OLTP systems directly, is that the data warehouse can be optimized for analytic access patterns. The indexing algorithms in the first half of this chapter work well for OLTP but are not good at answering analytic queries.

#### The divergence between OLTP databases and data warehouses

The most common data model for a data warehouse is the relational model, because SQL is generally well suited to analytic queries. Many graphical data analysis tools generate SQL queries and visualize the results, letting analysts explore data through operations like drill-down and slicing and dicing.

On the surface, a data warehouse and a relational OLTP database look similar—both have a SQL query interface—but the internal implementations are very different, because they are optimized for very different query patterns. Many database vendors now focus on either transaction processing or analytics, rather than both. Some databases, such as Microsoft SQL Server and SAP HANA, support both transaction processing and data warehousing in the same product, but increasingly as two separate storage and query engines that happen to be accessible through the same SQL interface.

Data warehouse vendors such as Teradata, Vertica, SAP HANA, and ParAccel sell their systems under expensive commercial licenses; Amazon Redshift is a hosted version of ParAccel. More recently, a batch of open-source SQL-on-Hadoop projects have appeared—still young, but aiming to compete with commercial data warehouses—including Apache Hive, Spark SQL, Cloudera Impala, Facebook Presto, Apache Tajo, and Apache Drill, some of which borrow ideas from Google's Dremel.

### Stars and snowflakes: schemas for analytics

In transaction processing, a wide variety of data models are used depending on the needs of the application, as Chapter 2 discussed; in analytics, there is much less variety. Many data warehouses use a fairly formulaic schema called a **star schema**, also known as dimensional modeling.

The book's example is a data warehouse for a grocery retailer. At the center of the schema is a **fact table**, here called `fact_sales`, where each row represents an event that happened at a particular time—in this case, a customer buying a product; if you were analyzing website traffic, each row might be a page view or a click.

Facts are usually recorded as individual events, because that gives the most flexibility for later analysis. The cost is that fact tables can become extremely large: big enterprises like Apple, Walmart, or eBay may have tens of petabytes of transaction history in their data warehouses, most of it in fact tables.

Some columns in the fact table are attributes, such as the price at which the product was sold and the cost of buying it from the supplier (the difference between the two is the profit). Other columns are **foreign keys** referencing other tables, called **dimension tables**. Each row in a fact table is an event, and the dimensions describe the who, what, where, when, how, and why of the event.

For example, the dimension table `dim_product` has one row for each product being sold, recording its stock keeping unit (SKU), description, brand, category, fat content, package size, and so on; each row in `fact_sales` uses a foreign key to point to `dim_product`, indicating which product was sold in that transaction. (For simplicity, if a customer buys several different products in one visit, they are recorded as several rows in the fact table.)

Even date and time are often represented using dimension tables, because this allows additional information about dates to be recorded—such as whether a date is a public holiday—so queries can distinguish sales on holidays from sales on weekdays.

The name "star schema" comes from the way the relationships between tables look when drawn: the fact table is in the middle, surrounded by dimension tables, and the lines from the fact table to each dimension table look like the rays of a star.

A variant is called the **snowflake schema**, where dimensions are further broken down into subdimensions. For example, brand and product category could each have their own table, and each row in `dim_product` references the brand and category by foreign key rather than storing them as strings in `dim_product`. Snowflake schemas are more normalized than star schemas, but star schemas are often preferred because they're simpler for analysts to work with.

In a typical data warehouse, tables are often very wide: fact tables commonly have over 100 columns, sometimes several hundred. Dimension tables can also be very wide, because they include all the metadata that might be relevant to analysis—for example, the `dim_store` table might record which services each store offers, whether it has an in-store bakery, its floor area, when it opened, when it was last remodeled, and how far it is from the nearest highway.

## Column-oriented storage

When a fact table has trillions of rows and petabytes of data, storing and querying it efficiently becomes a challenge. Dimension tables are usually much smaller (millions of rows), so this section is mainly concerned with storing fact tables.

Although fact tables often have over 100 columns, a typical data warehouse query accesses only 4 or 5 of them at a time—`SELECT *` is rarely needed in analytics. The book's example query wants to know: whether people are more inclined to buy fresh fruit or candy, and whether this depends on the day of the week. Written out, it looks roughly like this:

```sql
-- How many of each of fresh fruit and candy were sold on each day of the week in 2013
SELECT d.weekday, p.category, SUM(f.quantity) AS quantity_sold
FROM fact_sales f
  JOIN dim_date d    ON f.date_key   = d.date_key
  JOIN dim_product p ON f.product_sk = p.product_sk
WHERE d.year = 2013
  AND p.category IN ('Fresh fruit', 'Candy')
GROUP BY d.weekday, p.category;
```

It accesses a huge number of rows (every time someone bought fruit or candy in 2013), but only uses three columns of `fact_sales`: `date_key`, `product_sk`, and `quantity`. The rest of the columns are not needed.

How do you execute this query efficiently? Most OLTP databases store data in a **row-oriented** fashion: all the values from one row are stored next to each other. Document databases are similar: a document is usually stored as a contiguous sequence of bytes. Even if you have an index on `date_key` or `product_sk` that tells the storage engine where the sales records for a certain date or product are, a row-oriented storage engine still has to load all those rows (each with over 100 attributes) from disk into memory, parse them, and filter out those that don't meet the conditions—which can take a lot of time.

The idea behind **column-oriented storage** is simple: don't store all the values from one row together, but store all the values from each column together. If each column is stored in a separate file, a query only needs to read and parse the columns it uses, saving a lot of work.

Column-oriented storage is easiest to understand in the relational model, but it applies equally to nonrelational data—for example, Parquet is a column-oriented storage format that supports a document data model, based on Google's Dremel.

Column-oriented storage relies on one premise: the order of rows is the same in every column file. To reconstruct a whole row, take the k-th item from each column file, and together they form the k-th row of the table.

### Column compression

Besides reading only the columns a query needs from disk, you can also compress the data to further reduce the demand on disk throughput. Column-oriented storage happens to be very amenable to compression.

Values within a column often have a lot of repetition, which is a good sign for compression. Depending on the data in the column, different compression techniques can be used; one that is particularly effective in data warehouses is **bitmap encoding**.

The number of distinct values in a column is often much smaller than the number of rows. For example, a retailer may have billions of sales transactions but only 100,000 distinct products. So a column with n distinct values can be turned into n separate bitmaps: one bitmap per distinct value, with one bit per row—1 if that row has this value, 0 otherwise.

If n is very small (for example, the "country" column has only about 200 distinct values), the bitmaps can be stored with one bit per row; if n is larger, most bitmaps will have long runs of zeros (they are sparse), and the bitmaps can be further compressed with **run-length encoding**, which records only how many consecutive zeros and ones there are. This way a column can be encoded very compactly.

Such bitmap indexes are well suited to the kinds of queries common in data warehouses:

- `WHERE product_sk IN (30, 68, 69)`: load the three bitmaps for `product_sk = 30`, `product_sk = 68`, and `product_sk = 69`, and compute their bitwise OR—this can be done very quickly;
- `WHERE product_sk = 31 AND store_sk = 3`: load the two bitmaps for `product_sk = 31` and `store_sk = 3`, and compute the bitwise AND. This works because the order of rows is the same in every column, so the k-th bit in one column's bitmap corresponds to the same row as the k-th bit in another column's bitmap.

![Three columns product_sk, store_sk, and quantity each stored as a sequence, with values at the same position belonging to the same row; below are the bitmaps for each distinct value of product_sk and the bitmap for store_sk = 3; the two bitmaps are ANDed together to get rows 1 and 4](./column-storage.en.svg "Figure 3: Column-oriented storage and bitmap encoding. Each column is stored separately, and the values at the k-th position of each column together form the k-th row; each distinct value of product_sk has its own bitmap, and the query product_sk = 31 AND store_sk = 3 just ANDs the two bitmaps together to get rows 1 and 4.")

Incidentally, Cassandra and HBase have a concept inherited from Bigtable called **column families**, but calling them column-oriented would be a misunderstanding: within each column family, they still store all the columns of a row together with the row key, and they don't do column compression. So the Bigtable model is still essentially row-oriented.

#### Memory bandwidth and vectorized processing

For data warehouse queries that need to scan millions of rows, a big bottleneck is the bandwidth for getting data from disk into memory. But that's not the only bottleneck: developers of analytic databases also need to worry about efficiently using the bandwidth from main memory to the CPU cache, avoiding branch mispredictions and bubbles in the CPU instruction pipeline, and making use of SIMD (single instruction, multiple data) instructions in modern CPUs.

Besides reducing the amount of data read from disk, the columnar layout also helps use the CPU efficiently. For example, the query engine can take a chunk of compressed column data that fits exactly into the CPU's L1 cache and iterate over it in a tight loop without function calls; such a loop is much faster than code that has to call many functions and make many decisions for each record processed. Column compression allows more rows' worth of data to fit in the same L1 cache, and operations like the bitwise AND and OR above can be designed to operate directly on compressed chunks of column data. This technique is called **vectorized processing**.

### Sort order in column storage

In column storage, the order in which rows are stored doesn't necessarily matter. The simplest is insertion order: inserting a row means appending a value to the end of each column file. But you can also impose an order, as with SSTables, and use it as an indexing mechanism.

Sorting each column independently would be pointless, because then you wouldn't know which values in each column belong to the same row: the ability to reconstruct a row depends precisely on the k-th item of one column and the k-th item of another column belonging to the same row. So even though data is stored by column, sorting must be done on whole rows.

The database administrator can choose which columns to sort by, based on knowledge of common queries. For example, if queries often target a date range (like "last month"), `date_key` can be made the first sort key, and the query optimizer can then scan only the rows from last month, which is much faster than scanning all rows.

The second sort key determines the order of rows with the same value in the first sort column. For example, if the first sort key is `date_key`, the second could be `product_sk`, so that sales of the same product on the same day are stored next to each other—helpful for queries that group or filter by product within a date range.

Sorting has another benefit: it helps compress columns. If the first sort column doesn't have many distinct values, then after sorting it will have long sequences where the same value repeats consecutively, and simple run-length encoding can compress that column down to a few kilobytes, even if the table has billions of rows.

This compression effect is strongest on the first sort key. The second and third sort keys are more jumbled and won't have such long repeated sequences; columns further down the sort priority are essentially in random order and probably won't compress much. But having the first few columns sorted is still worthwhile overall.

#### Several different sort orders

C-Store introduced a clever extension, later adopted by the commercial data warehouse Vertica: different queries benefit from different sort orders, so why not store the same data in several different orders? Since data has to be replicated to multiple machines anyway to avoid losing it if one machine fails, you might as well sort those redundant copies differently and pick the most suitable one when processing a query.

Storing several sort orders in column storage is somewhat like having several secondary indexes in row-oriented storage. The difference is that row-oriented storage keeps each row in one place (a heap file or clustered index), and secondary indexes just contain pointers to the matching rows; column storage usually has no pointers to data elsewhere, just columns containing values.

### Writing to column-oriented storage

These optimizations make sense in a data warehouse, because the bulk of the load is large read-only queries run by analysts. Column-oriented storage, compression, and sorting all make read queries faster, at the cost of making writes harder.

The in-place update approach of B-trees doesn't work with compressed columns. Inserting a row in the middle of a sorted table would likely require rewriting all the column files; and since rows are identified by their position within a column, an insert would have to update all columns consistently.

Fortunately, this chapter already has a good solution: LSM-trees. All writes first go into an in-memory store, added to a sorted structure, ready to be written to disk; it doesn't matter whether this in-memory store is row-oriented or column-oriented. Once enough writes have accumulated, they are merged with the column files on disk and written out in bulk as new files. This is essentially what Vertica does.

Queries need to examine both the column data on disk and the recent writes in memory, and combine the two, but the query optimizer hides this distinction from the user. From an analyst's point of view, inserted, updated, or deleted data is immediately reflected in subsequent query results.

### Aggregation: data cubes and materialized views

Not every data warehouse is column-oriented: traditional row-oriented databases and other architectures are also in use. But column-oriented storage is much faster for ad hoc analytic queries, so it's rapidly gaining popularity.

One more aspect of data warehouses is worth mentioning: **materialized aggregates**. Data warehouse queries often use SQL aggregate functions such as COUNT, SUM, AVG, MIN, and MAX. If many queries use the same aggregates, it's wasteful to recompute them from raw data every time—better to cache the most commonly used counts or sums.

One way to build such a cache is a **materialized view**. In the relational model, it's usually defined in the same way as a standard (virtual) view: a table-like object whose contents are the result of some query. The difference is that a materialized view is an actual copy of the query result, written to disk, whereas a virtual view is just a shorthand for writing queries—when you read from a virtual view, the SQL engine expands it into the underlying query on the fly and executes that.

When the underlying data changes, a materialized view needs to be updated too, because it is a denormalized copy of the data. The database can do this automatically, but it makes writes more expensive, which is why materialized views are rarely used in OLTP databases; in a data warehouse, where reads dominate writes, they make more sense (whether they actually improve read performance depends on the situation).

A common special case of a materialized view is a **data cube**, also called an OLAP cube: a grid of aggregates grouped by different dimensions. For example, suppose each fact has foreign keys to only two dimension tables—date and product—then you can draw a two-dimensional table with one axis for date and the other for product, where each cell holds the aggregate value (say, SUM) of some attribute (say, `net_price`) of all facts with that combination of date and product. Then apply the same aggregation along each row or column to get a summary with one fewer dimension: aggregating along the date axis gives the total sales of each product (regardless of date); aggregating along the product axis gives the total sales of each day (regardless of product).

Facts often have more than two dimensions. Say there are five dimensions: date, product, store, promotion, and customer. A five-dimensional hypercube is hard to visualize, but the principle is the same: each cell is the sales for a particular combination of date, product, store, promotion, and customer, and these values can be repeatedly aggregated along each dimension.

The advantage of a materialized data cube is that certain queries become very fast, because the results have essentially been precomputed. For example, to find the total sales of each store yesterday, you just read the aggregated value along the corresponding dimension—no need to scan millions of rows.

The disadvantage is that a data cube is not as flexible as querying the raw data. For example, you can't compute what proportion of sales came from products priced over $100, because price is not one of the dimensions. So most data warehouses try to keep the raw data as much as possible and use aggregates like data cubes only as a way to speed up certain queries.

## Summary

This chapter set out to answer: how does a database store the data you give it, and how does it find it again when needed? From a high level, storage engines fall into two broad categories, optimized for transaction processing (OLTP) and for analytics (OLAP), because their access patterns are very different:

- OLTP systems are typically user-facing and have to handle a huge number of requests. To cope with the load, each application request touches only a small number of records, asking for data by some key, and the storage engine uses an index to find the data for that key. The bottleneck here is often disk seek time;
- Data warehouses and similar analytic systems are less well known, used mainly by business analysts rather than end users. The number of queries is much lower than in OLTP, but each query is usually heavy, scanning millions of records in a short time. The bottleneck here is often disk bandwidth (rather than seek time), and column-oriented storage is an increasingly popular solution.

On the OLTP side, there are two main schools of storage engines:

| School | Approach | Examples |
| --- | --- | --- |
| Log-structured | Only append to files and delete obsolete files; written files are never modified | Bitcask, SSTables, LSM-trees, LevelDB, Cassandra, HBase, Lucene |
| In-place updates | Treat the disk as a set of fixed-size pages that can be overwritten | B-trees, used by all major relational databases and many nonrelational ones |

Log-structured storage engines are a relatively recent development; their key idea is to systematically turn random writes on disk into sequential writes, taking advantage of the performance characteristics of spinning disks and SSDs to achieve higher write throughput. Beyond these two schools, this chapter also briefly looked at more complex index structures (secondary indexes, multi-column indexes, full-text and fuzzy indexes), and at databases that keep all data in memory.

Analytic workloads differ so much from OLTP because when a query needs to sequentially scan a huge number of rows, indexes matter much less; what matters is encoding the data very compactly to minimize the amount of data the query has to read from disk. Column-oriented storage, column compression, and sorting by rows all serve this purpose, while data cubes and materialized views trade precomputed aggregates for faster answers to certain queries.

Understanding the internals of storage engines helps application developers see more clearly which tool suits their application; when tuning database parameters, they can also imagine roughly what effect raising or lowering a value will have. This chapter won't make anyone an expert at tuning a particular storage engine, but it should be enough to read the documentation of the database you've chosen.

A few connections to other chapters:

- Response time percentiles are from Chapter 1, and it's the high percentiles that LSM-tree compaction affects;
- Locks on key ranges, copy-on-write, and snapshot isolation will come up again in Chapter 7 on transactions;
- This chapter covered how data is organized on disk; Chapter 4 goes on to how data is encoded into bytes, and how encoding formats evolve with applications.

## Glossary

| English | Chinese | Meaning |
| --- | --- | --- |
| storage engine | 存储引擎 | The part of a database responsible for storing and retrieving data |
| log | 日志 | A sequence of records that can only be appended to |
| index | 索引 | An additional structure derived from the primary data, used to speed up lookups |
| hash index | 哈希索引 | An in-memory hash map from keys to byte offsets in a data file |
| segment | 段 | A file split off from a log, never modified after being written |
| compaction | 压实 | Throwing away duplicate keys in a log, keeping only the most recent value for each key |
| merge | 合并 | Combining several segments into a new segment |
| tombstone | 墓碑 | A special record indicating the deletion of a key |
| SSTable | SSTable | A segment file with key-value pairs sorted by key, each key appearing only once |
| memtable | memtable | An in-memory balanced tree sorted by key, written out as an SSTable when it exceeds a threshold |
| LSM-tree | LSM 树 | A storage structure consisting of a memtable and a series of SSTables that are continuously merged and compacted |
| sparse index | 稀疏索引 | An index that records only one key every so often |
| Bloom filter | 布隆过滤器 | A memory-efficient approximate set representation that can tell that a key is definitely absent |
| size-tiered / leveled compaction | 大小分级 / 分层压实 | Two strategies for deciding when to merge which SSTables |
| B-tree | B 树 | A balanced tree made of fixed-size pages, updated in place |
| page | 页 | The fixed-size block that B-trees read and write, traditionally 4 KB |
| branching factor | 分支因子 | The number of child page references in a page |
| write-ahead log (WAL) | 预写日志 | Modifications are appended here first, then applied to the data structure, for crash recovery |
| latch | 闩锁 | A lightweight lock protecting an in-memory or on-disk data structure |
| copy-on-write | 写时复制 | Writing modifications to a new location and updating the parent page to point to it, rather than overwriting the original page |
| write amplification | 写放大 | One database write causing multiple disk writes over its lifetime |
| secondary index | 二级索引 | An index on non-primary-key columns, where keys may be duplicated |
| heap file | 堆文件 | The file where rows are stored, with indexes holding only references to it |
| clustered index | 聚簇索引 | Storing the whole row directly in the index |
| covering index | 覆盖索引 | Storing some columns in the index so some queries can be answered by the index alone |
| concatenated index | 联合索引 | Combining several fields into one key in a specified order |
| multi-dimensional index | 多维索引 | An index that can query ranges on several columns at once, such as an R-tree |
| edit distance | 编辑距离 | The number of letters added, removed, or changed to turn one word into another |
| in-memory database | 内存数据库 | A database whose read requests are served entirely from memory |
| anti-caching | 反缓存 | Evicting the least recently used data from memory to disk, record by record, when memory runs low |
| OLTP / OLAP | 在线事务处理 / 在线分析处理 | Reading and writing a small number of records by key / aggregating over a large number of records |
| data warehouse | 数据仓库 | A read-only copy of data from various OLTP systems, for analytics |
| ETL | 提取—转换—加载 | The process of getting data from OLTP systems into a data warehouse |
| star schema / snowflake schema | 星型模式 / 雪花模式 | A fact table in the middle referencing dimension tables / dimensions further split into subdimensions |
| fact table / dimension table | 事实表 / 维度表 | One row per event / describing the who, what, where, when, etc. of events |
| column-oriented storage | 列式存储 | Storing all values of each column together, rather than all values of each row |
| bitmap encoding | 位图编码 | One bitmap per distinct value, with one bit per row |
| run-length encoding | 游程编码 | Recording only how many consecutive identical values there are |
| vectorized processing | 向量化处理 | Processing compressed chunks of column data that fit in the CPU cache, in tight loops |
| materialized view | 物化视图 | An actual copy of a query result, written to disk |
| data cube / OLAP cube | 数据立方体 | A grid of aggregates precomputed along multiple dimensions |

[^stall]: The book describes the general case. RocksDB actually does slow down or even pause writes when compaction can't keep up, called a write stall—for example, when there are too many files in level 0, or when too much data is waiting to be compacted.

[^memsql]: The book was written in 2017. MemSQL was renamed SingleStore in 2020.

[^nvm]: The book was written in 2017. Since then, Intel launched Optane persistent memory based on 3D XPoint technology in 2019, which can be accessed byte by byte like memory while retaining data across power loss; but Intel announced in 2022 that it was winding down the entire Optane business.
