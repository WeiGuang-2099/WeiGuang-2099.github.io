---
title: "Chapter 2 Reading Notes: Operations — Developing and Managing LLM Applications and the Teams That Build Them"
description: "Notes on Chapter 2 of What We Learned from a Year of Building with LLMs: how to keep an LLM application running across four areas (data, models, product, and team), and what needs revising more than two years later."
sourceHash: "b7a02ff50663cbdb"
---

> Book: *What We Learned from a Year of Building with LLMs* (O'Reilly, July 2024)
> Scope of these notes: Chapter 2 (Data → Models → Product → Team and Roles)
> Note: **[Book]** marks my summary of the book's points; **[Extension]** marks background, examples, or changes since the book that I've added. Numbers from the book have their sources noted; industry experience cited in the extensions (not from papers) is labeled "anecdotal" where possible — verify it yourself.

---

Chapter 1 is about "how to tune a prompt well"; Chapter 3 is about "whether a company should do this at all, and how to avoid being left behind." Chapter 2 sits in between, about the **operational problems of actually shipping**: how to keep a system from rotting after launch, how to organize the team, how to design the product.

The authors open with a quote attributed to "many leaders," to the effect that **amateurs talk strategy and tactics; professionals talk operations**. This sets the chapter's perspective: the tactical layer sees a pile of "unique" technical problems, while the operational layer sees **fixable organizational dysfunction** — problems recur not because the technology is hard, but because the process is missing.

The chapter unfolds across four problem domains:

| Domain | Question to answer | Core answer (one sentence) |
|---|---|---|
| **Data** | How often, and how, should we review LLM inputs and outputs? How do we measure and reduce development-prod skew? | Look at samples every day; split skew into structural and content-based and monitor both |
| **Models** | How do we integrate models into the stack? How do we do versioning and migration? | Structured output; prompts are not portable; pin model versions + shadow pipeline; pick the smallest model that works |
| **Product** | When does design get involved? How do we design human-in-the-loop UX? How do we prioritize and calibrate risk? | Bring design in early; build feedback into the UX; "minimum lovable product"; set standards by use case |
| **People** | Whom to hire, and when? How do we build a culture of experimentation? Which matters more, process or tools? | Process before tools; keep experimenting; empower everyone; "AI engineers are not everything" |

A hidden thread runs through all four parts: **an LLM application is a system continuously coupled to the outside world** — users change (data drift), vendors change (model updates), the product's form changes (UX), and the team changes (evolving roles). Traditional software operations assume "the system is stable after deployment"; LLM applications are the opposite. Nearly every piece of advice in this chapter can be read as a response to that instability.

---

## Data

**[Book]** Just as the ingredients decide how a dish tastes, the quality of the input data sets a limit on how well a machine learning system performs; and the output data is all you have for judging whether the product works. **All of the authors watch the data closely, spending several hours every week looking at inputs and outputs**, to understand how the data is distributed: its modes, edge cases, and the limits of what the model understands about it.

### Check for development-prod skew

**[Book]** In traditional machine learning pipelines, one common source of errors is "train-serve skew": the data a model is trained on differs from the data it meets online. An LLM can be used without any training, so there is no training set, yet a similar problem still exists — **development-prod data skew**: the data you test the system with during development ought to match what the system will face once it is live; if it doesn't, accuracy in production takes a hit.

The authors split LLM development-prod skew into two kinds:

| Type | Meaning | Example |
|---|---|---|
| **Structural skew** | Inconsistency in format | A JSON dict whose value is a list vs. a JSON list directly; inconsistent casing; typos, incomplete sentences |
| **Content-based skew** (or "semantic" skew) | The data's meaning or context differs | Users start discussing different topics, entering territory the model hasn't seen |

Structural skew makes performance unpredictable: each LLM was trained on data in certain formats, and **a prompt can be extremely sensitive to tiny changes**.

How to monitor:
- **Simple metrics**: input/output length, whether specific format requirements (JSON, XML) are met — track changes directly.
- **Advanced drift detection**: cluster embeddings of inputs/outputs to find semantic drift — for example, a shift in the topics users discuss.
- **Keep the holdout set "fresh"**: when you test a change (prompt engineering, say), the holdout dataset should reflect recent real interactions. For instance, if online inputs often contain typos, the holdout set should contain them too.
- **Look at quality, not just numbers**: periodically review outputs by hand — the so-called "vibe check" — to confirm results match expectations and still fit user needs.
- **Fold non-determinism into the check**: run the pipeline multiple times on each input in the test set and analyze all outputs; this makes it easier to catch intermittent anomalies.

**[Extension]**

**① Why does the old concept of "train-serve skew" still apply to LLMs?**
An LLM application's "training set" is really: the few-shot examples in the prompt, the developer's mental model of "how users will ask," and the eval set. All three "define the world" on the model's behalf. Once online data deviates from that definition, the model's performance collapses in ways you didn't expect. In traditional ML this has long been engineering common sense (Google's internal Rules of ML has a dedicated entry; the ML Test Score paper lists train-serve skew as a must-test item). The book simply carries it over to the LLM setting.

**② Why is structural skew so damaging? — There is quantitative evidence for prompt format sensitivity**
Sclar et al. (2023) found that **merely changing the layout of the examples, the field names, or the delimiters in a prompt** can cause large swings in the same model's performance on the same task, with high variance ([Sclar et al., 2023](https://arxiv.org/abs/2310.11324)). In other words, the LLM's sensitivity to "format" is not an illusion. So changing `{"tags": ["a","b"]}` to `["a","b"]` online, swapping full-width quotes for half-width, or adding a trailing blank line — any of these can change the output.

The engineering countermeasure: **normalize and validate at the boundary**. Everything that enters a prompt passes through a layer of schema validation and normalization first (Pydantic / JSON Schema), rather than "shove in whatever you get."

**③ Common metrics for drift detection (my addition)**

| Purpose | Method | Notes |
|---|---|---|
| Numeric distribution drift (length, language ratio, format compliance rate) | PSI (Population Stability Index), KS test, Jensen–Shannon divergence | Simple; can set alert thresholds |
| Semantic drift | Input embeddings → clustering (e.g. HDBSCAN) → watch for new clusters / shifts in cluster proportions; or compare MMD against a baseline distribution | Can reveal "users have started asking new things" |
| New intents / new topics | Topic modeling or automatic LLM tagging on the last N days of inputs, compared against a baseline | Cheaper than LLM-as-Judge; better suited to high-frequency monitoring |
| Intermittent anomalies | Repeated sampling of the same input (self-consistency) | Inconsistent results across runs are themselves a signal of "instability" |

**④ More on "non-determinism"**: even with temperature set to 0, most services do not guarantee determinism — the reasons include GPU kernels tied to batch size, MoE routing, and floating-point accumulation order (the industry began discussing "batch-invariant" kernels in 2025, but they are far from widespread). The implication: **evals must be run multiple times and report mean/variance**; reproducing in development a problem that only "occasionally breaks" online depends on rerunning many times.

**⑤ Skew that is easy to miss in RAG and agent scenarios**

- RAG: during development you use a "clean test corpus," but the online index contains garbled text, scanned documents, stale documents, duplicate documents — **the retrieved chunk is itself part of the input**, and drift in its quality becomes drift in the model's input directly.
- Agents: the format of a tool's return value changes (API upgrade, website redesign) — this is one of the most common sources of online incidents for agent applications.

**Another example**: when "contract extraction" was tested during development, the PDFs were all clean text exported from Word. After launch, what customers upload is OCR output from scanned documents, with headers and footers mixed into the body text and amounts spelled out in formal Chinese numerals, as in "人民币壹拾万元整" (one hundred thousand yuan, exactly). The model's output isn't structurally wrong — it extracts the wrong fields. This kind of problem is completely invisible in the development set — it's not that "the model isn't strong enough"; the input distribution changed.

