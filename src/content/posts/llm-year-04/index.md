---
title: "反思笔记：这本书的经验在 2026 年还剩多少——写给 FDE 与开发工程师"
description: "两年多以后回看《What We Learned from a Year of Building with LLMs》：书里和我笔记里的 20 条主张在 2026 年还剩多少，对 FDE 和开发工程师分别意味着什么，以及作者是怎么思考的。"
pubDate: 2026-11-28
category: reading-notes
tags: ["llm-year", "llm-apps", "reading-notes"]
---

> 对象：《What We Learned from a Year of Building with LLMs》（O'Reilly，2024 年 7 月）六位作者的经验与方法
> 写于 2026 年 11 月 28 日，距成书约两年四个月
> 方法：在前三篇笔记（[第 1 章](/posts/llm-year-01/)、[第 2 章](/posts/llm-year-02/)、[第 3 章](/posts/llm-year-03/)）和原文的基础上，核对了 20 条主张在 2026 年的现状，查了 FDE 与开发工程师这两个角色的现状，也拆了作者的论证结构
> 说明：【事实】有来源可查；【观点】是评论或争论；【我的判断】是我的推断。外部数字多来自二手报道，标了证据级别（见文末附录），引用时请以原始来源为准。

---

## 先说结论

### 经验的存留状况

逐条核查了 20 条主张：多数出自书，几条是我在前三篇笔记里补充的判断，还有几条是成书之后的新现象，表里的“出处”一列标明了。一句话概括：**没有被彻底证伪的原则；书里有两条判断在今天基本反过来了（见表后），其余的多数仍成立，或只需改写理由。**

| 状态 | 数量 | 含义 |
|---|---|---|
| 仍成立 | 10 条 | 可以直接继续用 |
| 部分成立、需要改写 | 8 条 | 原则对，但做法或理由变了 |
| 成立但出现悖论 | 1 条 | 成本：单价大跌，总支出上涨 |
| 证据不足 | 1 条 | 推理模型时代微调的价值 |

**被实质性反转的两条：**

1. **“AI 只应是资源，不应是工作流的主要驱动者”**（第 3 章；表中 #18）。对可验证的任务（写代码、调研），Agent 已经是驱动者，人变成了审查者。“人对结果负责”的精神没变，回路的形状变了。
2. **“n-shot 示例 + 手写思维链是默认技巧”**（第 1 章；表中 #3、#4 记的是我在笔记里对它的修正，这两条修正仍成立）。对推理模型，这两样从“默认加上”变成“加上之后必须验证”。

**书里提到了、但低估了的一条：** 模型退役常态化。书里说过要准备好在旧模型弃用时迁移，讲了“固定版本”，但没有把“固定有期限”展开成流程。

### 对 FDE 的三句话

1. 你站在“开发—生产偏差”的第一现场，**第一周建评测基线，不是做 Demo**。
2. 你离开时留下的不应该是 Prompt，而是**评测集、失效模式库和一个能自己跑的团队**。
3. 书的盲区（安全、合规、客户政治）是你的日常，**书里没有的，你得自己补**。

### 对开发工程师的三句话

1. 书里的“用确定性包裹概率性”就是**编译器、类型、测试、CI 对 AI 生成代码的意义**——没有验证器，就不要放权。
2. **验证成了新瓶颈**：审查从看 diff 转向看意图、风险和测试；“感觉快了”不等于快了。
3. **上下文窗口是稀缺资源**：给 Agent 的上下文和给 LLM 的 Prompt 一样需要精雕，开发者体验就是 Agent 体验。

### 他们的思考方式与我的三点启发

- 他们用**分层**组织散乱经验，用**口号**分配注意力，用**差距**（Demo 对产品）制造紧迫感，用**数字**让结论可信，用**类比**让原则可记忆。
- 启发一：**先问问题落在哪一层**——孤立的技术问题、组织失调，还是方向选择？层次错了，解法必然错。
- 启发二：**看一条建议的理由，而不是结论**——理由与模型能力绑定的，每次换代重检；理由与世界、组织、人绑定的，长期有效。
- 启发三：**警惕复制他们的弱点**——他们的证据是样本量为一的归纳，我自己的笔记也是。

