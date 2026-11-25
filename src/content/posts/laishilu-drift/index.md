---
title: "让一句话在路上走样：《来时路》的转述规则和山顶评分"
description: "《来时路》是一个五分钟左右的浏览器小游戏：出发前写下一句理由，路上的人一遍遍转述它，到了山顶再凭记忆写回来。这一篇讲转述怎么用几张词表和一个带种子的随机数做出来，山顶怎么用最长公共子序列打分（这个分数就是 ROUGE-L）、判断你记住的是自己的话还是路上的说法，以及用上千个种子跑过一遍之后看到的问题。"
pubDate: 2026-11-25 21:00:00
tags: ["laishilu", "game-dev", "text-similarity", "evaluation", "typescript"]
---

[《来时路》](https://weiguang-2099.github.io/road-we-came/)是我做的一个五分钟左右的浏览器小游戏，有中英两个版本（英文版叫 [*The Road We Came*](https://weiguang-2099.github.io/road-we-came/?lang=en)）。出发前，你写下一句为什么要走这一趟。路上的茶寮、驿站、桥头，各有一个人把这句话转述给你听，每次都差一点，你可以认下，也可以纠正。渡口的船夫不收钱，要你从这句话里交出一个字。到了山顶，守经的人递给你一卷空白的经，你要凭记忆把当初的理由写上去，游戏再把三句话放在一起对照。

![《来时路》的山顶画面。左边一列是走过的地方：茶寮、驿站、桥头、渡口、山门、山顶。上方的经卷上竖排写着“想去看看妈妈说的那片湖”。下面三行对照：出发时写的是“想去看看母亲常说的那片海”，一路上人们传的是“想看妈妈说的片湖”，现在记得的是“想去看看妈妈说的那片湖”。第一行的“母亲常”和“海”下面是点线，后两行的“妈妈”和“湖”下面是波浪线。最后一行评语是“你记住的，是路上的人说的那一句。”](./summit.png "图 1：山顶的对照。第一行是出发时写的，第二行是一路传下来的（渡口已经收走一个字），第三行是到山顶时记得的。点线标出没被记住的字，波浪线标出后来添的字。")

这一篇讲其中两段代码：路上的人怎么把一句话传走样（[`src/drift.ts`](https://github.com/WeiGuang-2099/road-we-came/blob/e998384ef10f0d4f1558888b82f4797ae2ba8e8b/src/drift.ts)），山顶怎么判断你记住的是自己的话还是路上的说法（[`src/compare.ts`](https://github.com/WeiGuang-2099/road-we-came/blob/e998384ef10f0d4f1558888b82f4797ae2ba8e8b/src/compare.ts)）。文中的例子和数字，都是用游戏自己的代码和固定的种子跑出来的[^1]。游戏的设计和工程细节另有两篇：[设计篇](/posts/laishilu-design/)和[工程篇](/posts/laishilu-engineering/)。

## 为什么是规则，不是模型

这个博客的主题是 RAG 和 LLM 应用，读到这里，你可能会想：转述这种事，交给模型不是更像人吗？对《来时路》来说，有几条硬约束：

- **玩家写的字不离开浏览器。** 存档只放在浏览器的 localStorage 里，统计接口也故意不接收任何文字。调用在线模型，第一步就是把这句话发出去。
- **没有后端。** 游戏是一堆静态文件，放在 GitHub Pages 上，打包以后也能直接上传 itch.io。API key 只能写进前端代码，等于公开。
- **同一个种子要得到同一句。** 这样测试才能写出确定的期望值。

在浏览器里跑一个小模型能绕开前两条，可对一个五分钟的游戏来说，下载量太大了。

所以转述用的是规则：几张词表、几种改法、一个带种子的随机数。规则的好处是每一种改法都写在明处、能测；代价是它只认识词表里的词。这一点，后面跑上千个种子时会看得很清楚。

## 几种走样

中文的转述有三种改法：换个说法、丢掉一个字、听岔一个词。每一步按 5 : 3 : 2 的权重抽一种。英文另有一套：

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

句子里只要有一个汉字，就按中文的规则改。茶寮改 1 处，驿站和桥头各改 2 处，所以玩家要是一路都点“是这样”，到渡口时这句话最多已经被改过 5 次。点“不是这样的”，就要自己把这句话重说一遍，下一站从玩家说的版本接着传。

### 换个说法

`PHRASE_SHIFTS` 是一张 67 条的表，左边是玩家可能写的词，右边是别人可能说成的样子。下面挑了其中几条：

```ts title="src/drift.ts（节选）"
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

有的只是换了个近义的说法（“回家”说成“回乡”），有的把意思整个翻了过来（“回家”说成“离家”，“忘记”说成“记得”，“一起”说成“各自”）。路上传话，两种情况都会发生。

替换时有两条规矩。第一，长的词先认领自己的字：“回家”两个字被“回家”这一条占住以后，单字的“回 → 去”就碰不到它们，所以“回家”可以变成“回乡”，但不会变成“去家”。第二，单字的替换只对自己成词的字生效。“想起回忆”里的“回”是“回忆”的一部分，不能单独换成“去”。判断一个字是不是自己成词，用的是浏览器自带的分词器：

```ts title="src/drift.ts"
// Splits Chinese into words, so a one-character shift like 回 → 去 only
// touches a character that stands alone and never breaks up 回忆.
const WORDS =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', {granularity: 'word'})
    : null;
```

`Intl.Segmenter` 把“想起回忆”切成“想起 / 回忆”，把“我想回家”切成“我想 / 回家”，单字的替换在这两句里都无处下手。不支持它的浏览器会退回逐字处理，那时“回忆”就有可能被拆开。

一句话里有几处可以换时，按词的长度加权抽一处，长的词更容易被换掉。

### 丢掉一个字

`dropChar` 从句子里随机删掉一个字，标点和空格不算。

### 听岔一个词

`SOUND_ALIKES` 是 20 对读音相近的词：回忆和会议，梦想和梦乡，理想和离乡，告别和告白，旅行和履行，一生和医生，大学和大雪，星星和猩猩……代码注释写明了挑词的标准：两边都是真词，听岔了读起来是另一个理由，而不是错别字。听岔换的是表里的整个词，“为了旅行”可以被听成“为了履行”。不过它只按字面找，不看词界：“等我长大学会做饭”里的“大学”横跨“长大”和“学会”，也会被听成“大雪”，成了“等我长大雪会做饭”。

### 每一步怎么选

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

按权重抽一种改法；它用不上（句子里没有表里的词），或者改完以后只剩不到两个词（中文一个字算一个词），就把这种改法拿掉，在剩下的里面再抽。哪一种都用不上，这一步就原样转述。

两个词的下限是给后面的环节留的：渡口要从句子里收走一个字，山顶要有东西可以对照。一句话要是只有“梦想”，它在表里可以被说成“梦”，可那样只剩一个词，这次改动就不算，换别的改法。玩家出发时也至少要写两个词。

### 英文

英文的单位是整词：船夫收一个词，山顶按词对照。换说法的表有 55 条（home 说成 house 或 hometown，forget 说成 remember，together 说成 alone），同音或读音相近的词有 24 对（sea 和 see，morning 和 mourning，whole 和 hole，peace 和 piece，wonder 和 wander）。丢词要求句子里至少有三个词。权重最低的一种，是把一个四个字母以上的单词里相邻的两个字母对调。替换时保留原词的首字母大写。

## 一句话的一趟路

用测试里的例句“想去看看海，看它到底有多大”，种子 1，每一站都点“是这样”：

| 地点 | 这一站的改动 | 这一站的说法 |
| --- | --- | --- |
| 出发 | | 想去看看海，看它到底有多大 |
| 茶寮 | 海 → 河 | 想去看看河，看它到底有多大 |
| 驿站 | 丢掉一个“看”；想去 → 打算去 | 打算去看河，看它到底有多大 |
| 桥头 | 看 → 望；看 → 望 | 打算去望河，望它到底有多大 |

这个种子是我挑的，三站的说法都读得通。换一个种子，同一句话会走出完全不同的路：1000 个种子走到桥头，一共有 798 种不同的说法，没有一次原封不动。

## 刷新以后，还是同一句

随机数是带种子的 mulberry32。每一趟开始时取一个随机种子存进存档，每一站再从它派生出自己的种子：

```ts title="src/game.ts"
private randomFor(run: Run): Random {
  return new Random(run.seed + run.stage * 0x9e3779b1);
}
```

0x9e3779b1 是 2654435761，一个接近 2<sup>32</sup> ÷ φ 的质数（φ 是黄金分割比，约 1.618）。

转述一生成就写进存档，然后才显示出来：

```ts title="src/game.ts"
if (run.rumor === undefined) {
  run.rumor = drift(run.carried, DRIFT_STEPS[id], this.randomFor(run));
  this.store.saveRun(run);
}
```

所以玩家在茶寮刷新页面，回来听到的还是同一句。

确定性也让测试好写。`drift_test.ts` 里的测试大多不是“输入 A 应该得到 B”，而是把同一句话跑 300 个种子，检查某个性质每次都成立：

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

同样的写法还检查了：“回家”能变成“回乡”，但不会变成“去家”；“想起回忆”能被听成“想起会议”，但不会变成“想起去忆”。

## 山顶：按最长公共子序列对照

山顶要比较三句话：出发时写的（原句）、一路传下来的（路上那句）、现在记得的。比较之前先把句子切成词：中文一个字算一个词，英文按单词；标点、空格和大小写都不算，`don't` 和 `don’t` 也算同一个词。所以“想去看看海。”和“想去看看海”算一字不差。

两句话按词求最长公共子序列（LCS）。在 LCS 里的词标成“保留”，前一句里不在 LCS 里的标成“丢失”，后一句里不在 LCS 里的标成“添加”，图 1 里的点线和波浪线就是这么来的。分数这样算：

```ts title="src/compare.ts"
const total = x.length + y.length;
return {
  before: a.map((part, k) => markOf(part, keptA.has(k), 'lost')),
  after: b.map((part, k) => markOf(part, keptB.has(k), 'added')),
  similarity: total === 0 ? 1 : (2 * keptA.size) / total,
};
```

也就是 2 × LCS ÷ (m + n)，m 是原句的词数，n 是另一句的词数。“想去看看海”和“想去看湖”的 LCS 是“想去看”，3 个字，分数是 2 × 3 ÷ (5 + 4)，约 0.67。

### 这个分数就是 ROUGE-L

代码注释里管它叫“LCS 上的 Dice 系数”。换个角度看：把记得的那句当成候选、原句当成参考，精确率 P = LCS ÷ n，召回率 R = LCS ÷ m，两者的调和平均是 2PR ÷ (P + R) = 2 × LCS ÷ (m + n)，正是取 β = 1 时的 ROUGE-L[^2]。做过摘要或 RAG 评测的人对这个指标不会陌生：它在那里量的是模型的输出和参考答案有多像，在这里量的是一个人的记忆，和他出发时写下的那句话有多像。

### 六种评语

分数本身从不显示。玩家在山顶看到的，是图 1 那样的三行对照和最后一句评语；分数只在背后用来挑评语，另外随这一趟存进浏览器的历史里。

| 评语 | 什么时候给 |
| --- | --- |
| 一字不差。你还记得。 | 和原句的分数是 1 |
| 你记住的，是路上的人说的那一句。 | 记得的里面有路上添的词，而且和路上那句的分数不低于和原句的 |
| 你记得大半。可有的字，已经换成了路上的说法。 | 和原句的分数不低于 0.7，但混进了路上添的词 |
| 你记得大半。有几个字，留在了路上。 | 和原句的分数不低于 0.7 |
| 你只记得一点。剩下的，路替你改了。 | 和原句的分数不低于 0.35 |
| 你忘了。可你还是走到了这里。 | 其余情况 |

判断的顺序就是表格的顺序：

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

关键是 `repeatsRumor`：记得的那句里，有没有路上添的、玩家自己从没写过的词。

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

它做了两次对齐：原句对路上那句，标出哪些词是路上添的；路上那句对记得的那句，标出哪些词被记住了。两次对齐里，路上那句都按同一种方式切词，下标一一对应，把两组标记按位置并起来，就知道有没有哪个路上添的词被记住了。

所以光是离路上那句更近，还不算“记住的是路上那句”。如果路上只丢了字、没有添字，就怪不到路上头上：原句“想去看看海，看它到底有多大”，路上只剩“去看”，山顶写“想去看海”，和路上那句的分数（0.67）比和原句的（0.5）高，判的仍然是“只记得一点”。

原句不变，路上那句换成“要去瞧瞧湖，看它有多大”，山顶写下不同的句子时，分数和评语是这样的：

| 山顶写下的 | 和原句 | 和路上那句 | 评语 |
| --- | ---: | ---: | --- |
| 想去看看海，看它到底有多大 | 1 | 0.55 | 一字不差 |
| 想去看看湖，看它有多大 | 0.82 | 0.70 | 记得大半，混进了路上的说法 |
| 要去瞧瞧湖，看它有多大 | 0.55 | 1 | 记住的是路上那句 |
| 要去看看湖 | 0.35 | 0.40 | 记住的是路上那句 |

图 1 那一趟也可以这样算。原句“想去看看母亲常说的那片海”12 个字，路上那句“想看妈妈说的片湖”8 个字，山顶写的“想去看看妈妈说的那片湖”11 个字。和原句的 LCS 是“想去看看说的那片”，8 个字，分数 16 ÷ 23，约 0.696，差一点到 0.7；和路上那句的 LCS 是整句“想看妈妈说的片湖”，也是 8 个字，分数 16 ÷ 19，约 0.84。“妈妈”和“湖”是路上添的，于是判成“你记住的，是路上的人说的那一句”。

## 跑了上千个种子以后

写这篇文章时，我用游戏自己的代码把几句话各跑了 300 到 1000 个种子，记下每一次改动属于哪一种。规则基本按设计在工作：例句“想去看看海，看它到底有多大”里没有可以听岔的词，换说法和丢字约占 62.5% 和 37.5%，正好是 5 : 3。但也看到了几个问题，游戏里都还没改。

### 不看词界

`dropChar` 可能丢掉句子里的任何一个字，不管它是不是一个词的一半。在例句上跑 1000 个种子，一共丢了 1876 次字，其中 1249 次（三分之二）落在一个多字词里[^3]。有的无伤大雅，“看看”丢一个字还是“看”；有的就不像人话了。种子 0 的一趟：

> 想去看看海，看它到底有多大\
> → 想去看看海，它到底有多大\
> → 想去看一眼海，它到底有多大\
> → 想去看一海，它到底有多大\
> → 要去看一海，它到底有多大\
> → 要去看一湖，它到底有多大

“看一眼”丢掉“眼”，成了“看一海”。同样的情况还有“打算”只剩“打”或“算”，“到底”只剩“底”。人转述时会漏掉整个词，却很少让一个词只剩半截。

替换也有同样的毛病。单字的替换会先问分词器，多字的换说法和听岔却只按字面找。“我想成为了不起的人”里，“成为”的“为”和“了不起”的“了”连起来，正好是表里的“为了”：跑 1000 个种子，有 619 趟在茶寮就听到了“我想成因为不起的人”。

英文按整词丢，不会丢半个词，可也不管丢的是哪个词：I want to see the sea 走到桥头，可能只剩 I want to the 这样的残句。

### 改动会叠在一起

每一步只看当前这句话，不记得哪个词刚被改过，几次改动就可能叠成一个谁也不会说的词。“梦想”跑 300 个种子，有 179 个停在“念要”：先被说成“念想”，分词器把“念想”切成“念 / 想”，“想”成了一个单独的字，又按“想 → 要”换掉。英文也一样，see 先被听成 sea，sea 再被换成 lake：

> I want to see the sea before I turn thirty\
> → I want to see the lake before I turn thirty\
> → I want to sea the lake before I turn thirty\
> → I want to lake the lake before I turn thirty

### 词表以外的句子

规则只认识表里的词。一句话一个都没命中时，能用的只剩丢字（英文是丢词和对调字母）：

- “吃饭”跑 300 个种子，一次都没变过：丢一个字就只剩一个词，下限不允许。路上三个人都原样复述。
- “我要吃火锅”跑 1000 个种子，走到桥头时每一次都被磨到只剩两个字：“吃锅”“要锅”“我火”“我锅”……
- “eat noodles”只有两个词，连丢词也用不上，改动全是对调字母，到桥头成了 eat nodoles 这样的拼法。听岔的词表特意挑了两边都是真词的，免得读起来像错别字；可词表帮不上忙时，剩下的恰恰就是错别字。较长的英文例句 I want to see the sea before I turn thirty 也有 11.6% 的改动是对调字母（tunr、wnat、befoer）。

### 评语偏向路上那句

分数要除以两句话的总长度，而路上那句经过丢字和渡口，通常比原句短。同样记住 8 个字，对着短的那句分数就更高，图 1 那一趟就是这样。

分数相同时，也算给路上：原句“我想去看海”，路上传成“我要去看湖”，山顶写“我想去看湖”，和两句的分数都是 0.8，判的是“记住的是路上那句”。这里“记得大半，混进了路上的说法”其实更贴切。

### 可以怎么改

- 丢字改成按 `Intl.Segmenter` 切出来的词整个丢，或者只丢单字词；
- 多字的换说法和听岔也对照 `Intl.Segmenter` 的词界，匹配到的字不能一半在前一个词里、一半在后一个词里；
- 同一个词在一趟里只改一次，避免“听岔”之后再“换说法”；
- 英文去掉对调字母，丢词只丢 really、just 这类拿掉也通顺的词，词表帮不上忙时宁可原样转述；
- 分数相同时不算给路上（`>=` 改成 `>`），按和原句的分数往下判，上面那个 0.8 的例子就会判成“混进了路上的说法”；或者干脆不比分数，改看记得的那句里有多少词是路上添的。

## 小结

用规则做转述，换来的是三样东西：玩家写的字不离开浏览器，转述能按种子复现，每一种走样都能写成测试。代价是它只认识词表里的词。这一点，连同丢字和替换不看词界、改动会叠在一起这些规则没顾到的地方，都要跑足够多的种子才看得清楚。

山顶的分数是 ROUGE-L。同一个公式，在评测里给模型的输出打分，在这里给人的记忆打分。游戏最后会问你一句：当你的旅程抵达终点后，你还会记得你为何而出发吗？想知道自己的答案，可以去[走一趟](https://weiguang-2099.github.io/road-we-came/)。

[^1]: 例子和统计是在 Node.js 24.21（ICU 78.3）里跑的，种子的派生方式和游戏里一样。`Intl.Segmenter` 的中文分词依赖引擎自带的词典，不同浏览器的结果可能略有不同。

[^2]: Chin-Yew Lin 在 2004 年的论文 *ROUGE: A Package for Automatic Evaluation of Summaries* 中提出了 ROUGE-L。论文里的 F 值是 F = (1 + β<sup>2</sup>)RP ÷ (R + β<sup>2</sup>P)，β = 1 时就是 P 和 R 的调和平均。

[^3]: 判断方法：对每一次丢字，用 `Intl.Segmenter` 切分丢字之前的句子，看被丢的字所在的词是不是不止一个字。
