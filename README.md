# Dawning

缉熙（Dawning）的个人技术博客，记录 RAG、多智能体编排和 LLM 应用工程方面的笔记。

- 线上地址：<https://weiguang-2099.github.io>（英文版：<https://weiguang-2099.github.io/en/>）
- 源码：<https://github.com/WeiGuang-2099/WeiGuang-2099.github.io>

站点用 Astro 构建，从官方 minimal 模板起步，页面、布局和样式全部手写：没有博客主题，没有 UI 组件库，没有前端框架。设计方向叫“界”（ruled lines）：一本像中文书那样排版、像工程图那样标注的技术笔记。人写的内容用衬线体（思源宋体 / Source Serif），构建时测出来的数值（日期、阅读时长、篇数、小节编号、代码）用等宽体。阅读时长画成工程图里的尺寸线：一篇文章是一个 span，阅读时长是它的 duration，文章目录就是这篇文章自己的瀑布图。界面只用墨色和纸色，彩色只用来表示主题（rag、agents、llm-apps，用石绿、赭石、石青三种矿物颜料色）；唯一的例外是首页那方朱红的印章。

## 本地开发

需要 Node.js 22.12 或更高版本（CI 使用 Node 24）。

```sh
npm install        # 安装依赖（package-lock.json 需要提交，CI 里 withastro/action 按它安装依赖）
npm run dev        # 本地预览，默认 http://localhost:4321 ，草稿也会显示
npm run build      # 生成静态站点到 dist/（先停掉 dev）
npm run preview    # 预览 dist/ 里的构建结果
npm run check      # 类型检查（astro check，同样先停掉 dev）
npm run translate  # 用 DeepSeek 把还没有英文版的文章翻译成英文（见下面的“英文版”）
```

想严格按 `package-lock.json` 安装（和提交的版本完全一致）可以用 `npm ci`。

`npm run dev` 运行时不要同时执行 `npm run build` 或 `npm run check`：它们和 dev 共用 `.astro/` 里的生成文件，会把草稿从中去掉，dev 里会出现 500 错误（有 `.mdx` 草稿时）或草稿图片丢失。先按 Ctrl+C 停掉 dev 再构建；已经出错时重新运行 `npm run dev` 即可。

## 目录结构

```text
.github/workflows/deploy.yml   GitHub Pages 部署
public/                        原样复制的文件：favicon、og.png（社交分享图）、robots.txt
scripts/translate.ts           npm run translate：调用 DeepSeek 生成英文版
scripts/glossary.md            翻译用的术语表
src/content.config.ts          文章集合（posts）、英文版集合（translations）的定义和 frontmatter schema
src/content/posts/             文章（英文版 index.en.md 放在原文旁边）
src/content/drafts/            草稿（不进仓库，只在 npm run dev 里显示，需要时自己建）
src/pages/                     路由：中文版的首页、文章、归档、标签、About、404、RSS
src/pages/en/                  路由：英文版的同一套页面
src/views/                     页面内容：每个页面只写一份，中文和英文路由共用
src/layouts/BaseLayout.astro   页面骨架：<head>（SEO、Open Graph、hreflang、字体）、页眉、页脚、主题切换
src/components/                页眉（语言切换）、文章列表、目录瀑布图、标签等组件
src/lib/                       数据整理：文章和它的英文版、主题泳道、阅读时长、坐标轴、日期格式；界面文字（ui.ts）
src/plugins/                   Markdown 插件和代码高亮主题（构建时运行）
src/styles/global.css          全部样式（颜色变量、排版、布局、组件、深色模式）
```

## 写一篇文章

### 文件放在哪里

文章放在 `src/content/posts/`，支持 Markdown（`.md`）和 MDX（`.mdx`），两种目录结构都可以：

```text
src/content/posts/my-post.md            -> /posts/my-post/
src/content/posts/my-post/index.md      -> /posts/my-post/
src/content/posts/my-post/figure.png       （和文章放在一起的图片）
```