---

## 经验逐条审视：20 条主张在 2026 年的状态

### 判定标准与证据分级

**看理由。** 每条建议背后都有一个“因为”。理由是“模型目前不擅长某事”的，模型每换代一次就重检一次；理由是“世界、组织、人就是如此”的，几乎不用重检。

**证据分级。** A = 同行评议论文或官方文档；B = 厂商自述、投行或分析机构估算；C = 业界博客、VC 观点；D = 媒体转述、未找到原始出处。

**出处。** 表里的“书”指原书的主张，“笔记”指我在前三篇笔记里补充的判断，“新现象”指成书以后才出现的情况。

### 仍成立的（10 条）

| # | 主张 | 出处 | 2026 年的状态 | 级别 |
|---|---|---|---|---|
| 1 | 长上下文不会取代 RAG | 书 | 输入越长表现越不可预测（Chroma 对 18 个模型的测试）；NoLiMa 基准显示多数模型在长上下文下大幅退步 | A |
| 3 | n-shot 示例的价值下降 | 笔记 | 对推理模型，少样本示例越多准确率反而越低（2025 年研究，机制是语义误导和策略迁移失败） | A |
| 4 | 手写思维链可能有害 | 笔记 | 在隐式统计学习等任务上，思维链显著降低推理模型表现（Liu 等，2024）；其他任务效果混合 | A |
| 5 | 结构化输出是原生能力 | 笔记 | 主流 API 已把 Schema 编译进解码过程；但只保证语法，不保证语义 | A |
| 6 | LLM 裁判有偏差 | 书 | 位置、冗长、自我偏好偏差被反复证实，只能缓解不能根除；说服性措辞和格式改动也能抬高打分 | A |
| 8 | 缓存改变成本结构 | 书 + 笔记 | 缓存读取价约为原价的 5%–10%；官方指南要求把稳定指令放在变化内容之前 | A |
| 9 | 模型退役常态化 | 新现象 | 各家都按周期弃用旧模型；OpenAI 的弃用页面写明正式版至少提前 6 个月通知，预览版可能只有两周。网上流传的“中位寿命约 403 天”等统计没找到原始出处 | A |
| 14 | PMF 前不买 GPU | 书 | 仍是默认共识，从零训练几乎只存在于模型实验室 | C |
| 16 | “AI 工程师”分化，FDE 兴起 | 笔记 | 岗位头衔在分化；FDE 岗位数量大增（Fortune 2026 年 9 月引 Lightcast 数据：今年 1 到 8 月相关岗位同比增长超过 1000%，不同数据源的倍数差别很大） | B |
| 20 | 上下文工程流行 | 新现象 | 2025 年年中经 Shopify CEO 和 Karpathy 走红，被定义为提示工程的延伸，继续向“支架/循环工程”延伸 | C |

### 需要改写的（8 条）

| # | 主张 | 出处 | 需要改写的地方 | 对我的含义 |
|---|---|---|---|---|
| 2 | 高风险任务优先确定性工作流 | 书 | 算术没变，但**理由变了**：从“模型不可靠”变成“可验证性决定自主度”。有验证器的任务可以让 Agent 自主；主流形态是“工作流骨架 + 有界 Agent” | 自主度与风险的不可逆性挂钩 |
| 7 | 幻觉是顽固问题 | 书 | 仍然顽固，但重点从“编造”转向**校准、弃权和谄媚**：OpenAI 把幻觉归因于评测奖励猜测；有研究称“温暖训练降低准确率” | 评测要加“该弃权时是否弃权” |
| 10 | 小模型 + 按步骤路由 | 书 + 笔记 | 结论更强了，但出现反转：**单价暴跌和缓存削弱了路由的省钱空间**；Agent 用量上升又让“按任务难度分配”仍有价值 | 先有评测闸门再谈路由 |
| 12 | 数据飞轮是护城河 | 书 | 要三个条件同时成立：信号有效、回路闭合、反馈够快；否则只是日志文件 | 现场没有学习机制，就没有飞轮 |
| 13 | 套壳的护城河 | 书 | 重心从“专有数据”转向**工作流所有权和分发**；差异化不足的套壳被平台吞并 | 价值在用户每天工作的地方 |
| 17 | 评测成为组织能力 | 书 | 已成核心实践，但出现分歧：**Hamel 和 Shreya 不赞成一上来就写评测**（eval-driven development），主张先做错误分析；错误分析不要外包，由一位领域专家拍板 | 第一天先看样本、做错误分析，不急着搭自动化评测 |
| 18 | 人在回路 | 书 | 方向成立：从“环中”到“环上”，审查从逐行看 diff 转向意图与风险，出现“AI 审 AI”；但**人没有退出** | 人从操作者变成审查者与负责者 |
| 19 | 法规要求 | 笔记 | 要求存在（通用模型义务 2025 年 8 月起适用，透明度义务 2026 年 8 月起），但**高风险义务被推迟**（欧盟 Digital Omnibus 2026 年 7 月生效，Annex III 高风险义务推迟到 2027 年 12 月） | 近期约束主要来自透明度条款 |

