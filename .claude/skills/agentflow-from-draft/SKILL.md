---
name: agentflow-from-draft
description: "Use when moving an app built in AgentFlow's designers into code: converting a draft zip from Admin → Apps → Pack with agentflow-app init --from, then rewriting the converted workflows with the ./workflow helpers."
---

# Moving a designer-built app into code

The guide page for readers without an agent is `<AGENTFLOW_URL>/guides/en/xay-dung-ung-dung/tu-trinh-thiet-ke` (Vietnamese `<AGENTFLOW_URL>/guides/xay-dung-ung-dung/tu-trinh-thiet-ke`). `<AGENTFLOW_URL>` is the address your team opens AgentFlow at.

An app made in AgentFlow's designers can be packed into a **draft**: a zip of the package's files, not
signed. `agentflow-app init --from` turns that draft into an SDK project whose `config/` builds the same
package. You then rewrite the converted workflows with the builder's helpers, one at a time, proving after
each one that the package has not changed.

What goes in `config/` is the `agentflow-app-authoring` skill; building and sealing is
`agentflow-app-release`.

## 1. Download the draft

In AgentFlow, an admin opens **Admin → Apps → Pack**, packs the app, and downloads it **with no signing
key**. That gives the draft zip. Pack asks for an **overlay**, a JSON file with the members only a person writes
(id, version, publisher, requirements). When the app has a `launcher`, write its targets with `@obj:` references,
`@obj:entity_view:leave_request/all`: the `${entity_view:…}` form is the config's, not the overlay's, and the pack
answers `manifest_invalid  PACKAGE_MANIFEST_INVALID: manifest.json` without naming a place. A package sealed with a key is refused:

```
DRAFT_INVALID: this is a sealed package, not a draft: use Admin → Apps → Pack with no key
```

## 2. Convert it

```bash
pnpm dlx --package "github:reflexify/agentflow-sdk#sdk-v0.7.0&path:packages/agentflow-app-builder" \
  agentflow-app init my-app --from ./draft.zip
cd my-app && pnpm install && pnpm build && pnpm check
```

`pnpm dlx` fetches the builder from GitHub, so it needs the network. Offline, in any project where `pnpm install`
has run, the builder is in `node_modules`: `pnpm exec agentflow-app init ../my-app --from ./draft.zip` does the same.

- The folder must be new or empty (`INIT_DIR_NOT_EMPTY` otherwise).
- `--from` takes no `--prefix`, `--key`, `--no-ui` or `--no-site`: the draft holds the package id, and a
  converted project has no standalone site. Passing one is a usage error (exit 2).
- **It checks itself.** It builds the converted project and compares the result with the draft. Only if
  every file comes back the same does it write the folder; on any refusal it writes nothing.
- It prints `created /abs/my-app from /abs/draft.zip (91 files)` and the next commands. The count is every file now in
  the new folder (the config, `agentflow.app.mjs`, the built `package/`, the module's `ui/` files and the starter's
  project files), not the draft's own entries, so it is larger than the zip's list. Your number differs.

The folder is not a git repository. Run `git init` in it, then commit the converted project as it is, before you
change anything: it is your baseline.

**`pnpm test` in the converted project is only the build check.** Its `test` script is `agentflow-app build --check`: it
runs no tests, because the draft brings none and the project has no test runner (no `vitest`, no `vitest.config.ts`),
so a green `pnpm test` says only that `package/` still matches `config/`. Add what you need as you change the app:
`vitest` as a development dependency, a `vitest.config.ts`, your tests under `test/`, and the script
`vitest run && agentflow-app build --check` (plus `agentflow-app types --check` if you commit generated types). Tests
against a sandbox go in their own folder and script, so `pnpm test` stays offline: `sandbox-testing.md` in the
`agentflow-app-release` skill.

## 3. What the project holds