### Look at samples of LLM inputs and outputs every day

**[Book]** LLMs are dynamic and keep evolving. Their zero-shot abilities are remarkable and their output is often a pleasure to read, yet their failure modes are very hard to predict. For custom tasks, looking at samples regularly is a necessary step toward an "intuition for LLM behavior."

**Production input-output pairs are the genchi genbutsu of an LLM application — irreplaceable.** Recent research shows that the more data developers see, the more their idea of "what counts as a good or bad output" changes (this is **criteria drift**). Developers can work out some evaluation criteria ahead of time, but criteria defined in advance tend to be incomplete. During development, for example, we edit the prompt to make good replies more likely and bad ones less likely; this loop of "evaluate, re-evaluate, update the criteria" is necessary, because unless you look at the outputs themselves, neither the LLM's behavior nor people's preferences are easy to predict.

How to manage it:
- **Log inputs and outputs**;
- **Sample and review them every day**, quickly spotting new patterns or failure modes;
- When a new problem appears, **write an assertion or eval for it right away**; any update to the definition of failure modes should also be reflected in the eval criteria;
- **A "vibe check" is a signal of bad output; code and assertions turn it into something concrete**;
- This attitude has to be **socialized** — for instance, by making "reviewing/annotating inputs and outputs" part of the on-call rotation.

**[Extension]**

**① What is genchi genbutsu?** It is one of the "three reals" (real place, real thing, real situation) from the Toyota Production System: managers must go to the spot and look at the actual thing themselves, not just read reports. The authors borrow it to express an attitude: **metrics are secondhand; samples are firsthand.** Metrics tell you "it got 3 points worse"; only samples tell you "why."

**② Where criteria drift comes from**: the book links this to Shankar et al.'s 2024 EvalGen paper ([Shankar et al., 2024](https://arxiv.org/abs/2404.12272)). They found that users need criteria before they can score outputs, yet it is precisely the act of scoring that clarifies the criteria, so the criteria keep changing throughout the evaluation process — they call this "criteria drift." This is not the evaluator's fault — **criteria only become clear through contact with the data.** The implication for LLM applications: don't expect to "write the perfect eval criteria in one shot"; treat the iteration of criteria as the norm.

**③ The right way to "look at data" (my suggested process)**

1. **Sample, don't just look at alerts**: randomly draw 20–50 examples, plus specifically draw the "suspicious" ones (guardrail triggered, user downvote, retry, overly long output). Looking only at alerts misses "silent errors" — the answer is wrong but the user didn't complain.
2. **Look with questions in mind**: is this output wrong? What kind of error is it (retrieval error / comprehension error / format error / inappropriate refusal)? Which step of the pipeline went wrong?
3. **Bucket the errors**: group by failure type and count each bucket. **Fix the biggest bucket first** — this is the core of error analysis, far more effective than "read a hundred examples and tweak the prompt by feel."
4. **Turn each bucket into an assertion**: look at data → find a pattern → freeze it into a test → regression protection. This is the closed loop of Chapter 1, section 4.1, put into practice.
5. **Rotate who looks**: different people find different failure modes; newcomers especially notice problems that "old hands have gotten used to."

**④ What to log**: request ID, the complete final prompt (after assembly), model name and version, sampling parameters, output, tool-call trace, retrieved chunks and their scores, latency and token counts, guardrail results, user feedback. Pay attention to **redaction and retention periods** — logs contain user data, and retention policy must be consistent with compliance.

**⑤ The deeper meaning of "add it to the on-call rotation"**: it means "looking at data" is not an algorithm engineer's side job, but **part of operational duty**, as important as watching the monitoring dashboard. Whoever is on call looks at that day's samples. Otherwise "look at data every day" stays at the bottom of the to-do list forever.

---

## Working with models

**[Book]** LLM APIs let us lean on the "intelligence" of a few vendors. That is a good thing, but depending on them also means trade-offs in performance, latency, throughput, and cost. And over the past year a better new model has come out almost every month, so we have to be ready to update the product and move to new models when old ones are deprecated. This section shares what we learned using technology "we can't fully control and can't self-host."

### Generate structured output to ease downstream integration

**[Book]** In most real-world settings, downstream applications consume an LLM's output in some machine-readable format:
- **Rechat** (a real-estate CRM): the frontend needs structured replies to render widgets;
- **Boba** (a tool that comes up with ideas for product strategy): needs structured output with a title, summary, confidence score, and time horizon;
- **LinkedIn**: constrains the LLM to output YAML, which is used to pick the skill to call and to supply its parameters.

This pattern is **Postel's law** taken to the extreme: be lenient about what comes in (any natural language) and conservative about what goes out (typed objects that machines can read). The authors therefore believe it will be very durable.

The de facto standards at the time: Instructor for API calls, Outlines for self-hosted models.

**[Extension]**

**① Postel's law**: from the TCP specification Jon Postel wrote in 1980 (RFC 761), where it originally meant that TCP implementations should be robust: tolerant of what they receive, strict about what they send. The authors' application to LLMs is apt: **natural language in, type safety out.** This is the interface contract between an LLM application and traditional software.

**② Why will this pattern "be very durable"?** Because it wraps the LLM's unreliability **inside a testable boundary**: downstream code doesn't need to understand natural language, only to handle an object; and the object can be validated, rejected, retried. More than two years later, structured output is a native capability of every major API — which proves the pattern's durability.

**③ Structured output guarantees format, not semantics.** This is the most common misunderstanding. Passing schema validation only means "all fields present, types correct"; it doesn't guarantee the content is right: the amount may be fabricated, the date may be out of a plausible range, an enum value may be legal but wrong. So do **layered validation**:

```python
# Layer 1: schema validation (format) — guaranteed by structured output / Pydantic
# Layer 2: business-rule validation (semantics) — write it yourself
def validate(inv: Invoice, source_text: str):
    assert inv.total_cents >= 0
    assert inv.currency in {"CNY", "USD"}           # enum
    assert 2020 <= inv.issued.year <= 2030           # plausible range
    assert inv.invoice_number in source_text          # must come from the source text
    assert abs(sum(i.amount_cents for i in inv.line_items) - inv.total_cents) < 1  # internal consistency
```

The failure rate of layer 2 is itself an important quality metric.