### 成立但出现悖论（1 条）

| # | 主张 | 出处 | 2026 年的悖论 | 对我的含义 |
|---|---|---|---|---|
| 15 | 固定能力的成本快速下降 | 书 | 同等能力的单价大约每年降一个数量级（a16z；Epoch 按不同基准测得每年 9 到 900 倍）；但**总支出在涨**：企业花在模型 API 上的钱从 2024 年 11 月的 35 亿美元涨到 2025 年中的 84 亿美元（Menlo Ventures）。看起来像杰文斯悖论，但这些数据只说明两件事同时发生 | 预算按“每任务成本”，不按“每 token 成本” |

### 证据不足（1 条）

| # | 主张 | 出处 | 现状 | 对我的含义 |
|---|---|---|---|---|
| 11 | RAG 管知识，微调管行为 | 书 + 笔记 | 业界仍这么讲，但推理模型时代微调的价值缺少系统研究；供应商的态度在分化：OpenAI 2026 年 5 月起限制自助微调，12 月 15 日起不再接受新任务，谷歌还在给新的 Gemini 开放调优 | 保持“没证明必要不微调”，但把“微调小模型替代大模型”当作正当的降本手段（在 OpenAI 上已经走不通，要靠开源模型或别家平台） |

### 书里没有、现在必须有的

- 推理 token 的成本与延迟（看不见的输出）
- 工具调用可靠性（Agent 最主要的失败源之一）
- 上下文工程（往窗口里放什么、放多少）
- 模型退役日历与迁移常态化
- 安全与合规（提示注入、数据边界、人工监督）
- “AI 审 AI”的审查设计
- 评测由谁主导（领域专家还是评测团队）

---

## 作为 FDE：值得注意与值得反思的

### FDE 的工作结构与这本书的重合

FDE（Forward Deployed Engineer）源自 Palantir（内部叫“Delta”），2024–2026 年在 OpenAI、Anthropic、Cursor 等公司普及【事实，据媒体与招聘页面】。2026 年几家大厂都下了重注：亚马逊宣布用 10 亿美元组建 FDE 团队，Anthropic 拿出 1 亿美元培训客户的“前沿部署工程师”，OpenAI 成立了一家部署公司，据报道外部投资超过 40 亿美元【事实】。OpenAI、Anthropic、Cursor 的岗位描述一致：**在客户系统内写生产代码、做评测、交付，并把现场问题带回产品**。与解决方案工程师（售前、背销售指标、做 Demo）的区别是：FDE 在售后、通常不背销售指标、交付的是生产系统。

这本书的第 2 章（运营）和第 3 章（战略）几乎就是 FDE 的工作说明书：

| 书中的章节 | FDE 的对应工作 |
|---|---|
| 第 2 章 1.1 开发—生产偏差 | 客户现场就是“生产” |
| 第 2 章 1.2 每天看样本 | 看客户系统里真实的输入输出 |
| 第 2 章 2.3 固定版本 | 在客户环境里管住模型版本 |
| 第 2 章 3.2 人在回路的 UX | 让客户的领域专家能纠正模型 |
| 第 2 章 4.1 流程先于工具 | 交付的是流程，不是工具 |
| 第 3 章 2.1 系统是资产 | 留下评测、数据、集成 |
| 第 3 章 2.1 战略性拖延 | 不替产品团队做它迟早会做的事 |

