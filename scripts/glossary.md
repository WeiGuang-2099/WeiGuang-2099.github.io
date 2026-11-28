# Glossary for npm run translate

Names and terms with a fixed English form. scripts/translate.ts puts this whole file into its prompts, for
the posts and for the figure labels alike, so both use the same words. When a translation picks a word you
don't want, add a line here and translate the post again.

## Names

- 缉熙: the author's Chinese name, from the Book of Songs. Keep it in Chinese characters; where a post talks about the name itself, add its pinyin once: 缉熙 (jī xī). Everywhere else the author is Dawning.
- 读书笔记 in a title: Reading Notes. "DDIA 读书笔记 01：……" becomes "DDIA Reading Notes 01: ...".
- 《数据密集型应用系统设计》: *Designing Data-Intensive Applications* (DDIA), by Martin Kleppmann. 中译本: the Chinese translation of the book.
- 道格拉斯·亚当斯《基本无害》: Douglas Adams, *Mostly Harmless*. 格蕾丝·霍珀: Grace Murray Hopper. Poons 先生 / Cake 太太: Mr. Poons / Mrs. Cake.
- 托马斯·阿奎那《神学大全》: Thomas Aquinas, *Summa Theologica*. 《星球大战》: *Star Wars*.
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
- 记录系统: system of record; 派生数据 / 派生数据系统: derived data / derived data system; 批处理 / 流处理: batch processing / stream processing; 在线系统 / 离线系统 / 近实时系统: online / offline / near-real-time system; 吞吐量: throughput
- 工作集: working set; 统一接口: uniform interface; 逻辑与布线分离: separation of logic and wiring; 分布式文件系统: distributed filesystem; 纠删码: erasure coding; 让计算靠近数据: putting the computation near the data; mapper / reducer stay in English; 混洗: the shuffle; 工作流 / 工作流调度器: workflow / workflow scheduler
- 排序合并连接: sort-merge join; 二次排序: secondary sort; 分组: grouping; 会话化: sessionization; 热键: hot key; reduce 端连接 / map 端连接: reduce-side join / map-side join; 广播哈希连接: broadcast hash join; 分区哈希连接: partitioned hash join; map 端合并连接: map-side merge join
- 批量加载: bulk loading; 最小化不可逆性: minimizing irreversibility; 大规模并行处理: massively parallel processing (MPP); 数据湖: data lake; 寿司原则: the sushi principle; 读时模式 / 写时模式: schema-on-read / schema-on-write
- 中间状态: intermediate state; 物化（把中间状态写下来）: materialization; 数据流引擎: dataflow engine; 算子: operator; 血缘: lineage; 检查点: checkpoint; 确定性的: deterministic; 批量同步并行: bulk synchronous parallel (BSP); 向量化处理: vectorized processing; 有界 / 无界: bounded / unbounded
- 事件: event; 生产者 / 消费者: producer / consumer; 主题: topic; 背压: backpressure; 负载均衡: load balancing; 确认: acknowledgment; 重新投递: redelivery; 基于日志的消息代理: log-based message broker; 偏移量: offset; 消费者组: consumer group; 重放: replay
- 双写: dual writes; 变更数据捕获: change data capture (CDC); 日志压实: log compaction; 事件溯源: event sourcing; 命令（事件溯源）: command; 命令查询职责分离: command query responsibility segregation (CQRS)
- 复杂事件处理: complex event processing (CEP); 流分析: stream analytics; 事件时间 / 处理时间: event time / processing time; 掉队者: straggler; 滚动窗口 / 跳跃窗口 / 滑动窗口 / 会话窗口: tumbling / hopping / sliding / session window; 流-流连接 / 流-表连接 / 表-表连接: stream-stream / stream-table / table-table join; 扩充: enrichment; 缓慢变化维度: slowly changing dimension (SCD)
- 恰好一次语义: exactly-once semantics; 有效一次: effectively-once; 微批: microbatching; 屏障: barrier; 幂等性 / 幂等的: idempotence / idempotent
- 数据集成: data integration; 重新处理: reprocessing; Lambda 架构: lambda architecture; 拆解数据库: unbundling databases; 联邦数据库: federated database; 把数据库里外翻过来: database inside-out; 写路径 / 读路径: write path / read path; 离线优先: offline-first; 本地优先软件: local-first software
- 端到端论证: the end-to-end argument; 重复抑制: duplicate suppression; 请求 ID: request ID; 唯一性约束: uniqueness constraint; 及时性 / 完整性: timeliness / integrity; 避免协调: coordination-avoiding; 审计: auditing; Merkle 树: Merkle tree; 证书透明度: Certificate Transparency
- 监控 has two senses. In the last section of DDIA notes 12 (做正确的事, about privacy and tracking) it is surveillance: 监控基础设施: surveillance infrastructure, and the thought experiment that swaps 数据 for 监控 swaps "data" for "surveillance" (监控驱动的组织: surveillance-driven organization; 监控流 / 监控仓库: surveillance stream / surveillance warehouse). Everywhere else (监控作业, 监控消费者落后了多少) it is monitoring.
- 预测分析: predictive analytics; 算法监狱: algorithmic prison; 偏见的洗钱: money laundering for bias; 道德想象力: moral imagination; 系统思维: systems thinking; 数据尾气: data exhaust; 有毒资产: toxic asset; 《通用数据保护条例》: the General Data Protection Regulation (GDPR)

