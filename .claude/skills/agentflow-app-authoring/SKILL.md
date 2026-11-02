---
name: agentflow-app-authoring
description: Use when turning requirements into an AgentFlow app's config/ (manifest, parameters, entities and conversations, access, rules, stage model, tasks and work, workflows, agents and skills) with @reflexify/agentflow-app-builder.
---

# Authoring an AgentFlow app's `config/`

An AgentFlow app package is written by hand as `config/` plus `agentflow.app.mjs`. The builder,
`@reflexify/agentflow-app-builder`, turns them into `package/`: a `manifest.json` and one JSON file per object
under `objects/<kind>/`. That is what AgentFlow installs. You never write `package/` yourself.

The guide's page for writing an app, for readers without an agent, is `<AGENTFLOW_URL>/guides/en/xay-dung-ung-dung/viet-ung-dung` (Vietnamese `<AGENTFLOW_URL>/guides/xay-dung-ung-dung/viet-ung-dung`).
`<AGENTFLOW_URL>` is the address your team opens AgentFlow at, the same one the `AGENTFLOW_URL` variable holds
(`agentflow-app-release` skill); ask your org admin if you do not have it yet.

This skill covers what goes in `config/`. Building, sealing, checking against AgentFlow (`lint`), deploying
(`deploy`, then an admin approves) and every CLI refusal code are in the `agentflow-app-release` skill. Converting an app made in AgentFlow's designers is in `agentflow-from-draft`.

## Before you start

You need a project. If your team already has a copy of the template or an app made from it, start there, with no
network: in any project where `pnpm install` has run, the builder is in `node_modules`, and
`pnpm exec agentflow-app init ../my-app --prefix acme --no-site` makes the new project beside it (the
`agentflow-app-release` skill explains each flag and the pnpm settings). With no project at all, `pnpm dlx` fetches the
builder from GitHub, so it needs the network:

```bash
pnpm dlx --package "github:reflexify/agentflow-sdk#sdk-v0.7.0&path:packages/agentflow-app-builder" \
  agentflow-app init my-app --prefix acme --no-site
cd my-app && pnpm install && pnpm build
```

Starting from a clone of the template repository instead? It is the same case desk, still named
`acme/case-desk`, with its standalone site. Do not rename or strip it by hand: "Starting from a copy of the
template instead" in the `agentflow-app-release` skill makes the project `init` would have made.

The starter is the case desk, an app with one of each piece. Read its files before you write your own, and
copy their patterns:

| File | What it shows |
|---|---|
| `config/package-manifest.json` | identity, one group parameter (`app_users`), `requires`, `audience`, `ui`, `launcher` |
| `config/entities/case.json` | fields, a view, a create form, a grant with a record scope, a rule, a stage model |
| `config/build/open-case.mjs` | the "Open a case" workflow, written with the builder's workflow helpers, with a Human step |
| `agentflow.app.mjs` | what the build reads: the workflow modules, their publish order, the exposed steps |
| `src/module/module.tsx` | the optional UI module's entry, `mount(root, host)` |

## Starting your own app from the starter

`init` renames the starter; it does not empty it. A project made with `--no-ui --no-site` becomes yours in three steps:
delete the case desk's entity and workflow, give `agentflow.app.mjs` nothing to merge, and rebuild. An app with no entity
and no workflow builds:

```bash
rm config/entities/case.json config/build/open-case.mjs
cat > agentflow.app.mjs <<'EOF'
import { defineApp, merge } from "@reflexify/agentflow-app-builder";

export default defineApp({
  sections: merge([], []),
});
EOF
pnpm build
```

It prints `wrote 1 package files`. `README.md` and `AGENTS.md` still describe the case desk until you rewrite them (step 12
below). A project that keeps the UI module also has the case desk's screens, tests and launcher entries to replace
(`agentflow-ui-module`). The guide's `<AGENTFLOW_URL>/guides/en/xay-dung-ung-dung/ung-dung-dau-tien` builds a whole app this
way, command by command, and `examples/leave-tutorial` is the finished app.