| Draft | Project |
|---|---|
| `manifest.json` | `config/package-manifest.json`, with `"configVersion": 1` first and without the members the builder generates (`objects`, `grants`, `exports`, `features`) |
| an entity, its fields, views and create form, and its grants | `config/entities/<key>.json` |
| a workflow and its start grants | `config/build/workflows/<key>.mjs`, exporting `workflows` |
| a trigger | `config/build/triggers/<name>.mjs`, exporting `triggers` |
| an entity action | `config/build/actions/<entity>__<key>.mjs`, exporting `actions` |
| a Code step's source | `config/code/<workflow>-<step>.js`, which the step reads with `{ "$file": "code/<workflow>-<step>.js" }` |
| an agent | `config/agents/<key>.json` |
| a skill | `config/skills/<key>.SKILL.md`, whose `name` is the key |
| a memory type, a memory relationship | `config/memory_types/<key>.json`, `config/memory_relationships/<key>.json` (definitions only: a draft carries no memory) |
| a dashboard | `config/dashboards/<key>.json` |
| a document template | `config/document_templates/<key>.json` |
| the UI module, if any | `ui/built/`, byte for byte, with `ui/README.md` saying it is built output |

Beside them: `agentflow.app.mjs`, which imports every module, lists `ORDER` and `entityOrder`, and adds
`ui: { prebuilt: "ui/built" }` when there is a module; the built `package/`; and the project files from the
starter (`package.json`, `pnpm-workspace.yaml`, `.gitignore`, `README.md`, `AGENTS.md`, `CLAUDE.md`).

- Every `@obj:…` and `@param:…` in the draft comes back as a reference, `${entity:task}` or `${param:x}`.
- Each `.mjs` module is the graph as it was packed: `export const workflows = { … };` holding plain JSON.
  It is valid builder input, ready to be rewritten.
- The draft lists the manifest's objects and grants sorted by key, so the converted project keeps that
  order: `entityOrder` and the grants come out sorted, and `ORDER` is sorted with each workflow after the
  workflows it calls. That is expected.

## 4. When the conversion is refused

- **`DRAFT_INVALID`**: the file is not a draft. It cannot be read, it is not a zip, it has no `manifest.json`,
  or it is a sealed package. Download it again from Pack, with no key.
- **`DRAFT_UNSUPPORTED`**: the draft holds something the builder cannot write. The message names the draft
  file and the place, `<file>#<pointer>: <reason>`. For example:
  `objects/entity/case.json#/access: the entity has no access member; the builder writes access as "everyone" or "restricted": …`. The builder does
  not write a `relationship` or a `client`; non-empty `exports` or `features`; a create form with a layout
  other than a plain vertical one; a document template with an image; or a sentinel it
  never writes in that place.
  Change the app in the designers so that it no longer uses the form named (here, give the entity an access
  mode, `everyone` or `restricted`), pack it again, and convert again. The designers are an org admin's: ask
  the admin who packed the draft. Do not patch the zip yourself, since the converted app would then not be the
  admin's app.
- **`DRAFT_REBUILD_DIFFERS`**: the converted project builds, but not into the same package; the message
  lists where it differs, as `manifest.json#/grants` (a few members, then "and N more"). Nothing was written. Report it to the AgentFlow team with that list; do not
  try to convert by hand.

## 5. Rewrite one workflow with the helpers

The converted modules work, but they are hard to read and to change. Rewrite them with
`@reflexify/agentflow-app-builder/workflow`, one module at a time, keeping the package exactly the same.

**Before you start**, run `pnpm build && pnpm check` and commit `config/` and `package/`. The comparison reads
`package/` as it stands, so that is what you compare against: do not run `pnpm build` again until it passes.

**Then, for one module:**

1. Open `config/build/workflows/<key>.mjs`.
2. Replace the JSON with helper calls (the table below). Keep every step id, step name, edge id, value and
   order exactly as they are.
3. Run `pnpm exec agentflow-app build --check --values`. It builds the config in memory and compares the result
   with `package/` as JSON values, writing nothing. The builder writes members in the order your source gives
   them, so the bytes change while the values must not.
4. `package/ holds the values the config builds`: run `pnpm build` and `pnpm check` (it prints `package/ matches
   the config`), commit `config/` and `package/` together, and go on to the next module. `PACKAGE_DIFFERS`: the
   message names each member that differs, as `objects/workflow/<key>.json#/nodes/2/name`; fix the source and go
   back to step 3. If you ran `pnpm build` before it passed, `git checkout -- package` brings back what you
   compare against.

