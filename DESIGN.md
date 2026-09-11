# Visual Design Contract

## Product mode

- Mode: `experience`
- Audience and cadence: people arriving from a share link, on a phone more often
  than not, staying for a few questions. One visit, not a daily tool.
- Primary workflow: ask Shlawp something out loud, hear it agree.

## Visual direction

- Direction name: Late-night hologram. A handset in a dark room projecting a
  head inside a plasma orb, straight out of the sketch.
- Palette family: near-black ground (`#030409`), plasma electric blue and violet
  with cyan highlights, one hot magenta rim accent. The plasma palette is the
  brand here, so it lives only inside the orb and its glow. Chrome stays
  monochrome white-on-black.
- Type treatment: the wordmark is thin (300), uppercase, and very widely tracked.
  Captions and the transcript use Inter at reading sizes. There's no other type
  voice.
- Composition: a single centered column. In voice mode the orb is the whole
  screen: wordmark, orb, a live caption, then the mic. In text mode the orb
  shrinks to the top and the transcript takes the space below. On desktop the
  column sits inside a generic black phone container; on phones it's full
  bleed with no container.
- Shape language: circles (orb, mic button), a rounded phone slab, and pill
  inputs. No cards.
- Anti-references: generic SaaS chat (left sidebar, message bubbles, model
  picker), glassmorphism panels, sparkle icons, a real person's face or voice.

## Head states

The head sprites live in `public/shlawp/head/` (transparent) and `public/shlawp/states/`
(original tiles).

| State | Frames |
| --- | --- |
| Idle | `01-base`, glancing to `02-look-left` / `03-look-right` |
| Listening | `06-query` |
| Thinking | `08-thinking`, `07-puzzled` |
| Speaking | `04-speak-open` / `05-speak-closing`, on speech word boundaries |
| Tap the orb | `09-lasers` |

## Guardrails

- Keep chat transport, threads, and agent execution in Core; the Shlawp screen
  is presentation over the shared chat runtime.
- Voice uses browser speech APIs only; text mode must work everywhere.
- Loops and flicker respect `prefers-reduced-motion`.
