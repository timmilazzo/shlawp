# Shlawp

**Absolutely.**

A working Shlawp — the AI that agrees with you, from Ryan George's sketch
["Your Boss Who Has AI Psychosis"](https://www.youtube.com/watch?v=isLWnuBkaOc) —
with one button that turns the agreeing off.

Built on [Agent-Native](https://agent-native.com) from the stock Chat template.
Not affiliated with Ryan George. Ryan, the domain is yours if you want it.

Read [`SHLAWP.md`](./SHLAWP.md) for the concept, the page, the guardrails, and
the launch test cases. The two prompts live in [`server/prompts/`](./server/prompts).

## Run it

```bash
pnpm install
cp .env.example .env   # set AUTH_DISABLED=true for the public demo surface
pnpm dev
```

`SHLAWP_MODE=second-opinion pnpm dev` starts the honest agent instead. There is
no in-app switch between the two — see SHLAWP.md, "The turn", for why.

## Scaffold provenance

```bash
npx @agent-native/core@0.178.1 create shlawp --standalone --template chat
```

Full framework docs: [agent-native.com/docs/template-chat](https://agent-native.com/docs/template-chat).
