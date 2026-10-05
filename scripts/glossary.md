# Glossary for npm run translate

Names and terms with a fixed English form. scripts/translate.ts puts this whole file into its prompts, for
the posts and for the figure labels alike, so both use the same words. When a translation picks a word you
don't want, add a line here and translate the post again.

## Names

- 缉熙: the author's Chinese name, from the Book of Songs. Keep it in Chinese characters; where a post talks about the name itself, add its pinyin once: 缉熙 (jī xī). Everywhere else the author is Dawning.
- 读书笔记 in a title: Reading Notes. "DDIA 读书笔记 01：……" becomes "DDIA Reading Notes 01: ...".
- 《数据密集型应用系统设计》: *Designing Data-Intensive Applications* (DDIA), by Martin Kleppmann. 中译本: the Chinese translation of the book.
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

## Other

- 天文晨光 / 航海晨光 / 民用晨光: astronomical twilight / nautical twilight / civil twilight
- 检索增强生成: retrieval-augmented generation (RAG); 多智能体编排: multi-agent orchestration
- 多路召回: several retrievers (the results of several retrieval methods, e.g. BM25 and vector search); 召回率: recall