| Converted JSON | Helper |
|---|---|
| `"run_as": { "policy": "initiator" }` | `INITIATOR` |
| `"run_as": { "policy": "service_principal", "service_principal_id": "${param:x}" }` | `servicePrincipal("x")` |
| `"start_access": { "mode": "restricted", "group_ids": [] }` | `NOBODY` |
| `"start_access": { "mode": "restricted", "group_ids": ["${param:a}"] }` | `restricted("a")` |
| a start step with an entity `subject` | `start({ subject: "${entity:task}" })` |
| a start step with `"params": { "kind": "schema" }` | `start({ params: true })`, and the `input_schema` as `workflow()`'s last argument |
| an `entity_record` step, `"operation": "get"` | `getById(id, name, entity, "subject.record_id")` |
| an `entity_record` step, `"operation": "search"` | `search(id, name, entity, [flt(field, op, …)], { sort, dir, limit, fields })`, each option only when the JSON has it |
| `"operation": "create"` with a `body` | `create(id, name, entity, [bind(field, …)])` |
| `"operation": "update"` with a `body` | `update(id, name, entity, idPath, [bind(field, …)])` |
| `"operation": "upsert"` with `"matchBy": "key"`, a `matchKey` and a `body` | `upsert(id, name, entity, matchKey, [bind(field, …)])` |
| a body item `{ "field", "kind": "reference", "value" }` | `bind(field, ref(value))`; `template` is `tpl`, `literal` is `lit` |
| a body item `{ "field", "kind": "literal", "value": "text" }` (a string) | `bind(field, lit("text"))` |
| a body item `{ "field", "kind": "literal", "valueJson": 5 }` (a number, boolean, null, array or object) | `bind(field, lit(5))`: `lit` writes `value` for a string and `valueJson` for anything else, so write the JSON value, not its text |
| a body item with `"copy": true` | `bind(field, ref(value), { copy: true })`; without it the converted step drops `copy` and the comparison names it |
| `"operation": "update_many"` with `filters` and a `body` | `updateMany(id, name, entity, [flt(field, op, ref(...))], [bind(field, …)])`; each filter is `{ "field", "op", "value" }` and `flt(field, op, value)` writes it as is, so a filter value read from the run is `ref(path)`'s object |
| a `decision` with branches | `decision(id, name, [when(edge, condition), otherwise(edge)])` |
| an `end` with `outcomeLabel` | `end(id, name, outcome)` |
| `"edges": [{ "id", "from", "to" }]` | `edges([id, from, to], …)` |
| any other step | `node(id, name, nodeType, parameters, settings)`, with `parameters` less its `id` and `label` |

`graph(name, nodes, edges)` writes `start: "start"` and lists every End step as `end`, so it fits a graph
whose start step's id is `start`. `workflow()` writes `output_schema: null`; for a workflow with an output
schema, spread its result and set `output_schema`. When a helper cannot say what the JSON says, keep that
part as JSON: the comparison is what counts.

**Keep a whole module as converted when** its start step's id is not `start` (a draft's may be `s`: the helpers
cannot write another, and the comparison names the id as changed); or the workflow has no `name` or
`description` (`workflow()` always writes both, so the comparison names them as added; AgentFlow names
such a workflow by its key, which is what the converted JSON gives it); or its start step carries members `start()`
does not write; or any other step or member has no helper. A module left as JSON is valid builder input and builds
the same package. You may still replace a single step inside it with `node(...)` once the comparison passes for
that edit.

### Before and after: "Stamp completion"

This is an example, not a template to paste: its keys (`stamp_completion`, the entity `item`, the parameter
`automation_principal`) come from one draft. Your draft has its own workflows, entity keys, fields and steps, so write
yours from the module your conversion made, with its own keys, and let the comparison judge. A pasted copy of this
module in a project whose entity is `ticket` is refused (`${entity:item}` names nothing), or builds a different package.

Converted from a draft, `config/build/workflows/<key>.mjs` for the key `stamp_completion` begins
like this (abridged):