### 值得注意的八点

**① Demo 陷阱在客户现场被放大。** 客户高管在场、用的是客户最好的数据、你坐在旁边随时补位——书里那张“Demo 对产品”表的每一行都被放大了。FDE 的反模式清单里第一条就是“靠隐藏的人工步骤撑起的 Demo”【观点】。Cursor 的 FDE 岗位明确写着“不是 Demo 岗位”。**所以第一周应该做的事是建评测基线**：从客户历史数据里抽 50 条，人工写下正确答案，记录当前的失败类型。这一步不做，后面所有工作都没有锚点。

**② 确定性优先是交付纪律，不是技术偏好。** 书里说多步任务的成功率随步数指数下降；照第 1 章笔记里的算法，每一步成功率 95%，10 步只剩 60%。FDE 在客户现场最有价值的能力，是判断“这 10 步里有几步可以变成代码”。“计划 → 审批 → 执行”的形态，对高风险操作（发邮件、改数据、触发业务流程）几乎是必需的。

**③ 模型退役是你的责任。** 书里讲“固定版本”，没讲“固定有期限”。各家都按周期弃用旧模型，正式版通常只提前几个月通知，而客户环境里升级模型的人是你。固定版本、影子流量、弃用日历、第二家备选路由——这四样是 FDE 交给客户的运维基本功。

**④ 评测集是你留下的最大资产，也是你抽身的条件。** 没有评测集，FDE 无法离开：换了模型不知道有没有回归，改了流程不知道有没有变好，客户离不开你，你也离不开客户。反过来，一套能重跑的评测集加一个失效模式库，是任何供应商都给不了的资产。

**⑤ 现场知识必须回流，否则飞轮不转。** 数据飞轮要三个条件同时成立：信号有效、回路闭合、反馈够快。FDE 最大的失败模式是知识留在个人脑子里——客户的特殊处理、领域的判断标准、踩过的坑。需要组织授权的回流通道：定期的现场到产品的评审，把定制分叉归类为“该进产品 / 该等平台 / 客户特有”。

**⑥ 不是每个客户都需要 FDE。** Cursor 的 FDE 负责人给过一个 2×2 矩阵（客户成熟度 × 产品可定制性）：客户成熟且产品定制度低时，不该派 FDE【观点】。“战略性拖延”的 FDE 版本是：**不替产品团队做它迟早会做的事**。

**⑦ 书的盲区是你的日常。** 安全、合规、数据边界、客户内部的政治——书里几乎没讲，但 FDE 每天面对。作者的构成（顾问、研究者、团队负责人、教育者）里没有安全、法务、设计的人，这决定了他们的盲区，也意味着读这本书的 FDE 需要另外补齐这几块。

**⑧ 供应商的 FDE 和应用公司的 FDE 有利益冲突。** 批评者称供应商的 FDE 是“人形减震器”或“换皮外包”；国防软件公司 Legion 有一份文档直言 FDE 模型会变成“产品不成熟的拐杖”【观点】。我在第 2 章笔记里把模型叫作“带退役日期的依赖”，这在客户现场意味着：**你有义务告诉客户，哪些东西会在换模型时一起失效。**

### 值得反思的（我作为 FDE 该问自己的）

1. 我是不是在用隐藏的人工步骤撑起 Demo？
2. 我的指标驱动了决策吗？没有决策的指标等于装饰。
3. 我是否在过早微调？书里说“微调是重型机械”，FDE 在现场更容易被客户推着走这条路。
4. 我是否把某个客户的分叉当成了产品战略？
5. 我离开时留下的是什么：一堆 Prompt，还是评测集、失效模式库、能自己跑的团队？
6. 我有没有告诉客户，哪些是会随模型退役一起失效的东西？

---

## 作为开发工程师：值得注意与值得反思的

这里的“开发工程师”指日常写代码的研发工程师，也兼顾开发者体验。

### 开发本身变了