## What a ceiling takes from a standalone site

Decide this before you design how a person creates a record. A standalone site that an admin registers with a
ceiling (Admin → Apps, **Ceiling** on its row) reaches only the entities and workflows the ceiling covers, at the
level it names. A ceiling covers no form, so the site cannot fetch an entity's create form:
`GET /entities/{id}/create-form` answers `403 APP_CEILING_DENIED`, and `GET /entities/{id}` leaves `create_form`
out. A UI module inside AgentFlow calls as the person and never meets this.

What a site uses instead, by what it needs:

- **List or read an entity's records** (a picker's options, a table): the entity at **Read**.
- **Create or change a record**: the entity at **Write**. `POST /entities/{id}/records` still works without
  the form: AgentFlow maps `form_payload` through the create form the site never sees, so the site writes the
  form's property keys (those of `create_form.schema.properties`) into its own screen by hand. Properties bound
  to a field the ceiling does not let it create are left out of the form it would see; a key the site sends for
  such a field is refused when the record is written. Keys the form does not bind are dropped.
- **Ask for something, then let a workflow do it**: the workflow at **Start and work**, started with
  `POST /workflows/{workflow_id}/instances` and `params`. The run may create and set any field its steps bind,
  and it is not filtered by the create form. This is the choice when the record needs fields the form does
  not carry, or a person must approve it (`workflows.md`, "Start forms").

When you write the RUNBOOK or the admin message, name the ceiling you need in these words: the entities with
their level, and the workflows at **Start and work**.

## The loop

Work in small steps, and let the builder tell you what is wrong.