文件名（或文件夹名）就是网址里的 slug，按 GitHub 标题锚点的规则转换：转成小写，空格变成 `-`，大部分标点（`.`、`&`、`(`、`)`、`+` 等）会被删掉，中文保留。例如 `RAG & Agents v1.2.md` 会变成 `/posts/rag--agents-v12/`，所以文件名最好只用小写字母、数字和 `-`。frontmatter 里写了 `slug` 时以它为准。有图片的文章建议用文件夹结构，图片和 `index.md` 放在同一个文件夹里，用相对路径引用。

### frontmatter

```yaml
---
title: "文章标题：副标题"
description: "一两句话的摘要，用在列表、RSS 和社交分享卡片里。"
pubDate: 2026-10-03
updatedDate: 2026-10-10
tags: ["rag", "retrieval"]
draft: false
lang: zh-CN
---
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 必填 | 标题。标题里的冒号（全角“：”或英文“: ”）是换行点，窄屏上会在冒号后面换行。 |
| `description` | string | 必填 | 摘要，同时作为页面的 meta description。 |
| `pubDate` | 日期 | 必填 | 发布日期，写成 `2026-10-03`（同一天有多篇时可以加时间，见表格下面）。 |
| `updatedDate` | 日期 | 无 | 更新日期，填了才会在文章页显示 “Updated”。 |
| `tags` | string[] | `[]` | 标签。每个标签都有自己的页面 `/tags/<标签>/`（小写，空格变 `-`，中文保留）。 |
| `draft` | boolean | `false` | 草稿只在 `npm run dev` 里显示，不会出现在正式构建的任何页面、RSS 和 sitemap 里。但文件本身仍在公开仓库里，见下面的“草稿”。 |
| `lang` | string | `zh-CN` | 正文的语言，也决定中文标点和字体的处理方式。`zh-CN` 的文章属于中文版；直接用英文写的文章写 `en`，它属于英文版，发布在 `/en/posts/<slug>/`。 |
| `slug` | string | 无 | 网址里的 slug，不写就由文件名生成（见上面）。 |

- 标题只写在 frontmatter 的 `title` 里，正文从 `##` 开始，不要再写 `#` 一级标题：页面已经把 `title` 显示成唯一的一级标题。Typora、Obsidian 等编辑器习惯在第一行写 `# 标题`，记得删掉。
- 同一天发布的多篇文章按标题排序。想指定先后，就给 `pubDate` 加上时间，例如 `pubDate: 2026-10-05 20:00:00`（不加引号）。时间只用来排序，不要写时区：日期按 UTC 显示，写成 `2026-10-05T07:00:00+08:00` 这样的值会显示成前一天。

### 草稿

还没写完的文章放在 `src/content/drafts/`（文件夹需要自己建），目录结构和 frontmatter 都和 `posts/` 一样：

```text
src/content/drafts/my-post.md           -> /posts/my-post/（只在 npm run dev 里）
src/content/drafts/my-post/index.md     -> /posts/my-post/（只在 npm run dev 里）
```

- 这个文件夹写在 `.gitignore` 里，不会被提交，所以草稿永远不会出现在公开的 GitHub 仓库里；
- `npm run dev` 会把草稿和正式文章一起列出来，草稿带 `Draft` 标记，阅读时长线画成虚线；
- `npm run build` 和 GitHub Actions 根本不读这个文件夹；
- 草稿的 frontmatter 也必须完整（必填字段一个都不能少），否则 `npm run dev` 无法启动，错误信息会指出是哪个文件；
- 写完以后，把文件（或整个文件夹）移到 `src/content/posts/` 就是发布，`npm run dev` 开着时也可以直接移动。草稿和正式文章不要用同一个 slug，否则两篇会抢同一个网址；想改写已发布的文章，直接改 `posts/` 里的文件，不要在 `drafts/` 里放同名副本。

另一种做法是把文章留在 `posts/` 里、在 frontmatter 写 `draft: true`。它同样只在 `npm run dev` 里显示（也带 `Draft` 标记），不会出现在任何页面、RSS 和 sitemap 里；**但文件会和其他文章一起提交，任何人都能在公开仓库里读到它**，它引用的图片也仍会被复制进构建结果、随网站一起发布（只是没有页面链接到它们）。不想公开的内容请用 `drafts/` 文件夹。

