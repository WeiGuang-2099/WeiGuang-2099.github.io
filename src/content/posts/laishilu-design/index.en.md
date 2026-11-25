---
title: "The Road We Came: at the summit, do you still remember why you set out?"
description: "The Road We Came is a browser game of about five minutes that asks whether, at the end of the road, you still remember why you began. This post is about its design: how the sentence you write at the start is handed over, how the people along the road retell it, the character the ferryman asks for, the blank scroll at the summit, and how the people on the road recognize you when you walk it again."
sourceHash: "c79b1e36f779ef43"
---

[*The Road We Came*](https://weiguang-2099.github.io/road-we-came/) is a browser game of about five minutes, in Chinese and English. Below the title is a single line: "About five minutes. Best somewhere quiet."

Growing up, I sometimes felt lost. Making this game was also a way of slowly working out what I am moving forward for.

It asks only one question, the line that appears at the summit: At the end of the road, will you still know why you began? The whole game turns that question into something concrete: before you set out, you write down a reason; then the game takes it from you and gives it to the people along the road to pass on; at the summit, you have to write it back from memory.

This post goes through each stage of the journey in order and explains how it was designed. How the retelling and the comparison work in code is in [Letting a sentence drift on the road](/en/posts/laishilu-drift/); the engineering side—saving, input methods, layout, and publishing—is in [An engineering checklist for a purely static game](/en/posts/laishilu-engineering/). The screenshots here are all from the game itself[^1].

## Setting out: handing over the reason

![The screen after clicking Begin. The first line reads: "Before you set out, write down why you're making this journey." Below it, in smaller text: "One sentence will do. Make it the real reason." The input box contains 想去看看母亲常说的那片海 (I want to go and see the sea my mother often talked about) in indigo kai type, with the Set out button below.](./setting-out.png "Figure 1: Before setting out.")

After you click Begin on the title page, the next screen has only two lines and an input box. The first line reads: "Before you set out, write down why you're making this journey." Below it, in smaller text: "One sentence will do. Make it the real reason." The input box takes at most forty characters, and at least two: the ferry will take one character away, so if you write only one, nothing is left once it is handed over.

After you press Set out, the characters you wrote fade and blur one by one, drifting upward, and then a line appears: "The people along the road will remember it for you."

From here until the summit, the game never shows you your original sentence again. Every version you see after this, apart from the one you rewrite yourself when you correct someone, is spoken by someone else.

## The road: one sentence, three people

At the Teahouse, the Waystation, and the Stone Bridge, three people each retell the sentence to you once:

| Place | Who | How they bring it up |
| --- | --- | --- |
| Teahouse | The woman who keeps the teahouse | "Someone ahead mentioned you. They said that when you set out, you said: '...' Is that right?" |
| Waystation | The keeper, doing his accounts by the lamp | "I heard about you. The day you set out, you said '...', didn't you?" |
| Stone Bridge | The child throwing stones | "I know you! The grown-ups all say you set out because of '...'!" |

The source of the saying gets farther away at each stop: from "someone ahead mentioned you", to "I heard about you", to "the grown-ups all say". By the Stone Bridge, your reason has become something all the grown-ups talk about and even a child can recite. At each stop, the sentence usually drifts a little more: one change at the Teahouse, and up to two each at the Waystation and the Stone Bridge.

![The Teahouse. The text reads: there is a teahouse by the road, and the water on the stove has just boiled. The woman who keeps the teahouse pours you a bowl of tea and looks you over for a while. "Someone ahead mentioned you. They said that when you set out, you said: '想去看看母亲说的那片海' (I want to go and see the sea my mother talked about). Is that right?" Below are two buttons: That's right and That's not it.](./teahouse.png "Figure 2: The Teahouse. Compared with Figure 1, only the character 常 is missing.")

The Teahouse makes only one change, so what you hear there is often not far from the original. In Figure 2, the woman says 想去看看母亲说的那片海 (I want to go and see the sea my mother talked about), missing only 常 (often). If you don't compare carefully, it is easy to accept it.

The sentence in the retelling is in the same kai type and indigo as the one you wrote. Other people's versions and the characters you wrote yourself look exactly the same on screen.

### Accepting is easy; correcting is hard

At each stop there are only two choices: That's right and That's not it.

Accepting takes one click. Correcting is much more trouble: the other person asks you to say it yourself ("Then you tell me—how did it go?"), and you have to write the sentence out again. There is no original on screen to copy from; you can only go by memory.

After you correct it, the other person passes on your version: "Noted. If anyone asks, that's what I'll say." But a corrected version keeps drifting too: the keeper at the Waystation copies your words into his ledger, "his handwriting very sloppy"; when someone retells it later, they use your corrected sentence, and it will still be changed a few more times.

## The Ferry: choosing a character yourself

![The Ferry. On the left is a list of the places passed: Teahouse, Waystation, Stone Bridge, Ferry. The text reads: the river is wide, and there is only one ferry at the bank. "I take no fare," the ferryman says. "From the sentence you said when you set out, give me one character." A smaller line: choose one character to give the ferryman. Below is the sentence as it has come down the road, 想看妈妈说的那片湖 (want to see the lake Mom talked about), with every character clickable.](./ferry.png "Figure 3: The Ferry. What the ferryman lays out is the sentence as it has come down the road.")

The river is wide, and there is only one ferry. The ferryman takes no fare: "From the sentence you said when you set out, give me one character."

What he lays out is the sentence as it has come down the road, not your original. In Figure 3, 母亲 (mother) has become 妈妈 (mom), 海 (sea) has become 湖 (lake), and 去 (go), 常 (often), and one 看 (look) have been lost along the way. Every character is a button; click one and it tilts and drifts away to the lower right, slowly blurring, until it is gone. The ferryman tucks it into his sleeve: "This character, the river will remember for you."

The drift along the road is caused by others; this one character you choose yourself. Whether you give an insignificant 的 (a possessive particle) or the most important 湖 is up to you. On the journey in Figure 3, what was handed over was 那 (that).

## The Mountain Gate: say it enough, and it becomes true

Across the river is the mountain. The steps are long, and you climb for a long time. At the Mountain Gate an old man sweeping the steps stops, looks at you, and says two lines:

> "Everyone who climbs the mountain can say why they came."\
> "Say it enough, and it becomes true."

He is describing what has happened along the road. There is no choice here, only a Go on button. Farther up, you will have to write the sentence out from memory.

## The Summit: a blank scroll

At the summit, the keeper of the scrolls hands you a scroll. You open it, and there is not a single character on it. "Everyone who comes here must write it themselves," the keeper says. "Write down why you set out in the first place." The placeholder in the input box is "Write it from memory."

After you finish, your characters land on the scroll one by one, written vertically, and finally a cinnabar seal is stamped: 来时路. The page is moon-white; everything you write (and the sentence others retell) is indigo, and this seal is the only red in the whole game. With dark mode on, the background becomes dark gray-blue, the indigo characters become light blue, and the seal is still the only red. What remains on the scroll is the sentence you remember now, not the one you wrote when you set out.

Then three sentences are laid out side by side: the one you wrote at the start, the one people passed along the road, and the one you remember now. The characters you didn't remember fade out, and the ones added later are underlined with a wavy line.

![The summit of the first journey. On the scroll, written vertically, is 想去看看妈妈说的那片湖 (I want to go and see the lake Mom talked about), with the seal 来时路. Below, three lines for comparison: what was written at the start, 想去看看母亲常说的那片海 (I want to go and see the sea my mother often talked about); what was passed along the road, 想看妈妈说的片湖 (want to see the lake Mom talked about); what is remembered now, 想去看看妈妈说的那片湖. In the first line, 母亲常 and 海 are faded; in the last two lines, 妈妈 and 湖 have wavy underlines. The verdict reads: "What you remember is what the people on the road told you."](./summit.png "Figure 4: The summit of the first journey. Figures 1 through 4 are the same journey.")

Then comes a verdict, one of six. Comparing from the top down, whichever one matches first is the one you get:

| What you wrote back | Verdict |
| --- | --- |
| Exactly the original, character for character | Word for word. You still remember. |
| Contains words added along the road, and is no farther from the road's version than from the original | What you remember is what the people on the road told you. |
| Mostly your own words, but mixed with the road's phrasing | Most of it is still yours. But some of the words now belong to the road. |
| Mostly your own words | Most of it is still with you. A few words fell by the wayside. |
| Only a little left | Only a little of it is left. The road rewrote the rest. |
| Almost nothing left | You forgot. And still, you made it here. |

The summit gives no score. A score is actually calculated and saved in the browser, but it is never shown; all the player sees is this one sentence. Even if you forgot everything, the verdict is not "failure" but "And still, you made it here."

Only after the verdict does the game pose the question, in kai type one size larger than the body text: "At the end of the road, will you still know why you began?" Below it, one button: "Walk it again."

## Walking it again

Every journey is saved in the browser. When you walk it again, the people on the road recognize you:

- On the second journey, the Teahouse is still in its old place. The woman sees you and pauses: "You again." The keeper at the Waystation recognizes you, sets down his brush, and adds a little oil to the lamp. The child at the Stone Bridge seems to have grown a bit, and shouts from far off: "You're back!"
- On the third journey, a light rain begins, and you stand under the Teahouse eaves for a while. The rain lasts all the way to the Waystation, where the main room is crowded with people sheltering from it. The next morning the rain has stopped and the river has risen; the child is crouching at the Stone Bridge, writing your story in the mud.

![The Stone Bridge on the third journey. The text reads: the morning after the rain, the river has risen and the stone bridge is wet. The child is crouching at the bridge, drawing something in the mud. Seeing you, he stands up. "Look, I wrote your story on the ground: '打算看一眼妈妈常说的那片海' (planning to take one look at the sea Mom often talked about). Right?" Below are the two buttons That's right and That's not it.](./bridge-again.png "Figure 5: The Stone Bridge on the third journey.")

Click That's right, and the child draws a boat under the line; click That's not it, and he wipes the line away with his foot and rewrites it, stroke by stroke, as you tell him.

The dialogue at the three places is written per journey: on a given journey, the three stops use the same set, which is why the rain can last from the Teahouse to the Waystation, with the Stone Bridge coming after the rain. From the fourth journey on, the two sets from the second and third journeys alternate.

The summit remembers you too. From the second journey on, after the verdict there is an extra line telling you what you wrote when you set out last time; if the two times are the same sentence, it says "Last time, you wrote those very same words." Below the question there is also an extra small line recording how many times you have reached this point, like the journey in Figure 6: "You have made this climb 3 times."

![The summit of the third journey. On the scroll, written vertically, is 想去看看母亲常说的那片海. The three lines for comparison: what was written at the start and what is remembered now are both 想去看看母亲常说的那片海; what was passed along the road is 打算看一眼妈妈常说的那片. The verdict is "Word for word. You still remember." Then: "Last time, you wrote those very same words." Then, in larger kai type: "At the end of the road, will you still know why you began?" Below, a small line: "You have made this climb 3 times." At the bottom is the Walk it again button.](./summit-again.png "Figure 6: The summit of the third journey. Along the road the sentence became 打算看一眼妈妈常说的那片 (planning to take one look at the ... Mom often talked about), and 海 (sea) was given to the ferryman, yet what was written back was word for word.")

After you have walked the road once, a less conspicuous option appears on the title page: "Forget the roads behind." It first warns you: "Everything you wrote will be wiped away. There's no getting it back." Once confirmed, every journey walked and every sentence written is cleared; the sound and language settings are unaffected. When you set out again, the people on the road no longer know you, and everything starts over from the first journey.

## Other details

- After each line of text appears, there is a pause before the next line, so you can finish reading: 450 milliseconds, plus 55 milliseconds per character, up to 2.4 seconds. A click, Enter, or Space moves ahead early.
- Options never take focus automatically, so pressing Enter again and again to skip through the dialogue won't accidentally click That's right.
- Narration and dialogue are in a serif typeface; the characters you write, and the sentence quoted in dialogue, are in LXGW WenKai.
- The wind sound is synthesized live in the browser: a low noise, with a very slow swell as gusts, over two low tones. It starts only after the first click, and can be turned off in the corner.
- Every decision is saved as you make it; close the page and you can "Carry on" next time you open it. What you write never leaves the browser.

## The English version

The English version is called *The Road We Came*, and it was rewritten for English rather than translated word for word. When people on the road retell it, they swap words, drop words, mishear one word as another that sounds the same or similar, and swap two adjacent letters within a word (mother becomes motehr). The ferryman takes one word, the scroll is written horizontally, and the seal is still the Chinese 来时路. The input box takes at most 90 characters. The final question in English is: At the end of the road, will you still know why you began?

## Closing

This game has no winning or losing, and it doesn't tell you the answer. It does only one thing: it has you write down a sentence, and then, five minutes later, has you recover it from memory. How much you recovered, the verdict says; whose words you remember, the three-line comparison says. The question, you have to answer yourself. If you'd like to try, you can [walk the road](https://weiguang-2099.github.io/road-we-came/).

[^1]: The screenshots were taken by running the game locally and jumping directly to the relevant stop with prepared save data, in a 960 × 720 window; the window in Figure 4 was stretched to 960 × 770, and Figure 6 is a full-page screenshot. The retellings along the road are all computed by the game from the seed in the save data.
