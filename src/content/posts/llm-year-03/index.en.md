---
title: "Chapter 3 Reading Notes: Strategy — Building with LLMs Without Being Overtaken"
description: "Notes on Chapter 3 of What We Learned from a Year of Building with LLMs: why you shouldn't train a model right away, where the moat lies beyond the model, how humans and AI divide the work, how to get started, and what the trend of low-cost cognition means."
sourceHash: "9dbfd30d0f5ae575"
---

> Book: *What We Learned from a Year of Building with LLMs* (O'Reilly, July 2024)
> Scope of these notes: Chapter 3 (the book's final chapter: No GPUs Before PMF → Iterate to Something Great → AI in the Loop; Humans at the Center → Start with prompting/evals/data → The broad trend of low-cost cognition → From 0→1 demos to 1→N products)
> Note: **[Book]** marks my summary of the book's points; **[Extension]** marks background, examples, or changes since the book that I've added. Numbers from the book have their sources noted; numbers in the extension sections that come from industry blogs or news reports rather than papers are marked "experience/public reporting" — verify them yourself.

---

The first two chapters answered "how to do it" (tactics: concrete actions) and "what process supports doing it" (operations: higher-level processes). Chapter 3 answers **where these goals come from** — that is, strategy: the "what to do" and "why" behind tactics and operations.

The authors give several clear-cut slogans, such as "**No GPUs Before PMF (product-market fit)**" and "**Focus on the system, not the model**," to help teams decide where to put scarce resources. The chapter is organized around six questions:

| Question | One-sentence answer (from the book) |
|---|---|
| **Build or buy** | When should you train your own model, and when use an off-the-shelf API? — "It depends," and the authors explain what it depends on |
| **Iterate to something great** | How do you build a lasting advantage beyond "using the latest model"? — Build a robust system around the model and create memorable, sticky experiences |
| **Human-centered AI** | How do you fit LLMs into human workflows to maximize productivity and well-being? — Augment people rather than replace them |
| **How to get started** | What are the most basic steps? — Prompt engineering, evals, and data collection |
| **The future of low-cost cognition** | How will falling costs and rising capabilities shape applications? — Extrapolate from historical trends |
| **From demo to product** | What stands in between? — Rigorous engineering, testing, and polish |

The authors' closing words are worth remembering: successful products require deliberate planning and hard trade-offs, not endless prototyping, and not chasing the latest models and trends. The chapter opens with a joke — "let's think step by step," applying Chapter 1's CoT to the chapter's own organization.

---

## No GPUs before PMF

**[Book]** An excellent product can't be merely a thin wrapper around someone else's API. But erring in the opposite direction costs even more: over the past year, a great deal of venture capital (the book mentions one "eye-watering" mega-round) has been poured into training and customizing models, with no clear product vision or target market. This section explains why training your own model right out of the gate is a mistake, and discusses where self-hosting fits.

### Training from scratch is (almost) never worth it

**[Book]** For most organizations, pretraining an LLM from scratch is impractical and distracts from the work of building a product. Developing and maintaining ML infrastructure takes substantial resources: collecting data, training and evaluating models, deploying. If you're still validating PMF, this investment pulls resources away from the core product. **Even if you have the compute, the data, and the technical skills, the model you pretrain may be out of date within a few months.**

The example is **BloombergGPT**, an LLM trained specifically for financial tasks: pretrained on **363 billion tokens**, requiring a "heroic" effort from **9 full-time staff** (4 AI engineers and 5 in ML product and research). Despite this, **within a year it was surpassed on those financial tasks by gpt-3.5-turbo and gpt-4**.

The story shows that for most practical applications, even pretraining from scratch on domain data is not the best way to spend resources. A better approach is to **fine-tune the strongest open-source model for your needs**.

There are exceptions, of course: **Replit's code model** was trained specifically for code generation and understanding, and pretraining let it surpass larger models like CodeLlama-7b. But as stronger models are released, **maintaining that edge requires ongoing investment**.

**[Extension]**

**① BloombergGPT details and aftermath**: The model has 50 billion parameters, and the paper was published in 2023 ([Wu et al., 2023](https://arxiv.org/abs/2303.17564)). Later research compared BloombergGPT with ChatGPT/GPT-4 on financial NLP tasks and found the general-purpose models matched or beat it on most tasks ([Li et al., 2023](https://arxiv.org/abs/2305.05862)). The timeline of "surpassed by general-purpose models within a year" actually happened, rather than being hypothetical.

**② Why does "domain pretraining" often lose to general-purpose models?** Three reasons:
- **Scale and data quality**: public web data contains far more financial text (earnings reports, research reports, news) than any single company's private corpus; general-purpose models learn finance "along the way."
- **Capability transfer**: general capabilities like reasoning and instruction-following transfer across domains, and pretraining on a small corpus can't make up the gap.
- **The cost of catching up**: every time the base model improves, you have to retrain.

**③ When is training from scratch / continued pretraining still justified? (My judgment)**

| Condition | Explanation |
|---|---|
| You're selling the model itself | The model is the product (model labs, products that need differentiated model capabilities) |
| The data isn't on the public web, and there's a huge amount of it | For example, industry logs that only you have, or proprietary sensor data — and general-purpose models genuinely underperform on your evals |
| Hard constraints on latency/cost/offline use | Edge devices, privacy requirements too strict for APIs |
| You have the budget and team for sustained investment | Not a one-off, but something to redo for every base model release |

If any one of the four is missing, consider the "fine-tune the strongest open-source model" path first.

**④ The Replit example shows not that "pretraining is viable" but that "pretraining is a one-time lead"**: its advantage came from being first to invest in code; once CodeLlama, StarCoder, DeepSeek-Coder and others appeared, the lead was erased. **Unless you have a mechanism for sustained investment, a one-time model lead doesn't constitute a lasting advantage.**

### Don't fine-tune until you've proven you need to

**[Book]** For most organizations, what drives fine-tuning is more **FOMO** (fear of missing out) than clear strategic thinking. They commit to fine-tuning too early, hoping to rebut the accusation "you're just a thin wrapper." In fact, **fine-tuning is heavy machinery**: bring it out only once you've collected a large number of examples, enough to make you certain that other methods fall short.

A year ago, many teams said excitedly that they were going to fine-tune; **few of them found PMF, and most regret the decision.** If you do mean to fine-tune, you had better be quite sure of this: as base models improve, **you are ready to redo the work time after time** (see 2.1 and 2.3).

When is fine-tuning actually right? When the use case needs data **that isn't in the public web-scale datasets the existing models were trained on**, and you've **already built an MVP proving the existing models aren't good enough**. But be careful: **if even the model builders can't get good training data, where is yours coming from?**

Finally, remember: **an LLM application is not a science fair project**; what you invest in it should be in proportion to what it contributes to the business's strategic goals and competitive advantage.

**[Extension]**

**① Where is the weight in "heavy machinery"?** Not in the training itself (LoRA/QLoRA now make training cheap), but in these four things:
1. Collecting and labeling high-quality data;
2. Maintaining an eval suite that can judge "is the fine-tune better?";
3. Redoing it every time the base model updates;
4. Self-hosting operations (if you self-host in order to fine-tune).

**② Signals for and against fine-tuning (my checklist)**

| Signals against fine-tuning | Signals for fine-tuning |
|---|---|
| The goal is to "not sound like a thin wrapper" | You've tried prompting and RAG, and evals show a real bottleneck |
| You don't have an eval set yet | You have hundreds to thousands of high-quality, domain-specific samples |
| You want the model to "know" new facts (→ use RAG) | You need a specific output format/DSL/style that prompting can't hold steady |
| The task definition is still changing | The task is stable, call volume is high, and latency/cost pressure is real |
| The data is "something the model could also learn from the web" | The data is genuinely not public, and the model clearly underperforms on your evals |

**③ Changes since the book**: post-training methods became cheaper in 2024–2026 (parameter-efficient fine-tuning, preference optimization, etc.), so the per-round cost of "redoing it" fell; but **the real ongoing burden is the eval and data pipelines**, and that hasn't changed. Meanwhile, "fine-tune a small model to replace a big-model API" became a cost strategy (see Chapter 2, 2.4), which doesn't contradict this chapter's "fine-tuning needs a strategic reason" — there the reason is cost and latency, which is explicit.

**④ A caveat**: the authors' "most people regret it" comes from consulting experience, not statistics; but it's consistent with the "heavy machinery" judgment and worth taking as a prior.

### Start with inference APIs, but don't be afraid to self-host

**[Book]** With LLM APIs, startups can integrate language-modeling capabilities without training from scratch. General-purpose APIs from providers like Anthropic and OpenAI let you "sprinkle intelligence" on a product in a few lines of code. Using these services reduces investment and lets you focus on creating value for users — validating ideas faster and iterating to PMF faster.

But just as with databases, **a managed service does not suit every use case**, especially once scale and requirements go up. **Self-hosting may be the only way to use a model while keeping confidential or private data inside your network** — which regulated industries such as healthcare and finance require, as do contracts and confidentiality requirements. Self-hosting also sidesteps the constraints that come with inference providers: **rate limits, model deprecation, usage restrictions**. You also get complete control of the model, which makes a differentiated, high-quality system easier to build around it. Finally, at large scale, self-hosting (of fine-tuned models above all) can bring costs down — BuzzFeed, for example, has shared that fine-tuning open-source LLMs cut its costs by **80%**.

**[Extension]**

**① Self-hosting and fine-tuning are two independent decisions**; the book places them next to each other, which makes them easy to confuse:

| | Use an API | Self-host |
|---|---|---|
| **No fine-tuning** | Most common: call a general-purpose model directly | Data stays in-house; avoid rate limits and deprecation; use open weights |
| **Fine-tuning** | Provider-side fine-tuning (upload data, or use their training service) | Fully self-directed: open base model + your data + your infrastructure |

"Data must stay in-house" only means you need to self-host, not that you must fine-tune; "we need a specific format" only means you might fine-tune, not that you must self-host.

**② The hidden costs of self-hosting**: GPU purchase or rental, inference engineers, capacity planning, version upgrades — these are all fixed costs, amortized only when call volume and utilization are both high enough (see Chapter 2, 2.4). The premise of "self-hosting cuts costs" is scale.

**③ Open weights are a hedge against deprecation risk**: Chapter 2 covered providers retiring models; if a model your critical business depends on gets retired, having self-hostable weights turns an "emergency migration" into a "route switch." So even if you normally use an API, **keeping a validated open-source fallback route** is sound strategic insurance.

**④ A 2024–2026 trend**: the emergence of high-quality open-weight models made "self-hosting + no fine-tuning" a viable option for data-sensitive industries, which wasn't realistic two years earlier. This strengthens the book's "don't be afraid to self-host" without weakening "start with APIs."

---

## Iterate to something great

**[Book]** To keep a competitive advantage over the long term, you need to think about things beyond the model — what will make your product stand out. Fast execution certainly matters, but it should not be the only advantage you have.

### The model isn't the product; the system around the model is

**[Book]** For teams that don't build models, fast-moving model innovation is a tailwind: they move from one SOTA to the next, chasing gains in context length, reasoning ability, and cost-performance, and make better and better products. This progress is exciting and also **entirely predictable**. Put all of this together, and **the model is very likely the least durable component in your system**.

Instead, put effort into things that provide lasting value:

| Component | Role |
|---|---|
| **Evaluation chassis** | Reliably measure how your task performs across different models |
| **Guardrails** | Prevent undesirable outputs regardless of which model you use |
| **Caching** | Reduce latency and cost by bypassing the model entirely |
| **Data flywheel** | Drive iterative improvement of all of the above |

These components form a **thicker moat around product quality** than raw model capability.

But the application layer is not free of risk either: **don't aim your scissors at the same yaks that model providers such as OpenAI have to shave in order to offer usable enterprise software.** For example, some teams put effort into building tools that check the structured output of proprietary models. It's important to make a minimal investment here, but deep investment is a poor use of time: OpenAI has to guarantee that a request for a function call returns a valid one, because all of its customers want that. Practice "**strategic procrastination**" here: build the things you absolutely need, and wait for the providers' capabilities to expand as they naturally will.

**[Extension]**

**① Why is the model "the least durable component"?** Because it iterates fastest, is the most substitutable, and isn't under your control. The more easily a component can be replaced, the less it can serve as a moat. **Moats come from things that are hard to replace: data that's hard to replicate, integrations that are hard to migrate, trust that's hard to win.**

**② Which are "the provider's yaks"? (My list, updated as things change)**

| Likely to be built in by providers | Why | What you should do |
|---|---|---|
| Structured output / function call validation | Every customer needs it | Use the native capability; don't invest deeply in your own |
| Built-in RAG / file search / web search | Platform features | Use them for prototypes and generic scenarios |
| Conversation memory, long-term memory | Platform features | Build your own only for domain-specific memory |
| Prompt caching / prefix caching | Infrastructure | Use it; don't build it |
| Generic content moderation, PII detection | Generic capabilities | Use off-the-shelf, then add domain rules |
| Generic chat interfaces, speech transcription | Commoditized | Don't differentiate here |

**③ Understanding "strategic procrastination" with Wardley maps**: Simon Wardley's maps classify components by evolution as "genesis → custom-built → product → commodity." The further right a component is (the more commoditized), the less it is worth investing in yourself. "Strategic procrastination" means **identifying components that are moving right quickly** — expensive to build yourself now, a built-in platform feature a year later. Structured output is exactly this: in 2024 you still needed libraries like Instructor and Outlines to guarantee it; a year later it became a native API capability.

**④ Verification and correction two-plus years on**: the authors' judgment was basically right — structured output, built-in RAG, memory, and connectors all became platform capabilities. But two things need adding:
- **"Caching" as a moat has thinned**: prefix caching has become provider infrastructure. "Exact-match response caching" still belongs to the application layer and has value, but it's hard to call it a moat.
- **The authors' list omits "distribution" and "workflow integration."** The market gave the answer two years later: products dismissed as "just thin wrappers" survived and grew if they had distribution channels (user habits), deep workflow integration, or domain-proprietary data; thin wrappers with nothing but a prompt and an interface were indeed weeded out. **The most durable system around a model is "the place where users work every day."** (This judgment rests mainly on the views of investment firms, not yet on research evidence.)

**⑤ Platform risk keeps moving upward**: model providers aren't just doing infrastructure; they're also moving into the application layer (memory, connectors, agent features). The boundary of "which are yaks" changes every year, so **redraw this map regularly**, not once and done.

### Start small and build trust

**[Book]** A product that wants to do everything for everyone is doomed to be mediocre. To make an attractive product, a company has to concentrate on building **memorable, sticky experiences** that bring users back again and again.

Imagine a general-purpose RAG system that "can answer any question a user asks": lacking specialization means it can't prioritize the latest information, can't parse domain-specific formats, and can't understand the nuances of a particular task. The result is a shallow, unreliable experience that doesn't meet users' needs.

The solution is to **focus on a specific domain and use case, narrowing the scope — deep, not broad**. That yields domain-specific tools that strike a chord with users. Specialization also lets you **be candid about what the system can do and where its limits lie**. Staying transparent about "what the system can and can't do" is a sign of self-awareness; it helps users see where the system creates the most value, and that in turn builds their trust and confidence in its output.

**[Extension]**

**① "Deep, not broad" and Chapter 2's "build around the jobs to be done" are two sides of the same thing**: Chapter 2 is about "solving which job, for whom"; this chapter is about "trade-offs in product scope." Both point to specialization.

**② Specialization brings measurable improvement**: narrow scope → more focused eval sets → more concrete failure modes → improvements captured by evals → users perceive progress. A general-purpose product can't do this, because "what counts as good" is itself unclear.

**③ Ways to put "transparency" into practice (my examples)**: state clearly in the product "what I can do / what I don't do"; show citations in answers; when retrieval finds nothing, say explicitly "it's not in the materials"; for low-confidence questions, show a "please verify" reminder. These all turn Chapter 1's "allow it to say it doesn't know" into product language.

**④ Specialization doesn't mean staying small forever**: first become memorable in one narrow scenario, then expand to adjacent scenarios — this is the common path. The key is to first have a point where "users can't do without you."

### Build LLMOps, but for the right reason: faster iteration

**[Book]** At root, DevOps is not reproducible workflows, not "shifting left," not empowering "two-pizza teams" — still less is it writing YAML files.

**DevOps means shortening the feedback loop between work and results, so that it is improvements that pile up, not errors.** Its roots can be traced, by way of the Lean Startup movement, to lean manufacturing and the Toyota Production System (TPS), and to the weight TPS puts on **rapid changeover** (SMED) and **Kaizen**.

MLOps carried the **form** of DevOps over to ML: reproducible experiments, all-in-one suites — and, of course, oceans of YAML. Yet as an industry, **MLOps didn't inherit DevOps's function**: the feedback gap between a model and its inference and interactions in production did not get any shorter.

The good news is that LLMOps has stopped obsessing over "prompt management" — the "hobgoblin of little minds" (the authors parodying Emerson's famous phrase) — and turned to the problems that actually block iteration: **production monitoring and continuous improvement, connected by evals.**

There are already interactive arenas with neutral, crowdsourced evals for chat and coding models — a collective "outer loop" of iterative improvement. Tools like LangSmith, Log10, LangFuse, W&B Weave, and HoneyHive promise not only to collect data on system outcomes in production but also to improve the system through deep integration with development. **Embrace these tools, or build your own.**

**[Extension]**

**① Translating DevOps's four key metrics into LLM terms** (drawing on *Accelerate*'s measures of DevOps):

| DevOps metric | LLM application equivalent | How to measure |
|---|---|---|
| **Lead time** | Time from "an idea for a change" to "knowing whether it works" | Hours/days is healthy |
| **Deployment frequency** | How often prompt/model/retrieval changes ship | Weekly beats quarterly |
| **Change failure rate** | Share of changes that cause eval regressions | You need evals to know |
| **Time to restore** | Time from noticing a production quality problem to rolling back | Depends on monitoring and shadow pipelines |

**Without evals and monitoring, none of these four can be measured** — this is exactly what the authors mean by "MLOps didn't inherit DevOps's function."

**② Inner loop and outer loop**:
- **Inner loop** (during development): change the prompt → run evals → see results, at minute scale;
- **Outer loop** (in production): production samples → discover failure modes → add them to the eval set → trigger the inner loop.

The value of LLMOps tools isn't "managing prompts" but **closing the outer loop**. Two years later, tracing and observability tools have been commoditized; **what you still need to build yourself is the piece that connects production data to evals**.

**③ What SMED and Kaizen teach**: SMED says "changeover time determines whether small-batch production is viable" — in LLM terms, the faster evals run, the more viable small-step experiments are. Kaizen is about continuous small improvements — in LLM terms, looking at data every day and adding one assertion every day (Chapter 2, 1.2). These two Toyota principles are exactly the two pillars of this chapter's "faster iteration."

**④ Designing a complete iteration loop (my example)**

```
Production logs → daily sampling + error bucketing → new failure modes
   → frozen into eval cases (inner-loop protection)
   → change prompt / retrieval / model → offline evals → shadow traffic → canary → back to production
```

Every link needs tooling, but **the "rules" at each link are your own** — echoing Chapter 2's "process before tools."

### Don't build LLM features you can buy

**[Book]** Most successful companies are not LLM companies; at the same time, most companies stand to be improved by LLMs.

These two observations often lead leaders astray: they hastily bolt LLMs onto their systems at higher cost and lower quality, and ship the result as "fake," cosmetic "AI" features — topped off with the sparkle icon everyone now fears. A better approach: **focus on LLM applications that genuinely fit the product's goals and strengthen core operations.**

Consider a few "misguided" efforts that waste team time:
- Building your own Text-to-SQL for your business;
- Building a chatbot that chats with your documents;
- Wiring your company knowledge base into a customer-service bot.

These are the "hello world" of LLM applications, but **almost no product company should build them itself**. They're common problems across many businesses, and the gap between a "promising demo" and a "reliable component" is large — which is exactly the traditional territory of software companies. Spending precious R&D resources on generic problems that "the current Y Combinator batch is collectively attacking" is a waste.

If this sounds like banal business advice, that's because amid the excitement of the current hype wave, anything "LLM" is readily mistaken for cutting-edge, value-adding differentiation, and it's easy to miss **which applications have long been old news**.

**[Extension]**

**① Verification two-plus years on: the prediction was almost entirely correct**. The three things the book lists are all features you can buy or get built in today:
- Text-to-SQL: a general-purpose model plus a database connector does it; most platforms offer it;
- "Chat with your documents": standard in notes, office suites, and knowledge-base tools;
- Knowledge base + customer-service bot: a built-in feature of customer-service platforms.

"The more generic, the sooner commoditized" — this is exactly the "yaks" of 2.1.

**② But avoid the reverse misunderstanding**: the authors aren't saying "these features are useless"; they're saying "**don't make them the focus of your own development**." You still need these capabilities — you should just buy them — and then put your energy into **embedding them in your domain workflow**.

**③ Criteria for "buy the capability, build the process" (my summary)**

| Question | If "yes" → lean buy | If "yes" → lean build |
|---|---|---|
| Do other companies need this feature too? | Yes (generic) | Only your domain needs it |
| Might the model provider build it in next year? | Yes | No (it involves your data and processes) |
| Does doing it well require domain knowledge? | No | Yes |
| Is it a source of differentiation for you? | No | Yes |

**④ A real gray area**: Text-to-SQL on **your own complex business schema** is still an engineering problem that needs polishing — but what you're polishing is "your data model and business rules," not "the Text-to-SQL capability itself." Buy the former, build the latter.

---

## AI in the loop; humans at the center

**[Book]** For now, LLM applications are fragile. They need extensive safeguards and defensive engineering, and their behavior is still hard to predict. But **when their scope is strictly limited, they can be extremely useful**. This means LLMs are **excellent tools for accelerating users' workflows**.

While it's tempting to imagine an LLM application fully replacing a workflow or a role, **the most effective paradigm today is the "human-machine centaur"** (cf. centaur chess): capable people working with LLM capabilities tuned for their quick use can see both productivity and well-being at work rise sharply. One of the flagship LLM applications, GitHub Copilot, shows the power of this kind of workflow — GitHub reports that developers say they feel more confident using Copilot and Copilot Chat because writing code becomes easier, less error-prone, more readable, more reusable, more concise, more maintainable, and more resilient.

People who've done ML for a long time might immediately think of "human-in-the-loop" (HITL), but not so fast: **the HITL machine learning paradigm is about having human experts ensure the model behaves as intended**; what is meant here is related but subtler — **today, LLM systems should not be the primary driver of most workflows; they should only be a resource.**

Putting people at the center and asking "how can LLMs support their workflow?" leads to markedly different product and design decisions. In the end, it has you building **products unlike those of competitors who rush to "outsource" all responsibility to LLMs** — better, more useful, lower-risk products.

**[Extension]**

**① Where does the "centaur" come from?** After Deep Blue beat Kasparov in 1997, Kasparov proposed "advanced chess" in 1998: humans and computers playing as teams, an augmentation model he went on to champion. In the "freestyle chess" tournaments that began in 2005, **human-machine combinations could beat machines alone**, and a strong player with one ordinary computer could beat a chess supercomputer.

**② This idea is much older than LLMs**: as early as 1960, in "Man-Computer Symbiosis," J. C. R. Licklider proposed that humans and machines should work together, each doing what it does best.

**③ Empirical evidence (2023)**:
- Customer service: a generative AI assistant raised productivity by about 14%, **helping novices the most** ([Brynjolfsson, Li & Raymond, 2023](https://arxiv.org/abs/2304.11771));
- Writing tasks: quality up, time down (Noy & Zhang, *Science*, 2023);
- **The "jagged technological frontier"**: for tasks inside the frontier, AI makes people perform better; for tasks outside it, using AI actually makes them perform worse (Dell'Acqua et al., 2023, Harvard Business School Working Paper 24-013) — this paper uses "cyborg" and "centaur" to describe two modes of human-AI collaboration.

**④ "AI should only be a resource, not the primary driver" — this needs revision two years later**:
- For **verifiable, low-risk, high-frequency** tasks (writing code and running tests, search and research, batch format conversion), agents can already be the "driver," with the human stepping back to "reviewer";
- For **unverifiable, high-risk, low-frequency** tasks (medicine, law, external communication), the human is still the driver and AI is the copilot.

The authors' **spirit** (the human is responsible for the outcome) still holds; but **the shape of the loop has changed**: the human moves from "operating every step" to "reviewing the results." The hard product-design problem becomes: **how to let a human efficiently review the work of an autonomous system** (itself a new UX problem).

**⑤ Three risks of human-AI collaboration (not emphasized in the book)**:
- **Automation bias**: people tend to accept the machine's suggestions, and review becomes a rubber stamp;
- **Skill atrophy**: long-term reliance degrades human judgment, so when the AI gets something wrong, people are no longer able to catch it;
- **False confidence**: fluent output makes people think it's correct.

Countermeasures: verifiable outputs (citations, runnable code), randomly inserting "known errors" to calibrate reviewers' attention, and keeping the ritual of a human "final sign-off."

---

## Start with prompting, evals, and data collection

**[Book]** The previous sections gave a pile of techniques and advice. Let's look at the minimal useful set: if a team wants to build an LLM product, where do they start?

Over the past year, the authors have seen enough examples to start feeling confident that successful LLM applications follow one consistent path. The core idea is to **begin with something simple and add complexity only when you need it**. A good rule of thumb: **every level you climb in complexity usually takes at least an order of magnitude more effort than the level below it**.

### Prompt engineering first

**[Book]** Do prompt engineering first. Using every technique from Chapter 1 — chain-of-thought, n-shot prompting, structured input and output — is almost always a good idea. **Prototype with the most capable model first**, and then see how much performance you can squeeze out of weaker ones.

**Consider fine-tuning only when prompt engineering can't reach the performance you want.** Fine-tuning comes up more often when non-functional requirements (data privacy, full control, cost) rule out proprietary models and so make self-hosting necessary. But **make sure the same privacy requirements don't stop you from fine-tuning on user data**.

### Build evals and start the data flywheel

**[Book]** Even teams that are just starting out need evals. Without them, you can't tell whether prompt engineering is enough, or when a fine-tuned model can take the base model's place.

Effective evals are task-specific and reflect intended usage. The first level of evals the authors recommend is **unit tests**: simple assertions that check for known or suspected failure modes and help steer early design decisions. See also the task-specific evals for classification, summarization, and so on.

Unit tests and model-based evals are useful, but **they can't replace human evaluation**. Put your model/product in front of people and collect their feedback. This does two jobs at once: it measures performance and defect rates in the real world, and it gathers high-quality labeled data for fine-tuning future models. The result is a positive feedback loop, the **data flywheel**, which compounds over time:

1. Use human evaluation to measure model performance and/or find defects;
2. Use the labeled data to fine-tune the model or update the prompt;
3. Repeat.

For example, when auditing LLM-generated summaries, you can annotate each sentence with fine-grained feedback: factual inconsistency, irrelevance, poor style. Then use the "factual inconsistency" labels to train a hallucination classifier, or the "relevance" labels to train a reward model. Another example: LinkedIn has shared that they use model-based evaluators to estimate hallucination, responsible-AI violations, coherence, and so on.

**Creating assets whose value compounds over time lifts eval-building from a pure operating cost to a strategic investment, and it builds the data flywheel along the way.**

**[Extension]**

**① "An order of magnitude more effort per level" — drawing the ladder**

| Level | What you do | Relative effort (illustrative) | When to take this step |
|---|---|---|---|
| 1 | Prompt engineering + few-shot + CoT | 1× | Always start here |
| 2 | Add RAG | ~10× | When you need knowledge the model doesn't have |
| 3 | Multi-step workflow / agents | ~100× | When a single call can't solve it, and you can design verification points |
| 4 | Fine-tuning | ~1000× | When behavior/format/cost has a real bottleneck, and data is sufficient |
| 5 | Continued pretraining / training from scratch | Higher still | See the four conditions in 1.1 |

(The multiples are illustrative and vary a lot by task; but the direction — "each step up costs an order of magnitude more" — is right.)

**② The deeper point of "prototype with the strongest model first"**: it answers two questions separately — "is the task feasible at all?" and "what's the cheapest way to do it?" First prove feasibility with the strongest model, then move down to smaller models per Chapter 2, 2.4. Doing it the other way round (agonizing over which model to use first) leads you to mistake your own engineering problems for model-capability problems.

**③ Four necessary conditions for a data flywheel (my summary)** — most "flywheels" stall at condition 3:

1. **Usage**: without enough users and call volume, there's no data;
2. **Signal**: user behavior reflects right and wrong (the UX design of Chapter 2, 3.2);
3. **A learning mechanism**: a pipeline that turns labels into evals, prompts, or fine-tunes;
4. **Measurable improvement**: you can prove the product actually got better after one turn of the flywheel.

Only when all four hold does the flywheel work; otherwise you've just "collected data."

**④ Eval assets depreciate**: an eval set reflects the data distribution and the criteria of one moment in time. When users change, tasks change, or models get stronger (old failure modes stop appearing), evals need updating (Chapter 2's "criteria drift"). So "treat evals as a strategic investment" is right, but **it's an asset that needs ongoing maintenance**, not a one-time investment.

**⑤ A two-week getting-started plan (my example)**

| Day | What to do |
|---|---|
| 1–2 | Write the first prompt with the strongest model; run 20 real inputs and look at them by hand |
| 3–4 | Turn the failure modes you see into 5–10 assertions |
| 5–7 | Build a UX prototype; have 5 real users try it and correct it; record the corrections |
| 8–9 | Build an eval set of 50–100 items (real inputs + human labels) |
| 10 | Decide whether to keep iterating on the prompt or whether you need RAG |
| 11–14 | Set up logging and the habit of looking at samples daily; queue up the next round of experiments |

---

## The broad trend of low-cost cognition

**[Book]** In 1971, researchers at Xerox PARC predicted the future — the networked personal-computer world we now live in. They helped bring that future about through inventions in Ethernet, graphics rendering, the mouse, windows, and more.

But they also did something else: **they took applications that were very useful (video displays, for example) but not yet economical (the RAM needed to drive a display cost thousands of dollars), looked at the technology's historical price trend (Moore's law), and from it predicted the point at which these technologies would become economical.**

**We can do the same for LLMs**, even without a metric as clean as "transistors per dollar." Pick a popular long-standing benchmark (like MMLU) and a consistent input format (five-shot prompting), and compare the cost over time of running models at different performance levels. The book's Figure 3-1 shows the result: **at fixed cost, capability rises quickly; at fixed capability, cost falls quickly.**

Three sets of numbers from the book:
- In the four years since OpenAI's davinci model was released as an API, the cost of running a million tokens (about a hundred copies of this book) on a model of comparable performance on that task fell from **$20 to under 10 cents** — a **halving period of just 6 months**.
- In May 2024, Meta's LLaMA 3 8B cost only **20 cents per million tokens** via API or self-hosting, with performance close to text-davinci-003 (the model that let ChatGPT stun the world); the latter cost about $20 per million tokens at release — **two orders of magnitude in 18 months**, while Moore's law over the same period only predicted a doubling. (Note: the book says "released November 2023" here; it should be **November 2022**, otherwise it doesn't match "18 months.")

One "useful but not yet economical" application: **giving video game characters generative capabilities** (the "generative agents" line of work from Park et al.), which a paper the book cites (Lyfe Agents) estimates at **$625 per hour**. Since that paper's publication in August 2023, the cost has fallen by about an order of magnitude to **$62.50 per hour**; in another nine months it could fall to **$6.25 per hour**. And when *Pac-Man* came out in 1980, $1 in today's money bought one game, which lasted from a few minutes to a few tens of minutes — at 6 games per hour, roughly **$6 per hour**. By this napkin arithmetic, **a convincing LLM-enhanced game experience should become economical around 2025**.

These trends are still new, only a few years old. But there's no reason to expect them to slow in the next few years. Even after the "low-hanging fruit" of algorithms and datasets (like exceeding the "Chinchilla ratio" — about 20 tokens per parameter) is picked, deeper innovation and investment at the data-center and silicon level will take over.

**This may be the most important strategic fact: demos and research papers that are completely infeasible today turn into premium features a few years later, and into commodities soon after that. We should build our systems and organizations accordingly.**

**[Extension]**

**① You can reproduce this method yourself — "capability-adjusted price"**:
1. Pick a benchmark relevant to your business, and set a "good enough" score threshold;
2. Find the **cheapest model that meets the threshold** at each point in time;
3. Plot price over time;
4. Use the curve to predict when the feature you care about becomes economical.

Two cautions: benchmarks saturate and get contaminated by training data, so rotate benchmarks regularly or use private evals; and the threshold should correspond to real business quality, not leaderboard scores.

**② Verification two-plus years on (conclusion: the direction is right, but there's one important new phenomenon)**:
- **Price at fixed capability**: industry tracking shows that inference prices at a given capability fell roughly 10× per year from 2021 to 2025 (a16z's "LLMflation" analysis at the end of 2024 gives the same order of magnitude), which is **even faster than the authors' 6-month halving period**.
- **Frontier flagship prices have not fallen**: top-model output prices have stayed in the tens of dollars per million tokens, with no clear downward trend.
- **Each bill hasn't fallen 10×**: because reasoning models introduced "thinking tokens," an agent's per-task token consumption is orders of magnitude higher than a single call. As a result, the prices of "**commoditized cognition**" and "**frontier cognition**" diverge: the cheap gets cheaper, and the expensive gets used more.

**What this means strategically**: the authors' "plan for tomorrow's costs" still holds, but you need to distinguish two kinds of features —

| Feature type | Cost trend | Planning advice |
|---|---|---|
| Classification, extraction, summarization, bounded Q&A | Rapidly approaching free | You can already design the high-frequency features you "didn't dare build before because of cost" |
| Multi-step agents, deep reasoning, long-context synthesis | Unit price falls, but per-task usage rises | Budget by "cost per task," not "cost per token," and design caching, routing, and early termination |

**③ Jevons paradox**: price falls → usage explodes → total spending may rise. According to figures made public at the 2026 China Computing Power Conference, average daily token calls grew more than a thousandfold in two years, and high-end model prices even rose when supply was tight (as relayed in news reports; take the magnitudes as a rough guide). So the other side of "low-cost cognition" is "high-total-volume cognition."

**④ My own napkin math**: imagine "generating a personalized deep report for 100,000 users every week," each report 5,000 output tokens — that's 500 million output tokens per week. At frontier-model output prices of $10 per million tokens, about $5,000/week; at commoditized-model prices of $0.50 per million, about $250/week. (Prices are illustrative.) The same feature was "infeasible" two years ago, is a "premium feature" today, and will be "standard" in two years — exactly the authors' three-step progression.

**⑤ "Capability overhang"**: this phrase became popular in 2022–2023 through Jack Clark's Import AI newsletter, and refers to how models' capabilities often run ahead of the products that use them — the products haven't put to use capabilities the models already have. This is the flip side of falling costs: **tomorrow, your competitors can take a capability that is "uneconomical" today and build a feature with it that you never thought of.**

---

## Enough of 0→1 demos; it's time for 1→N products

**[Book]** Building LLM demos is great fun: a few lines of code, a vector database, a carefully written prompt, and you can create magic. Over the past year, people have likened this magic to the internet, to the smartphone, even to the printing press.

But unfortunately, as anyone who has built real software knows, **a demo that runs in a controlled environment and a product that runs reliably at scale are worlds apart.**

Take self-driving cars: the first car driven by a neural network appeared in 1988. It took 25 more years before Andrej Karpathy first rode in a Waymo demo. Another decade passed before the company got a driverless permit. **From prototype to commercial product: 35 years of rigorous engineering, testing, polish, and regulatory communication.**

Over the past year — "year 1 (of N)" of LLM applications — the authors have closely watched the ups and downs in industry and academia. They hope these lessons — from rigorous operational techniques to the strategic view of "which capabilities to build in-house" — will help everyone in year 2 and beyond.

**[Extension]**

**① After the "35 years" of self-driving**: in 2024–2026, robotaxis expanded from trials in a few cities to commercial operation at larger scale. This confirms the same pattern again: **demo to product is slow, but once you cross the reliability threshold, expansion can be fast.** The lesson for LLM products: the patient stage of polishing reliability can't be skipped, but it's the precondition for later expansion.

**② Why is the gap between demo and product so large?** The previous two chapters answer this:
- A demo has no evals (Chapter 1, 4.x), so you don't know what share of inputs you're right on;
- A demo doesn't handle edge cases and failure modes (the data section of Chapter 2);
- A demo has no UX for collecting feedback and corrections (Chapter 2, 3.2);
- A demo has no migration and rollback mechanism (Chapter 2, 2.3);
- A demo has no risk tiering (Chapter 2, 3.4).

Each of these is "an order of magnitude" of effort (the ladder in 4.2).

**③ Will LLM applications be faster?** My view: for low-risk, verifiable, pure-software scenarios, much faster — there are no physical-world regulatory and safety problems; for high-risk scenarios (medicine, law, financial decisions), the 35-year timescale isn't an exaggeration, because it depends on regulation and trust, not on model capability.

---

## Where the book says too little or is debatable

Chapter 3 is the book's most prediction-heavy chapter. Which predictions were verified and which need revision is written in the [Extension] sections above; the item-by-item status check is in the [fourth post](/en/posts/llm-year-04/). Here I'll just note where this chapter says too little, or where I think it's debatable:

1. **Distribution is underestimated.** The whole chapter defines "the system" as technical components, but the "thin wrapper" companies that survived two years later mostly did so on distribution and workflow — not a technical problem, but a product and channel problem.
2. **The data flywheel is made to sound too smooth.** A flywheel needs all four links — usage → signal → learning mechanism → measurable improvement — to hold at once; most products have data but no learning mechanism, so the flywheel doesn't turn.
3. **Platform risk only covers "providers will build your features themselves," not "providers will move up into workflows."** The latter is a bigger threat to application companies.
4. **Regulation and compliance are almost absent.** For high-risk industries, whether "low-cost cognition" becomes a product depends on compliance, not price.
5. **The tension between the "humans at the center" and "1→N" sections**: to reach 1→N, many parts inevitably get automated; the human's role should shift from "operator" to "reviewer and accountable party." The book doesn't state this shift explicitly.
6. **A typo in the original**: text-davinci-003's release year should be 2022, not 2023.
7. **The cost prediction for generative game NPCs points the right way, but I haven't seen public evidence of it becoming mainstream gameplay.** Cost is only a necessary condition; product experience and latency matter just as much.

---

## The underlying ideas running through the chapter (distilled)

After reading Chapter 3, I've condensed the scattered advice into **seven principles**:

1. **Validate before you invest.** No GPUs before PMF; no fine-tuning until prompting hits a bottleneck; prove feasibility with the strongest model first, then talk about cutting costs.
2. **The model is rented capability; the system is your own asset.** Evals, guardrails, flywheels, workflows, distribution — the harder something is to replace, the more it's worth building.
3. **Don't shave the provider's yaks.** Identify components that are commoditizing fast, make minimal investments, and wait for the platform to fill in; redraw this map regularly.
4. **Small entry point, go deep, and state the boundaries clearly.** Specialization brings measurable improvement; transparency brings trust.
5. **Iteration speed is competitiveness.** The only legitimate reason for LLMOps is shortening feedback loops — the inner loop runs on evals, the outer loop on production data.
6. **Humans are the center of judgment.** Centaurs beat pure machines; but the shape of the loop is changing — from "human operates" to "human reviews," with responsibility unchanged.
7. **Plan today with tomorrow's costs.** What's infeasible today is next year's premium feature and the year after's commodity; but distinguish "commoditized cognition" from "frontier cognition."

Connections to the previous two chapters: Chapter 1 "wrap probability in determinism," Chapter 2 "wrap uncertainty in process and product," Chapter 3 "wrap uncertainty in trade-offs and the dimension of time" — **on a rapidly changing technology, the only reliable strategy is to know what will change (the model) and what won't (data, workflows, trust, iteration capability), and to bet your resources on the things that don't change.**

---

## Practical checklist

**Investment and technology choices**
- [ ] Have you validated feasibility with an API + the strongest model, rather than agonizing over model choice first?
- [ ] If considering fine-tuning: do evals prove prompting/RAG isn't enough? Is the data non-public and sufficient? Can you redo it as base models update?
- [ ] If considering self-hosting: is the reason data staying in-house, avoiding rate limits/deprecation, or cost at scale? Have you calculated utilization and fixed costs?
- [ ] Have you kept a validated open-source fallback route to hedge against model deprecation?

**Moat**
- [ ] Have you written your own "yak list" — capabilities the provider will build in next year? Do you redraw it annually?
- [ ] Are the evaluation chassis, guardrails, and flywheel accumulating? Are distribution and workflow integration still missing?
- [ ] Do you have a complete flywheel of "usage → signal → learning mechanism → measurable improvement"? Which link is it stuck at?
- [ ] Is the product scope "deep, not broad"? Have you told users transparently where the capability boundary is?

**Iteration and human-AI collaboration**
- [ ] Are you measuring lead time, deployment frequency, change failure rate, and time to restore?
- [ ] Is the outer loop closed: production samples → eval set → inner loop?
- [ ] Have you decided, by "verifiability × risk × frequency," whether the human is driver or reviewer?
- [ ] Is there a mechanism to prevent "rubber stamp" review?

**Facing the future**
- [ ] Have you drawn a "capability-adjusted price" curve? Have you scheduled features that are "uneconomical today" based on it?
- [ ] Are you budgeting by "cost per task" rather than "cost per token"?
- [ ] Does someone own each gap between demo and product (evals, boundaries, UX, migration, risk tiering)?

---

## Further reading

**Mentioned in the book**
- BloombergGPT: Wu, S., et al. 2023. "BloombergGPT: A Large Language Model for Finance." [arXiv:2303.17564](https://arxiv.org/abs/2303.17564)
- BloombergGPT vs. general-purpose models: Li, X., et al. 2023. "Are ChatGPT and GPT-4 General-Purpose Solvers for Financial Text Analytics? A Study on Several Typical Tasks." EMNLP 2023 Industry. [arXiv:2305.05862](https://arxiv.org/abs/2305.05862)
- Generative agents: Park, J. S., et al. 2023. "Generative Agents: Interactive Simulacra of Human Behavior." [arXiv:2304.03442](https://arxiv.org/abs/2304.03442)
- The $625/hour cost estimate (the paper the book links): Lyfe Agents. [arXiv:2310.02172](https://arxiv.org/abs/2310.02172)
- The Chinchilla ratio: Hoffmann, et al. 2022. "Training Compute-Optimal Large Language Models." [arXiv:2203.15556](https://arxiv.org/abs/2203.15556)
- BuzzFeed fine-tuning open-source models to cut costs (the public write-up cited in the book)
- LLMOps tools: LangSmith, Log10, Langfuse, W&B Weave, HoneyHive

**Added in these notes**
- DevOps and measurement: Kim, G., et al. *The DevOps Handbook*; Forsgren, N., Humble, J., & Kim, G. *Accelerate*
- Lean and Toyota: Ohno, T. *Toyota Production System*; Shingo, S. (SMED); Imai, M. (Kaizen)
- Component evolution mapping: Wardley, S. "Wardley Mapping" (from 2015)
- The economics of AI — LLM price trends: a16z, "LLMflation" (2024)
- Empirical evidence on human-AI collaboration: Brynjolfsson, E., Li, D., & Raymond, L. 2023. "Generative AI at Work." [arXiv:2304.11771](https://arxiv.org/abs/2304.11771)
- The jagged technological frontier: Dell'Acqua, F., et al. 2023. "Navigating the Jagged Technological Frontier." Harvard Business School Working Paper 24-013.
- The origin of human-computer symbiosis: Licklider, J. C. R. 1960. "Man-Computer Symbiosis."
- Centaurs and advanced chess: Kasparov, G. *Deep Thinking* (2017)
- Early neural-network driving: Pomerleau, D. 1989. "ALVINN: An Autonomous Land Vehicle in a Neural Network."
- Cost prediction for personal computers: Kay, A. 1972. "A Personal Computer for Children of All Ages." (Dynabook)

---

*These notes are a summary, interpretation, and extension of Chapter 3 of the book. All [Extension] sections are the note author's additions and do not represent the book's views. For cited numbers, refer to the original papers or the book.*