- DORA 2025 报告：九成开发者用 AI，中位每天约两小时；AI 提升吞吐量，**同时与交付不稳定上升相关**【事实】。
- METR 的随机对照实验：资深开发者用 AI 后实际慢了 19%，却自认快了 20%【事实】。
- 斯坦福“Canaries”研究：22–25 岁软件开发者就业明显下降，年长者反而增长；作者称这是描述性指标，不是因果估计。2026 年 8 月的修订版说，受 AI 影响最大的职业里，年轻人的就业比跟上其他职业增速时应有的水平低 19%【事实】。
- Agent 是“放大器”还是“替代者”：Yegge 和 Karpathy 各有说法，并不是一场直接的争论【观点】；Karpathy 提出人通过“自主性调节器”控制 Agent【观点】。
- “vibe coding”的划界：Willison 的说法是“不审查才是 vibe coding”，解释不了的代码不进仓库【观点】。

### 书里的原则怎么映射到 AI 辅助开发

| 书里的原则（第 1 章为主） | 在 AI 辅助开发里的对应 |
|---|---|
| 断言式单测 | 让 Agent 改代码前先有的测试 |
| LLM 裁判 | 集成测试、端到端测试 |
| A/B 测试 | 生产灰度 |
| 实习生测试 | 把 Agent 当实习生：目标清楚、资料齐全、检查产出 |
| 一个 Prompt 只做一件事 | 任务拆小、PR 拆小 |
| 用确定性包裹概率性 | 编译器、类型系统、测试、CI 是生成代码的验证器 |
| 没有评测就没有迭代 | 没有测试就不要让 Agent 改代码 |
| 看数据，不看指标 | 看 diff，不看“感觉” |
| 精雕上下文 | 给 Agent 的上下文同样要精雕：相关文件、约束、边界 |

### 值得注意的六点

**① 验证成了新瓶颈。** DORA 的访谈显示，节省下来的写码时间转移到了审计和验证上【事实】。PR 变大，审查时间上升。设计工作流时要把**验证成本**算进去。

**② 自主度与测试强度匹配。** 书里“确定性优先”的开发版本：编译器和测试就是验证器，验证器越强，可以放的自主度越大。Karpathy 的“自主性调节器”说的是同一件事。

**③ 上下文窗口是稀缺资源。** 上下文工程对 Agent 同样适用：给它哪些文件、哪些约束、哪些历史，直接决定产出质量。

**④ 工具调用可靠性是新的首要失败源。** Agent 写代码时工具选错、参数填错，是现在最常见的失败方式之一，需要专门的测试。

**⑤ 开发者体验就是 Agent 体验。** 文档、架构决策记录、快速测试、可复现环境，同时服务人和 Agent【观点】。

**⑥ “AI 审 AI”出现了，但人没有退出。** 审查从逐行看 diff 转向看意图、风险和测试；人仍是负责者。

### 值得反思的

1. 我是否在 vibe coding？解释不了的代码有没有进仓库？
2. 我的测试是否跟上了生成速度？没有测试覆盖的代码，Agent 改起来我敢放权吗？
3. 我是否因为“感觉快了”而低估了验证时间？
4. 我写的 spec 是否能让 Agent 像实习生一样工作，还是每次都要我在旁边补位？

---

## 作者是怎么思考的：拆解与启发

### 组织逻辑：三层，而且是事后套上的

全书分战术、运营、战略三层。第 2 章开头引了一句据说出自多位领袖的话：“外行谈战略和战术，内行谈运营。”接着对比了几种视角：战术看到的是“一堆独一无二的问题”，运营看到的是“一种可以修复的组织性失调”，战略看到的是“一个机会”。

值得注意的是：这个结构是**事后**套上的。致谢里说，文章起源于群聊，Bryan 把它重组成三部分。换句话说，先有经验，后有框架——框架是为了让经验可传授。

### 六种反复出现的论证手法

