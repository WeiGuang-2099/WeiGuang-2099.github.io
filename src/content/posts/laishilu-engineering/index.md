---
title: "纯静态小游戏的工程清单：《来时路》的存档、输入、排版和发布"
description: "《来时路》没有后端，玩家写的字也不离开浏览器。这一篇把它在工程上照顾到的细节整理成一份清单：存档和刷新，怎样让测试走完一整趟旅程，中文输入法和手机键盘，竖排的经卷和字体，浏览器里合成的风声，双语的链接预览，每次都一样的 zip，不收集文字的访问统计，以及 Dependabot 和 CI 的设置。"
pubDate: 2026-11-25 22:00:00
category: projects
tags: ["laishilu", "game-dev", "frontend", "typescript", "testing", "ci"]
---

[《来时路》](https://weiguang-2099.github.io/road-we-came/)是一个五分钟左右的浏览器小游戏：出发前，你写下一句理由；路上的茶寮、驿站、桥头各有一个人把它转述给你听，传着传着就走了样，你可以认下，也可以纠正；渡口的船夫不收钱，要你从这句话里交出一个字；到了山顶，你凭记忆把它写在一卷空白的经上，游戏再把三句话放在一起对照。再走一次，路上的人会换一套台词认出你。它的设计和转述规则另有两篇：[设计篇](/posts/laishilu-design/)和[转述篇](/posts/laishilu-drift/)。这一篇讲剩下的工程细节，大多是些不显眼、但不做就会出问题的地方。

整个游戏就是一个纯静态的网页：TypeScript 加 Vite，没有前端框架，也没有后端，部署在 GitHub Pages 上，也能打包成 zip 上传 itch.io。玩家写的字只存在浏览器里。源码在 [GitHub](https://github.com/WeiGuang-2099/road-we-came) 上。下面分几个方面整理成一份清单。

## 存档

### 只在定局时存档

一趟路分七个阶段：出发、茶寮、驿站、桥头、渡口、山门、山顶。前五个阶段都要等玩家的选择定下来，才调用一次 `advance`；山门没有要选的，一进门就调用；山顶不调用它，写完直接把这一趟存进历史，再清掉进行中的存档。`advance` 只做两件事：

```ts title="src/game.ts"
private advance(run: Run): void {
  run.stage += 1;
  this.store.saveRun(run);
}
```

所以走到半路刷新页面，标题页上会出现“继续上路”和“重新出发”；选“继续上路”，就从第一个还没定局的阶段接着走。各站的转述是个例外：它在显示之前就先存进存档（[转述篇](/posts/laishilu-drift/)里讲过），所以在茶寮刷新，回来听到的还是同一句。

### 键名带前缀

```ts title="src/save.ts"
// Every GitHub Pages project site under one account shares an origin, and so
// shares localStorage. All keys carry this prefix to stay out of each other's
// way.
const PREFIX = 'laishilu:v1:';
```

同一个 GitHub 账号下的 Pages 站点共用一个域名：这个博客和《来时路》都在 `weiguang-2099.github.io` 下，对浏览器来说是同一个 origin，localStorage 也是同一个。所以《来时路》的每个键都带 `laishilu:v1:` 前缀。

### 存不了也能玩

- 打开时先试着写一个探测用的键，写不进去（隐私模式、存储满了、被禁用），就当作没有存储。
- 每一次读写都包在 try/catch 里，出错就吞掉：游戏照常玩，只是不再记得。
- 读出来的数据先检查形状（`isRun`、`isJourney`；进行中那一趟的存档还要求 `version` 是 1），对不上的当作没有，不会因为一份坏存档卡住。
- 切换语言时，选的语言既存进 localStorage，也写进网址的 `?lang=`；存储不可用时，网址也能带着它。

## 测试：让一个假页面走完整趟旅程

`Game` 不直接依赖画页面的 `View` 类，而是依赖一个 `GameView` 接口；对声音，它也只要求有一个 `start()` 方法。这样，测试里声音传一个空的 `{start() {}}` 就行，`View` 则换成一个按脚本作答的假页面 `ScriptedView`。它记下每一行台词、每一组按钮、每一次转述、走过的地方和山顶的对照；脚本里的回答用完了，游戏就停在那一步等着，就像玩家把页面开着没动。

在这个基础上，最有用的一组测试是“刷新”。一趟路上要等玩家操作十几次，这组测试挑了其中 8 处停下：写完理由以后、茶寮等回答时、驿站等玩家自己重说时、桥头答完以后、渡口挑字时、把字交给船夫以后、走到山门时、山顶写字之前。然后用同一份存储重新打开游戏，走完剩下的路，再和一趟没被打断的旅程比：

```ts title="src/game_test.ts（简化后）"
it.each(RELOADS)('picks up the journey $when', async ({played, resumes}) => {
  const whole = await play(new MemoryStorage(), WHOLE_JOURNEY);
  const storage = new MemoryStorage();
  const first = await play(storage, [pick(TITLE.start), ...played]);
  const second = await play(storage, [pick(TITLE.resume), ...from(resumes)]);

  expect(second.road).toEqual(whole.road);
  expect(second.rows).toEqual(whole.rows);
  // A station shown again repeats the rumor it showed before.
  expect([...new Set([...first.rumors, ...second.rumors])]).toEqual(
    whole.rumors,
  );
  expect(new SaveStore(storage).loadHistory()).toHaveLength(1);
});
```

走过的地方要一样，山顶的对照要一样；刷新前后听到的转述合起来、去掉重复以后，要和没刷新的那一趟一样；历史里也只能有一趟。`Math.random` 在这组测试里被固定成 0.5，所以每一趟的种子都相同。

关于测试，还有几条：

- `script_test.ts` 检查英文文案里除了印章，没有漏翻的中文；每一站的每一套台词开头都不一样；每一句转述都引用了玩家的理由。
- 中文和英文各走一整趟。
- 测试文件和源码放在一起，叫 `*_test.ts`。写这篇时一共有 79 个测试，推到 main 和每个 PR 上都会跑。

## 输入

### 中文输入法的回车

```ts title="src/view.ts"
input.addEventListener('keydown', event => {
  // While an IME is composing, Enter picks a candidate instead of
  // submitting. Safari still reports keyCode 229 for that press.
  if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) {
    return;
  }
  event.preventDefault();
  form.requestSubmit();
});
```

用拼音输入法打字时，回车是用来上屏的，不能当成提交。`isComposing` 能分辨这种回车，Safari 还要再看 `keyCode` 是不是 229。游戏仓库的 [README](https://github.com/WeiGuang-2099/road-we-came#readme) 里专门留了一句：以后换引擎或重写界面，也别改成在 canvas 里自绘的输入框。自绘的输入框很难接好系统的输入法。

### 输入框和提示

- 输入框随着字数长高，而不是在框里滚动。
- 回车就是提交，所以设了 `enterKeyHint = 'done'`，提示手机键盘把回车键显示成“完成”（有的键盘显示成一个对勾）。
- 框里空着时，按钮按不了；写了东西但字数不够时（只写标点不算字），按钮照样能按，按下去，输入框下面出现“再多写几个字。”放这句提示的元素设成了 `aria-live`，没有提示时也一直留在页面上，只是不占地方：live 区域要先在页面上、再往里填字，读屏软件才能稳定地读出来。

## 排版

### 竖排的经卷

写的字里有汉字时，山顶的经卷是竖排的；一个汉字也没有时（英文版通常是这样），改成横排。第一版的经卷有个 bug：字一多，超出一列的部分就跑出纸的左边，压到印章底下（在提交 [be06ffb](https://github.com/WeiGuang-2099/road-we-came/commit/be06ffbadc5ba1df1ddaa1287c8653bc84798430) 里修好）。原因在于纸本身是一个横排的盒子，里面放的却是竖排的字：纸先空着排好，字后来才一个一个加进去，浏览器不会按列数把纸撑宽，纸一直停在最小宽度。修法分三步：

- 纸本身也改成竖排，列数越多，纸越宽；
- 所有字先占好位置，再一个一个上墨，纸一次就定在最终的大小，不会每多一列就往旁边挪一下；
- 窄屏上放不下那么多列时，把纸拉高，让每一列多装几个字。

### 字体

玩家写的字、转述里的那句话，还有地名、游戏名和最后那个问题，都用楷体。楷体用的是霞鹜文楷（npm 包 `lxgw-wenkai-webfont`，字体按 SIL OFL 1.1 授权）。用网络字体而不是系统自带的楷体，是为了让每台设备，包括手机，看到的都是同一种楷体。中文字体文件很大，这个包按 unicode-range 拆成了 97 块，浏览器只下载页面上真正出现的字所在的那几块。玩家会写什么字，事先不知道；写到哪个字，再下载哪一块。

### 标点、颜色和动效

- 对白开头的“「”悬挂在左边，折行以后的字和第一行引号后面的字对齐。
- 山顶对照里丢掉的字，用的本来就是偏灰的颜色，第一版又叠了一层半透明，读起来太淡；后来去掉了半透明，只留那个颜色，和背景的对比度大约 5 : 1。
- 深色模式重新定义了颜色变量，浏览器顶栏的 theme-color 也有深色的一份。
- 系统打开了“减少动态效果”时，动画都缩到 1 毫秒，代码里为动画留的等待也跳过。

## 声音：不带一个音频文件

```ts title="src/ambience.ts"
// A slow wobble on the cutoff reads as gusts.
const gust = context.createOscillator();
gust.frequency.value = 0.07;
const gustDepth = context.createGain();
gustDepth.gain.value = 260;
gust.connect(gustDepth).connect(filter.frequency);
```

风声是用 WebAudio 现场合成的：一段 4 秒的棕噪声循环播放，经过一个 520 Hz 的低通滤波器；再用一个 0.07 Hz 的振荡器让截止频率在 260 到 780 Hz 之间慢慢起伏，大约 14 秒一个来回，听起来就是一阵一阵的风。底下垫着 98 Hz 和 147 Hz 两个正弦波，正好差一个纯五度。所以游戏里没有任何音频文件。

- 浏览器不允许页面在用户操作之前出声，所以 AudioContext 在第一次点击时才创建。
- 页面切到后台时暂停，回来再继续。
- 浏览器不支持 WebAudio 也没关系：出错就不出声，游戏照常。

## 语言和链接预览

- 语言的选择顺序：网址里的 `?lang=`，然后是玩家上次手动选的，然后是浏览器的语言偏好（只认中文和英文），都没有就用英文。
- 链接预览的卡片是抓取网页的爬虫生成的，爬虫不运行脚本，用不上上面的语言选择。所以卡片只有一张，中英双语：标题中文在前（“来时路 · The Road We Came”）；描述英文在前，这样预览被截短时，英文读者也能读到英文。
- 卡片图片是 `scripts/og.html` 这一页的截图，用本机的 Chrome 或 Edge 以无头模式截下来（`npm run og`），不用安装任何浏览器相关的 npm 包。`--virtual-time-budget=5000` 让浏览器等字体加载完再截；每次用一个临时的用户目录，不影响已经开着的浏览器。同一页加上 `?cover`，截出来就是 itch.io 的封面。

## 发布

- Vite 的 `base` 设成 `'./'`，构建出来全是相对路径：同一份构建放在任何名字的 Pages 仓库下都能用，也能在 itch.io 的 iframe 里运行。
- itch.io 的嵌入视口设成 960 × 720，还要勾上 Enable scrollbars：山顶那一页比 720 像素高，不勾就看不到下面的对照。

上传 itch.io 的 zip 是用自己写的脚本打包的，只用 `node:zlib` 的 `crc32` 和 `deflateRawSync`，没有加依赖：

```js title="scripts/zip.mjs"
// Every entry is dated 1980-01-01, the earliest DOS date, so the same build
// always zips to the same bytes.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
```

- 所有文件的日期都写成 1980-01-01，这是 zip 用的 DOS 日期能表示的最早一天；文件按路径排序，不依赖目录读出来的顺序。日期和顺序都固定下来，同一份构建每次打出来的字节就完全一样。
- 字体和图片本来就压缩过，压不小的就原样存进去。
- 文件名用 UTF-8，路径分隔符统一成 `/`，在 Windows 上打的包也一样。

## 访问统计：只数两件事

```ts title="src/stats.ts"
// A fixed version of GoatCounter's script, checked against its published
// hash. It runs on the same page as the player's words, so the browser must
// refuse anything else that turns up at this address.
const SCRIPT = 'https://gc.zgo.at/count.v5.js';
const SCRIPT_HASH =
  'sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ';

/** What the game tells the visit counter. Never anything the player wrote. */
export interface Stats {
  /** A journey reached the summit. */
  reachedSummit(): void;
}
```

统计用的是 GoatCounter，它不用 cookie，也不收集个人信息。游戏只告诉它两件事：游戏打开了，有一趟走到了山顶。前一件不用专门调用，GoatCounter 的脚本加载后会自己记一次访问；后一件才要游戏主动报，所以 `Stats` 接口只有一个 `reachedSummit()`，不接收任何参数，玩家写的字从类型上就传不过去。

- 统计脚本是第三方的，却和玩家写的字跑在同一个页面里，所以固定用 `count.v5.js` 这个版本，并带上完整性校验（SRI）：这个地址上的文件一旦被换掉，浏览器就拒绝执行。
- 每次访问记成“网站/语言”（比如 `weiguang-2099.github.io/en`），GitHub Pages 和 itch.io、中文和英文分得开。itch.io 把游戏放在 iframe 里，而 GoatCounter 的脚本默认不数 iframe 里的访问，所以 `stats.ts` 里给它打开了 `allow_frame`。
- “走到山顶”是在这一趟记进历史、进行中的存档清掉以后才数的，所以在山顶刷新，不会把同一趟数两次。测试里专门检查了这一点。
- 在 localhost 上打开不计数；被广告拦截器拦下也不计数，游戏照常玩。

## 依赖和 CI

- `deploy.yml` 在推到 main 时运行：lint、测试、构建，然后发布到 GitHub Pages。它只在 main 上跑，Dependabot 开的 PR 就没人检查，所以又加了一个 `check.yml`，在每个 PR 上跑同样的检查。
- 两个工作流默认只有读权限，只有发布那一步能写 Pages；checkout 时也不留下凭据（`persist-credentials: false`）。
- TypeScript 锁在 `~6.0.3`，Dependabot 也只让它收补丁更新：typescript-eslint 目前只支持低于 6.1 的版本。
- `package.json` 里用 `overrides` 让 typescript-eslint 用上修过安全问题的 minimatch，等它自己升级依赖以后再删掉。

Dependabot 每月检查一次 npm 包和 GitHub Actions：

```yaml title=".github/dependabot.yml（节选）"
# Waits a week after a release, so versions that are pulled or turn out to
# be compromised are skipped. Security updates do not wait.
cooldown:
  default-days: 7
```

新版本发布满 7 天才提 PR，避开刚发布就被撤回或者后来发现被投毒的版本；安全更新不用等。npm 包的小版本和补丁合成一个 PR，大版本各开一个，可以先搁着不合；GitHub Actions 的更新不分大小版本，合成一个 PR。

## 小结

这些细节单独看都不大。合在一起，才让一个五分钟的小游戏可以放心交给陌生人玩：刷新不丢进度，存不了也能玩，输入法不出错，写下的字不离开浏览器。
