# The standalone site

`agentflow-app init` keeps a small web site beside the package unless you pass `--no-site`. It is a separate
program from the app package: people open it in a browser, sign in to AgentFlow through its server, and work tasks,
records and a workflow start there. The package (`config/`) and the UI module (`src/module/`) need none of it. Read
this page when you change anything under `server/`, `src/` (outside `src/module/`), `static/`, `scripts/` or
`test/`, or when the brief says "a site".

`init` has already written your names into the site: the app's name where the starter said "Case desk", your
package key where it said `case-desk` (the config route, the client id `<key>-dev`, the log prefix), and your key in
capitals with underscores in front of every environment variable (`<KEY>_ORIGIN`, `<KEY>_SESSION_KEY`,
`<KEY>_ENTITY_ID`, `<KEY>_WORKFLOW_ID`). The names are the only thing it changes. What stays case-specific is below.

## The files

| Path | What it is |
|---|---|
| `server/app.ts`, `server/main.ts` | the Hono server: the SDK's sign-in and proxy (`/agentflow/...`), `GET /<key>/config.json`, `/plain`, the built site |
| `server/config.ts`, `server/checks.ts` | reads `.env`; `checks.ts` is what `pnpm check-setup` runs against the real stack |
| `server/vite-plugin.ts`, `vite.config.ts` | under `pnpm dev`, the same server inside Vite |
| `src/main.tsx`, `src/App.tsx`, `src/route.ts` | the page: the elements inside `<agentflow-provider>`, a hash route for Inbox, Records and Start |
| `src/StartCase.tsx` | the start screen: a form that starts a workflow |
| `src/text.ts` | every string, in English and Vietnamese |
| `scripts/setup.ts`, `scripts/doctor.ts`, `.env.example`, `RUNBOOK.md` | `pnpm setup-keys` (keys, `.env`, the registration body), `pnpm check-setup`, the settings, the step-by-step run against a real AgentFlow |

The site holds no token in the browser. The server keeps the session and signs the calls; the page and its elements
call `/agentflow/api/...` on the same origin.

## The start screen

A workflow whose input is a schema has no launch form for `<agentflow-start-form>` to draw, so
`src/StartCase.tsx` asks for the inputs itself and starts the run as the signed-in person through the proxy. It
shows the pattern to copy: one input per schema property, the refusal's `fieldErrors` placed under the field they
name, a banner for the rest, a guard against a double submit, and the access-lost codes handed up to `App.tsx`.
Its inputs, `summary` and `amount`, are the starter workflow's; a workflow with other inputs needs another form.

## Adapting it

Change these, in this order, when the app is not a case desk:

1. `src/StartCase.tsx`: the inputs, their validation, the run's name, and `startForm` in `src/text.ts`.
2. `src/App.tsx`: the Records screen's filter (`URGENT` is a field of the starter's entity and refuses on yours),
   the header and the routes.
3. The ids the site needs. When the site's registration belongs to the installed package, give the elements
   `entity-key="<key>"` or `workflow-key="<key>"` instead and skip the id plumbing below: AgentFlow resolves the
   key in the organization, and an element for a key the app lacks says "not installed". A site whose
   registration has no package keeps the id form: `<KEY>_ENTITY_ID` and `<KEY>_WORKFLOW_ID` are read in `server/config.ts` and checked in
   `server/checks.ts`; the page gets them through `publicConfig` (also in `config.ts`), `src/main.tsx` and
   `src/App.tsx` (the `PublicConfig` interface and the not-configured message for each id). A new id
   is added in all of those, in `.env.example` and in `RUNBOOK.md`.
4. `RUNBOOK.md` step 4 and the walkthrough in step 6, which name the starter's entity, workflow and fields.
5. `static/plain.html`, the plain-HTML page, if you keep it.

`pnpm check-setup` and `pnpm test` then say what you missed.

## Its tests

`pnpm test` runs Vitest over `test/` and then `agentflow-app build --check`. `test/app.test.tsx` and
`test/main.test.tsx` render the page; `test/app.test.ts`, `test/config.test.ts` and `test/checks.test.ts` hold the
server, the settings and the checks; `test/setup.test.ts` the key script; `test/vite-plugin.test.ts` the dev
server; `test/plain.test.ts` and `test/styles.test.ts` the plain page and the styles.
They encode the starter's case: expect to rewrite the ones that name its entity, its fields and its start form
when you change them. `pnpm typecheck` covers the site and the module.

## The ceiling

An admin registers the site with a ceiling (Admin → Apps), and under a ceiling the site cannot fetch an entity's
create form: `GET /entities/{id}/create-form` answers `403 APP_CEILING_DENIED`, and "New record" is gone. That
is why the starter lets people start a workflow and does not offer a create form. What the site can still do, and the
level the ceiling needs for it, is in the authoring skill's `SKILL.md`, "What a ceiling takes from a standalone
site", and the workflow side in `workflows.md`, "Start forms". Decide it before you design how a person
creates anything.

`init --no-site` drops all of these files; `--no-ui` drops only the module and keeps the site. The release skill
says what else changes.