| 手法 | 他们怎么用 | 例子 |
|---|---|---|
| **口号化** | 标题多为“否定 + 条件”或“X 不是 Y” | “No GPUs Before PMF”；“The Model Isn't the Product; the System Around It Is” |
| **反向建议** | “不要……”式祈使句，四个小节标题就以 Don't 开头 | “Don't Fine-Tune Until You've Proven It's Necessary” |
| **类比** | 把陌生问题映射到熟悉的经验 | 实习生测试、半人马、自动驾驶 35 年、米开朗基罗雕上下文、内存与磁盘、Postel 定律、丰田快速换模 |
| **数字论证** | 用具体数字让结论可信 | 19% → 44%、n ≥ 5、68% → 94%、80% 对 30%、5%–10%、$3.5 对 $25、10%、$20 → 10¢ |
| **差距论证** | 用两个东西之间的鸿沟制造紧迫感 | Demo 对产品；大海捞针对真实长文；基准对产品评测 |
| **第一人称归纳** | “我们学到”“我们观察到”，有时匿名信源，有时先自贬再立论 | “(Some of us were initially huge skeptics.)”；“We know of a team that…” |

### 七个底层思维模型（他们的世界观）

1. **模型是概率组件，需要确定性外壳。** “produce deterministic plans which are then executed in a structured, reproducible way”
2. **成本随时间下降，所以今天不可行的明天可行。** “a completely infeasible floor demo … today will become a premium feature in a few years and then a commodity”
3. **系统比模型持久。** “models are likely to be the least durable component in the system”
4. **注意力是稀缺资源。** 每周数小时看数据；“where to allocate scarce resources”
5. **反馈周期是根本。** “shortening the feedback cycles between work and its outcomes so that improvements accumulate instead of errors”
6. **按需加复杂度。** “start simple and only add complexity as needed”；“fine-tuning is heavy machinery”
7. **人是中心。** 模型“should merely be a resource”

### 他们论证的弱点

| 弱点 | 具体表现 |
|---|---|
| 样本小且匿名 | “十来家公司”得出“一致观察到”；匿名团队“一年完成了三年路线图” |
| 失败不点名 | “多数人后悔这个决定”没有案例；成功案例都有名有姓（BuzzFeed、Replit） |
| 视角偏差 | 批评“开箱即用评测”时，正面例子是共同作者自己的论文（EvalGen） |
| 经验写成结论 | n ≥ 5、三个断言、“每级一个数量级的努力”都没有出处；成本曲线只有四年数据，却断言“没理由预期这个过程会放慢” |
| 自我矛盾 | 说这些洞见“没有被更广泛讨论”，但证据几乎全来自公开博客；自己标注为“轶事数据”的材料仍被当论据 |

### 对我的启发

**元规则：读经验之谈的四个动作。**

1. 看它的**理由**（与模型绑定，还是与世界绑定）。
2. 找它的**样本**（多少家、谁、有没有失败案例）。
3. 找**反例**（什么情况下这条不成立）。
4. 问**写它的人是谁**（作者构成决定盲区）。

**十条可迁移的思维动作**（来自原文，我重新表述）：

1. 先问问题落在哪一层：孤立问题、组织失调，还是机会。
2. 每加一级复杂度，先确认付出一个数量级的努力值不值得。
3. 给任务做实习生测试：缺知识就补上下文，太慢就拆任务。
4. 把概率步骤包进确定性计划，失败才能定位到具体步骤。
5. 看到新问题，立刻写成断言。
6. 降低人的判断成本：用二元和成对替代打分。
7. 学一个范式时问它的功能是什么，别只抄形式。
8. 只投入会在模型迭代后留下的资产。
9. 今天不经济的事，沿价格曲线推算可行时点。
10. 提供商迟早会做的事，做战略性拖延。

**对我自己写法的反思。** 这本书的弱点，我的笔记也有：我在笔记【扩展】里写的“成书后的变化”和这篇的核对表，引用的很多是业界估算和媒体转述，不是受控研究；我的“落地检查清单”也是经验归纳。这份反思尽可能标了证据级别，但仍然继承了这个局限。**读我写的东西，也应该用读它的方法。**

---

## 行动清单

### 读任何“经验”时的五个问题

- 它的理由是什么？与模型绑定还是与世界绑定？
- 样本多大？有没有失败案例？
- 写它的人是谁？他们的盲区在哪？
- 什么情况下这条不成立？
- 我能不能用 20 条样本验证它？