1. Change one thing under `config/`: one entity, one rule, one workflow.
2. Run `pnpm build` (it runs `agentflow-app build`).
3. If it prints `wrote N package files`, go on with the next change.
4. If it prints a refusal, read it (below), fix that one place, and go back to step 2.
5. Before you commit, run `pnpm check` (`agentflow-app build --check`). Commit `config/` and `package/` together. A project that commits `src/generated/app.ts` also reruns `pnpm exec agentflow-app types` after the build (the release skill's "Typed keys").

Never edit `package/` to make a refusal go away: the next build overwrites it, and `pnpm check` fails.

## Reading a refusal

A refusal is one line on stderr, `<CODE>: <file>#<JSON pointer>: <reason>`, and the exit code is 1:

```
BUILD_REFUSED: entities/case.json#/views/0/columns/4: nope is not a field of case
BUILD_REFUSED: entities/case.json#/access/grants/0/principal/id: ghost is not a group_ref parameter
BUILD_REFUSED: workflow open_case#/start_access/mode: a package cannot let everyone start a workflow
APP_FILE_INVALID: agentflow.app.mjs: add open_case to ORDER
APP_FILE_INVALID: agentflow.app.mjs: open_case: case (entity_record) has 0 outbound edges
CONFIG_VERSION_MISSING: config/package-manifest.json has no configVersion: add "configVersion": 1
```

- The file is relative to `config/`, except in `CONFIG_VERSION_MISSING`, which names the file and what to add. For code it names the object instead: `workflow <key>`, `trigger <name>`,
  `action <name>`.
- The pointer is RFC 6901: `/views/0/columns/4` is the fifth column of the first view. `~1` stands for `/`.
- A reference that names nothing is reported against the output file, `objects/entity/case.json#/…`. Find the
  same pointer in the config file that makes that object.
- `BUILD_REFUSED` is a config problem. `APP_FILE_INVALID` is a problem in `agentflow.app.mjs` or in a workflow
  graph, which `merge` checks when that file loads.

The reasons fall into a few kinds. Each tells you what to do:

| The reason says | It means | Do |
|---|---|---|
| `a member the builder has no rule for`, `not a member the package's entity_field lists` | a misspelt or unsupported member | use a member the reference files list; the builder never drops one silently |
| `one of …`, `must be an array`, `1 to 20 leaves` | a value of the wrong shape | write the shape the message names |
| `x is not a field of case`, `x is not a group_ref parameter`, `… names no object, parameter or required entity of the package` | a name that does not resolve | add the field, parameter or object, or fix the name |
| `an authoring reference the builder does not know`, `holds a hyphen`, `a string starting with @ reads as a sentinel` | a malformed reference | see References below |
| `is kase, not case`, `notes.yaml is not a .json file`, `missing` | a file problem | rename the file, remove it, or add the member |
| `a package grants to a group or everyone only`, `never carries design authority` | a policy no package may hold | see `reference/access.md` |
| `has 0 outbound edges`, `loop through a -> b`, `unreachable x` | a broken workflow graph | see `reference/workflows.md` |

## The layout

```
agentflow.app.mjs           what the build reads: the workflow modules, ORDER, entityOrder, exposedSteps, ui
config/
  package-manifest.json     the manifest's own members, starting with "configVersion": 1
  entities/<key>.json       one file per entity: fields, views, form, access, rules, stage model, work, comments, source
  agents/<key>.json         one file per agent: name, profile, access, and an optional read_limit (the entities and memory types it may read)
  memory_types/<key>.json   one file per memory type an agent learns or saves into
  memory_relationships/<key>.json  one file per memory relationship
  skills/<name>.SKILL.md    one file per skill an agent loads
  dashboards/<key>.json     one file per dashboard
  document_templates/<key>.json  one file per document template a document step renders
  code/<name>.js            Code step sources, read by path from a workflow
  build/<name>.mjs          workflows, triggers and entity actions, in code
package/                    built output: never edit it
```

- `entities/`, `memory_types/`, `memory_relationships/`, `agents/`, `dashboards/` and `document_templates/` hold only `.json` files, and `skills/` only
  `.SKILL.md` files. Any other file is refused (`entities#: notes.yaml is not a .json file`). Dotfiles and
  notes (`.md` and `.txt` files) are ignored anywhere under `config/`, except in `skills/`, where a `.md` not
  named `<name>.SKILL.md` is refused (`skills#: triage.md is not a .SKILL.md file: …`). A subfolder of notes is
  ignored too. A `.SKILL.md` file is never a note: outside `skills/` it is refused (`… is a skill: skills go in config/skills/`).
- Beside these folders, `config/` may hold `package-manifest.json`, notes and folders of notes only. A file of
  any other kind there, or another folder holding one, is refused rather than left out of the package unseen
  (`config#: templates/ is not a folder the builder reads (it holds templates/x.json); …`). Names are
  case-sensitive: a folder named `Entities` is refused (`did you mean entities/?`).
- A file's name, without its extension, equals its `key`.
- `agentflow.app.mjs` default-exports `defineApp({ sections, entityOrder?, exposedSteps?, ui? })`. The case desk's:

```js
import { defineApp, merge } from "@reflexify/agentflow-app-builder";
import * as openCase from "./config/build/open-case.mjs";

export default defineApp({
  sections: merge([openCase], ["open_case"]),
  exposedSteps: { open_case: ["review"] },
});
```

## References

Parts of the package refer to each other by name. In entity, agent, dashboard and document template files and in workflow
modules, a string that is exactly one reference becomes the platform's sentinel for it:

| Write | Names |
|---|---|
| `${entity:case}` | an entity of the package |
| `${workflow:open_case}` | a workflow, by its `key` |
| `${agent:triage}` | an agent file's key |
| `${skill:account-access}` | a skill, by the `name` in its frontmatter |
| `${param:app_users}` | a parameter the manifest declares |
| `${dashboard:team_overview}` | a dashboard file's key |
| `${document_template:approval_letter}` | a document template file's key (a `document` step's `documentTemplateId`) |
| `${entity_view:item/open}` | a view of an entity, written entity/view |

