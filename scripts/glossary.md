# Glossary for npm run translate

Names and terms with a fixed English form. scripts/translate.ts puts this whole file into its prompts, for
the posts and for the figure labels alike, so both use the same words. When a translation picks a word you
don't want, add a line here and translate the post again.

## Names

- 缉熙: the author's Chinese name, from the Book of Songs. Keep it in Chinese characters; where a post talks about the name itself, add its pinyin once: 缉熙 (jī xī). Everywhere else the author is Dawning.
- 读书笔记 in a title: Reading Notes. "DDIA 读书笔记 01：……" becomes "DDIA Reading Notes 01: ...".
- 《数据密集型应用系统设计》: *Designing Data-Intensive Applications* (DDIA), by Martin Kleppmann. 中译本: the Chinese translation of the book.
- 道格拉斯·亚当斯《基本无害》: Douglas Adams, *Mostly Harmless*. 格蕾丝·霍珀: Grace Murray Hopper. Poons 先生 / Cake 太太: Mr. Poons / Mrs. Cake.
- 《诗经》: the Book of Songs. 《诗经·周颂·敬之》: "Jing Zhi", in the Hymns of Zhou of the Book of Songs; keep the Chinese title beside it.

## DDIA terms

- 可靠性 / 可扩展性 / 可维护性: reliability / scalability / maintainability
- 故障 / 失效: fault / failure. A fault is one component deviating from its spec; a failure is the system as a whole no longer providing its service.
- 负载参数: load parameters; 扇出: fan-out
- 响应时间 / 延迟: response time / latency; 百分位数: percentiles; 中位数: median; 尾部延迟: tail latency; 尾部延迟放大: tail latency amplification
- 垂直扩展 / 水平扩展: scaling up / scaling out
- 可操作性 / 简单性 / 可演化性: operability / simplicity / evolvability
- 阻抗失配: impedance mismatch; 规范化: normalization
- 一对多 / 多对一 / 多对多: one-to-many / many-to-one / many-to-many
- 声明式 / 命令式: declarative / imperative
- 属性图 / 三元组存储: property graph / triple-store
- 日志结构: log-structured; 只追加: append-only; 段: segment; 合并: merging; 压实: compaction; 墓碑: tombstone
- 预写日志: write-ahead log (WAL); 内存表: memtable; 稀疏索引: sparse index; 布隆过滤器: Bloom filter
- 页: page; 分支因子: branching factor; 写放大: write amplification; 崩溃恢复: crash recovery
- 二级索引: secondary index; 覆盖索引: covering index
- 列式存储: column-oriented storage; 位图: bitmap
- 星型模式 / 雪花模式: star schema / snowflake schema; 事实表 / 维度表: fact table / dimension table
- 物化视图: materialized view; 数据立方体: data cube
- 编码 / 解码: encoding / decoding; 字段标签: field tag; 标签号: tag number
- 写者模式 / 读者模式: writer's schema / reader's schema; 模式演化: schema evolution
- 数据流: dataflow; 消息代理: message broker; 滚动升级: rolling upgrade
- 共享内存 / 共享磁盘 / 无共享架构: shared-memory / shared-disk / shared-nothing architecture
- 领导者 / 追随者: leader / follower; 副本: replica; 复制日志: replication log; 变更流: change stream
- 同步复制 / 异步复制 / 半同步: synchronous / asynchronous replication / semi-synchronous
- 故障转移: failover; 脑裂: split brain; 追赶恢复: catch-up recovery; 共识: consensus
- 隔离 has two senses. In DDIA notes 05, shutting down the second leader after a split brain: fencing. Everywhere else it is isolation: 隔离性 / 隔离级别 / 事务隔离: isolation / isolation level / transaction isolation. 防护 / 防护令牌: fencing / fencing token
- 复制延迟: replication lag (never "replication latency"); 最终一致性: eventual consistency
- 写后读一致性 / 读己之写: read-after-write consistency / read-your-writes; 单调读: monotonic reads; 一致前缀读: consistent prefix reads
- 多领导者 / 无领导者复制: multi-leader / leaderless replication; 写冲突: write conflict; 最后写入胜出: last write wins (LWW)
- 法定人数: quorum; 宽松的法定人数: sloppy quorum; 提示移交: hinted handoff; 读修复: read repair; 反熵: anti-entropy
- 先于: happens before; 并发: concurrent; 兄弟值: siblings; 版本向量 / 点版本向量: version vector / dotted version vector; 因果上下文: causal context
- 分区（名词）: partition; 分区（做法）: partitioning; 分片: sharding; 再平衡: rebalancing; 偏斜: skew; 热点: hot spot
- 按键范围分区 / 按哈希分区: partitioning by key range / partitioning by hash of key; 复合主键: compound primary key; 联合索引: concatenated index
- 本地索引 / 全局索引: local index / global index; 按文档分区 / 按词条分区: document-partitioned / term-partitioned; 词条: term; 分散/聚集: scatter/gather
- 请求路由: request routing; 路由层: routing tier; 服务发现: service discovery; 协调服务: coordination service; 流言协议: gossip protocol
- 事务: transaction; 提交 / 中止 / 回滚: commit / abort / rollback; 安全保证: safety guarantees; 可中止性: abortability; 不变式: invariants; 多对象事务: multi-object transaction; 比较并设置: compare-and-set; 竞态条件: race condition
- 读已提交 / 读未提交: read committed / read uncommitted; 脏读 / 脏写: dirty read / dirty write; 快照隔离: snapshot isolation; 可重复读: repeatable read; 读偏斜 / 不可重复读: read skew / nonrepeatable read; 一致性快照: consistent snapshot; 多版本并发控制: multi-version concurrency control (MVCC); 可见性规则: visibility rules
- 丢失更新: lost update; 读取-修改-写回循环: read-modify-write cycle; 冲掉: clobber; 原子写操作: atomic write operation; 游标稳定性: cursor stability; 写偏斜: write skew; 幻读: phantom (not "phantom read", except in the summary row 幻读: phantom reads); 物化冲突: materializing conflicts
- 可串行化: serializability (the property), serializable (the isolation level); 真正的串行执行: actual serial execution; 存储过程: stored procedure; 两阶段锁: two-phase locking (2PL); 共享锁 / 排他锁: shared / exclusive lock; 谓词锁: predicate lock; 索引范围锁: index-range locking; 可串行化快照隔离: serializable snapshot isolation (SSI); 悲观 / 乐观并发控制: pessimistic / optimistic concurrency control; 前提: premise; 绊线: tripwire
- 部分失效: partial failure; 异步分组网络: asynchronous packet network; 网络故障: network fault; 级联失效: cascading failure; 无界延迟 / 有界延迟: unbounded delay / bounded delay; 吵闹的邻居: noisy neighbor; 电路交换 / 分组交换: circuit switching / packet switching; 突发流量: bursty traffic
- 日历时钟: time-of-day clock; 挂钟时间: wall-clock time; 单调时钟: monotonic clock; 时钟漂移 / 时钟偏差: clock drift / clock skew; 调速: slewing; 抹平（闰秒）: smearing; 逻辑时钟 / 物理时钟: logical clock / physical clock; 置信区间: confidence interval; 进程暂停: process pause; 租约: lease; 全局停顿: stop-the-world; 窃取时间: steal time; 颠簸: thrashing; 硬实时: hard real-time
- 系统模型: system model; 拜占庭故障: Byzantine fault; 拜占庭将军问题 / 两将军问题: Byzantine Generals Problem / Two Generals Problem; 同步 / 部分同步 / 异步模型: synchronous / partially synchronous / asynchronous model; 崩溃-停止 / 崩溃-恢复故障: crash-stop / crash-recovery faults; 稳定存储: stable storage; 安全性 / 活性: safety / liveness
- 线性一致性: linearizability (线性一致的: linearizable); 新近性保证: recency guarantee; 寄存器: register; 严格可串行化: strict serializability; 跨信道的时序依赖: cross-channel timing dependencies; 内存屏障: memory barrier
- 因果关系: causality; 因果依赖: causal dependency; 因果一致: causally consistent; 全序 / 偏序: total order / partial order; 序列号: sequence number; 全序广播 / 原子广播: total order broadcast / atomic broadcast; 可靠交付 / 全序交付: reliable delivery / totally ordered delivery; 状态机复制: state machine replication; 顺序一致性: sequential consistency; 自增并读取: increment-and-get
- 原子提交: atomic commit; FLP 结论: the FLP result; 两阶段提交 / 三阶段提交: two-phase commit (2PC) / three-phase commit (3PC); 协调者: coordinator; 事务管理器: transaction manager; 参与者: participant; 准备: prepare; 提交点: commit point; 存疑: in doubt; 补偿事务: compensating transaction; 恰好一次: exactly once; 孤立的存疑事务: orphaned in-doubt transaction; 启发式决策: heuristic decision
- 一致同意 / 完整性 / 有效性 / 终止: uniform agreement / integrity / validity / termination; 提议 / 决定（共识）: propose / decide; 视图戳复制: Viewstamped Replication; 纪元编号 / 选票编号 / 视图编号 / 任期号: epoch number / ballot number / view number / term number; 动态成员: dynamic membership; 成员服务: membership service; 临时节点: ephemeral node

## Other

- 天文晨光 / 航海晨光 / 民用晨光: astronomical twilight / nautical twilight / civil twilight
- 检索增强生成: retrieval-augmented generation (RAG); 多智能体编排: multi-agent orchestration
- 多路召回: several retrievers (the results of several retrieval methods, e.g. BM25 and vector search); 召回率: recall