### FDE 开工前的十个问题

- 我有没有先建评测基线，而不是先做 Demo？
- 客户的成功指标是什么？谁有权定义“对”？
- 哪些步骤必须是代码？哪些可以让模型做？
- 高风险操作有没有审批点？
- 模型版本固定了吗？退役日历看了吗？备选方案有吗？
- 现场发现会怎么回流产品？谁来归类？
- 安全、合规、数据边界，谁负责？
- 我有没有用隐藏的人工步骤？
- 客户的领域专家能不能在界面里纠正模型？
- 我离开时留下什么？

### 让 Agent 改代码前的十个问题

- 测试覆盖够吗？没有测试的代码敢放权吗？
- 验证器是什么（编译、类型、测试、CI）？
- 自主度与风险匹配吗？
- 我给的上下文够不够、准不准？有没有多余的？
- 任务拆得够小吗？
- 我会审查 diff 吗？还是只看它说“完成了”？
- 工具调用（运行测试、查文件）可靠吗？
- 推理 token 的成本和延迟我能接受吗？
- 有没有“解释不了”的代码进仓库？
- 出错时能回滚吗？

---

## 附录：证据分级与来源

### 分级

| 级别 | 含义 |
|---|---|
| A | 同行评议论文、官方文档 |
| B | 厂商自述、投行或分析机构估算 |
| C | 业界博客、VC 观点 |
| D | 媒体转述，未找到原始出处 |

### 主要来源（按主题）