```js
export const workflows = {
  "stamp_completion": {
    "key": "stamp_completion",
    "name": "Stamp completion",
    "description": "Sets an item's completed_at when it enters done, and clears it when it leaves done.",
    "run_as": { "policy": "service_principal", "service_principal_id": "${param:automation_principal}" },
    "start_access": { "mode": "restricted", "group_ids": [] },
    "input_schema": null,
    "output_schema": null,
    "graph": {
      "schemaVersion": "1.0",
      "start": "start",
      "end": ["finish"],
      "nodes": [
        { "id": "item", "name": "Read the item", "node_type": "entity_record",
          "parameters": { "entityId": "${entity:item}", "id": "item", "label": "Read the item", "operation": "get",
            "recordIdExpr": { "kind": "reference", "value": "subject.record_id" } }, "settings": {} }
      ]
    }
  }
};
```

Rewritten with the helpers:

```js
import {
  NOBODY, NOW, bind, decision, edges, end, getById, graph, otherwise, ref, servicePrincipal, start, update, when, workflow,
} from "@reflexify/agentflow-app-builder/workflow";

const ITEM = "${entity:item}";
const CLEAR = ref("");

export const workflows = {
  stamp_completion: workflow(
    "stamp_completion", "Stamp completion",
    "Sets an item's completed_at when it enters done, and clears it when it leaves done.",
    servicePrincipal("automation_principal"), NOBODY,
    graph("Stamp completion", [
      start({ subject: ITEM }),
      getById("item", "Read the item", ITEM, "subject.record_id"),
      decision("is_done", "Done?", [
        when("e_done", { "==": [{ var: "nodes.item.output.record.status" }, "done"] }),
        otherwise("e_not_done"),
      ]),
      update("stamp", "Stamp completion", ITEM, "subject.record_id", [bind("completed_at", NOW)]),
      update("clear", "Clear completion", ITEM, "subject.record_id", [bind("completed_at", CLEAR)]),
      end("finish", "Finish", "completed"),
    ], edges(
      ["e_start", "start", "item"], ["e_read", "item", "is_done"],
      ["e_done", "is_done", "stamp"], ["e_not_done", "is_done", "clear"],
      ["e_stamped", "stamp", "finish"], ["e_cleared", "clear", "finish"],
    )),
  ),
};
```

The comparison passes. Once every module is rewritten, you may move a workflow's trigger into its module and
rename the files: update the imports in `agentflow.app.mjs`, and the comparison must still pass.

## 6. The prebuilt UI module

A draft carries its UI module only as built files, so the project copies `ui/built/` into `package/ui` on
every build (`ui: { prebuilt: "ui/built" }` in `agentflow.app.mjs`). It is not source: do not edit it.
`ui/built/` ships exactly as the draft carried it. Open it before you seal, and check that each `module`
launcher entry has a screen behind it.

**A draft's module can be an empty stub.** A draft made without a screen carries a module such as
`function mount() { return () => {}; } export { mount };` (56 bytes, in the module's built file under `ui/built/`): it builds, `pnpm check`
and `seal` accept it, and every person in the audience gets a launcher entry that opens a blank page.
`init --from` prints `warning: the draft's UI module ui/index.js (56 bytes) is an empty stub` when it finds one.
Either replace it with a real module (below, and the `agentflow-ui-module` skill), or remove the `ui` member
and every `module` launcher entry from `config/package-manifest.json`, and `ui: { prebuilt: ... }` from
`agentflow.app.mjs`, then delete `ui/`.

To change the module, replace it with source:

1. Write the module's source in the project, with a Vite config that builds it as one ES entry named
   `index.js` ending in `export { mount };`. The starter's `src/module/` and `vite.module.config.ts` are a
   working example: make a project with `agentflow-app init` to copy them from, with their dependencies.
2. `pnpm add -D vite`, and the module's own dependencies.
3. In `agentflow.app.mjs`, remove `ui: { prebuilt: "ui/built" }` (the build then uses
   `vite.module.config.ts`), or write `ui: { viteConfig: "<your config>" }`.
4. Delete `ui/built/` and `ui/README.md`, then `pnpm build`.

This is the one change that is meant to alter the package: the module is now yours. The comparison in section 5
compares the module's files byte for byte, so it names them until you run `pnpm build`. Raise `version` before you
seal it.
