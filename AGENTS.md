# Notes for coding agents

This project is an AgentFlow app, built with the AgentFlow SDK: `inno/pl`, "TeraBox · Hiệu quả đơn hàng". It is being
rebuilt from scratch on a new specification: today `config/` describes an empty package (no entities, no workflows), and
`src/module/` shows a placeholder screen. The new spec goes in `docs/superpowers/specs/`, its plans in
`docs/superpowers/plans/`. `config/` describes an app package, and the builder turns it into `package/`.

## Skills

The AgentFlow plugin for Claude Code holds the skills for this work. Add it once:

```
/plugin marketplace add reflexify/agentflow-sdk
/plugin install agentflow@agentflow-sdk
```

- `agentflow-app-authoring`: turning requirements into `config/` (the manifest, parameters, entities, access, rules,
  stage models, work, workflows, agents and skills).
- `agentflow-app-release`: building, checking, sealing, linting against AgentFlow and deploying, and what each refusal means.
- `agentflow-from-draft`: moving an app built in AgentFlow's designers into code.
- `agentflow-ui-module`: the UI module's screens, styles, kit elements, tests and review, against the design guide
  `node_modules/@reflexify/agentflow-elements/DESIGN.md`.

Without the plugin, read the skills themselves: they are Markdown in the SDK repository (reflexify/agentflow-sdk on
GitHub), one folder each under `claude-plugin/skills/`, a `SKILL.md` and its `reference/`. The builder's README,
`node_modules/@reflexify/agentflow-app-builder/README.md`, documents every file under `config/`.

## The old app (v1) and its specification

The first version was built on a specification that turned out wrong, and was thrown away.

- **Never read, search or reuse `docs/archive/`** (the v1 source spec, mockup and sample workbook) **unless the user
  explicitly asks** to consult it in that conversation. Keep it out of searches: give a path or a glob that excludes it.
- The same holds for the git tag `archive/pl-v1` (the v1 code, specs and plans): do not check it out, diff against it or
  copy from it unless the user asks.
- The new specification is the only source of truth for what the app does. Do not carry over v1's entities, roles, task
  codes, business rules or screens because they "were there before".
- `docs/sdk-feedback.md` is about the AgentFlow platform, not the business: read it, it still applies. Its examples name
  v1 objects; take the platform's behaviour from them, never the business rules.

## Commands

- `pnpm build`: `node scripts/build-code.mjs && agentflow-app build`: bundles each Code step's TypeScript (the `ENTRIES`
  of `scripts/build-code.mjs`, none yet) into `config/code/<name>.js`, then writes `package/` from `config/`.
  `pnpm build:code` does the first part alone.
- `pnpm build` also writes the UI module into `package/ui`: built with Vite, or copied as it is when `ui` in
  `agentflow.app.mjs` names a `prebuilt` folder.
- `pnpm check`: `agentflow-app build --check`: fails when the committed `package/` is not what `config/` builds.
  `pnpm check` compares package/ui with the module when package/ui exists (git ignores that folder; `pnpm build`
  writes it).
- `pnpm test`: all the Vitest tests, then the check and `types --check`. See "Testing": not after every phase.
- `pnpm vitest run <files or folders>`: only those tests.
- `pnpm test:sandbox [e2e/<file>]`: the black-box tests in `e2e/*.sandbox.test.ts` (all, or the files named) against the
  sandbox in `.agentflow/sandbox.json` (made by `pnpm af deploy --sandbox` from `sandbox.json`); `pnpm test` never runs them.
- `pnpm typecheck`: TypeScript over the project's `.ts` and `.tsx` files.
- `pnpm exec agentflow-app types`: TypeScript for the package's objects (`LogicalKey`, `EntityFields`,
  `WorkflowInputs`), from `package/`: run `pnpm build` first.
- `src/generated/app.ts` is what `types` writes, and the project commits it. `pnpm test` ends with
  `agentflow-app types --check`, which fails with `TYPES_STALE` when the file is behind `package/`.
- `pnpm demo`: the UI module in a browser, at `http://localhost:5174/module.html`.
- `pnpm exec agentflow-app keygen --key-id <id>`: once per publisher, a signing key in `keys/`.
- `pnpm seal`: `agentflow-app seal`: signs `package/` into `dist-app/`.
- `pnpm exec agentflow-app lint`: checks `package/` against the AgentFlow at `AGENTFLOW_URL`, with the key in `AGENTFLOW_TOKEN`.
- `pnpm exec agentflow-app deploy --wait`: uploads the sealed package and asks for it to be installed; an admin approves it at the
  link it prints.

`AGENTFLOW_URL`, `AGENTFLOW_TOKEN` and `AGENTFLOW_SANDBOX_KEY` live in `.env` (git ignores it; `.env.example` is
the template). `pnpm af <command>` runs any `agentflow-app` command with `.env` loaded; `pnpm lint`,
`pnpm deploy:app` (`deploy --wait`) and `pnpm sandbox` are shortcuts. Use these instead of asking for the values,
and never print, read back or commit `.env`.