**长上下文与检索（A）**
- [Chroma Research, *Context Rot*](https://www.trychroma.com/research/context-rot)
- [NoLiMa 基准](https://arxiv.org/abs/2502.05167)

**提示技巧与推理模型（A）**
- [少样本示例对推理模型的影响](https://arxiv.org/abs/2509.23196)
- [Liu 等，*Mind Your Step (by Step)*](https://arxiv.org/abs/2410.21333)

**结构化输出与缓存（A）**
- [Anthropic 严格工具使用文档](https://platform.claude.com/docs/zh-CN/agents-and-tools/tool-use/strict-tool-use)
- [OpenAI 的 Prompt caching 文档](https://developers.openai.com/api/docs/guides/prompt-caching)

**LLM 裁判（A）**
- [裁判偏差综述（转载）](https://developer.aliyun.com/article/1786820)
- [修辞改写对 AI 审稿打分的影响](https://arxiv.org/abs/2608.08975)
- [Hwang 等，*Can You Trick the Grader?*（说服性措辞与 LLM 裁判，2025）](https://arxiv.org/abs/2508.07805)
- [Yang 等，*Turning Bias into Bugs*（格式改动与 LLM 裁判，2026）](https://arxiv.org/abs/2605.26156)

**幻觉（B）**
- [OpenAI, *Why Language Models Hallucinate*](https://openai.com/index/why-language-models-hallucinate/)
- [牛津关于“友好聊天机器人更多错误”的研究](https://www.oii.ox.ac.uk/friendly-ai-chatbots-make-more-mistakes-and-tell-people-what-they-want-to-hear-study-finds/)

**模型退役、路由、成本（A–C）**
- [OpenAI 的弃用页面（模型与自助微调）](https://developers.openai.com/api/docs/deprecations)
- [RouteLLM](https://arxiv.org/abs/2406.18665)
- [路由的落地条件（C）](https://oometa.ai/insights/llm-model-routing-inference-2026)
- [a16z, *LLMflation*（2024）](https://a16z.com/llmflation-llm-inference-cost/)
- [Epoch AI：LLM 推理价格趋势（2025）](https://epoch.ai/data-insights/llm-inference-price-trends)
- [Menlo Ventures：2025 年中 LLM 市场报告](https://menlovc.com/perspective/2025-mid-year-llm-market-update/)

**微调与飞轮（C）**
- [RAG 与微调对比（博客）](https://app-lab.ai/blog/rag-vs-finetuning-2026)
- [飞轮的三个条件（博客）](https://tianpan.co/zh/blog/2026/05/05/data-flywheel-assumption-ai-features-noise)

**护城河（C）**
- [Aperture, *AI Wrapper Thesis 2026*（VC 观点）](https://theaperture.vc/reports/ai-wrapper-thesis-2026/)

**评测（C，存在分歧）**
- [Hamel Husain、Shreya Shankar 的评测 FAQ](https://hamel.dev/blog/posts/evals-faq/)
- [评测驱动开发与 TDD 的区别](https://wpnews.pro/news/eval-driven-development-what-it-is-how-it-differs-from-tdd-and-a-loop-that-works)

**FDE 与角色（B–D）**
- [FDE 人才争夺（媒体）](https://www.inside.com.tw/article/41983-fde-ai-forward-deployed-engineers-ai-talent-war)
- [Cursor 的 FDE 岗位](https://cursor.com/ko/careers/forward-deployed-engineer-india)
- [FDE 与解决方案工程师的区别](https://brandengineering.ai/blog/forward-deployed-engineer-vs-solutions-engineer)
- [FDE 现场指南（反模式）](https://github.com/Bosheng2020/fde-field-guide/blob/main/docs/zh-CN/09-challenges-antipatterns.md)
- [Legion, *The Forward Deployed Engineering Model Is Backward*](https://cdn.prod.website-files.com/680a8bc2d69bace9040bd4d9/6a5935d8e42aef4e74695ce2_The%20Forward%20Deployed%20Engineering%20Model%20Is%20Backward.pdf)
- [Cursor 的 FDE 实践（含 2×2 矩阵，转载）](https://www.jxxy.net/ai/articles/forward-deployed-engineering-at-cursor)
- [亚马逊：10 亿美元的 FDE 团队（2026）](https://www.aboutamazon.com/news/aws/aws-1-billion-forward-deployed-ai-engineers)
- [Anthropic：Claude Frontier Academy（2026）](https://anthropic.com/news/claude-frontier-academy)
- [TNW：OpenAI 成立部署公司（2026）](https://thenextweb.com/news/openai-deployment-company-4bn-tpg-tomoro)
- [Fortune：FDE 岗位快速增长（2026 年 9 月，引 Lightcast 数据）](https://www.fortune.com/2026/09/03/forward-deployed-engineers-fast-growing-six-figure-silicon-valley-job-integrate-ai-with-customers-tech-careers-palantir/)

**开发工程师（A–C）**
- [DORA 2025 报告（Google 博客介绍）](https://blog.google/technology/developers/dora-report-2025/)
- [DORA 访谈（AI 使用与验证）](https://dora.dev/insights/balancing-ai-tensions/)
- [斯坦福 Canaries 论文（2026 年 8 月修订版）](https://digitaleconomy.stanford.edu/app/uploads/2026/08/Canaries_August2026.pdf)
- [斯坦福 Canaries 面板](https://digitaleconomy.stanford.edu/project/indicators/canaries-dashboard/)
- [Karpathy, *Software Is Changing (Again)*（Latent Space 整理的幻灯片与视频）](https://www.latent.space/p/s3)
- [Yegge, *Revenge of the Junior Developer*](https://sourcegraph.com/blog/revenge-of-the-junior-developer)
- [Anthropic 2026 Agentic Coding 报告](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf)
- [人在环上的代码审查（博客）](https://wangjunjian.com/posts/2026-11-14-agentic-code-review-human-on-the-loop.html)
- [METR 实验与 vibe coding（博客转述）](https://tianpan.co/zh/blog/2026/04/13/vibe-coding-considered-harmful)
- [开发者体验与 AI（博客）](https://business.nopex.cloud/blog/developer-experience-ai-era)

**法规与术语（A–C）**
- [欧盟 AI 法案实施时间线](https://artificialintelligenceact.eu/implementation-timeline/)
- [Regulation (EU) 2026/1744（Digital Omnibus on AI，官方公报）](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng)
- [Digital Omnibus 的变化（指南）](https://www.osabee.com/wake/guides/digital-omnibus-ai-act-what-changes)
- [“上下文工程”词条](https://earlyterms.com/zh/term/context-engineering)

---

*本笔记为个人反思，不代表原书作者观点。引用的外部数字请以原始来源为准。*