### 主题泳道（彩色标记）

站点有三个彩色的主题泳道：`rag`（石绿）、`agents`（赭石）、`llm-apps`（石青）。一篇文章属于哪个泳道，取决于它的 `tags` 里**第一个**出现的泳道标签；一个都没有就归入灰色的 `other`。泳道颜色用在首页和归档的阅读时长线、文章目录的瀑布图，以及该标签前面的小圆点上（`other` 的文章不显示圆点）。

### 阅读时长和目录

阅读时长在构建时由 `src/plugins/remark-reading-time.ts` 从 Markdown 源文件计算，不需要手填：

- 中文按每分钟 350 字，英文按每分钟 220 词；
- 代码块按每分钟 110 个 token（比正文慢一半）；
- 每张图片加 10 秒，图片说明按正文计算；
- 不计 frontmatter、链接地址、图片路径；脚注算在第一次引用它的位置。

页面上显示四舍五入后的整分钟数（至少 1 分钟）。同一次计算也给出每个 h2 到 h4 小节的起点和长度，文章有两个或更多小标题时，右侧（窄屏时在文章开头）会显示目录瀑布图。

文章里的 h2 到 h4 会自动编号（1、1.1、1.1.1），宽屏时编号悬挂在正文左侧的页边里，目录瀑布图用的是同一套编号。所以**标题里不要手写编号**（写 `## 可靠性`，不要写 `## 2. 可靠性`），否则会出现两个编号。

### 代码块

用三个反引号加语言名，`title="..."` 会显示成代码块顶部的文件名：

````md
```python title="rrf.py"
print("hello")
```
````

超过一行的代码块会自动加行号；每个代码块都有 Copy 按钮。高亮用 Astro 内置的 Shiki 和本站自己的两套主题（浅色、深色），跟随主题切换。

### 图片和图注

单独占一段的图片，如果写了标题（引号里的部分），会变成带图注的 figure：

```md
![给读屏软件的替代文字](./figure.png "图 1：图注写在这里。")
```

普通图片（png、jpg、webp 等）由 Astro 自动压缩并生成宽高，还会生成几种宽度的版本（srcset），手机只下载接近屏幕宽度的那一张。照片提交前最好先把长边缩到 2000px 以内：原图会进仓库，原尺寸的那一版也会随网站发布。没有标题的图片保持普通 `<img>`。

### SVG 插图（内联）

和文章放在一起的本地 SVG（相对路径，例如 `./dawn.svg`），如果是专门为本站画的，会在构建时直接内联进页面，而不是用 `<img>` 引用。这样 SVG 可以使用站点的 CSS 变量和字体，跟随深色模式和手动切换。只有同时满足下面三个条件的 SVG 才会内联：

- 至少用到一个 CSS 变量（文件里出现 `var(--`）；
- 没有 `<style>` 元素（内联以后它会影响整个页面的样式）；
- 没有 `id`（同一页面里的多张图会互相冲突）。

其余的 SVG，比如 Illustrator、draw.io、matplotlib 导出的图，按普通图片显示。写了图注的会放进白底的 figure，深浅色模式下都和导出时一样，所以导出的图最好写上图注。

写可以内联的 SVG 时请注意：

- 颜色用 CSS 变量，并给出浅色模式的兜底值，例如 `style="fill: var(--ink, #1B222B)"`；可用的变量见 `src/styles/global.css` 顶部（`--ink`、`--muted`、`--rule-strong`、`--sky-1` 到 `--sky-3` 等）；
- 不要用渐变；
- 替代文字写在 Markdown 的 `![...]` 里，会成为 SVG 的 `aria-label`；
- 文字字号保持在 12px 以上，确保手机上可读。可以参考 `src/content/posts/hello-world/dawn.svg`：它没有 viewBox，横向位置用百分比，所以文字不会随宽度缩小。带 viewBox 的 SVG 会按比例整体缩放，文字也跟着变小。