**④ Schema design advice**: add descriptions to fields; use enums to restrict values; distinguish required from nullable clearly (this ties to Chapter 1's "LLMs output even when they shouldn't" — nullable fields must allow null); don't nest too deeply; split large tasks into several small schemas. When validation fails, **passing the error message back to the model for a retry** often works, but set a retry limit.

**⑤ Tool calling / function calling is a special case of structured output**: LinkedIn's "YAML decides which skill to call" is, in today's terms, function calling. After 2024 the major APIs unified this interface, and it is the infrastructure on which the agent wave is built.

### Migrating prompts across models is a chore

**[Book]** Sometimes a carefully polished prompt performs excellently on one model and collapses on another. This happens both when switching vendors and when upgrading versions of the same model.

- **Voiceflow** found that after moving from gpt-3.5-turbo-0301 to gpt-3.5-turbo-1106, their intent classification task dropped by **10%** (fortunately they had evals).
- **GoDaddy** observed a positive trend: after upgrading to 1106, the gap between gpt-3.5-turbo and gpt-4 narrowed. (A pessimist could also say gpt-4's lead was eroded.)

So if a migration is necessary, **expect to invest far more than "swapping the API endpoint"**; don't assume the same prompt will bring similar or better results. Reliable automated evals let you compare how well the task is done before and after the switch, and reduce how much has to be checked by hand.

**[Extension]**

**① Why aren't prompts portable?** Three reasons:
- **Different tokenizers** — the same sentence is a different token sequence in different models' eyes;
- **Different format distributions in training data** — Claude saw lots of XML during training, GPT saw more Markdown, and this determines "which style the model is better at";
- **Different instruction-tuning styles** — the boundary of "obeying instructions," the handling of negations, the default answer length: every model has its own personality.

**② Upgrades are not always progress**: Chen, Zaharia, and Zou studied ChatGPT's behavior changes over several months in 2023 and found that performance on some tasks **worsened** over time, quietly, while the model name stayed the same ([Chen et al., 2023](https://arxiv.org/abs/2307.09009)). Voiceflow's 10% is the engineering version of the same phenomenon. **Conclusion: "a newer version is better" is a hypothesis to be falsified with evals, not a premise.**

**③ Migration engineering discipline (my addition, synthesizing industry practice)**
1. **The model ID lives in exactly one place in the config**, not scattered through the code;
2. Read the vendor's migration guide first: removed parameters, changed defaults, tokenization and pricing changes;
3. **Run old and new side by side** on a "golden set" built from online samples, comparing success rate, format compliance, refusal rate, cost, latency — **read the examples that got worse, one by one**;
4. **Delete the workarounds from the old-model era first**, then add instructions for the new model (otherwise it's patch piled on patch);
5. Roll out gradually, keep one-click rollback;
6. **Fine-tuned models have their own problem**: when the base model is retired, the fine-tuning results are scrapped with it, and must be redone on the new base.

**④ The trade-off of abstraction layers**: using a unified gateway/abstraction library (various LLM gateways) to pull the model ID out of the code can turn "code migration" into "config change." But be clear-eyed: **an abstraction layer solves call portability, not prompt portability.** Over-abstraction also hides vendor-specific features (caching, tool-calling details). My advice: abstract "routing and observability," not "prompts and evals."

### Version and pin your models

**[Book]** In any ML pipeline, "changing anything changes everything." This is all the more true when we rely on LLMs we didn't train ourselves — they may **change without our knowing**.

Fortunately, many vendors let you "pin" a specific version (such as gpt-4-turbo-1106), so that you use a particular set of model weights that is guaranteed not to change. Pinning model versions in production avoids sudden changes in behavior when a model is swapped out — output that suddenly turns verbose, for instance, or other failure modes no one anticipated — changes that often show up first as customer complaints.

Also consider keeping a **shadow pipeline**: the same configuration as production, but on the newest model version. That gives you a safe place to try out and test new versions; once you have confirmed that the new model's output is stable and good, you can switch production to the new version with confidence.

**[Extension]**

**① "Changing anything changes everything"** (CACE) comes from Sculley et al.'s paper on ML technical debt: the book links the 2015 *Hidden Technical Debt in Machine Learning Systems*, and the phrase first appeared in their 2014 paper. It describes the fundamental difference between ML systems and traditional software: in traditional software, changing A affects only A; in an ML system, changing data, thresholds, or dependencies can change everything globally. LLM applications amplify this trait — **you don't even have the right to know that a "change" happened.**

**② Two limits of pinning model versions (the book doesn't go into them)**
- **Pinning is not forever**: vendors retire old versions after some months, and you will have to migrate eventually. So pinning buys "time," not "finality" — migration capability must become routine.
- **Floating aliases are a hazard**: `latest`, `preview`, and model names without dates can change without you deploying anything. **Production uses only IDs with explicit version numbers**; aliases are for development environments only.

**③ The "shadow pipeline" is now a mature practice**, usually in three steps:
1. **Offline regression**: run the new version on the golden set, compare against the old version's baseline;
2. **Shadow traffic**: copy online requests to the new model, but **don't return its responses to users** (careful: don't cause side effects — for agents, shadow only the read-only parts, or point tools at a sandbox);
3. **Gradual rollout**: 5% → 25% → 100%, observing a fixed window at each step, with a single switch for rollback if something goes wrong.

**④ Assign an owner to "retirement"**: subscribe to the vendor's deprecation announcements, maintain a table of "model inventory + retirement dates," and designate who is responsible. In one sentence: **a retirement date without an owner will be "discovered" in the form of an incident.**

**⑤ Treat a model change as a deployment**: it needs an approver, eval results, and a rollback plan — just like shipping code, not "ops casually tweaking a parameter."

### Choose the smallest model that gets the job done

**[Book]** When you build a new application, the most powerful model is a tempting choice. But once you have confirmed that the task can be done technically, it's worth trying a smaller model to see whether it gets close to the same results.

Small models bring lower latency and lower cost. They are weaker, but chain-of-thought, n-shot prompting, and in-context learning can make them "punch above their weight," and fine-tuning on the task helps too. Put together, **a well-designed workflow built on a small model can often equal or even beat the quality a single large model gets in one generation, and do it faster and more cheaply.** The authors cite an anecdotal figure: Haiku with 10-shot beats zero-shot Opus and GPT-4. In the long run, they expect "small model + process engineering" to show up more and more as the best balance of quality, latency, and cost.

Classification is another example: **DistilBERT** (67 million parameters) is a surprisingly strong baseline, and **the 400-million-parameter DistilBART** is a good option too — fine-tuned on open-source data, it reached a ROC-AUC of **0.84** at detecting hallucinations, better than most LLMs, while its latency and cost are under **5%** of theirs.

The takeaway: don't ignore small models. Throwing a big model at every problem is easy, but bring a little creativity and some experiments, and a more efficient answer often turns up.

**[Extension] Looking back more than two years later, this section's direction has been validated, but the room for savings has been squeezed by falling unit prices and caching: small models and routing are still necessary, but they are no longer the biggest cost lever.**

**① Where small models are strong and weak (by task shape, not by industry)**

| Task shape | Examples | Recommended tier | Why |
|---|---|---|---|
| Classification / routing / intent detection | Ticket classification, moderation, sentiment | Small model (encoder or 7B-class); with few labeled examples, consider few-shot methods such as SetFit | Small decision space, high concurrency, cost-sensitive |
| Structured extraction | Invoices, resumes, forms | Small-to-medium model + strict schema (fine-tuning possible) | Format guarantee matters more than reasoning |
| Bounded summarization / format conversion | Meeting notes, single-document summarization | Small-to-medium model | The heavy lifting is in retrieval and preprocessing, not generation |
| Multi-step planning, open-ended reasoning, broad world knowledge | Research, complex code, fuzzy judgment | Frontier model | Early errors amplify in later steps |

**② From "picking one model" to "routing per step"**: the common industry practice now is **tiered routing** — many simple, high-frequency steps in a pipeline go to a small model, and only genuinely hard steps escalate to a frontier model; the escalation condition can be a rule (task type), a confidence score, or an output failing validation. This is fully aligned with this section's "small model + process engineering" conclusion, just taken to step granularity.

| Routing approach | Cost (relative to all-frontier) | Engineering effort | Risk |
|---|---|---|---|
| All frontier | 100% | None | None (but expensive, slow) |
| Rule-based routing | roughly 35%–50% | Low (days) | Very low if rules are conservative |
| Rules + confidence escalation | roughly 20%–35% | Medium (weeks) | Needs quality monitoring |

(The cost ratios in the table come from anecdotal numbers in industry blogs, not controlled experiments; treat the magnitudes as indicative only.)

**③ Two prerequisites, both necessary**
- **Evals before model swaps**: without a task-specific eval set, "the small model is worse" is just a feeling. Anecdotally: teams are not infrequently wrong about which model is better on their own task, and the errors go in both directions.
- **Optimize after the task stabilizes**: while still exploring how the task should be done, use a frontier model; once the task definition is clear, move down to a small model. Otherwise you're debugging the routing and the task at the same time.

**④ Why do "encoder small models" still hold up on classification?** DistilBERT ([Sanh et al., 2019](https://arxiv.org/abs/1910.01108)) makes BERT 40% smaller while retaining about 97% of its performance; DistilBART ([Shleifer & Rush, 2020](https://arxiv.org/abs/2010.13002)) compresses BART in a similar way. DistilBERT is a **bidirectional encoder**; DistilBART is an encoder-decoder, but its encoder is bidirectional too. Models like these are naturally efficient at "understanding" tasks (classification, NLI); generative LLMs pay a huge inference cost for generality, which is wasted on a single classification task. The book's 0.84 hallucination detection is essentially NLI (judging "can the source text entail the summary"), exactly the home turf of such models.

**⑤ The cost threshold for self-hosting**: small models are cheaper than APIs only when traffic is large enough — GPUs are a fixed cost, and at low utilization you save nothing. Anecdotally, self-hosting pays off at hundreds of thousands to millions of requests per month, plus latency sensitivity or a requirement that data stay in-house; otherwise calling a small API tier is more economical.

**⑥ A 2026 addendum**: open-source small models (7B–30B class) have improved dramatically in two years, and with inference framework optimizations, "a Llama/Qwen-class 7B model + good retrieval" has closed much of the gap with frontier models on RAG question answering — because the heavy lifting in such tasks is retrieval. But this **does not mean frontier models are unimportant**: open-ended reasoning, multi-step planning, and judgments where errors are costly remain their territory.

**⑦ Chinese-language scenarios**: choosing a Chinese small model requires looking at how well it was trained on Chinese corpora, tokenization efficiency (Chinese token efficiency differences affect cost), and tool-calling ability; evaluate on your own business data, not general leaderboards.

---

## Product

**[Book]** New technology opens up new possibilities, but the principles behind a good product don't change. Even if the problem is new, there's no need to reinvent the wheel in product design. Only by building LLM applications on solid product basics can you truly deliver value to users.

### Involve design early and often

**[Book]** A designer forces you to think hard about how the product is built and how users will see it. Designers are sometimes pigeonholed as "the people who make things look nice," but beyond the interface, they also **rethink what would make the user experience better, even when that means breaking the rules and paradigms already in place**.

Designers are particularly good at **recasting users' needs into different forms** — some of those forms are easier to solve, so they leave more or less room for AI. As with many products, an AI product should be organized around the **job to be done** rather than the technology that drives it.

Ask yourself: what job do users want this product to take on for them? Is it a job for a chatbot? For autocomplete? Maybe for something else! Think about the design patterns that already exist and how each relates to the "job to be done" — this is a valuable asset that designers bring to a team.

**[Extension]**

**① "Jobs to Be Done"** comes from the thinking of Christensen et al. (the "milkshake experiment" is the classic case): users "hire" a product to accomplish a job, and the product succeeds based on how well it does the job, not on what technology it uses. Applied to LLMs: **users don't want to "chat with an AI"; they want to "get this thing done."** A chat interface is just one of many possible "forms," and often not the best one.

**② Different forms for the same job (my example)**: the user's job = "send this Chinese email to a client in polished English."

| Form | User cost | AI fit | Notes |
|---|---|---|---|
| Chatbot: paste the email and type "help me translate to English" | High (typing instructions, waiting for the whole thing) | Inefficient | Fastest demo, worst experience |
| Select text → one-click rewrite → replace in place | Low | High | Puts the output directly into the user's flow |
| Real-time suggestions while composing (autocomplete) | Lowest | Medium | Fragment generation, Tab to accept |
| Pre-send tone check with suggested edits | Low | High | "Suggest-confirm" pattern |

All four forms use the same model, but the product value differs enormously — **the difference is in design, not the model.** The designer's value is turning the first form into the third.

**③ Ready-made AI design guidelines**: Microsoft's HAX (Guidelines for Human-AI Interaction, Amershi et al., 2019) proposes 18 guidelines, such as "make clear what the system can do," "support efficient correction and dismissal," "scope services when in doubt," and "show contextually relevant information"; Google's PAIR guidebook has similar content. They can be used directly to review LLM product prototypes.

**④ Examples of breaking paradigms**: GitHub Copilot is not "chat" but inline completion in the IDE; Cursor and others later combined "conversation" with "Tab to accept"; Midjourney uses "pick one of four + variations" rather than "refine through text description." These are all cases where design preceded the technical form.

### Design UX for human-in-the-loop (HITL)

**[Book]** One route to high-quality labels is to build human-in-the-loop **into the user experience**: make it easy for users to give feedback and corrections, which both improves the output in front of them and collects valuable data.

Picture an e-commerce platform on which users upload products and assign them to categories. The UX could be designed in several ways:
1. The user picks the category by hand; from time to time an LLM goes over new products and fixes wrong categories in the backend;
2. The user doesn't pick a category at all; the LLM assigns categories in the backend from time to time (and may get some wrong);
3. The LLM **suggests a category in real time**, and the user checks it and changes it if needed.

All three use an LLM, yet the UX is completely different. The first puts the burden on the user up front, with the LLM only checking afterwards; the second asks no effort of the user but leaves them without transparency or control; **the third gets the balance right**: the LLM suggests first, which lightens the user's cognitive load — they don't need to learn our category scheme — while the user can still review and change the suggestion, **keeping the final decision on how the product is categorized**. As a bonus, the third option naturally closes a feedback loop for improving the model: good suggestions are accepted (positive samples), and bad ones are corrected (a negative sample plus the positive one that immediately follows).

This "suggest → user verifies → collect data" pattern appears in:
- **Coding assistants**: accept the suggestion (strong positive), accept with edits (positive), ignore (negative);
- **Midjourney**: upscale and download (strong positive), make variations (positive), regenerate a set (negative);
- **Chatbots**: thumbs up (positive), thumbs down (negative), regenerate (strong negative).

Feedback comes in two kinds, **explicit** and **implicit**: explicit feedback is what users give when the product asks for it; implicit feedback is learned from how users interact, without their having to provide it on purpose. The coding assistant and Midjourney examples are implicit feedback; thumbs up and thumbs down are explicit. **With a well-designed UX, you can collect a great deal of implicit feedback.**

**[Extension]**

**① The core insight of this section: UX is not just an interface; it is a data collection channel.** Product design connects to Chapter 1's "evaluation" and this chapter's "data" in one line: good UX → high-quality labels → better evals and fine-tuning → better models → better UX. This is the so-called **data flywheel**, and its starting point is "make it effortless for users to correct."

**② Implicit feedback is not clean — watch out for three biases**

| Bias | Manifestation | Mitigation |
|---|---|---|
| **Verifiability bias** | Users only accept suggestions they can understand; ones they can't (e.g. complex code) are neither accepted nor rejected | Don't treat "ignored" uniformly as negative; combine with dwell time and whether it was later reverted |
| **Selection bias** | Users only downvote/upvote the especially bad or especially good; the middle is silent | Don't estimate overall accuracy from upvote rates; they only reflect the tails of the distribution |
| **Habitual acceptance** | On approval screens, users "click confirm all the way through"; feedback becomes a rubber stamp | Only request confirmation when the model is uncertain or the stakes are high; monitor whether the acceptance rate is abnormally high |

**③ Layering signal strength**: map feedback to labels of different strengths, e.g. "accepted as-is = +1, accepted with edits = +0.5, rejected/regenerated = −1, ignored = unknown (excluded)." This way weak signals remain usable without being mistaken for strong ones.

**④ Three timing modes for HITL**

| Mode | Description | Suited for | Cost |
|---|---|---|---|
| **Approve before use** | Output is shown to a human first; takes effect only after confirmation | High-risk, irreversible actions (sending email, placing orders, writing to a database) | Human cost on every instance |
| **Correct after use** | Takes effect first; user can edit or undo | Medium-to-low risk, reversible | Depends on users noticing problems |
| **Sampled review** | Most cases pass automatically; a sample gets human review | Low risk, high frequency | Problems are found with a lag |

The basis for choosing is "**cost of error × frequency**": high cost + low frequency → approve before use; low cost + high frequency → automatic + sampling; in between → correct after use + easy undo.

**⑤ New forms since the book**: this pattern has extended from "suggest a category" to agents — an agent first produces a **plan** or a **code diff**, and a human reviews and approves before execution (modern coding agents' "review the diff," agents' "plan confirmation"). The essence is unchanged: **look before you leap, with the final decision in human hands.**

**⑥ A privacy reminder**: implicit feedback logs record user behavior, which is user data, subject to retention and compliance constraints; and don't feed "user acceptance" directly into training data — clean and spot-check it first, otherwise the model will learn "users putting up with it."

### Prioritize ruthlessly

**[Book]** When pushing a demo to production, consider these requirements:
- **Reliability**: 99.9% uptime, adherence to structured output;
- **Harmlessness**: no offensive, NSFW, or otherwise harmful content;
- **Factual consistency**: faithful to the provided context, no fabrication;
- **Usefulness**: relevant to the user's needs and requests;
- **Scalability**: latency SLAs, supported throughput;
- **Cost**: budgets are not infinite;
- **And more**: security, privacy, fairness, GDPR, DMA, etc.

Try to meet every requirement at once and you'll never ship. So prioritize, **ruthlessly**. That means being clear about what is non-negotiable (reliability and harmlessness, for example) — without these, the product can't work or isn't viable. The key is to find the "**minimum lovable product**." Version one won't be perfect, and you have to live with that: **ship first, then iterate**.

**[Extension]**

**① Splitting requirements into "gates" and "budgets" makes prioritization easier**:

| Category | Meaning | Examples | How to manage |
|---|---|---|---|
| **Gate** | Below the bar, no launch; not "traded" over time | Harmlessness, compliance, data stays in-house | Binary judgment; all must pass before launch |
| **Budget** | Has a quantitative target; can be traded off, can go into debt | Availability, latency, cost, factual consistency | Set SLOs and an "error budget"; fix when exceeded |
| **Nice-to-have** | Affects experience but not essential | Polishing usefulness, tone and style | Queue into later iterations |

The book says "reliability and harmlessness are non-negotiable" — those are gates; latency and cost are typical budgets; usefulness is usually a nice-to-have, though for some products (like search) it becomes a gate.

**② The risk matrix — deciding what should be a gate**

| | Error reversible | Error irreversible |
|---|---|---|
| **High error cost** | Correct after use + easy undo (e.g. draft generation) | Approve before use + high gate (e.g. money transfer, medical advice) |
| **Low error cost** | Automatic + sampled review (e.g. classification, tagging) | Automatic + monitoring (e.g. one-off recommendations) |

Requirements in the top-right cell will almost always be proposed as gates; those in the bottom-left are mostly nice-to-haves. **The same technology has completely different "minimum standards" in different quadrants.**

**③ "Minimum lovable product" vs. "minimum viable product"**: the former requires, beyond "it runs," that users **want to use it** — otherwise there is no feedback loop, and the "iterate" in "ship first, then iterate" has nothing to iterate on. For LLM products, "lovable" often means: fast responses (streaming output), correctable when wrong (HITL), and not annoying when saying "I don't know."

**④ The boundary of "ship first, then iterate"**: this is entirely correct for internal tools and low-risk scenarios; in regulated, high-risk scenarios, gates must be passed before launch, and "iteration" can only happen at the nice-to-have level. The authors make exactly this point in the next subsection.

### Calibrate risk tolerance to the use case

**[Book]** When you decide which model to use and how strictly to review its output, take the use case and the audience into account. A customer-facing chatbot that gives medical or financial advice needs very high standards of safety and accuracy: wrong or bad output does real harm and wears away trust. For applications where less is at stake, though — a recommendation system, say, or internal uses such as content classification and summarization — **requirements that are too strict just slow things down and add little value**.

This matches an a16z report: many companies are building **internal** LLM applications faster than **external** ones. Running internal productivity experiments with AI lets an organization begin to get value from it, and learn to handle the risks, where things are easier to control; as its confidence grows, it can move on to customer-facing uses.

**[Extension]**

**① A gradual ladder (my summary)**

| Level | Form | Who backstops errors | Typical gates |
|---|---|---|---|
| 1 | Internal tool, personal use | The user themselves | Harmlessness, data stays in-house |
| 2 | Internal tool, one step in a multi-person process | The person at the next step | + reliability, format compliance, traceability |
| 3 | Customer-facing, human-in-the-loop | An employee reviews before it reaches the customer | + factual consistency, audit logs |
| 4 | Customer-facing, automatic execution | The system | + high-standard security and compliance, rollback, monitoring and alerting |

Each level up adds gates, expands the eval set, and tightens launch approval. **Accumulate eval sets and operational experience at lower levels first, then move up.**

**② Since the book, this part has gone from "advice" to "regulation"**: the EU AI Act took effect in 2024, tiering risk — unacceptable, high, limited, minimal — and requirements for high-risk systems include risk management, data governance, technical documentation, logging, **human oversight**, and accuracy/robustness. This means that in some use cases, "human-in-the-loop" and "traceability" are no longer product choices but legal obligations (the Digital Omnibus, effective July 2026, postponed the applicability date of the Annex III high-risk obligations to December 2, 2027). In China there are also the Interim Measures for the Management of Generative AI Services (in force 2023) and rules on labeling AI-generated and synthetic content (in force September 2025). For compliance decisions, always refer to the latest text of the regulations.

**③ "Internal first" still holds, with two new twists**:
- Internal tools also touch sensitive data — **"internal" does not mean "risk-free"**; data classification and permission isolation remain gates;
- Since 2025, agents can "act" (call tools, modify data), so an internal agent's risk level is far higher than an internal chatbot's; "level 2" needs to be subdivided by "can it perform actions."

**④ Hard gates on the data side**: whether data may be sent to a third-party API, whether it is used for vendor training (zero-retention agreements), data residency, redaction — in many organizations these determine "can we use a frontier model at all," which in turn shapes model selection (see 2.4). **Answer whether the data can leave first, then compare models.**

---

## Team and roles

**[Book]** Defining any role's responsibilities is hard, and writing a job description for this new field is harder than most. The authors don't draw a Venn diagram of job titles or offer a job description template, but they do accept that a new role exists — the **AI engineer** — and talk about who else is on the team and how the responsibilities are split.

### Focus on process, not tools

**[Book]** Faced with a new paradigm, software engineers tend to reach for tools. We then lose sight of the problems and processes the tools were supposed to address, and take on **accidental complexity** that hurts the team's productivity in the long run.

For example, an article discusses tools that write prompts for LLMs automatically, and points out (rightly, the authors think) that engineers who use such tools before they understand how the problem should be solved, and by what process, end up carrying technical debt they didn't need.

Tools are also often **underspecified**. LLM evaluation tools are turning into an industry that offers "out-of-the-box LLM evals": general-purpose evaluators for toxicity, conciseness, tone and so on. Many teams, in the authors' experience, adopt these tools **and never ask critically which failure modes are specific to their own domain**. **EvalGen** is the contrast: it has users take part closely in every step — setting the criteria, labeling the data, reviewing the evals — and in this way teaches them **a process for building domain-specific evals**:

1. Define domain-specific tests (generated automatically from the prompt as a first draft), written as code assertions or LLM-as-Judge;
2. Align the tests with human judgment, which lets users check whether the tests reflect the criteria they set;
3. Revise the tests as the system (the prompts and so on) changes.

What EvalGen gives developers is a **mental model** of how evals get built, without tying them to any particular tool. The authors find that once AI engineers have this background, they often go for simpler tools, or write their own.

An LLM system has too many parts to list them all here. What matters is that AI engineers understand the process first and adopt tools second.

**[Extension]**

**① "Accidental complexity" vs. "essential complexity"**: this is the distinction Fred Brooks drew in his 1986 essay "No Silver Bullet" — essential complexity is inherent to the problem; accidental complexity is introduced by the tools and methods we choose. The essential complexity of LLM applications lies in: defining "good output" (evals), managing data distributions, and designing human-in-the-loop. Tools can't solve these; they can only accelerate what you've already thought through. **Using tools before thinking things through just automates the confusion.**

**② Why "out-of-the-box evals" are a trap**: generic evaluators ("is it toxic," "is it concise") measure the dimensions common to all tasks — and the least important ones. What really determines your product's quality is **domain-specific failure modes** — "wrong drug name or dosage extracted," "wrong unit on an amount," "turned 'not applicable' into a concrete date." These can only come from looking at data and from domain experts. **Evals are the encoding of domain knowledge; they can't be bought.**

**③ When to use tools (my judgment)**

| Type | Examples | Advice |
|---|---|---|
| Commodity infrastructure | LLM gateways, tracing, logging, experiment tracking, labeling platforms | Buy/use off-the-shelf |
| General capabilities | Generic guardrails (PII, toxicity), embedding models | Use off-the-shelf, but verify on your own data |
| **Encoding of domain knowledge** | **Eval sets and scoring criteria, error taxonomies, prompts** | **Build yourself; don't outsource to "out-of-the-box"** |

**④ The same applies to agent frameworks**: from 2024 to 2026 agent frameworks proliferated and iterated extremely fast. First understand "what process your agent needs" (state, tools, validation points, where humans intervene), then pick a framework; otherwise the framework's abstractions become a straitjacket. One industry observation: **mature teams often use a very thin framework, because the process lives in their heads.**

### Always be experimenting

**[Book]** Experimentation runs all through ML products — not only the A/B-test and randomized-controlled-trial kind, but also frequent changes to **components of the system that are as small as possible**, evaluated offline. **People are this keen on evals not really for credibility and confidence, but because evals make experiments possible!** Better evals mean faster rounds of experiments, and faster rounds mean you reach the best version of the system sooner.

Experimentation is now cheap, so attacking one problem in several different ways is common: collecting data and training models used to be expensive, and that cost has been pushed to a minimum, while prompt engineering costs almost nothing but people's time. **Have everyone on the team learn the basics of prompt engineering** and encourage all of them to experiment; the organization then gets a wide variety of ideas from within.

And experiments aren't only for **exploring**; use them to **exploit**, too! Already have a version of a new task that works? Have someone else on the team do it a different way. Try a faster alternative. Study techniques like chain-of-thought and few-shot to improve quality. **Don't let tools drag down experimentation; if they do, rebuild them or buy a better one.**

Finally, when planning a product or project, **reserve time for building evals and for repeated experiments**. Write the product spec as you would for any engineered product, but add clear eval criteria. When drawing up the roadmap, don't underestimate how long experiments take: expect several rounds of development and evaluation before you get the "green light" to go to production.

**[Extension]**

**① "Evals are for experimentation" is a sharp perspective.** It turns evals from a defensive "quality assurance" activity into an offensive "iteration speed" activity. It can be expressed as a chain of inequalities:

> Better evals → faster experiments → more attempts → faster convergence on a good system

So **iteration cycle time** (the time from an idea to a "works / doesn't work" conclusion) is one of the most important health metrics for an LLM team. Measure it, then shorten it.

**② Exploration and exploitation**: these terms come from multi-armed bandits / reinforcement learning. Exploration = trying different approaches (different pipelines, models, ways of splitting the task); exploitation = continuously improving an already-workable approach (adding examples, adding CoT, switching to a cheaper model). Healthy teams do both; the common mistake is **exploiting without exploring** — polishing a 70-point solution endlessly without trying an alternative that might score 90. The book's "have someone else do it a different way" is institutionalized exploration.

**③ Offline experiments vs. online A/B**

| | Offline evals | Online A/B |
|---|---|---|
| Speed | Fast (minutes to hours) | Slow (days to weeks) |
| Noise | Low, repeatable | High; needs traffic and statistical power |
| Question answered | "Did output quality change?" | "Did user behavior / business metrics change?" |
| Blind spot | Eval set bias; not equal to user satisfaction | Tells you A/B differ, not why |

Practice order: offline screening to drop the clearly bad → small-traffic A/B → understand the difference → fold the findings back into the eval set.

**④ Experiment discipline (my addition)**: change one variable at a time; pin the model version and random seed (to reduce noise); record the full configuration and results of every experiment (experiment tracking tools); set a "minimum detectable effect," and don't draw conclusions when the sample size is insufficient; **read the samples of every failed experiment** — knowing why it failed matters more than knowing the score.

**⑤ Quantifying "reserve time"**: industry experience is that going from a demo to a shippable LLM feature usually takes multiple rounds (commonly cited as 3–10) of "develop-evaluate" cycles; if the schedule allows only one round, that's the same as allowing no time for experiments. Writing the eval criteria into the PRD aligns product and engineering on "what counts as good" before work begins.

### Empower everyone to use new AI technology

**[Book]** As generative AI is adopted more widely, we want the **whole team** — not only the experts — to understand the new technology and feel confident using it. Nothing builds an intuition for how LLMs work (latency, failure modes, UX) better than actually using them. LLMs are fairly approachable: you can make a pipeline perform better without knowing how to code, and anyone can pitch in, starting with prompt engineering and evals.

Much of this is **education**. You can begin with the basics of prompt engineering: how n-shot and CoT steer the model toward the output you want. People with the right background can also teach the more technical side, such as the **autoregressive** nature of LLMs: the input tokens are handled in parallel, but the output tokens come out one after another. So **latency depends more on output length than on input length** — a key point when you design the UX and set expectations for performance.

You can go a step further and give people chances to experiment and explore hands-on. A hackathon, say? Having the whole team spend a few days tinkering with "exploratory" projects looks expensive, but the results can be surprising. The authors know of a team whose hackathon let it all but finish a three-year roadmap within one year; at another team, a hackathon produced a paradigm-shifting UX that only LLMs made possible, and it was made a priority for that year and the years after.

**[Extension]**

**① Write "latency depends on output length" as a formula**

```
total latency ≈ time to first token (TTFT) + output tokens × inter-token latency (ITL)

TTFT  ∝ input length (prefill phase, parallel computation)
ITL   relates to the output content, largely independent of input length (decode phase, generated one by one)
```

A feel for the numbers: prefill for a 10,000-token input may take only a few hundred milliseconds to a second or two; but generating 1,000 tokens at 50 ms per token is 50 seconds. **So long inputs are cheap; long outputs are expensive.**

**② Direct implications for UX**

| Strategy | Approach |
|---|---|
| Streaming output | Perceived wait drops sharply, even if total time is unchanged |
| Skeleton screens / staged display | Give structure first, then fill in content |
| Limit output length | Ask the model to "give 3 key points" rather than "write a long essay" |
| Move long generation to the background | Return a task ID first, notify when done |
| Prefill + short confirmation | Have the model generate less; let the user confirm more |

**③ Changes since the book**: prefix caching and faster prefill have significantly reduced TTFT; but **reasoning models introduced "thinking tokens"** — the model generates a large amount of reasoning content (invisible or collapsed for the user) before giving its answer, and this part is billed as output tokens and contributes to latency just the same. So "latency ∝ output length" holds even more today, except that "output" now includes an invisible chunk. In UX, give the user clear "thinking" feedback, and allow turning off reasoning for tasks that don't need deep reasoning.

**④ Ways to "empower everyone" (my addition)**: an internal prompt library and case sharing; regular "looking at data" open days (non-engineers also join error analysis — they often know the business best); office hours (technical people answer questions); hackathons — but with themes and judging criteria, and with a destination for the output (into the roadmap or the archive).

**⑤ Who most needs empowering? Domain experts.** Eval criteria, failure modes, good examples — all ultimately come from the people who know the business best. Teach them to use prompts, and they can directly participate in building eval sets — higher leverage than "let everyone build agents."

### Don't fall into the "AI engineers are enough" trap

**[Book]** When a new job title appears, people at first tend to inflate what the role covers, and a painful correction often follows. Examples worth noting from the past ten years:
- **Data scientist**: "a person who is better at statistics than any software engineer and better at software engineering than any statistician";
- **Machine learning engineer (MLE)**: looking at machine learning from a software engineering point of view.

Early on, many believed that data scientists alone could carry data-driven projects; only later did people realize that data scientists have to work with software engineers and data engineers to build and deploy data products.

The same misunderstanding is back, this time around the new **AI engineer** role: some teams believe AI engineers are the whole story. In fact, it takes many different specialist roles to build an ML or AI product. **The authors have advised over a dozen companies on their AI products, and time and again they have seen those companies fall into the "AI engineers are enough" trap.** So their products often never get past the demo, because the companies neglected key parts of building a product.

Take **evaluation and measurement**: they are the key to growing a product beyond the "vibe check," and the skills that effective evaluation needs match what MLEs have traditionally been good at — **a team of only AI engineers probably lacks those skills**. Hamel Husain, one of the authors, has shown why these skills matter in his recent work on catching data drift and on designing evals for specific domains.

The authors outline, roughly, **what kinds of roles are needed and when** as an AI product develops:

1. **Start by concentrating on getting the product built.** You can have an AI engineer, but you don't have to. An AI engineer is a real asset for fast prototyping and product iteration (the UX, connecting the pipeline, and so on).
2. **Next, put the right foundation in place: instrument the system and collect data.** Depending on what kind of data you have and how much, you may need platform engineers, data engineers, or both. There also have to be systems in place to query and analyze the data when you're debugging problems.
3. **Only after that will you want to optimize the AI system.** That doesn't have to mean training models; the basic work includes designing metrics, building an eval system, running experiments, tuning RAG retrieval, debugging stochastic systems, and the like. **MLEs are good at this** (AI engineers can learn it too). Hiring an MLE before the earlier steps are done usually makes little sense.

Beyond these, **domain experts are needed at every stage**: in a small company the founding team should ideally fill this role; in a large one, product managers can. **Knowing how roles progress and when each one is needed is crucial** — bringing people on at the wrong moment (an MLE too early, say) or building things out of order wastes time and money and drives people away. And consulting an MLE regularly during stages 1–2 (no full-time hire needed) helps a company get its foundations right.

**[Extension]**

**① What each role actually owns (my breakdown)**

| Role | Core responsibility | Concrete form in LLM applications | Common misunderstanding |
|---|---|---|---|
| AI engineer | Quickly turn model capabilities into products using APIs | Prompts, pipeline orchestration, tool calling, UX integration | Thinking evals can be done "on the side" |
| ML engineer | Make the model system measurable, optimizable, maintainable | Metric design, eval systems, experiment methodology, debugging stochastic systems | Thinking "no model training means not needed" |
| Data / platform engineer | Make data available, queryable, traceable | Logging, instrumentation, data pipelines, tracing, features/indexes | Thinking "we'll add it after launch" |
| Product manager | Define the job, priorities, risk gates | Jobs to be done, acceptance criteria, compliance boundaries | Thinking demo success = product success |
| Designer | Restate needs into solvable forms | Interaction patterns, HITL, feedback collection | Thinking it's just "making the UI pretty" |
| **Domain expert** | Knows what "right" is | Eval criteria, failure modes, examples | Thinking "can leave after the requirements review" |

**② This table exposes why "AI engineers are enough" is wrong**: AI engineers are good at **building** things, but "doing it right" (evals), "keeping it stable" (data and platform), and "doing the right thing" (product and domain) each require different capabilities. The faster the demo is built, the more easily this gap is hidden — until launch.

**③ Why "hiring an MLE too early is a waste"**: an MLE's leverage lies in optimization — and optimization requires something to optimize (a product) and something to measure it with (data). No instrumentation means no data; without data, evals are castles in the air, and no matter how strong the MLE is, there is nothing to do. **But the authors' advice is "consult regularly"** — spend a little money to get the instrumentation and eval foundations right in stages 1–2, avoiding rework.

**④ I think the book has a tension here that needs correcting**: Chapter 1 says evals are the most important thing in LLM applications, while this section says "hiring an MLE too early makes no sense." The two can be reconciled, but it needs to be said clearly: **what's needed from day one is the ability to look at samples and do error analysis, not an automated eval system; the dedicated eval role can come later.** In other words, someone on the stage-1 team must understand evals (even if it's the AI engineer learning it themselves, or an external consultant); it's just not necessary to hire a full-time MLE for it. Likewise, "instrumentation" should not wait until stage 2 — if you don't instrument in stage 1, there is no data to collect in stage 2. **My suggestion is to change the order to "product and instrumentation start together."**

**⑤ "hidden technical debt" — the technical debt of ML systems looks different**: Sculley et al.'s classic 2015 paper points out that the biggest technical debt in ML systems is not in the model code, but in **glue code, pipeline jungles, configuration, undeclared consumers, and peripheral components**. LLM applications inherit all of these debts, plus one more: **debt to an uncontrollable external dependency (the model vendor)** (see 2.3). This is the point of multi-role collaboration — these debts are scattered across different corners of the system, and no single person can see them all.

**⑥ Since the book: the "AI engineer" role itself is splitting up** (industry observation, not yet settled): as LLM features reach into retrieval, evals, agents, inference cost, and safety, it's hard for one "AI engineer" to be expert in all of them; industry discussions have produced finer divisions — evals, context engineering, LLMOps/platform, AI safety, and so on. At the same time, AI coding assistants let small teams deliver more, so "fewer people + more complete tools" is also possible. Both trends coexist: **titles are splitting, but the requirement of "process understanding" (4.1) for everyone has not diminished.**

**⑦ On forward-deployed engineers (FDEs)**: model vendors and AI companies increasingly send engineers to customer sites to co-build applications. This helps accelerate adoption, but be careful not to bind the system to a single vendor — a model is a "dependency with a retirement date" (2.3).

---

## Where the book says too little or is debatable

More than two years after publication, the changes in each section are already in the [Extension] notes above; a point-by-point check of where things stand now is in the [fourth post](/en/posts/llm-year-04/). Here I only record what this chapter doesn't mention, doesn't cover enough, or where I think it's debatable:

1. **Security is almost a blank.** The whole chapter mentions security and privacy only once, under "and more." But for LLM applications, prompt injection, data leakage, jailbreaking, and tool abuse are the most common operational risks, and deserve a place among the gates.
2. **Cost and "FinOps" are not developed.** Cost is only listed as one requirement; model selection, routing, caching, and budget alerting deserve their own section (Chapter 1 covers caching, this chapter covers small models, but nothing ties them together).
3. **Incident response is missing.** Vendor outages, rate limits, content-filter false positives, output format drift — these need plans, an on-call runbook, and drills.
4. **"Experimentation is now cheap" is said too lightly.** Changing prompts is cheap, but **evals are expensive** — building and maintaining eval sets, human labeling, and calibrating LLM-as-Judge are the real bottleneck of iteration cost. A more accurate statement: the marginal cost of experiments is falling, but the fixed cost (evals) hasn't changed.
5. **"Ship first, then iterate" needs qualifiers.** It applies to internal, low-risk scenarios; for customer-facing or regulated scenarios, gates must be passed first.
6. **The tension between "hire MLEs later" and "evals matter most"** is not addressed head-on (see 4.4 ④).
7. **Statistical decisions under non-determinism and sampling variance** (how many samples are needed, how large an improvement counts as significant) are not discussed, which is why "run it twice and eyeball the result" experiments are common.

---

## The underlying ideas running through the chapter (distilled)

After reading Chapter 2, I distill the scattered advice into **seven principles**:

1. **Look at the data, not just the metrics.** Metrics tell you "it changed"; samples tell you "why." Look every day, and write it into the on-call duties.
2. **Treat the model as an external dependency with a retirement date.** Pin model versions, shadow-verify, gradual rollout with rollback, a deprecation calendar — treat it like a third-party service you don't control.
3. **Go as small as possible; choose per step.** Frontier models validate feasibility; small models + process engineering scale it; without an eval set, don't talk about model selection.
4. **UX is a data channel.** Suggest → user verifies → data → better models. Human-in-the-loop is both a safety valve and a labeling factory.
5. **Layer requirements; set standards by risk.** Gates (non-negotiable), budgets (tradable), nice-to-haves (iterable); error cost and reversibility determine what becomes a gate.
6. **Process before tools; evals before optimization.** Tools amplify the understanding you already have; evals shorten your iteration cycle.
7. **Roles evolve with stages; domain experts run through all of them.** Build the product first, lay instrumentation at the same time, then optimize; don't expect one role to do everything.

Connection to Chapter 1: Chapter 1's principle is "**wrap the probabilistic in the deterministic**"; Chapter 2's principle is "**wrap uncertainty in process and product**." The former is technology, the latter is organization — without either, a demo never becomes a product.

---

## Practical checklist

**Data**
- [ ] Are complete inputs and outputs logged (including the assembled prompt, model version, retrieval results, tool calls)?
- [ ] Does someone sample and review examples every day? Is it part of the on-call duties?
- [ ] Are structural skew (length, format compliance rate) and semantic drift (embedding clustering) monitored?
- [ ] Does the holdout set reflect recent real interactions (including typos, colloquialisms, edge cases)?
- [ ] Do evals run the same input multiple times and report variance?
- [ ] When a new failure mode is found, does it become an assertion within 24 hours?

**Models**
- [ ] Does output go through a structured schema? Is there a second layer of business-rule validation?
- [ ] Does production use only versioned model IDs? Does the model ID live in exactly one config location?
- [ ] Is there a golden set built from online samples? Does every model/prompt change automatically run regression?
- [ ] Is there a shadow pipeline? Is there gradual rollout and one-click rollback?
- [ ] Is there a maintained "model inventory + retirement dates + owner" table?
- [ ] Has it been verified whether a small model suffices for the task? Is model selection done per step rather than per application?

**Product**
- [ ] Is the designer involved at problem definition (not just UI polish)?
- [ ] Has the form been examined through "jobs to be done": chat, completion, or something else?
- [ ] Can users easily correct outputs? Are corrections recorded as labels?
- [ ] Are gates, budgets, and nice-to-haves distinguished? Have all gates been met?
- [ ] Has an "error cost × reversibility" matrix been drawn, and used to decide HITL timing?
- [ ] Does implicit feedback handle verifiability bias and habitual acceptance?

**Team**
- [ ] Before adopting a tool, was the process it solves understood? Are eval criteria built in-house?
- [ ] Is "iteration cycle time" measured? Does the schedule reserve multiple "develop-evaluate" rounds?
- [ ] Has everyone on the team learned prompt basics? Do domain experts participate in building eval sets?
- [ ] Is it clear which stage the team is in (building the product / laying foundations / optimizing), and does staffing match?
- [ ] Does instrumentation start from day one (rather than waiting for stage 2)?
- [ ] Is there an external MLE consultant reviewing periodically in the early stages?

---

## Further reading

**Mentioned in the book**
- EvalGen: Shankar, Shreya, et al. "Who Validates the Validators? Aligning LLM-Assisted Evaluation of LLM Outputs with Human Preferences." 2024. [arXiv:2404.12272](https://arxiv.org/abs/2404.12272)
- The a16z report on enterprise internal LLM application adoption outpacing external applications (cited in the book)
- Structured output tools: Instructor, Outlines
- Small models: DistilBERT, DistilBART

**Added in these notes**
- Prompt format sensitivity: Sclar, et al. 2023. [arXiv:2310.11324](https://arxiv.org/abs/2310.11324)
- Model behavior drift over time: Chen, Zaharia & Zou, 2023. "How is ChatGPT's Behavior Changing over Time?" [arXiv:2307.09009](https://arxiv.org/abs/2307.09009)
- ML system launch checks: Breck, et al. 2017. "The ML Test Score: A Rubric for ML Production Readiness and Technical Debt Reduction." IEEE Big Data.
- Hidden technical debt in ML systems ("changing anything changes everything"; the book links this paper): Sculley, et al. 2015. "Hidden Technical Debt in Machine Learning Systems." NeurIPS.
- Train-serve skew: Google, "Rules of Machine Learning" (Martin Zinkevich)
- Postel's law: Postel, J. 1980. RFC 761, "DoD Standard Transmission Control Protocol."
- Essential and accidental complexity: Brooks, F. 1986. "No Silver Bullet — Essence and Accident in Software Engineering."
- DistilBERT: Sanh, et al. 2019. [arXiv:1910.01108](https://arxiv.org/abs/1910.01108)
- DistilBART: Shleifer & Rush, 2020. [arXiv:2010.13002](https://arxiv.org/abs/2010.13002)
- Few-shot classification with SetFit: Tunstall, et al. 2022. [arXiv:2209.11055](https://arxiv.org/abs/2209.11055)
- Model cascades and routing: FrugalGPT, Chen et al. 2023. [arXiv:2305.05176](https://arxiv.org/abs/2305.05176); RouteLLM, Ong et al. 2024. [arXiv:2406.18665](https://arxiv.org/abs/2406.18665)
- Human-AI interaction guidelines: Amershi, et al. 2019. "Guidelines for Human-AI Interaction." CHI; Google PAIR Guidebook
- Jobs to be done: Christensen, et al. 2005. "Marketing Malpractice: The Cause and the Cure." HBR
- Toyota's genchi genbutsu: Liker, J. *The Toyota Way*
- The EU AI Act (in force 2024) — risk-tiering provisions; for the 2026 revision see [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng) (Digital Omnibus on AI)

---

*These notes are a summary, interpretation, and extension of Chapter 2 of the book. All [Extension] sections are the note author's additions and do not represent the book's views. For cited numbers, refer to the original papers or the book.*