## LLM-year terms

The llm-year posts are reading notes on *What We Learned from a Year of Building with LLMs* (O'Reilly, July 2024), by Eugene Yan, Bryan Bischof, Charles Frye, Hamel Husain, Jason Liu and Shreya Shankar. Its free online edition is applied-llms.org. Where a Chinese term renders one of the book's own headings or terms, use the book's English. This edition spells it fine-tune / fine-tuning.

- 【原文】 / 【扩展】, the markers in front of paragraphs: [Book] / [Extension]. [Book] marks the author's summary of the book; [Extension] marks the author's own additions. In the reflection post, 【事实】 / 【观点】 / 【我的判断】: [Fact] / [Opinion] / [My judgment].
- 第 N 章读书笔记 in a title: Chapter N Reading Notes. 反思笔记 in a title: Reflection.
- 战术 / 运营 / 战略: tactics / operations / strategy (the book's three chapters: Tactics, Operations, Strategy)
- 提示 / Prompt 工程: prompting / prompt engineering; 思维链: chain-of-thought (CoT); n-shot 提示: n-shot prompting; 上下文学习: in-context learning; 预填: prefill; 精雕上下文: crafting the context (the book: "Craft Your Context Tokens")
- 关键词检索: keyword search; 混合检索: hybrid search; 重排: reranking; 相关性 / 信息密度 / 细节程度: relevance / information density / level of detail
- 确定性工作流: deterministic workflow; 多步流程: multi-step flow; 前缀缓存: prefix caching; 精确缓存 / 语义缓存: exact cache / semantic cache
- 评测: evals (an eval); 断言 / 断言式单元测试: assertion / assertion-based unit tests; 成对比较: pairwise comparison; 实习生测试: the intern test; 护栏: guardrails; 无参考评测: reference-free evals; 大海捞针: needle in a haystack (NIAH); 错误分析: error analysis; 幻觉: hallucination; 事实不一致: factual inconsistency
- 开发—生产偏差: development-prod skew; 结构性偏差 / 内容性偏差: structural skew / content-based skew; 标准漂移: criteria drift; 现地现物: genchi genbutsu; 固定版本: pinning model versions; 影子流水线: shadow pipeline
- 人在回路: human-in-the-loop (HITL); 人在环上: human on the loop; 最小可爱好产品: minimum lovable product; 待完成的任务: jobs to be done; 偶然复杂度 / 本质复杂度: accidental / essential complexity
- 门槛 / 预算 / 增益, the author's three kinds of product requirements: gates / budgets / nice-to-haves
- AI 工程师: AI engineer; 派驻式工程师 / FDE: forward-deployed engineer (FDE); 解决方案工程师: solutions engineer
- PMF: product-market fit (PMF); 套壳: a thin wrapper; 评测底盘: evaluation chassis; 数据飞轮: data flywheel; 战略性拖延: strategic procrastination; 牦牛 (the book's yak shaving): the yaks that model providers will shave
- 半人马: centaur; 低成本认知: low-cost cognition; 能力过剩: capability overhang; 杰文斯悖论: Jevons paradox
- 推理模型: reasoning model; 思考 token: thinking tokens; 上下文工程: context engineering; 自主性调节器: autonomy slider; 模型退役 / 弃用: model retirement / deprecation

Rules for the llm-year posts:

- The [Book] paragraphs are the author's Chinese summary of the book. Translate that Chinese. Do not restore the book's original sentences from memory, apart from the few English quotes the post already gives in English, which stay exactly as they are.

## Other

- 天文晨光 / 航海晨光 / 民用晨光: astronomical twilight / nautical twilight / civil twilight
- 检索增强生成: retrieval-augmented generation (RAG); 多智能体编排: multi-agent orchestration
- 多路召回: several retrievers (the results of several retrieval methods, e.g. BM25 and vector search); 召回率: recall

## 来时路 (The Road We Came)

The laishilu posts are about the author's browser game 《来时路》. Its English version, *The Road We Came*, was rewritten rather than translated word for word. Use the English game's own words:

- 《来时路》: *The Road We Came*, in italics like a book title. Two things keep the Chinese: the cinnabar seal on the scroll, which reads 来时路 in both versions, and the link-preview card title, which is literally "来时路 · The Road We Came".
- 设计篇 / 转述篇 / 工程篇, the series' own names for its three posts: the design post / the retelling post / the engineering post.
- Places: 茶寮 the Teahouse; 驿站 the Waystation; 桥头 the Stone Bridge; 渡口 the Ferry; 山门 the Mountain Gate; 山顶 the Summit. People: 老板娘 the woman who keeps the teahouse; 掌柜 the keeper; 孩子 the child; 船夫 the ferryman; 扫地的老人 the old man sweeping the steps; 守经的人 the keeper of the scrolls. 经卷 / 一卷经: the scroll.
- Buttons and screen text: 开始: Begin. 继续上路: Carry on. 重新出发: Start afresh. 抹去走过的路: Forget the roads behind. 出发 (the button): Set out. 是这样: That's right. 不是这样的: That's not it. 继续: Go on. 再走一次: Walk it again. 打开声音 / 关闭声音: Sound on / Sound off. 大约五分钟。找个安静的时候。: About five minutes. Best somewhere quiet. 出发之前，写下你为什么要走这一趟。: Before you set out, write down why you're making this journey. 一句话就好，写真的理由。: One sentence will do. Make it the real reason. 这句话，路上的人会替你记着。: The people along the road will remember it for you. 凭记忆写: Write it from memory. 再多写几个字。: A few more words.
- The six verdicts: 一字不差。你还记得。: Word for word. You still remember. 你记得大半。有几个字，留在了路上。: Most of it is still with you. A few words fell by the wayside. 你记得大半。可有的字，已经换成了路上的说法。: Most of it is still yours. But some of the words now belong to the road. 你记住的，是路上的人说的那一句。: What you remember is what the people on the road told you. 你只记得一点。剩下的，路替你改了。: Only a little of it is left. The road rewrote the rest. 你忘了。可你还是走到了这里。: You forgot. And still, you made it here.
- 当你的旅程抵达终点后，你还会记得你为何而出发吗？: At the end of the road, will you still know why you began? 上一次，你写的也是这一句。: Last time, you wrote those very same words.
- 原句: the original; 路上那句 / 一路传下来的那句: the road's version; 记得的那句: the remembered version; 转述: retell, retelling; 走样: drift; 换说法: rephrasing; 丢字: dropping a character; 丢词: dropping a word; 听岔: mishearing; 对调字母: swapping letters; 评语: verdict; 种子: seed; 霞鹜文楷: LXGW WenKai.
- 字: in the Chinese version the unit is the character (the ferryman takes one character); the English version works in words.

Rules for the laishilu posts:

- They discuss Chinese text character by character: a player's sentence and the versions it turned into (想去看看母亲常说的那片海, 想看妈妈说的片湖), and characters or words picked out of them (常, 的, 那, 母亲 → 妈妈, 海 → 湖). Keep that Chinese exactly as it is, in running text, tables, image alt text and captions alike, and put its English meaning in parentheses after it, as in 母亲 (mother) → 妈妈 (mom); for a character that is only grammar, give its role, as in 的 (a possessive particle). Never replace it with English. Dialogue and narration from the game are translated.
- Their code blocks are exact copies of the game's source. Copy every line of them unchanged, Chinese strings included: those strings are the game's data, such as '看海' or ['回', ['去']]. Only a Chinese title="..." on the fence line is translated.
- The screenshots show the Chinese version of the game. An image's alt text says so once ("In the Chinese version: ..."), keeps the player's sentences in Chinese with their English meaning in parentheses, and translates the rest.
- Never put a double quote inside an image title (the quoted caption after the image path): quote with single quotes there.