修改 SVG 后，构建和开发服务器都会重新渲染文章（见 `src/lib/inlined-svgs.ts`）。如果在 `.mdx` 文章里内联 SVG，开发服务器需要重启才能看到改动。

### MDX

`.mdx` 文章和 `.md` 使用同一套插件，可以在正文里使用组件或 JSX。

构建 `.mdx` 文章时，终端里可能出现一条 `[MODULE_LEVEL_DIRECTIVE] "use astro:head-inject" ... may not be preserved` 警告。它来自 Astro 自身，不影响页面（组件的样式照常进入 `<head>`），可以忽略。

### 维护提示

Hello World 一文里的 `src/content.config.ts` 代码块是这个文件的原样拷贝，修改 schema 时请同步更新（之后 Hello World 的英文版会过期，用 `npm run translate -- hello-world` 重新翻译）。

渲染好的文章缓存在 `node_modules/.astro/` 里（CI 里 withastro/action 也会恢复这份缓存），Astro 只在文章本身的 Markdown 改动时才重新渲染它。为此 `src/lib/inlined-svgs.ts` 会在 `src/plugins/`、`astro.config.mjs`、`package-lock.json` 或文章目录里的 SVG 改动后，让所有文章在下一次构建时自动重新渲染；开发服务器要重启才会用上改过的插件。如果别处的改动也影响文章的渲染结果，先删除 `node_modules/.astro/` 再构建。

## 英文版

站点有两个版本：中文版在原来的网址（`/`、`/posts/<slug>/`），英文版在 `/en/` 下（`/en/`、`/en/posts/<slug>/`）。页眉右上角的语言按钮（中文页上是 `EN`，英文页上是 `中`）在两个版本的同一页面之间切换。界面文字在 `src/lib/ui.ts`，首页介绍和 About 的长段落在 `src/views/` 里，中英文各一份。日期、阅读时长等测量值在两个版本里写法相同（`2026-10-05`、`12 min`）。

### 英文版的文章从哪里来

文章只用中文写。英文版是放在原文旁边的另一个文件，由 `npm run translate` 调用 DeepSeek API 生成，和原文一起提交：

```text
src/content/posts/ddia-03/
  index.md            中文原文
  index.en.md         英文版（脚本生成，可以手改）
  lsm-tree.svg        插图
  lsm-tree.en.svg     插图的英文版（只替换了图里的中文标签）
```

`index.en.md` 的 frontmatter 只有三项：`title`、`description`（英文标题和摘要）和 `sourceHash`（翻译时中文原文的标题、摘要和正文的指纹，用来判断英文版是否过期）。发布日期、标签和草稿状态都跟着中文原文走，不用写两遍。

还没有英文版的文章也会出现在英文版的列表里：标题前有一个“中文”标记，链接指向中文原文，这篇文章页上的语言按钮画成虚线、不能点。英文版的文章信息栏里有一行 “Translated from”，链回中文原文。

### 配置

在项目根目录建一个 `.env` 文件（已经写在 `.gitignore` 里，不会提交）：

```sh
DEEPSEEK_API_KEY=sk-...
# 可选：
# TRANSLATE_MODEL=deepseek-flash                 默认是 deepseek-v4-pro
# TRANSLATE_BASE_URL=https://api.deepseek.com    换成其他兼容 OpenAI 接口的服务也可以
```

### 翻译

```sh
npm run translate                # 翻译所有还没有英文版的已发布文章，更新英文插图，列出过期的英文版
npm run translate -- ddia-05     # 翻译（或重新翻译）指定的文章，草稿也可以
npm run translate -- --dry-run   # 只列出要翻译什么和大概的费用，不调用 API
npm run translate -- --check     # 手改译文之后，核对每篇英文版的结构是否还和原文一致，不调用 API
npm run translate -- ddia-05 --from <文件>   # 用文件里的译文代替 API 的回复（例如改好的被拒译文），照常核对、写入
```