Every `agentflow-app` command takes `--json` for one JSON value on stdout. A refusal prints `<CODE>: <message>` and exits `1`.

## Testing

Running every suite after every phase cost too much time in v1. So:

- **During a phase** (one plan, or one task of it), run only the tests that cover what the phase changed:
  - `pnpm vitest run <test files or folders>`: the tests the phase wrote or touched (or
    `pnpm vitest related --run <changed source files>`);
  - `pnpm typecheck`, and `pnpm build` then `pnpm check` (both quick) when `config/` or `src/module/` changed;
  - on the sandbox, only the phase's own files (`pnpm test:sandbox e2e/<file>.sandbox.test.ts`), and only when the
    phase changes what runs on AgentFlow (entities, access, rules, workflows, triggers). Deploy the sandbox once per
    phase, not per task.
- Each plan lists, per task and for the whole phase, exactly which test files prove it ("Kiểm tra"). The final reviewer
  of a plan reads the code and runs those, not the full suites.
- **The full suites**, `pnpm test` and the whole `pnpm test:sandbox`, run once when the whole app is built and
  deployed, and again before a release is sealed or pushed. Not after each phase.

## Platform notes

What v1 learnt about AgentFlow, which any app here will meet (details and repros in `docs/sdk-feedback.md`):

- Triggers always ship off: `deploy --sandbox` arms them; on a real AgentFlow the admin turns them on. After
  `deploy --sandbox` they may take a few minutes to start (F-20; the delay was never measured).
- The sandbox's workflow runner is slow (7 s to 2 min a run): sandbox tests run one file at a time
  (`vitest.sandbox.config.ts`) and wait on conditions rather than fixed sleeps.
- Creating a record does not fire an `updated` trigger: a workflow must not rely on another workflow's creations to
  wake it.
- A workflow people start runs as them; one that must run as the app's service principal is started by a trigger.
- API records carry their fields under `body`. Times arrive as `2026-11-03T18:54:44.945958101+07:00`: in code a Code
  step runs, parse them with a helper that handles nanoseconds and the offset, never `Date.parse`.
- A create form refuses `null` for a number field: leave an empty number out. An entity's create form keeps only the
  fields it binds.
- The builder seeds `done_at` on a task entity itself.
- Enum colours must be gray, sky, teal, amber, emerald, violet, indigo, rose or fuchsia (the install refuses others, the
  builder does not). A routing rule's `when` is one json-logic operator, like a trigger filter.
- An installed app cannot upload attachments (`POST /attachments` answers 403, F-25), files a workflow run produced
  answer 404 through the app (F-27), and `GET /app/objects` only answers the app's own caller (F-22).

## Where things are

- `config/package-manifest.json`: the package's identity and parameters (today only `app_users`); raise `version` for
  every release. Its `ui` and `launcher` members declare the module and its entry in AgentFlow's sidebar.
- `config/entities/`, `config/build/`: none yet. `agentflow.app.mjs` merges the workflow modules of `config/build/`, in
  publish order.
- `scripts/build-code.mjs`: bundles a Code step's TypeScript into `config/code/<name>.js`; never edit those by hand.
- `src/module/`: `module.tsx` (the entry, `mount(root, host)`), `mount.tsx` (the stylesheet in the shadow root, the
  language and the theme), `App.tsx` (picks the screen), `kit.tsx` (the kit's elements for React), `icons.tsx`,
  `format.ts` (money, percentages and days the Vietnamese way), `text.ts` (vi and en), `styles.css`, `demo.tsx`
  (for `module.html`).
- `test/module/`: `test-host.tsx` (a host for screen tests), `shims.ts` (what jsdom lacks), `styles.test.ts` and
  `ui-build.test.ts` (the module rules), `app.test.tsx`.
- `sandbox.json`: the sandbox's people, groups and roles: one user group today; rewrite it with the new spec's roles.
- `docs/sdk-feedback.md`: the platform's snags, F-01 onwards. Add an F-xx for each new one, with "Cách tái hiện" and
  "Đề xuất".

## Rules

- Never commit `keys/`. It holds the signing key, and git ignores it.
- Never print, read back or commit `.env`. Never write the value of `AGENTFLOW_TOKEN` into a file, a command line or a log.
- Never edit `package/` or `config/code/` by hand. Change `config/` or the TypeScript, run `pnpm build`, and commit both.
- After a change under `src/module/`, run `pnpm build` before `pnpm check`: the check compares the built `package/ui`.
- After a change under `config/` that adds, renames or removes an object, run `pnpm build`, then
  `pnpm exec agentflow-app types`, and commit `src/generated/app.ts`.
- After every change under `config/`, run `pnpm build` and fix what it refuses: it names the file and the place.
- Keep `README.md` and this file in step with the app: its objects, parameters, triggers and install notes.
- In the module: one stylesheet in the shadow root, no listeners on `document`, sizes by container queries, every id
  read from `GET /app/objects`, and every link the browser opens itself made with `host.apiUrl`.
  `test/module/styles.test.ts` and `test/module/ui-build.test.ts` check this.
- Never push to `main` until the user says so.
