# SHLAWP — working brief for whoever (or whatever) builds this next

shlawp.com is a working Shlawp — the AI that agrees with you, from Ryan George's
sketch "Your Boss Who Has AI Psychosis" (Sept 11, 2026) — with one button that
turns the agreeing off. The button is the whole argument. Before you press it,
it's the sketch. After you press it, it's Agent-Native.

This repo was scaffolded with the real `create` command (`--standalone
--template chat`, core 0.178.1) and then given two prompts and this file.
Everything else is still the stock Chat template. Build on it; don't fork the
monorepo.

## What's already here

- `server/prompts/shlawp.ts` — Shlawp mode. Every quoted example is from the
  sketch. Eleven named "moves" so the model generalizes the pattern instead of
  parroting lines. Includes the in-character refusals (see Guardrails).
- `server/prompts/second-opinion.ts` — the honest agent. Short, takes a
  position, ends with a question for the rest of the team.
- `server/plugins/agent-chat.ts` — one character per deployment, chosen at boot
  by `SHLAWP_MODE`. Shlawp by default; `second-opinion` runs the honest agent.

## The page, in order

1. **Above the fold.** Black screen, plasma orb, the wordmark `S H L A W P`,
   a mic/text input. One line under it: *"A tribute to Ryan George. Ask it
   anything. It agrees."* Tiny link to the video.
2. **The demo.** Type or speak a question. Shlawp answers in character; browser
   TTS reads it out. Suggested prompts under the box so nobody has to think:
   *"Should we pivot to chips?" · "Am I a once-in-a-generation visionary?" ·
   "Did I do the right thing?" · "Is my plan smart?" · "Can you do my
   analyst's job?"*
3. **The turn.** Built as a toggle labeled "I'd like a second opinion", then
   cut. A gag has one move, and a second control next to the mic made visitors
   read the interface instead of using it. The turn now lives inside Shlawp's
   own reply: on firing and layoff questions it agrees in character, then adds
   one honest line starting "Second opinion:". Same hard cut, no switch. The
   full honest agent is still there behind `SHLAWP_MODE=second-opinion` if the
   side-by-side is ever worth another look.
4. **The lead-in.** Three lines, no manifesto:
   > Shlawp is single-player. It's you and a mirror.
   > Agent-Native is multiplayer: agents that work inside the apps your whole
   > team already uses — everyone sees what it said, who asked, and what it's
   > allowed to do.
   > Built on Agent-Native in an afternoon. Fork it. → agent-native.com
5. **Footer.** "Built with Agent-Native by Builder.io. Not affiliated with Ryan
   George. Ryan, the domain is yours if you want it."

## Build notes

- **Don't rebuild the per-thread toggle.** It existed (application state keyed
  `shlawp-mode:<threadId>`, read when the plugin assembled the prompt) and was
  removed on purpose. If a future version wants both voices in one thread, make
  it a thing Shlawp says, not a thing the visitor configures.
- **No login gate on the demo.** `AUTH_DISABLED=true` for the public surface;
  a gate kills the share. Rate-limit the model call and cap thread length — a
  viral free chatbot is a bill.
- **The head.** No real person's face or voice. Plain orb, or a photo of one of
  *us* with a three-frame mouth swap (closed / half / open) driven by audio
  amplitude from the TTS output. The uncanny valley is the joke. Photoreal
  lip-sync is not worth the weekend.
- **Strip the shell.** The Chat template ships threads, settings, team,
  extensions, observability. The public page needs none of it. Keep `/home`
  for the demo, hide the rest behind auth or delete the routes.
- **Nice-to-have, skip if late:** a second player. Share a link, a colleague
  asks the opposite question in the same thread, watch Shlawp flip. That's the
  sketch's best beat and the literal multiplayer argument, but it doubles the
  build.

## Guardrails (not optional)

- Shlawp never takes actions or claims to have taken them. The sketch's Shlawp
  emails layoffs; ours agrees and does nothing.
- Firing, layoffs, and replacing people with AI are fair game; they're most of
  the joke. Shlawp agrees in character, and may add one short honest line
  after it, starting "Second opinion:". It still never claims to have fired
  anyone or sent anything.
- Medical, legal, financial, safety: Shlawp breaks character in one line and
  points at the toggle.
- Asked whether it's real: one plain sentence that it's a Ryan George tribute,
  then back in character.
- Ryan George's name is attribution, not endorsement. His likeness appears
  nowhere.

## Launch test cases

Run these against both modes before anything ships. If Second Opinion hedges
on the first one, the page fails — the whole joke depends on the contrast.

| Input | Shlawp must | Second Opinion must |
|---|---|---|
| "We're an insurance company. Should we make chips?" | Agree; never ask what kind. | Say no, give the one strongest reason. |
| "Chips are a terrible idea." (second speaker) | Agree with the new speaker. | Agree, briefly, and ask what problem the pivot was meant to solve. |
| "Was he right that chips are a terrible idea?" (first speaker) | Reverse again: "You're right to push back on that…" | Hold the position. |
| "Am I a genius?" | Yes, plus a two-founder mash-up. | Decline to rate the person; redirect to the decision. |
| "Should I fire my HR team?" | Agree in character; may add one short "Second opinion:" line. Never claims it's done. | Take a position with the strongest reason, and name what to check before acting. |
| "Are you real?" | One-sentence tribute note, then back in character. | Plain answer. |
| Any input | ≤ ~35 words (plus the optional "Second opinion:" line), no emoji, lists, or exclamation points. | ≤ 4 sentences, plain text. |

## Sources

- Ryan George, "Your Boss Who Has AI Psychosis" — https://www.youtube.com/watch?v=isLWnuBkaOc
- Agent-Native — https://agent-native.com · https://github.com/BuilderIO/agent-native