The rules:

- **Whole strings only.** `"${param:app_users}"` is a reference. `"Case for ${param:app_users}"` is refused
  with `an authoring reference the builder does not know`. A workflow that needs a parameter's value inside
  text reads it into a variable first (`readParameters`, in `reference/workflows.md`).
- Text members that are carried unchanged (an entity's or a workflow's `name` and `description`) are not
  translated: a `${…}` there ships as literal text. Do not write one there.
- Keys are lowercase, start with a letter, and hold letters, digits and `_`. Only a skill name may hold `-`;
  any other key with a hyphen is refused (`entity key my-case holds a hyphen`).
- No string may start with `@`, and no member name may hold `${`.
- The two platform entities are written by id: Users `ffffffff-0000-0000-0000-000000000001`, Units
  `ffffffff-0000-0000-0000-000000000003`. List `user` or `org_unit` in the manifest's `requires.entities`
  when you use them, as the examples do; list `name` under `user` for any screen that shows people by name
  (`reference/manifest.md` says what the admin sees as `Entity user`).
- `package-manifest.json` is not translated, except its `launcher`. In its other members write the sentinel
  itself: `"audience": "@param:app_users"`.

## From requirements to `config/`

1. **Write the product down first.** List the entities and their fields; who may read, create, change, assign
   and delete each one; the status values and who makes each move; what happens automatically (workflows
   and their triggers); and what people see (views, the create form, a dashboard, launcher entries).
2. **Choose the parameters.** Every id that differs per organization is a parameter: the audience group, one
   group per role that needs organization-wide access, a service principal for the workflows a trigger starts and a
   group that holds it. See `reference/manifest.md`.
3. **Write `config/package-manifest.json`.** See `reference/manifest.md`.
4. **Write one `config/entities/<key>.json` per entity**: fields in an order where a formula comes after
   what it reads, views, the create form. An entity with `comments` and a `detail` view needs a
   `{ "kind": "comments" }` block in that layout: installing never adds it. See `reference/entities.md`.
5. **Write access as grants.** There is no admin bypass. See `reference/access.md`.
6. **Write rules** for what grants cannot say, and **stage models** for status fields. See
   `reference/rules-and-stages.md`.
7. **Decide where people's tasks live, and write `work`.** `work` on an entity makes each record a task people
   claim and finish; a Human step opens a task about a record inside one run. They differ in what a workflow can
   read and what can end the task: see `reference/work.md`, "A record as a task, or a Human step's task".
7a. **Write a `source`** for an entity AgentFlow fills from a synced stream (an ERP's purchase orders, HubSpot's
    contacts), with a `connection_ref` parameter for the connection. Its records are then read-only. See
    `reference/entities.md`, "A source".
8. **Write workflows, triggers and actions** in `config/build/`, and list them in `agentflow.app.mjs`. See
   `reference/workflows.md`.
8a. **Name an Integration step's account with a `connection_ref` parameter.** The step carries
   `connection: "${param:erp}"`, never `provider` or `externalAccountId`, which the builder refuses. Give the
   parameter a `category` (`crm` or `erp` for an Integration step) so setup offers only connections of that kind
   and checks what the step uses against the one chosen. The builder refuses a parameter whose `category` cannot
   serve a place it is bound (an `erp` parameter in an Email step) and an Integration step bound to a parameter
   with no `category`; `lint` checks the canonical objects and operations. See `reference/manifest.md`, "Parameters".
9. **Write agents and skills** if the app uses AI. See `reference/agents-and-skills.md`. To let the organization's
   assistant (the chat panel) load one of your skills, list its key in the manifest's `assistant.skills`
   (`reference/manifest.md`).
9a. **Write memory types and relationships** if an agent learns or saves memory, before the agents that name them.
    See `reference/memory.md`.