- 一篇文章整篇一次翻译，前后术语一致。术语表在 `scripts/glossary.md`；翻译规则（Markdown 结构不变、代码原样保留、标题不加编号、括号里给出的英文术语直接用……）写在 `scripts/translate.ts` 的提示词里。哪个词译得不满意，就往术语表里加一行，再重新翻译。
- 写文件之前，脚本会核对标题层级、代码块、脚注、链接、表格行数、段落数和列表项数是否和原文一致；代码块里只有含中文的行（注释、字符串）允许改动。对不上就不写文件，译文存到系统临时目录里，路径会打印出来；改好以后用 `--from` 交回脚本。
- 英文版里指向其他文章的链接会自动改成英文版的地址（`/posts/x/` 变成 `/en/posts/x/`），那篇还没有英文版时保持指向中文。
- 写好以后，脚本列出仍然含有中文的行：引用的古诗可以保留，其余的要看一下。
- 用 `git diff` 审阅译文，可以直接修改，满意了再提交。GitHub Actions 构建时不调用 API，也不需要 key。
- 费用：`deepseek-v4-pro` 翻译一篇一万字左右的文章约 0.5 元；北京时间工作日 9:00 到 12:00、14:00 到 18:00 以外（包括周末和法定节假日）半价。脚本结束时会打印这次的用量和估算费用。

### 中文改过以后

- 中文原文的标题、摘要或正文改过，英文版就过期了：`npm run dev` 和构建会在终端里提示，`npm run translate` 也会列出来。英文版不会被自动覆盖（它可能手改过），需要时运行 `npm run translate -- <slug>` 重新翻译整篇。
- 插图不一样：中文插图改过以后，下一次 `npm run translate` 会重新生成它的英文版，对英文插图的手工调整也会被覆盖。
- 英文标签通常比中文长，可能放不下或者压到别的线条。新生成的英文插图要在浏览器里看一眼，放不下就直接改 `.en.svg`：挪位置，或者换一个更短的说法。

### 草稿

草稿的英文版也放在草稿旁边（`drafts/my-post/index.en.md`），发布时和中文原文一起移到 `posts/`。`npm run translate` 默认不翻译草稿，要翻译时写出它的名字：`npm run translate -- my-post`。

## 部署

站点部署在 GitHub Pages，仓库名是 `WeiGuang-2099.github.io`，所以 `astro.config.mjs` 里只设置了 `site: 'https://weiguang-2099.github.io'`，没有 `base`。

1. 在仓库的 Settings -> Pages 里，把 Source 设为 **GitHub Actions**。
2. 推送到 `main` 分支后，`.github/workflows/deploy.yml` 会用官方的 `withastro/action` 安装依赖、构建并发布。也可以在 Actions 页面手动运行。

每个页面都带有标题、描述、canonical 地址和 Open Graph 信息；RSS 在 `/rss.xml`，sitemap 在 `/sitemap-index.xml`。

## 字体

字体全部自托管（`@fontsource`），不依赖 Google Fonts，国内访问也能正常加载：

- Source Serif 4（可变字体，带 optical size 轴）：英文正文和标题，标题按字号自动换成更精细的 display 字形；
- Noto Serif SC（400、600）：中文，也就是思源宋体，按 unicode-range 分片，页面只下载用到的分片；
- IBM Plex Mono（400、500、600）：日期、阅读时长等测量值，以及代码；
- 楷体：中文引文和首页的题款按“正文宋体、引文楷体”的习惯用楷体，取读者系统自带的楷体（macOS 的 Kaiti SC、Windows 的 KaiTi），不额外下载；没有楷体的系统显示宋体。

只发布 woff2 格式：`astro.config.mjs` 去掉了 @fontsource 附带的 woff 备用文件，并且不把字体分片内联进 CSS。

Source Serif 4 能显示任意字重；Noto Serif SC 只有 400 和 600 两档，CSS 的 500 会落到 400、700 会落到 600，所以同一个字重下中英文的粗细总是成对的。中文段落里的引号、破折号、省略号和间隔号使用 Noto Serif SC 的全角字形（`SC Punct` 字体，定义在 `BaseLayout.astro`）。

## 许可

文章内容版权归作者所有。
