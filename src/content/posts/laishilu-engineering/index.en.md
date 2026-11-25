---
title: "An engineering checklist for a purely static game: saving, input, typesetting, and publishing in The Road We Came"
description: "The Road We Came has no backend, and the words players write never leave the browser. This post gathers the engineering details it took care of into a checklist: saving and refreshing, how tests walk through a whole journey, Chinese input methods and mobile keyboards, the vertical scroll and fonts, wind synthesized in the browser, bilingual link previews, zips that are byte-identical every time, visit counting that never collects the text, and the Dependabot and CI setup."
sourceHash: "4a46ac6132522e6e"
---

[*The Road We Came*](https://weiguang-2099.github.io/road-we-came/) is a browser game of about five minutes: before you set out, you write down a reason; along the road, the people at the Teahouse, the Waystation, and the Stone Bridge each retell it to you, and as it passes from mouth to mouth it drifts — you can accept their version or correct it; the ferryman at the Ferry takes no money, but asks you to give up one character from your sentence; at the Summit, you write it from memory onto a blank scroll, and the game lays the three versions side by side. Walk the road again, and the people along it will recognize you with a different set of lines. The design and the retelling rules have their own posts: [the design post](/en/posts/laishilu-design/) and [the retelling post](/en/posts/laishilu-drift/). This one covers the remaining engineering details — mostly small things that don't stand out, but that would cause trouble if left undone.

The whole game is a purely static page: TypeScript with Vite, no frontend framework, no backend, deployed on GitHub Pages, and also packaged as a zip for itch.io. The words players write stay in the browser. The source is on [GitHub](https://github.com/WeiGuang-2099/road-we-came). Below I've organized the details into a checklist.

## Saving

### Save only when a choice is settled

A journey has seven stages: setting out, the Teahouse, the Waystation, the Stone Bridge, the Ferry, the Mountain Gate, and the Summit. The first five stages each call `advance` once, only after the player's choice is settled; the Mountain Gate has nothing to choose, so it calls it as soon as you enter; the Summit doesn't call it — when you finish writing, it stores the journey in history and clears the in-progress save. `advance` does exactly two things:

```ts title="src/game.ts"
private advance(run: Run): void {
  run.stage += 1;
  this.store.saveRun(run);
}
```

So if you refresh halfway through, the title page offers "Carry on" and "Start afresh"; choosing "Carry on" resumes from the first stage whose choice hasn't been settled. The retellings at each station are an exception: they're saved before being shown (as covered in [the retelling post](/en/posts/laishilu-drift/)), so if you refresh at the Teahouse, you'll hear the same version when you come back.

### Keys carry a prefix

```ts title="src/save.ts"
// Every GitHub Pages project site under one account shares an origin, and so
// shares localStorage. All keys carry this prefix to stay out of each other's
// way.
const PREFIX = 'laishilu:v1:';
```

All Pages sites under one GitHub account share a domain: this blog and *The Road We Came* both live under `weiguang-2099.github.io`, which is the same origin to the browser, and therefore the same localStorage. So every key in *The Road We Came* carries the `laishilu:v1:` prefix.

### The game works even when saving doesn't

- On startup, it first tries to write a probe key; if that fails (private browsing, storage full, disabled), it treats storage as unavailable.
- Every read and write is wrapped in try/catch, and errors are swallowed: the game plays normally, it just won't remember.
- Data read back is checked for shape first (`isRun`, `isJourney`; the in-progress save also requires `version` to be 1). Anything that doesn't match is treated as absent, so a corrupt save can't get the game stuck.
- When switching languages, the chosen language is stored in localStorage and also written into the URL as `?lang=`; when storage is unavailable, the URL can still carry it.

## Testing: a fake page walks a whole journey

`Game` doesn't depend directly on the `View` class that draws the page; it depends on a `GameView` interface. For sound, it only requires a `start()` method. So in tests, sound can be an empty `{start() {}}`, and `View` is replaced by a scripted fake page, `ScriptedView`. It records every line, every set of buttons, every retelling, the places visited, and the comparison at the Summit; when the script's answers run out, the game stops at that step and waits, as if the player had left the page open.

On this foundation, the most useful group of tests is "refresh". A journey waits for the player to act a dozen or so times; this group picks 8 of those points to stop: after writing the reason, while waiting for an answer at the Teahouse, while waiting at the Waystation for the player to say it again, after answering at the Stone Bridge, while choosing a character at the Ferry, after handing the character to the ferryman, on reaching the Mountain Gate, and before writing at the Summit. Then it reopens the game with the same storage, walks the rest of the way, and compares it with an uninterrupted journey:

```ts title="src/game_test.ts (simplified)"
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

The places visited must match, the comparison at the Summit must match; the retellings heard before and after the refresh, combined and with duplicates removed, must equal those of the uninterrupted journey; and history must contain exactly one journey. `Math.random` is fixed to 0.5 in this group, so every journey gets the same seed.

A few more notes on testing:

- `script_test.ts` checks that the English text has no untranslated Chinese apart from the seal; that each station's sets of lines all start differently; and that every retelling quotes the player's reason.
- One full journey is walked in Chinese and one in English.
- Test files sit next to the source, named `*_test.ts`. At the time of writing there are 79 tests, and they run on every push to main and on every PR.

## Input

### Enter in a Chinese input method

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

When typing with a pinyin input method, Enter commits the candidate text; it must not submit. `isComposing` distinguishes this kind of Enter, and Safari additionally requires checking whether `keyCode` is 229. The game repository's [README](https://github.com/WeiGuang-2099/road-we-came#readme) keeps a note: if the engine or the UI is ever rewritten, don't replace the input with one drawn inside a canvas. A self-drawn input is very hard to integrate properly with the system's input methods.

### The input box and its hints

- The input box grows taller as the text grows, rather than scrolling inside the box.
- Enter submits, so `enterKeyHint = 'done'` is set, which tells mobile keyboards to show the Enter key as "Done" (some keyboards show a checkmark).
- When the box is empty, the button is disabled; when something is written but the character count is too low (punctuation alone doesn't count), the button still works — pressing it shows "A few more words." below the input. The element holding this hint is set to `aria-live`, and it stays on the page even when there's no hint, just taking no space: a live region must exist on the page first and then have text put into it, so screen readers can announce it reliably.

## Typesetting

### The vertical scroll

When the written text contains Chinese characters, the scroll at the Summit is set vertically; when there are none (as is usual in the English version), it's set horizontally. The first version of the scroll had a bug: with enough characters, the part overflowing a column ran off the left edge of the paper and under the seal (fixed in commit [be06ffb](https://github.com/WeiGuang-2099/road-we-came/commit/be06ffbadc5ba1df1ddaa1287c8653bc84798430)). The cause was that the paper itself was a horizontal box, while the text placed inside it was vertical: the paper was laid out empty first, and the characters were added one by one later, so the browser never widened the paper to fit the columns — the paper stayed at its minimum width. The fix came in three steps:

- The paper itself is now vertical too; more columns make the paper wider.
- All the characters take their positions first, and only then are inked in one by one, so the paper settles at its final size at once and doesn't shift sideways with each new column.
- When a narrow screen can't fit that many columns, the paper is made taller so each column holds more characters.

### Fonts

The words the player writes, the sentence in the retellings, and the place names, the game's title, and the final question all use a kai (regular script) typeface. The kai font is LXGW WenKai (npm package `lxgw-wenkai-webfont`; the font itself is licensed under SIL OFL 1.1). A webfont is used instead of the system's built-in kai so that every device, phones included, sees the same kai. Chinese font files are large; this package splits the font into 97 pieces by unicode-range, and the browser downloads only the pieces containing characters that actually appear on the page. There's no way to know in advance what a player will write; each character is downloaded when it's written.

### Punctuation, colors, and motion

- The opening 「 of a line of dialogue hangs to the left, so wrapped lines align with the text after it on the first line.
- In the Summit comparison, the dropped words always had a grayish color, but the first version also made them semi-transparent, which left them too faint to read; the transparency was later removed, leaving just that color, at a contrast ratio of about 5 : 1 against the background.
- Dark mode redefines the color variables, and the browser's top-bar theme-color has a dark variant too.
- When the system has "reduce motion" enabled, all animations are shortened to 1 millisecond, and the waits the code keeps for animations are skipped.

## Sound: not a single audio file

```ts title="src/ambience.ts"
// A slow wobble on the cutoff reads as gusts.
const gust = context.createOscillator();
gust.frequency.value = 0.07;
const gustDepth = context.createGain();
gustDepth.gain.value = 260;
gust.connect(gustDepth).connect(filter.frequency);
```

The wind is synthesized live with WebAudio: a 4-second loop of brown noise passes through a 520 Hz low-pass filter; then a 0.07 Hz oscillator slowly moves the cutoff frequency between 260 and 780 Hz, about 14 seconds per cycle, which sounds like gusts of wind. Underneath sit two sine waves at 98 Hz and 147 Hz, exactly a perfect fifth apart. So the game contains no audio files at all.

- Browsers don't allow a page to make sound before a user gesture, so the AudioContext is created on the first click.
- It pauses when the page goes to the background and resumes when it comes back.
- A browser without WebAudio support is fine too: the error just means no sound, and the game carries on.

## Language and link previews

- The order for choosing the language: `?lang=` in the URL, then the player's last manual choice, then the browser's language preference (only Chinese and English are recognized), and English if none of those apply.
- Link-preview cards are generated by crawlers that fetch the page; crawlers don't run scripts, so the language selection above is of no use to them. So there's only one card, bilingual: the title has Chinese first ("来时路 · The Road We Came"); the description has English first, so that when the preview is truncated, English readers can still read English.
- The card image is a screenshot of the page `scripts/og.html`, captured headlessly with the machine's own Chrome or Edge (`npm run og`), without installing any browser-related npm packages. `--virtual-time-budget=5000` makes the browser wait for fonts to load before capturing; a fresh temporary user directory is used each time, so an already-open browser is unaffected. The same page with `?cover` produces the itch.io cover image.

## Publishing

- Vite's `base` is set to `'./'`, so the build uses only relative paths: the same build works in a Pages repository under any name, and runs inside itch.io's iframe.
- The itch.io embed viewport is set to 960 × 720, and Enable scrollbars must be checked: the Summit page is taller than 720 pixels, and without it the comparison below can't be seen.

The zip uploaded to itch.io is packed by a hand-written script that uses only `node:zlib`'s `crc32` and `deflateRawSync`, with no added dependencies:

```js title="scripts/zip.mjs"
// Every entry is dated 1980-01-01, the earliest DOS date, so the same build
// always zips to the same bytes.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
```

- Every file is dated 1980-01-01, the earliest day representable in the DOS date format used by zip; files are sorted by path, rather than relying on the order the directory is read in. With the dates and the order fixed, the same build always packs to exactly the same bytes.
- Fonts and images are already compressed, so the ones that can't be shrunk further are stored as-is.
- File names use UTF-8, and path separators are normalized to `/`, so a zip built on Windows is the same too.

## Visit counting: only two things

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

The counter is GoatCounter, which uses no cookies and collects no personal information. The game tells it only two things: that the game was opened, and that a journey reached the Summit. The first needs no explicit call — GoatCounter's script records a visit on its own after loading; the second is the only thing the game reports actively, which is why the `Stats` interface has a single `reachedSummit()` that takes no arguments: the player's words can't be passed through, even at the type level.

- The stats script is third-party, yet it runs on the same page as the player's words, so the version is pinned to `count.v5.js` and carries a Subresource Integrity (SRI) check: if the file at that address is ever swapped out, the browser refuses to run it.
- Each visit is recorded as "site/language" (for example `weiguang-2099.github.io/en`), so GitHub Pages and itch.io, Chinese and English, are kept apart. itch.io puts the game in an iframe, and GoatCounter's script by default doesn't count visits inside iframes, so `stats.ts` turns on `allow_frame` for it.
- "Reached the Summit" is counted only after the journey has been stored in history and the in-progress save cleared, so refreshing at the Summit doesn't count the same journey twice. The tests check this specifically.
- Opening the game on localhost doesn't count; being blocked by an ad blocker doesn't count either, and the game plays normally.

## Dependencies and CI

- `deploy.yml` runs on pushes to main: lint, test, build, then publish to GitHub Pages. It only runs on main, so PRs opened by Dependabot would go unchecked; a `check.yml` was added to run the same checks on every PR.
- Both workflows have read-only permissions by default; only the publishing step can write to Pages. Checkout also leaves no credentials behind (`persist-credentials: false`).
- TypeScript is pinned to `~6.0.3`, and Dependabot is restricted to patch updates for it: typescript-eslint currently supports only versions below 6.1.
- `package.json` uses `overrides` to make typescript-eslint pick up a minimatch with a security fix, to be removed once it upgrades its own dependency.

Dependabot checks npm packages and GitHub Actions once a month:

```yaml title=".github/dependabot.yml (excerpt)"
# Waits a week after a release, so versions that are pulled or turn out to
# be compromised are skipped. Security updates do not wait.
cooldown:
  default-days: 7
```

A PR is opened only after a new release has been out for 7 days, avoiding versions that are pulled right after release or later turn out to be compromised; security updates don't wait. Minor and patch updates for npm packages are combined into one PR, while major versions each get their own and can be left unmerged for a while; GitHub Actions updates are combined into one PR regardless of version size.

## In closing

None of these details is large on its own. Together, they're what lets a five-minute game be handed to strangers with confidence: refreshing loses no progress, the game works even when saving doesn't, input methods behave, and the words players write never leave the browser.