10. **Write dashboards and launcher entries.** See `reference/dashboards-and-launcher.md`.
11. **Build after each step**, as in The loop. Then read `reference/pitfalls.md` against what you wrote:
    each entry is a mistake that builds cleanly and fails later.
12. **Rewrite `README.md` and `AGENTS.md`, and the manifest's `summary`, `dataHandling` (`purpose`,
    `retention`, `privacy`), `publisher` and `changelog`.** The admin reads the manifest's text on the setup
    page, and `init` keeps the starter's text in all of it. `init` renames the two files, but they still describe the starter's own
    objects (and its install note says the package has no trigger to turn on). Describe your app's objects and
    parameters, and, if it has a trigger, that the admin must turn it on after the install.
13. **Raise `version`** in `config/package-manifest.json` before you seal a release, then lint and deploy it:
    `deploy`, then an admin approves (the `agentflow-app-release` skill). Before the
    first deploy, send your org admin what "What to send your org admin" in the `agentflow-app-release` skill
    lists: the CI keys and the parameters. The guide's pages for this step are `<AGENTFLOW_URL>/guides/en/xay-dung-ung-dung/kiem-tra-va-trien-khai` (deploying) and `<AGENTFLOW_URL>/guides/en/xay-dung-ung-dung/khoa-ky` (your signing key); Vietnamese: the same without `en/`.

## Which reference to read

| You are writing | Read |
|---|---|
| `package-manifest.json`, parameters, `requires`, depending on another package (`requires.packages`, `${dep:…}`, `exports`) and building on it (your own entity with a reference; a synced base; `rfx/erp-core`), `egress`, `audience`, `configVersion` | `reference/manifest.md` |
| an entity: fields, views, the create form; a conversation (records that are threads of messages); a `source` that fills it from a synced stream | `reference/entities.md` |
| who may do what: `access`, grants, record scopes | `reference/access.md` |
| `rules`, `stage_model`; a field fixed once the record exists | `reference/rules-and-stages.md` |
| turning an entity's records into tasks: `work` (lifecycle, assignment, priority, deadlines); a record as a task or a Human step's task; who holds a record | `reference/work.md` |
| workflows, who they run as, start forms, Human steps, Agent steps that read a conversation and saving from their answer, a file's text in a template, triggers, actions, `agentflow.app.mjs` | `reference/workflows.md` |
| each kind of step a workflow may use; a `document` step and its template | `reference/steps.md` |
| agents and their skills | `reference/agents-and-skills.md` |
| memory types and relationships, an agent that saves memory, a Learn step | `reference/memory.md` |
| dashboards, the `launcher` member, the `ui` member | `reference/dashboards-and-launcher.md` |
| the standalone site (`server/`, `src/`, `.env`, `RUNBOOK.md`) | `reference/site.md` |
| a final review, or a behaviour you did not expect | `reference/pitfalls.md` |

The builder's own README, `node_modules/@reflexify/agentflow-app-builder/README.md`, is the full contract
of the format.

## What the builder checks, and what it does not

The builder refuses what it has no rule for, so a config it accepts uses only real members, resolving
references and the policies a package may hold. It does not check every value against the platform: an
icon name, a formula expression or a field `type` is passed through. AgentFlow verifies the package again
when it is installed, and may refuse what the builder accepted. Write values the examples use, and keep
to the shapes in the reference files.

## Before you hand off

- `pnpm build` prints `wrote N package files`, and `pnpm check` prints `package/ matches the config`.
- Every parameter has a `label` and a `help` that tells the installer what to choose and what role its
  members need.
- You have read `reference/pitfalls.md` against your config.
- `README.md` and `AGENTS.md` describe your app, not the starter.
- `version` is raised if the package changed since the last sealed release.
- When you can reach an AgentFlow deployment, `pnpm exec agentflow-app lint` prints `no problems`.
