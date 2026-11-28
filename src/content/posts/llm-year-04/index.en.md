---
title: "Reflection: How much of this book's experience remains in 2026 — for FDEs and developers"
description: "Looking back at What We Learned from a Year of Building with LLMs more than two years later: how many of the 20 claims from the book and my notes still hold in 2026, what they mean for FDEs and for developers, and how the authors think."
sourceHash: "d245daf992a408bc"
---

> Subject: the experience and methods of the six authors of *What We Learned from a Year of Building with LLMs* (O'Reilly, July 2024)
> Written on November 28, 2026, about two years and four months after the book came out
> Method: based on the first three notes ([Chapter 1](/en/posts/llm-year-01/), [Chapter 2](/en/posts/llm-year-02/), [Chapter 3](/en/posts/llm-year-03/)) and the original text, I checked the status of 20 claims in 2026, looked into the current state of the FDE and developer roles, and took apart the authors' argument structure
> Note: [Fact] has a traceable source; [Opinion] is commentary or debate; [My judgment] is my inference. External figures mostly come from secondhand reports, with evidence grades marked (see the appendix at the end). When citing, please refer to the original sources.

---

## Conclusions first

### How the experience has held up

I checked 20 claims one by one: most come from the book, a few are judgments I added in the first three notes, and a few are new phenomena after the book was written; the "Source" column in the tables marks which. In one sentence: **no principle has been outright falsified; two judgments in the book are basically reversed today (see below the table), and most of the rest still hold, or only need their reasoning rewritten.**

| Status | Count | Meaning |
|---|---|---|
| Still holds | 10 | Can keep using directly |
| Partially holds, needs rewriting | 8 | The principle is right, but the practice or reasoning has changed |
| Holds but a paradox has emerged | 1 | Cost: unit prices collapse, total spending rises |
| Insufficient evidence | 1 | The value of fine-tuning in the reasoning-model era |

**The two that have been substantively reversed:**

1. **"AI should only be a resource, not the primary driver of the workflow"** (Chapter 3; #18 in the table). For verifiable tasks (writing code, research), the agent is already the driver, and the human has become the reviewer. The spirit of "the human is responsible for the outcome" hasn't changed; the shape of the loop has.
2. **"n-shot examples + hand-written chain-of-thought are default techniques"** (Chapter 1; #3 and #4 in the table record my corrections to this in my notes, and those two corrections still hold). For reasoning models, these two go from "add by default" to "must be verified after adding."

**One thing the book mentioned but underestimated:** model retirement as a routine. The book said to be ready to migrate when old models are deprecated and talked about "pinning model versions," but it didn't turn "pinning has an expiration date" into a process.

### Three sentences for FDEs

1. You stand at the front line of development-prod skew. **Build an eval baseline in the first week, not a demo.**
2. What you leave behind should not be prompts, but **eval sets, a failure-mode library, and a team that can run on its own.**
3. The book's blind spots (security, compliance, customer politics) are your daily life. **What the book doesn't cover, you have to fill in yourself.**

### Three sentences for developers

1. The book's "wrap the probabilistic in the deterministic" is exactly what **compilers, types, tests, and CI mean for AI-generated code** — without a verifier, don't delegate authority.
2. **Verification has become the new bottleneck**: review shifts from reading diffs to looking at intent, risk, and tests; "it feels faster" is not the same as faster.
3. **The context window is a scarce resource**: the context you give an agent needs as much crafting as the prompt you give an LLM, and developer experience is agent experience.

### How they think, and three lessons for me

- They use **layering** to organize scattered experience, **slogans** to allocate attention, **gaps** (demo vs. product) to create urgency, **numbers** to make conclusions credible, and **analogies** to make principles memorable.
- Lesson one: **first ask which layer the problem sits in** — an isolated technical problem, an organizational dysfunction, or a directional choice? If the layer is wrong, the solution is necessarily wrong.
- Lesson two: **look at the reasoning behind a piece of advice, not the conclusion** — reasoning tied to model capability needs rechecking at every generation; reasoning tied to the world, organizations, and people stays valid for a long time.
- Lesson three: **beware of copying their weaknesses** — their evidence is induction from a sample size of one, and so are my own notes.

---

## Examining the experience one by one: the status of 20 claims in 2026

### Criteria and evidence grades

**Look at the reasoning.** Every piece of advice has a "because" behind it. If the reasoning is "the model is currently bad at something," recheck it every time the model generation changes; if the reasoning is "the world, organizations, and people are just like this," it barely needs rechecking.

**Evidence grades.** A = peer-reviewed papers or official documentation; B = vendor statements, investment bank or analyst estimates; C = industry blogs, VC opinions; D = media retellings, original source not found.

**Source.** In the tables, "Book" means a claim from the original book, "Notes" means a judgment I added in the first three notes, and "New phenomenon" means something that only appeared after the book was written.

### Still holds (10)

| # | Claim | Source | Status in 2026 | Grade |
|---|---|---|---|---|
| 1 | Long context won't replace RAG | Book | The longer the input, the more unpredictable the performance (Chroma's tests on 18 models); the NoLiMa benchmark shows most models degrade sharply with long context | A |
| 3 | The value of n-shot examples is declining | Notes | For reasoning models, more few-shot examples actually mean lower accuracy (2025 research; the mechanisms are semantic misdirection and strategy-transfer failure) | A |
| 4 | Hand-written chain-of-thought can be harmful | Notes | On tasks like implicit statistical learning, chain-of-thought significantly degrades reasoning-model performance (Liu et al., 2024); mixed results on other tasks | A |
| 5 | Structured output is a native capability | Notes | Mainstream APIs already compile schemas into the decoding process; but they only guarantee syntax, not semantics | A |
| 6 | LLM judges are biased | Book | Position, verbosity, and self-preference biases have been repeatedly confirmed; they can be mitigated but not eliminated; persuasive wording and format changes also inflate scores | A |
| 8 | Caching changes the cost structure | Book + notes | Cached reads cost about 5%–10% of the original price; official guidance requires putting stable instructions before changing content | A |
| 9 | Model retirement as a routine | New phenomenon | Every vendor deprecates old models on a schedule; OpenAI's deprecation page states that generally available (GA) models get at least 6 months' notice, while preview models may get only two weeks. For statistics circulating online, such as a "median lifespan of about 403 days," I found no original source | A |
| 14 | No GPUs before product-market fit (PMF) | Book | Still the default consensus; training from scratch exists almost only in model labs | C |
| 16 | "AI engineer" is differentiating, FDE is rising | Notes | Job titles are differentiating; FDE openings have surged (Fortune, September 2026, citing Lightcast data: from January to August this year, related openings grew more than 1000% year over year; the multiple varies a lot across data sources) | B |
| 20 | Context engineering is popular | New phenomenon | Went viral in mid-2025 via Shopify's CEO and Karpathy, defined as an extension of prompt engineering, and continues to extend toward "scaffold/loop engineering" | C |

### Needs rewriting (8)

| # | Claim | Source | What needs rewriting | What it means for me |
|---|---|---|---|---|
| 2 | Prefer deterministic workflows for high-risk tasks | Book | The arithmetic hasn't changed, but **the reasoning has**: from "models are unreliable" to "verifiability determines autonomy." Tasks with verifiers can let agents act autonomously; the mainstream form is "workflow skeleton + bounded agent" | Autonomy is tied to the irreversibility of risk |
| 7 | Hallucination is a stubborn problem | Book | Still stubborn, but the focus shifts from "fabrication" to **calibration, abstention, and sycophancy**: OpenAI attributes hallucination to evals that reward guessing; an Oxford study reports that training models to sound warm and empathetic makes them less accurate | Evals should add "does it abstain when it should" |
| 10 | Small models + routing by step | Book + notes | The conclusion is stronger, but a reversal has appeared: **collapsing unit prices and caching have shrunk the cost-saving room for routing**; rising agent usage keeps "assign by task difficulty" valuable | Build the eval gate before talking about routing |
| 12 | The data flywheel is a moat | Book | Three conditions must hold at once: the signal is valid, the loop is closed, and feedback is fast enough; otherwise it's just log files | Without a learning mechanism on site, there is no flywheel |
| 13 | The moat of a thin wrapper | Book | The center of gravity shifts from "proprietary data" to **workflow ownership and distribution**; wrappers without enough differentiation get absorbed by platforms | The value is where users work every day |
| 17 | Evals become an organizational capability | Book | Now a core practice, but a split has appeared: **Hamel and Shreya don't favor writing evals right away** (eval-driven development), arguing for error analysis first; error analysis shouldn't be outsourced, and one domain expert should make the call | On day one, look at samples and do error analysis; don't rush to build automated evals |
| 18 | Human-in-the-loop | Book | The direction holds: from "in the loop" to "on the loop," review shifts from reading diffs line by line to intent and risk, and "AI reviewing AI" has appeared; but **the human has not exited** | The human moves from operator to reviewer and accountable party |
| 19 | Regulatory requirements | Notes | The requirements exist (general-purpose model obligations apply from August 2025, transparency obligations from August 2026), but **high-risk obligations have been postponed** (the EU Digital Omnibus took effect in July 2026; Annex III high-risk obligations postponed to December 2027) | Near-term constraints come mainly from transparency provisions |

### Holds but a paradox has emerged (1)

| # | Claim | Source | The paradox in 2026 | What it means for me |
|---|---|---|---|---|
| 15 | The cost of fixed capability falls fast | Book | Unit prices for the same capability drop by roughly an order of magnitude per year (a16z; Epoch measures drops of 9x to 900x per year, depending on the benchmark); but **total spending is rising**: enterprise spending on model APIs grew from $3.5 billion in November 2024 to $8.4 billion in mid-2025 (Menlo Ventures). It looks like Jevons paradox, but these data only show two things happening at once | Budget by "cost per task," not "cost per token" |

### Insufficient evidence (1)

| # | Claim | Source | Current state | What it means for me |
|---|---|---|---|---|
| 11 | RAG handles knowledge, fine-tuning handles behavior | Book + notes | The industry still says this, but the value of fine-tuning in the reasoning-model era lacks systematic research; vendor attitudes are diverging: OpenAI has restricted self-serve fine-tuning since May 2026 and will stop accepting new jobs on December 15, while Google is still opening up tuning for new Gemini models | Keep "don't fine-tune until proven necessary," but treat "fine-tune a small model to replace a large one" as a legitimate cost-cutting move (no longer viable on OpenAI; use open-source models or other platforms) |

### Not in the book, but now necessary

- The cost and latency of reasoning tokens (the invisible output)
- Tool-calling reliability (one of the biggest failure sources for agents)
- Context engineering (what to put in the window, and how much)
- A model retirement calendar and migration as a routine
- Security and compliance (prompt injection, data boundaries, human oversight)
- The design of "AI reviewing AI"
- Who owns evals (domain experts or an eval team)

---

## As an FDE: worth noting and worth reflecting on

### How the FDE role's structure overlaps with this book

The forward-deployed engineer (FDE) role originated at Palantir (internally called "Delta") and spread to OpenAI, Anthropic, Cursor, and others in 2024–2026 [Fact, per media and job postings]. In 2026 several big companies placed heavy bets: Amazon announced a $1 billion FDE team, Anthropic put up $100 million to train Frontier Deployed Engineers for its customers, and OpenAI set up a deployment company with reported external investment of over $4 billion [Fact]. The job descriptions at OpenAI, Anthropic, and Cursor are consistent: **write production code inside customer systems, build evals, deliver, and bring field problems back to the product**. The difference from solutions engineers (pre-sales, carrying sales quotas, making demos) is that FDEs are post-sales, usually don't carry sales quotas, and deliver production systems.

Chapter 2 (Operations) and Chapter 3 (Strategy) of this book are almost a job description for FDEs:

| Section in the book | The corresponding FDE work |
|---|---|
| Chapter 2, 1.1 Development-prod skew | The customer's site is "production" |
| Chapter 2, 1.2 Look at samples every day | Look at real inputs and outputs in the customer's system |
| Chapter 2, 2.3 Pinning model versions | Manage model versions in the customer's environment |
| Chapter 2, 3.2 Human-in-the-loop UX | Let the customer's domain experts correct the model |
| Chapter 2, 4.1 Process before tools | Deliver a process, not a tool |
| Chapter 3, 2.1 The system is the asset | Leave behind evals, data, integrations |
| Chapter 3, 2.1 Strategic procrastination | Don't do for the product team what it will eventually do itself |

### Eight points worth noting

**① The demo trap is amplified on the customer's site.** The customer's executives are present, you're using the customer's best data, and you're sitting right there to step in at any moment — every row of the book's "demo vs. product" table is amplified. The first item on one list of FDE anti-patterns is the demo propped up by hidden manual steps [Opinion]. Cursor's FDE posting says plainly that the job is not about demos. **So what you should do in the first week is build an eval baseline**: pull 50 examples from the customer's historical data, write down the correct answers by hand, and record the current failure types. Without this step, everything after it has no anchor.

**② Determinism first is a delivery discipline, not a technical preference.** The book says the success rate of multi-step tasks drops exponentially with the number of steps; by the arithmetic in my Chapter 1 notes, with a 95% success rate per step, 10 steps leave only 60%. The most valuable ability an FDE has on site is judging "how many of these 10 steps can become code." The "plan → approve → execute" shape is almost mandatory for high-risk operations (sending email, changing data, triggering business processes).

**③ Model retirement is your responsibility.** The book talks about "pinning model versions" but not "pinning has an expiration date." Every vendor deprecates old models on a schedule, GA versions usually with only a few months' notice, and the person upgrading models in the customer's environment is you. Pinned versions, shadow traffic, a deprecation calendar, and a second-vendor fallback route — these four are the operational basics an FDE hands to the customer.

**④ The eval set is the biggest asset you leave behind, and the condition for extracting yourself.** Without an eval set, an FDE cannot leave: change the model and you don't know if there's a regression; change the process and you don't know if it got better; the customer can't do without you, and you can't do without the customer. Conversely, a rerunnable eval set plus a failure-mode library is an asset no vendor can provide.

**⑤ Field knowledge must flow back, or the flywheel won't turn.** The data flywheel needs three conditions to hold at once: the signal is valid, the loop is closed, and feedback is fast enough. The FDE's biggest failure mode is knowledge staying in one person's head — the customer's special handling, the domain's judgment criteria, the pitfalls already stepped in. This needs an organizationally authorized feedback channel: regular field-to-product reviews that classify custom forks as "belongs in the product / wait for the platform / customer-specific."

**⑥ Not every customer needs an FDE.** Cursor's FDE lead gave a 2×2 matrix (customer maturity × product customizability): when the customer is mature and the product's customizability is low, don't send an FDE [Opinion]. The FDE version of "strategic procrastination" is: **don't do for the product team what it will eventually do itself.**

**⑦ The book's blind spots are your daily life.** Security, compliance, data boundaries, the customer's internal politics — the book barely covers them, but FDEs face them every day. The authors' make-up (consultants, researchers, team leads, educators) includes no one from security, legal, or design, which determines their blind spots and also means an FDE reading this book needs to fill in those areas separately.

**⑧ A vendor's FDE and an application company's FDE have conflicts of interest.** Critics call vendor FDEs human shock absorbers, or outsourcing under a new name; the defense software company Legion has a document saying outright that the FDE model becomes a crutch for immature products [Opinion]. In my Chapter 2 notes I called the model "a dependency with a retirement date," which on the customer's site means: **you have an obligation to tell the customer which things will break along with it when the model is swapped.**

### Worth reflecting on (what I should ask myself as an FDE)

1. Am I propping up a demo with hidden manual steps?
2. Do my metrics drive decisions? Metrics without decisions are decoration.
3. Am I fine-tuning too early? The book says "fine-tuning is heavy machinery," and FDEs on site are more easily pushed down this path by customers.
4. Have I mistaken one customer's fork for product strategy?
5. What do I leave behind: a pile of prompts, or eval sets, a failure-mode library, and a team that can run on its own?
6. Have I told the customer which things will fail along with the model when it is retired?

---

## As a developer: worth noting and worth reflecting on

"Developer" here means an engineer who writes code day to day, with some attention to developer experience as well.

### Development itself has changed

- DORA 2025 report: nine in ten developers use AI, with a median of about two hours a day; AI improves throughput **and is at the same time associated with rising delivery instability** [Fact].
- METR's randomized controlled experiment: senior developers using AI were actually 19% slower, yet believed they were 20% faster [Fact].
- Stanford's "Canaries" research: employment for software developers aged 22–25 declined markedly, while employment for older developers actually grew; the authors call this a descriptive indicator, not a causal estimate. The August 2026 revision says that among the occupations most affected by AI, young people's employment is 19% below where it would have been had it kept pace with growth in other occupations [Fact].
- Is the agent an "amplifier" or a "replacement": Yegge and Karpathy each have their own take, and it isn't a direct debate [Opinion]; Karpathy proposes that humans control agents through an "autonomy slider" [Opinion].
- Drawing the line on "vibe coding": Willison draws the line at review: code you have reviewed and understood is not vibe coding, and code you can't explain doesn't go into the repository [Opinion].

### How the book's principles map to AI-assisted development

| The book's principles (mostly Chapter 1) | Their counterpart in AI-assisted development |
|---|---|
| Assertion-based unit tests | The tests that exist before you let an agent change code |
| LLM judges | Integration tests, end-to-end tests |
| A/B testing | Production canary releases |
| The intern test | Treat the agent as an intern: clear goals, complete materials, check the output |
| One prompt does one thing | Small tasks, small PRs |
| Wrap the probabilistic in the deterministic | Compilers, type systems, tests, CI are the verifiers for generated code |
| No evals, no iteration | No tests, no letting the agent change code |
| Look at the data, not the metrics | Look at the diff, not the "feeling" |
| Craft the context | The context you give an agent needs crafting too: relevant files, constraints, boundaries |

### Six points worth noting

**① Verification has become the new bottleneck.** DORA's interviews show that the time saved on writing code has shifted to auditing and verification [Fact]. PRs get bigger, and review time goes up. When designing workflows, **verification cost** has to be counted in.

**② Match autonomy to test strength.** The development version of the book's "determinism first": compilers and tests are the verifiers, and the stronger the verifier, the more autonomy you can grant. Karpathy's "autonomy slider" says the same thing.

**③ The context window is a scarce resource.** Context engineering applies to an agent too: which files, which constraints, which history you give it directly determine the quality of the output.

**④ Tool-calling reliability is the new primary failure source.** Agents picking the wrong tool or filling in the wrong parameters when writing code is now one of the most common failure modes, and it needs dedicated tests.

**⑤ Developer experience is agent experience.** Documentation, architecture decision records, fast tests, reproducible environments serve humans and agents at the same time [Opinion].

**⑥ "AI reviewing AI" has appeared, but the human has not exited.** Review shifts from reading diffs line by line to looking at intent, risk, and tests; the human remains the accountable party.

### Worth reflecting on

1. Am I vibe coding? Has code I can't explain entered the repository?
2. Has my testing kept up with the speed of generation? For code without test coverage, do I dare delegate changes to an agent?
3. Am I underestimating verification time because "it feels faster"?
4. Does the spec I write let an agent work like an intern, or does it need me standing by to fill gaps every time?

---

## How the authors think: taking it apart and what I take from it

### The organizing logic: three layers, added after the fact

The book is divided into three layers: Tactics, Operations, and Strategy. Chapter 2 opens with a quote attributed to multiple leaders: "Amateurs talk strategy and tactics; professionals talk operations." It then contrasts several perspectives: the tactical view sees "a pile of unique problems," the operational view sees "a fixable organizational dysfunction," and the strategic view sees "an opportunity."

Worth noting: this structure was added **after the fact**. The acknowledgments say the article began in a group chat, and Bryan reorganized it into three parts. In other words, the experience came first, and the framework came later — the framework exists to make the experience teachable.

### Six recurring argumentative moves

| Move | How they use it | Examples |
|---|---|---|
| **Sloganeering** | Headings are mostly "negation + condition" or "X is not Y" | "No GPUs Before PMF"; "The Model Isn't the Product; the System Around It Is" |
| **Reverse advice** | "Don't..." imperatives; four section headings start with Don't | "Don't Fine-Tune Until You've Proven It's Necessary" |
| **Analogy** | Map an unfamiliar problem onto familiar experience | The intern test, centaurs, 35 years of self-driving, Michelangelo carving context, memory and disk, Postel's law, Toyota's rapid die change |
| **Argument by numbers** | Concrete numbers make conclusions credible | 19% → 44%, n ≥ 5, 68% → 94%, 80% vs. 30%, 5%–10%, $3.5 vs. $25, 10%, $20 → 10¢ |
| **Argument by gap** | The chasm between two things creates urgency | Demo vs. product; needle in a haystack vs. real long documents; benchmarks vs. product evals |
| **First-person induction** | "We learned," "we observed," sometimes anonymous sources, sometimes self-deprecation before making a point | "(Some of us were initially huge skeptics.)"; "We know of a team that…" |

### Seven underlying mental models (their worldview)

1. **The model is a probabilistic component that needs a deterministic shell.** "produce deterministic plans which are then executed in a structured, reproducible way"
2. **Cost falls over time, so what is infeasible today becomes feasible tomorrow.** "a completely infeasible floor demo … today will become a premium feature in a few years and then a commodity"
3. **The system outlasts the model.** "models are likely to be the least durable component in the system"
4. **Attention is a scarce resource.** Several hours a week looking at data; "where to allocate scarce resources"
5. **The feedback cycle is fundamental.** "shortening the feedback cycles between work and its outcomes so that improvements accumulate instead of errors"
6. **Add complexity only as needed.** "start simple and only add complexity as needed"; "fine-tuning is heavy machinery"
7. **The human is the center.** The model "should merely be a resource"

### Weaknesses in their arguments

| Weakness | How it shows up |
|---|---|
| Small and anonymous samples | "A dozen or so companies" yields "consistently observed"; an anonymous team "completed a three-year roadmap in a year" |
| Failures are not named | "Most people regret this decision" with no cases; success stories all have names (BuzzFeed, Replit) |
| Perspective bias | When criticizing "out-of-the-box evals," the positive example is a co-author's own paper (EvalGen) |
| Experience written as conclusions | n ≥ 5, the three assertions, "an order of magnitude of effort per level" have no sources; the cost curve rests on only four years of data, yet they assert "there is no reason to expect this process to slow down" |
| Self-contradiction | They say these insights "haven't been discussed more widely," but the evidence comes almost entirely from public blogs; material they themselves label "anecdotal data" is still used as evidence |

### What I take from it

**The meta-rule: four moves for reading experience-based writing.**

1. Look at its **reasoning** (tied to the model, or tied to the world).
2. Find its **sample** (how many companies, who, any failure cases).
3. Look for **counterexamples** (under what conditions this doesn't hold).
4. Ask **who wrote it** (the authors' make-up determines the blind spots).

**Ten transferable thinking moves** (from the original, in my own words):

1. First ask which layer the problem sits in: an isolated problem, an organizational dysfunction, or an opportunity.
2. Before adding a level of complexity, confirm that an order of magnitude of effort is worth it.
3. Give a task the intern test: missing knowledge means adding context; too slow means breaking the task up.
4. Wrap probabilistic steps in a deterministic plan, so failures can be located to a specific step.
5. When you see a new problem, write it down as an assertion immediately.
6. Lower the cost of human judgment: replace scoring with binary and pairwise comparisons.
7. When learning a paradigm, ask what its function is; don't just copy the form.
8. Only invest in assets that will remain after model iterations.
9. For things that aren't economical today, extrapolate along the price curve to find when they become feasible.
10. For things the provider will eventually do, practice strategic procrastination.

**Reflection on my own writing.** The book's weaknesses are in my notes too: in the "changes since the book" I wrote in the [Extension] paragraphs of my notes, and in the check tables of this post, much of what I cite is industry estimates and media reports, not controlled studies; my "practical checklist" is also induction from experience. This reflection marks evidence grades as much as possible, but it still inherits this limitation. **Read what I write the same way you'd read the book.**

---

## Action checklist

### Five questions when reading any "experience"

- What is its reasoning? Tied to the model or tied to the world?
- How big is the sample? Any failure cases?
- Who wrote it? Where are their blind spots?
- Under what conditions does this not hold?
- Can I verify it with 20 samples?

### Ten questions for an FDE before starting

- Have I built an eval baseline first, rather than a demo?
- What is the customer's success metric? Who has the authority to define "correct"?
- Which steps must be code? Which can the model do?
- Is there an approval point for high-risk operations?
- Is the model version pinned? Have I checked the retirement calendar? Is there a fallback?
- How will field findings flow back to the product? Who classifies them?
- Who owns security, compliance, and data boundaries?
- Am I using hidden manual steps?
- Can the customer's domain experts correct the model in the interface?
- What do I leave behind?

### Ten questions before letting an agent change code

- Is test coverage enough? Do I dare delegate code without tests?
- What is the verifier (compiler, types, tests, CI)?
- Does autonomy match risk?
- Is the context I give enough and accurate? Is there anything extraneous?
- Is the task broken down small enough?
- Will I review the diff, or just take its word when it says "done"?
- Are tool calls (running tests, reading files) reliable?
- Can I accept the cost and latency of reasoning tokens?
- Has any code I "can't explain" entered the repository?
- Can I roll back when something goes wrong?

---

## Appendix: evidence grades and sources

### Grades

| Grade | Meaning |
|---|---|
| A | Peer-reviewed papers, official documentation |
| B | Vendor statements, investment bank or analyst estimates |
| C | Industry blogs, VC opinions |
| D | Media retellings, original source not found |

### Main sources (by topic)

**Long context and retrieval (A)**
- [Chroma Research, *Context Rot*](https://www.trychroma.com/research/context-rot)
- [NoLiMa benchmark](https://arxiv.org/abs/2502.05167)

**Prompting techniques and reasoning models (A)**
- [The effect of few-shot examples on reasoning models](https://arxiv.org/abs/2509.23196)
- [Liu et al., *Mind Your Step (by Step)*](https://arxiv.org/abs/2410.21333)

**Structured output and caching (A)**
- [Anthropic strict tool use documentation](https://platform.claude.com/docs/zh-CN/agents-and-tools/tool-use/strict-tool-use)
- [OpenAI prompt caching documentation](https://developers.openai.com/api/docs/guides/prompt-caching)

**LLM judges (A)**
- [Survey of judge biases (repost)](https://developer.aliyun.com/article/1786820)
- [The effect of rhetorical rewriting on AI review scores](https://arxiv.org/abs/2608.08975)
- [Hwang et al., *Can You Trick the Grader?* (persuasive wording and LLM judges, 2025)](https://arxiv.org/abs/2508.07805)
- [Yang et al., *Turning Bias into Bugs* (format changes and LLM judges, 2026)](https://arxiv.org/abs/2605.26156)

**Hallucination (B)**
- [OpenAI, *Why Language Models Hallucinate*](https://openai.com/index/why-language-models-hallucinate/)
- [Oxford study on "friendly AI chatbots make more mistakes"](https://www.oii.ox.ac.uk/friendly-ai-chatbots-make-more-mistakes-and-tell-people-what-they-want-to-hear-study-finds/)

**Model retirement, routing, cost (A–C)**
- [OpenAI deprecation page (models and self-serve fine-tuning)](https://developers.openai.com/api/docs/deprecations)
- [RouteLLM](https://arxiv.org/abs/2406.18665)
- [Conditions for routing in practice (C)](https://oometa.ai/insights/llm-model-routing-inference-2026)
- [a16z, *LLMflation* (2024)](https://a16z.com/llmflation-llm-inference-cost/)
- [Epoch AI: LLM inference price trends (2025)](https://epoch.ai/data-insights/llm-inference-price-trends)
- [Menlo Ventures: mid-2025 LLM market report](https://menlovc.com/perspective/2025-mid-year-llm-market-update/)

**Fine-tuning and the flywheel (C)**
- [RAG vs. fine-tuning comparison (blog)](https://app-lab.ai/blog/rag-vs-finetuning-2026)
- [The flywheel's three conditions (blog)](https://tianpan.co/zh/blog/2026/05/05/data-flywheel-assumption-ai-features-noise)

**Moats (C)**
- [Aperture, *AI Wrapper Thesis 2026* (VC view)](https://theaperture.vc/reports/ai-wrapper-thesis-2026/)

**Evals (C, with disagreement)**
- [Hamel Husain and Shreya Shankar's evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- [Eval-driven development vs. TDD](https://wpnews.pro/news/eval-driven-development-what-it-is-how-it-differs-from-tdd-and-a-loop-that-works)

**FDE and roles (B–D)**
- [The FDE talent war (media)](https://www.inside.com.tw/article/41983-fde-ai-forward-deployed-engineers-ai-talent-war)
- [Cursor's FDE posting](https://cursor.com/ko/careers/forward-deployed-engineer-india)
- [FDE vs. solutions engineer](https://brandengineering.ai/blog/forward-deployed-engineer-vs-solutions-engineer)
- [FDE field guide (anti-patterns)](https://github.com/Bosheng2020/fde-field-guide/blob/main/docs/zh-CN/09-challenges-antipatterns.md)
- [Legion, *The Forward Deployed Engineering Model Is Backward*](https://cdn.prod.website-files.com/680a8bc2d69bace9040bd4d9/6a5935d8e42aef4e74695ce2_The%20Forward%20Deployed%20Engineering%20Model%20Is%20Backward.pdf)
- [FDE practice at Cursor (with the 2×2 matrix, repost)](https://www.jxxy.net/ai/articles/forward-deployed-engineering-at-cursor)
- [Amazon: the $1 billion FDE team (2026)](https://www.aboutamazon.com/news/aws/aws-1-billion-forward-deployed-ai-engineers)
- [Anthropic: Claude Frontier Academy (2026)](https://anthropic.com/news/claude-frontier-academy)
- [TNW: OpenAI sets up a deployment company (2026)](https://thenextweb.com/news/openai-deployment-company-4bn-tpg-tomoro)
- [Fortune: FDE openings growing fast (September 2026, citing Lightcast data)](https://www.fortune.com/2026/09/03/forward-deployed-engineers-fast-growing-six-figure-silicon-valley-job-integrate-ai-with-customers-tech-careers-palantir/)

**Developers (A–C)**
- [DORA 2025 report (Google blog introduction)](https://blog.google/technology/developers/dora-report-2025/)
- [DORA interviews (AI use and verification)](https://dora.dev/insights/balancing-ai-tensions/)
- [Stanford Canaries paper (August 2026 revision)](https://digitaleconomy.stanford.edu/app/uploads/2026/08/Canaries_August2026.pdf)
- [Stanford Canaries dashboard](https://digitaleconomy.stanford.edu/project/indicators/canaries-dashboard/)
- [Karpathy, *Software Is Changing (Again)* (slides and video compiled by Latent Space)](https://www.latent.space/p/s3)
- [Yegge, *Revenge of the Junior Developer*](https://sourcegraph.com/blog/revenge-of-the-junior-developer)
- [Anthropic 2026 Agentic Coding report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf)
- [Human-on-the-loop code review (blog)](https://wangjunjian.com/posts/2026-11-14-agentic-code-review-human-on-the-loop.html)
- [The METR experiment and vibe coding (blog retelling)](https://tianpan.co/zh/blog/2026/04/13/vibe-coding-considered-harmful)
- [Developer experience and AI (blog)](https://business.nopex.cloud/blog/developer-experience-ai-era)

**Regulation and terminology (A–C)**
- [EU AI Act implementation timeline](https://artificialintelligenceact.eu/implementation-timeline/)
- [Regulation (EU) 2026/1744 (Digital Omnibus on AI, Official Journal)](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng)
- [What the Digital Omnibus changes (guide)](https://www.osabee.com/wake/guides/digital-omnibus-ai-act-what-changes)
- ["Context engineering" entry](https://earlyterms.com/zh/term/context-engineering)

---

*This note is a personal reflection and does not represent the views of the book's authors. For external figures cited, please refer to the original sources.*
