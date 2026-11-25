---
title: "Letting a sentence drift on the road: the retelling rules and summit scoring in The Road We Came"
description: "The Road We Came is a five-minute browser game: before you set out, you write down one reason for the journey; the people along the road retell it again and again, and at the summit you write it back from memory. This post covers how the retelling is built from a few word lists and a seeded random number generator, how the summit scores with the longest common subsequence (the score is ROUGE-L) and decides whether you remembered your own words or the road's version, and the problems that showed up after running over a thousand seeds."
sourceHash: "97668b8d9819911e"
---

[*The Road We Came*](https://weiguang-2099.github.io/road-we-came/) is a five-minute browser game I made, with a Chinese version and an [English version](https://weiguang-2099.github.io/road-we-came/?lang=en). Before you set out, you write down one sentence about why you're making this journey. At the Teahouse, the Waystation, and the Stone Bridge along the road, someone retells the sentence to you, each time a little different; you can accept it or correct it. The ferryman at the Ferry takes no money, but asks you to give up one character from the sentence. At the Summit, the keeper of the scrolls hands you a blank scroll, and you have to write the original reason from memory. The game then puts the three sentences side by side.

![The summit screen of The Road We Came. On the left is a list of the places you've passed: the Teahouse, the Waystation, the Stone Bridge, the Ferry, the Mountain Gate, the Summit. On the scroll above, written vertically, is 想去看看妈妈说的那片湖 (I want to see the lake Mom talked about). Below are three lines compared: what you wrote at the start was 想去看看母亲常说的那片海 (I want to see the sea Mother often talked about), the road's version is 想看妈妈说的片湖 (want to see the lake Mom talked about), and what you remember now is 想去看看妈妈说的那片湖 (I want to see the lake Mom talked about). In the first line, 母亲常 and 海 are underlined with dots; in the last two lines, 妈妈 and 湖 are underlined with waves. The verdict at the bottom reads 'What you remember is what the people on the road told you.'](./summit.png "Figure 1: The comparison at the Summit. The first line is what you wrote at the start, the second is the road's version (the Ferry has already taken one character), and the third is what you remember at the Summit. Dotted underlines mark characters that weren't remembered; wavy underlines mark characters added later.")

This post is about two pieces of the code: how the people along the road let a sentence drift ([`src/drift.ts`](https://github.com/WeiGuang-2099/road-we-came/blob/e998384ef10f0d4f1558888b82f4797ae2ba8e8b/src/drift.ts)), and how the Summit decides whether you remembered your own words or the road's version ([`src/compare.ts`](https://github.com/WeiGuang-2099/road-we-came/blob/e998384ef10f0d4f1558888b82f4797ae2ba8e8b/src/compare.ts)). The examples and numbers in this post were all produced with the game's own code and fixed seeds[^1]. The game's design and engineering details are covered in two other posts: [the design post](/en/posts/laishilu-design/) and [the engineering post](/en/posts/laishilu-engineering/).

## Why rules, not a model

This blog is about RAG and LLM applications, so at this point you might wonder: wouldn't a model be more human-like at retelling? For *The Road We Came*, there are a few hard constraints:

- **The player's words never leave the browser.** The save file lives only in the browser's localStorage, and the stats endpoint deliberately accepts no text at all. Calling an online model would mean sending the sentence out as the very first step.
- **There is no backend.** The game is a pile of static files, hosted on GitHub Pages, and the build can also be uploaded directly to itch.io. An API key would have to go into the frontend code, which is as good as public.
- **The same seed must produce the same sentence.** That's what makes deterministic test expectations possible.

Running a small model in the browser would get around the first two, but for a five-minute game, the download is too large.

So the retelling is built from rules: a few word lists, a few kinds of changes, and a seeded random number generator. The virtue of rules is that every kind of change is out in the open and testable; the cost is that they only know the words in the lists. That cost becomes very clear when we run over a thousand seeds later on.

## The kinds of drift

The Chinese retelling has three kinds of changes: rephrasing, dropping a character, and mishearing a word. Each step draws one kind with weights 5 : 3 : 2. English has its own set:

```ts title="src/drift.ts"
const HAN_CHANGES: ReadonlyArray<readonly [Change, number]> = [
  [shiftPhrase, 5],
  [dropChar, 3],
  [mishear, 2],
];

const LATIN_CHANGES: ReadonlyArray<readonly [Change, number]> = [
  [shiftWord, 5],
  [mishearWord, 3],
  [dropWord, 3],
  [swapLetters, 1],
];
```

If the sentence contains even one Chinese character, the Chinese rules apply. The Teahouse makes 1 change, and the Waystation and the Stone Bridge make 2 each, so if the player clicks "That's right" all the way, the sentence has been changed up to 5 times by the time it reaches the Ferry. Clicking "That's not it" means you have to say the sentence again yourself, and the next stop continues from the player's version.

### Rephrasing

`PHRASE_SHIFTS` is a table of 67 entries: on the left are words the player might write, on the right are what someone else might turn them into. Here are a few of them:

```ts title="src/drift.ts (excerpt)"
const PHRASE_SHIFTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['第一次', ['头一回', '又一次']],
  ['回家', ['回乡', '离家']],
  ['自己', ['别人', '家人']],
  ['忘记', ['记得', '放下']],
  ['告别', ['道别', '重逢']],
  ['一起', ['一道', '各自']],
  // ……
  ['去', ['回']],
  ['回', ['去']],
  ['想', ['要']],
  // ……
];
```

Some just swap in a near-synonym (回家 (go home) becomes 回乡 (return to one's hometown)); some flip the meaning entirely (回家 (go home) becomes 离家 (leave home), 忘记 (forget) becomes 记得 (remember), 一起 (together) becomes 各自 (each on their own)). When a sentence is passed along the road, both things happen.

There are two rules for replacement. First, longer words claim their characters first: once the two characters of 回家 (go home) are taken by the 回家 entry, the single-character 回 → 去 can't touch them, so 回家 can become 回乡 but never 去家. Second, single-character replacements only apply to characters that stand alone as words. The 回 in 想起回忆 (recall memories) is part of 回忆 (memories) and can't be replaced with 去 on its own. To decide whether a character stands alone, the code uses the browser's built-in segmenter:

```ts title="src/drift.ts"
// Splits Chinese into words, so a one-character shift like 回 → 去 only
// touches a character that stands alone and never breaks up 回忆.
const WORDS =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', {granularity: 'word'})
    : null;
```

`Intl.Segmenter` splits 想起回忆 into 想起 / 回忆, and 我想回家 into 我想 / 回家, so the single-character replacements have nothing to grab in either sentence. Browsers that don't support it fall back to character-by-character processing, and then 回忆 could be broken apart.

When a sentence has several replaceable spots, one is drawn with weights proportional to word length, so longer words are more likely to be changed.

### Dropping a character

`dropChar` deletes one character at random from the sentence, not counting punctuation or spaces.

### Mishearing a word

`SOUND_ALIKES` is 20 pairs of words that sound alike: 回忆 (memories) and 会议 (meeting), 梦想 (dream) and 梦乡 (dreamland), 理想 (ideal) and 离乡 (leaving home), 告别 (farewell) and 告白 (confession of love), 旅行 (travel) and 履行 (carry out), 一生 (a lifetime) and 医生 (doctor), 大学 (university) and 大雪 (heavy snow), 星星 (stars) and 猩猩 (apes)... The code comment spells out the selection criterion: both sides must be real words, so that a mishearing reads as a different reason, not a typo. Mishearing swaps the whole word from the table: 为了旅行 (in order to travel) can be misheard as 为了履行 (in order to carry out). But it only matches literally, without looking at word boundaries: in 等我长大学会做饭 (when I grow up and learn to cook), the 大学 spans 长大 (grow up) and 学会 (learn), and can be misheard as 大雪 (heavy snow), turning the sentence into 等我长大雪会做饭 (when I grow heavy snow can cook).

### How each step chooses

```ts title="src/drift.ts"
/**
 * A retelling can lose words, but never so many that fewer than this are
 * left. A short reason then reaches the ferry with a word to spare.
 */
const FEWEST_WORDS = 2;

function driftOnce(text: string, random: Random): string {
  const floor = Math.min(wordCount(text), FEWEST_WORDS);
  const changes = [...(hasHan(text) ? HAN_CHANGES : LATIN_CHANGES)];
  while (changes.length > 0) {
    const index = weightedIndex(
      changes.map(([, weight]) => weight),
      random,
    );
    const [change] = changes.splice(index, 1)[0];
    const result = change(text, random);
    if (result !== null && result !== text && wordCount(result) >= floor) {
      return result;
    }
  }
  return text;
}
```

It draws one kind of change by weight; if that kind can't be used (the sentence has no words from the table), or the result would leave fewer than two words (in Chinese, one character counts as one word), it removes that kind and draws again from the rest. If none of them work, the step retells the sentence unchanged.

The two-word floor is there for the later stages: the Ferry takes one character from the sentence, and the Summit needs something to compare. If a sentence is just 梦想 (dream), the table can turn it into 梦 (dream), but that would leave only one word, so the change is rejected and another kind is tried. The player also has to write at least two words at the start.

### English

English works in whole words: the ferryman takes one word, and the Summit compares word by word. The rephrasing table has 55 entries (home becomes house or hometown, forget becomes remember, together becomes alone), and there are 24 pairs of homophones or near-homophones (sea and see, morning and mourning, whole and hole, peace and piece, wonder and wander). Dropping a word requires at least three words in the sentence. The lowest-weighted kind swaps two adjacent letters in a word of four or more letters. Replacement preserves the original word's initial capital.

## One journey for one sentence

Using the test sentence 想去看看海，看它到底有多大 (I want to see the sea, to see how big it really is), seed 1, clicking "That's right" at every stop:

| Place | Change at this stop | What this stop says |
| --- | --- | --- |
| Start | | 想去看看海，看它到底有多大 |
| Teahouse | 海 (sea) → 河 (river) | 想去看看河，看它到底有多大 |
| Waystation | dropped one 看 (look); 想去 (want to go) → 打算去 (plan to go) | 打算去看河，看它到底有多大 |
| Stone Bridge | 看 (look) → 望 (gaze); 看 → 望 | 打算去望河，望它到底有多大 |

I picked this seed; all three versions read naturally. With a different seed, the same sentence takes a completely different path: across 1000 seeds, the sentence arrives at the Stone Bridge in 798 different forms, and never once unchanged.

## Refresh, and it's still the same sentence

The random numbers come from a seeded mulberry32. Each run draws a random seed and stores it in the save file, and each stop derives its own seed from it:

```ts title="src/game.ts"
private randomFor(run: Run): Random {
  return new Random(run.seed + run.stage * 0x9e3779b1);
}
```

0x9e3779b1 is 2654435761, a prime close to 2<sup>32</sup> ÷ φ (φ is the golden ratio, about 1.618).

The retelling is written into the save file as soon as it's generated, before it's shown:

```ts title="src/game.ts"
if (run.rumor === undefined) {
  run.rumor = drift(run.carried, DRIFT_STEPS[id], this.randomFor(run));
  this.store.saveRun(run);
}
```

So if the player refreshes the page at the Teahouse, they come back to the same sentence.

Determinism also makes tests easy to write. Most of the tests in `drift_test.ts` are not "input A should produce B", but rather run the same sentence over 300 seeds and check that some property holds every time:

```ts title="src/drift_test.ts"
it('never wears a reason down below two words', () => {
  // 梦想 can be retold as 梦, which would leave a single word.
  for (const text of ['看海', '梦想', '想家了', 'go home']) {
    for (const seed of SEEDS) {
      const result = drift(text, 5, new Random(seed));
      expect(wordCount(result), `${text} -> ${result}`).toBeGreaterThan(1);
    }
  }
});
```

The same style checks that 回家 can become 回乡 but never 去家, and that 想起回忆 can be misheard as 想起会议 but never becomes 想起去忆.

## The Summit: comparing with the longest common subsequence

The Summit compares three sentences: what you wrote at the start (the original), what the road passed along (the road's version), and what you remember now. Before comparing, the sentences are split into words: in Chinese, one character is one word; in English, words are split on spaces. Punctuation, spaces, and capitalization don't count, and `don't` and `don’t` count as the same word. So 想去看看海。 and 想去看看海 count as word for word.

Two sentences are aligned by their longest common subsequence (LCS) of words. Words in the LCS are marked "kept"; words in the first sentence but not the LCS are marked "lost"; words in the second sentence but not the LCS are marked "added". That's where the dotted and wavy underlines in Figure 1 come from. The score is computed like this:

```ts title="src/compare.ts"
const total = x.length + y.length;
return {
  before: a.map((part, k) => markOf(part, keptA.has(k), 'lost')),
  after: b.map((part, k) => markOf(part, keptB.has(k), 'added')),
  similarity: total === 0 ? 1 : (2 * keptA.size) / total,
};
```

That is, 2 × LCS ÷ (m + n), where m is the word count of the original and n is the word count of the other sentence. The LCS of 想去看看海 and 想去看湖 is 想去看, 3 characters, so the score is 2 × 3 ÷ (5 + 4), about 0.67.

### This score is ROUGE-L

The code comment calls it "the Dice coefficient over the LCS". From another angle: treat the remembered sentence as the candidate and the original as the reference. Precision P = LCS ÷ n, recall R = LCS ÷ m, and their harmonic mean is 2PR ÷ (P + R) = 2 × LCS ÷ (m + n), which is exactly ROUGE-L with β = 1[^2]. Anyone who has done summarization or RAG evaluation will recognize this metric: there it measures how close a model's output is to a reference answer; here it measures how close a person's memory is to the sentence they wrote at the start.

### The six verdicts

The score itself is never shown. What the player sees at the Summit is the three-line comparison like Figure 1 and a final verdict; the score is only used behind the scenes to pick the verdict, and is saved with the journey in the game's history in the browser.

| Verdict | When it's given |
| --- | --- |
| Word for word. You still remember. | Score against the original is 1 |
| What you remember is what the people on the road told you. | The remembered version contains words the road added, and its score against the road's version is no lower than against the original |
| Most of it is still yours. But some of the words now belong to the road. | Score against the original is at least 0.7, but words the road added have slipped in |
| Most of it is still with you. A few words fell by the wayside. | Score against the original is at least 0.7 |
| Only a little of it is left. The road rewrote the rest. | Score against the original is at least 0.35 |
| You forgot. And still, you made it here. | Everything else |

The checks run in the order of the table:

```ts title="src/compare.ts"
export function judge(
  origin: string,
  carried: string,
  recall: string,
): Verdict {
  const toOrigin = similarity(origin, recall);
  if (toOrigin === 1) {
    return 'exact';
  }
  const echoesRumor = repeatsRumor(origin, carried, recall);
  if (echoesRumor && similarity(carried, recall) >= toOrigin) {
    return 'rumor';
  }
  if (toOrigin >= MOSTLY_MIN) {
    // Mostly the player's own words, but some of the road's slipped in.
    return echoesRumor ? 'mixed' : 'mostly';
  }
  return toOrigin >= PARTLY_MIN ? 'partly' : 'forgotten';
}
```

The key is `repeatsRumor`: does the remembered sentence contain any word that the road added and the player never wrote?

```ts title="src/compare.ts"
function repeatsRumor(
  origin: string,
  carried: string,
  recall: string,
): boolean {
  // Both alignments mark the parts of `carried`, index for index.
  const added = align(origin, carried).after;
  const echoed = align(carried, recall).before;
  return added.some(
    (mark, i) => mark.kind === 'added' && echoed[i].kind === 'kept',
  );
}
```

It does two alignments: the original against the road's version, marking which words the road added; and the road's version against the remembered one, marking which words were remembered. In both alignments, the road's version is split into words the same way, so the indices line up one to one. Putting the two sets of marks together by position tells you whether any word the road added was remembered.

So merely being closer to the road's version doesn't count as "remembering the road's version". If the road only lost words and added none, the road can't be blamed: with the original 想去看看海，看它到底有多大, the road's version reduced to 去看, and the Summit written as 想去看海, the score against the road's version (0.67) is higher than against the original (0.5), yet the verdict is still "Only a little of it is left".

With the same original but the road's version changed to 要去瞧瞧湖，看它有多大 (going to take a look at the lake, to see how big it is), here are the scores and verdicts for different things written at the Summit:

| Written at the Summit | vs. original | vs. road's version | Verdict |
| --- | ---: | ---: | --- |
| 想去看看海，看它到底有多大 | 1 | 0.55 | Word for word |
| 想去看看湖，看它有多大 | 0.82 | 0.70 | Mostly remembered, with the road's words mixed in |
| 要去瞧瞧湖，看它有多大 | 0.55 | 1 | Remembered the road's version |
| 要去看看湖 | 0.35 | 0.40 | Remembered the road's version |

The run in Figure 1 can be computed the same way. The original 想去看看母亲常说的那片海 has 12 characters; the road's version 想看妈妈说的片湖 has 8; what was written at the Summit, 想去看看妈妈说的那片湖, has 11. The LCS with the original is 想去看看说的那片, 8 characters, score 16 ÷ 23, about 0.696, just short of 0.7. The LCS with the road's version is the whole sentence 想看妈妈说的片湖, also 8 characters, score 16 ÷ 19, about 0.84. 妈妈 and 湖 were added by the road, so the verdict is "What you remember is what the people on the road told you."

## After running over a thousand seeds

While writing this post, I used the game's own code to run several sentences over 300 to 1000 seeds each, recording which kind each change belonged to. The rules basically work as designed: the example sentence 想去看看海，看它到底有多大 has no mishearable words, and rephrasing and dropping account for about 62.5% and 37.5%, exactly 5 : 3. But I also saw a few problems, none of which are fixed in the game yet.

### Word boundaries are ignored

`dropChar` can delete any character in the sentence, whether or not it's half of a word. Over 1000 seeds on the example sentence, 1876 characters were dropped in total, and 1249 of them (two thirds) landed inside a multi-character word[^3]. Some are harmless — 看看 losing one character is still 看 — but others stop sounding human. One run with seed 0:

> 想去看看海，看它到底有多大\
> → 想去看看海，它到底有多大\
> → 想去看一眼海，它到底有多大\
> → 想去看一海，它到底有多大\
> → 要去看一海，它到底有多大\
> → 要去看一湖，它到底有多大

看一眼 (take a look) lost 眼, becoming 看一海. The same thing happens with 打算 (plan to) reduced to just 打 or 算, and 到底 (after all) reduced to just 底. A person retelling a sentence might drop a whole word, but rarely leaves a word half-finished.

Replacement has the same flaw. Single-character replacements consult the segmenter first, but multi-character rephrasing and mishearing only match literally. In 我想成为了不起的人 (I want to become a great person), the 为 of 成为 (become) and the 了 of 了不起 (great) line up to form 为了 (in order to), which is in the table: over 1000 seeds, 619 runs heard 我想成因为不起的人 at the Teahouse.

English drops whole words, so it never drops half a word, but it also doesn't care which word it drops: I want to see the sea can arrive at the Stone Bridge as a fragment like I want to the.

### Changes stack on top of each other

Each step only looks at the current sentence and doesn't remember which word was just changed, so several changes can pile up into a word no one would ever say. 梦想 (dream) over 300 seeds stopped at 念要 in 179 runs: first it was retold as 念想 (a longing), the segmenter split 念想 into 念 / 想, 想 became a standalone character, and then 想 → 要 applied. English does the same: see is first misheard as sea, then sea is rephrased as lake:

> I want to see the sea before I turn thirty\
> → I want to see the lake before I turn thirty\
> → I want to sea the lake before I turn thirty\
> → I want to lake the lake before I turn thirty

### Sentences outside the word lists

The rules only know the words in the tables. When a sentence hits none of them, the only tools left are dropping characters (or dropping words and swapping letters in English):

- 吃饭 (eat) over 300 seeds never changed once: dropping a character would leave only one word, and the floor forbids it. All three people on the road repeat it verbatim.
- 我要吃火锅 (I want hotpot) over 1000 seeds was worn down to two characters every single time by the Stone Bridge: 吃锅, 要锅, 我火, 我锅...
- eat noodles has only two words, so even dropping a word is unavailable; all the changes are letter swaps, and by the Stone Bridge it's spellings like eat nodoles. The mishearing table was deliberately chosen so both sides are real words, to avoid reading like typos; but when the table can't help, what's left is exactly typos. The longer English example I want to see the sea before I turn thirty also had 11.6% of its changes as letter swaps (tunr, wnat, befoer).

### The verdict leans toward the road's version

The score divides by the total length of the two sentences, and the road's version, after dropping characters and the Ferry's toll, is usually shorter than the original. Remembering the same 8 characters scores higher against the shorter sentence, which is what happened in Figure 1.

When the scores are equal, the tie also goes to the road: with the original 我想去看海, the road's version 我要去看湖, and the Summit written as 我想去看湖, the score against both is 0.8, and the verdict is "Remembered the road's version". Here "Mostly remembered, with the road's words mixed in" would fit better.

### What could be changed

- Change dropping to drop whole words as split by `Intl.Segmenter`, or only drop single-character words;
- Make multi-character rephrasing and mishearing also respect `Intl.Segmenter` word boundaries, so a match can't straddle two words;
- Change each word at most once per run, so a word can't be "misheard" and then "rephrased";
- In English, remove letter swapping, and only drop words like really or just whose removal still reads naturally; when the tables can't help, repeat the sentence unchanged;
- Don't give ties to the road (change `>=` to `>`), and continue judging by the score against the original; the 0.8 example above would then get "Mostly remembered, with the road's words mixed in". Or stop comparing scores altogether and instead look at how many words in the remembered sentence were added by the road.

## Summary

Building the retelling from rules buys three things: the player's words never leave the browser, the retelling is reproducible from a seed, and every kind of drift can be written as a test. The cost is that it only knows the words in the tables. That cost, along with the places the rules don't cover — dropping and replacement ignoring word boundaries, changes stacking on top of each other — only becomes visible after running enough seeds.

The Summit's score is ROUGE-L. The same formula that scores a model's output in evaluation scores a person's memory here. At the end, the game asks you one question: At the end of the road, will you still know why you began? To find out your own answer, you can [take the walk](https://weiguang-2099.github.io/road-we-came/).

[^1]: The examples and statistics were run in Node.js 24.21 (ICU 78.3), with seeds derived the same way as in the game. `Intl.Segmenter`'s Chinese word segmentation depends on the engine's built-in dictionary, so results may differ slightly across browsers.

[^2]: Chin-Yew Lin proposed ROUGE-L in the 2004 paper *ROUGE: A Package for Automatic Evaluation of Summaries*. The F-measure in the paper is F = (1 + β<sup>2</sup>)RP ÷ (R + β<sup>2</sup>P), which at β = 1 is the harmonic mean of P and R.

[^3]: How this was determined: for each dropped character, I split the pre-drop sentence with `Intl.Segmenter` and checked whether the word containing the dropped character had more than one character.
