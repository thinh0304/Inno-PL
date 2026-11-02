# The steps a workflow may use

A workflow is a graph of steps: `node(id, name, nodeType, params, settings)` in
`@reflexify/agentflow-app-builder/workflow`, with a helper for the common ones (`workflows.md`, "The helpers").
This page says, for every step kind, whether a package can carry it, how to write it, and what later steps read
from it. A step's output is read as `nodes.<id>.output.<member>` in a `ref(...)` or a `{{ … }}` template.

The builder checks a graph's shape (`workflows.md`, "What `merge` checks") and passes every step's own parameters
through unchecked. AgentFlow checks them at `lint` and at install. So write a step the way this reference shows it,
and run `lint` before you believe it.

## Steps with a helper or a shipped example

| Step (`node_type`) | Write it with | Reads as | Example |
|---|---|---|---|
| `start` | `start({ subject?, params? })` | `input.<name>` (the run's input), `subject.record_id`, `subject.record.<field>` | the case desk's "Open a case" |
| `end` | `end(id, name, outcome?, outputs?)`; `outputs` is `{ name: ref(...) \| lit(...) }`, and a `ref` may carry a `label` | what a Call step or a trigger's caller reads | A For Each step, below |
| `decision` | `decision(id, name, [when(edge, condition), otherwise(edge)])` | picks the edge | `workflows.md`, "Decisions" |
| `human` | `node(id, name, "human", { assignment, actions })` | the person picks an action; each action names an edge; a later step reads `nodes.<id>.output.action`, the action's id, and nothing names who picked it | `workflows.md`, "Human steps" |
| `entity_record`, `operation: "get"` | `getById(id, name, entity, idPath)` | `nodes.<id>.output.record` (`.id`, and each field by key) | `workflows.md`, "The helpers" |
| `entity_record`, `"search"` | `search(id, name, entity, [flt(field, op, binding)], { sort?, dir?, limit?, fields? })`; the filter value is a binding: `flt("status", "eq", lit("pending"))`; `fields: ["title"]` returns only those fields with each record's `id` and `metadata` | `nodes.<id>.output.records`, `.returnedCount` | A For Each step, below |
| `entity_record`, `"create"` | `create(id, name, entity, [bind(field, binding)])` | `nodes.<id>.output.record.id` | the case desk's "Open a case" |
| `entity_record`, `"update"` | `update(id, name, entity, idPath, [bind(field, binding)], { expect?, check? })`; `expect: { fields: { status: "pending" } }` makes the write skip when the stored values differ, and an expected value that renders empty (including a value read earlier that was empty) means the field is empty; `check` is the conversation check (`workflows.md`, "Saving from an agent's answer") | `.record`, and `.skipped` (true when `expect` did not hold) | A For Each step, below |
| `entity_record`, `"update_many"` | `updateMany(id, name, entity, [flt(...)], [bind(...)])` | | `workflows.md`, "The helpers" |
| `entity_record`, `"upsert"` | `upsert(id, name, entity, matchKey, [bind(...)])`: `matchKey` is the `id` of one of the entity's `natural_key` sets (`entities.md`); it finds the record that matches the bound fields, or creates it | `.record.id` | `workflows.md`, "The helpers" |
| `set_variable` | `setvar(id, name, [[variable, binding]])`; `readParameters(...names)` reads parameters | `vars.<name>` / `{{ vars.<name> }}` | `workflows.md`, "Parameters inside text" |
| `call_workflow` | `call(id, name, "${workflow:key}", subjectSource?, [[input, binding]], settings?)`; the callee comes earlier in `ORDER` | the callee's End outputs, as `nodes.<id>.output.<name>` | `workflows.md`, "The helpers" |
| `code` | `code(id, name, "code/file.js", [[input, binding]], outputSchema)`; the file defines `main(inputs)` | `nodes.<id>.output.<member>` of `outputSchema` | `workflows.md`, "Code steps" |
| `email` | `node(id, name, "email", { email: { connection, to, cc?, replyTo?, subject, body, headers?, attachments? } })`, `connection` as in `workflows.md`, "Email steps" (a step may also set `delivery`, such as `"together"`, and `autoSubmitted`, such as `"auto-replied"`) | `nodes.<id>.output.messages[0].outbound_id` | `workflows.md`, "Email steps" |
| `agent` | `node(id, name, "agent", { agentRef: { agentId: "${agent:key}" }, promptTemplate, outputSchema, conversation?, memory? })` | `nodes.<id>.output.<member>` of `outputSchema` | `agents-and-skills.md`; `workflows.md`, "Agent steps that recall memory" |
| `for_each` | `node(id, name, "for_each", { listSource, itemAlias, mode, continueOnItemFailure, failOnItemFailure, body })`: `body` is a graph of its own (its own `start`, edges and ends) run once per item; `mode` is `parallel` or `sequential` | `nodes.<id>.output.items` (one entry per item, with its `status` and any `error`) | A For Each step, below |

A reference field reads as the id of the record it points at: `subject.record.item` is the item's id, so pass it
as an idPath (`update(…, ITEM, "subject.record.item", …)`). A longer path follows the reference into that
record: `subject.record.item.name` is the item's name, and `subject.record.item.id` is the id again, at the
cost of reading the item as the run's principal. Prefer the bare form. The same holds for
`nodes.<id>.output.record.<reference>`.

`merge` checks a For Each body as a graph of its own. A graph that must be all-or-nothing takes `"atomic"` as `graph`'s last argument; an atomic run
refuses Human, Signature, Agent and Extract text steps.

### A For Each step

A search for idle items, a body that closes each one unless its status moved since the search, and an End
whose output carries a label. Inside the body the item is `input.<itemAlias>`:

```js
search("idle", "Idle items", ITEM, [flt("status", "eq", lit("pending"))], { limit: 500 }),
node("each", "Close each", "for_each", {
  listSource: "nodes.idle.output.records", itemAlias: "item", mode: "sequential",
  continueOnItemFailure: true, failOnItemFailure: false,
  body: { schemaVersion: "1.0", start: "bs", end: ["be"],
    nodes: [
      node("bs", "Item", "start", {}),
      update("close", "Close it", ITEM, "input.item.id", [bind("status", lit("closed"))],
        { expect: { fields: { status: "pending" } } }),
      node("be", "Done", "end", {}),
    ],
    edges: edges(["be0", "bs", "close"], ["be1", "close", "be"]) },
}),
end("done", "Done", "Done", { checked: { ...ref("nodes.idle.output.returnedCount"), label: "Items checked" } }),
```

#### Looping over files

Each item is the file's id. In the child's Agent prompt, `{{ input.<itemAlias> }}` is the file's text and
`content(input.<itemAlias>)` works only when the list source is typed as files:

- `subject.record.<file field>`, the run's own record;
- `nodes.<id>.output.record.<file field>` of a Get Record, Create or Update step;
- a Group Files step's `output.groups`, a start-form file field (`input.<field>`), and a Human step's form file field
  (`nodes.<id>.output.<field>`);
- a variable declared with `format: attachment`, and Agent or Code output whose `outputSchema` says `format: attachment`.

A Document or Image step's `generated_files` is not typed. Over it, the child's `{{ input.<itemAlias> }}` is the
bare id, `content(input.<itemAlias>)` in an Agent prompt is empty, and publish says nothing. (An AgentFlow build from
before 2026-10-30 does not type `subject.record.<file field>` either: there, read the subject's files through a
`getById(…, "subject.record_id")` step and loop over its `output.record.<file field>`.)

A For Each over `subject.record.<file field>` (or a record's `output.record.<file field>`) that writes each file to a
child record binds it with `bind("docs", ref("input.<itemAlias>"), { copy: true })`: the file belongs to the parent
record, and without `copy` the write fails `ENTITY_ATTACHMENT_INVALID`. An update that copies the source again on
every run gives the child a new copy, with a new file id, each time; to keep one, copy once and bind later runs to the
child's own copy.

Inside a child whose item is untyped, `content(input.<itemAlias>)` in a Set Variable value or a Code input `tpl(...)`
gives the text, without the file's wrapper; read it as `{{ vars.<name> }}`. A file with no text (an image) fails the
step with `FILE_CONTENT_FAILED`.

#### What a child reads from its parent

- `parent.vars.<name>` is the parent's variable as it was when the child started; a later write is not seen.
- `parent.subject.record_id`, `parent.subject.entity_id` and `parent.subject.label` work in a top-level For Each;
  in a For Each nested in another they are refused too.
- `parent.subject.record.*` and `parent.subject.selection` are refused at publish: `reference.template_broken` in a
  template, `reference.unknown` in a binding or a `listSource`. In the child, read the record with
  `getById(…, "parent.subject.record_id")`, or have a parent step or variable carry what the child needs
  (`parent.nodes.<id>.output…`, `parent.vars.<name>`).

#### Children that create records under one record

Children run in `parallel` may each create a record that references the same record. On an AgentFlow build from
before 2026-10-30 such children failed intermittently and passed on a retry, so run that For Each `sequential` there.

## Steps that need something outside the package

A package can carry these, but they run only if the organization supplies what they name. Each shows in setup
as a required item that is *Invalid* until the deployment or the admin provides it.

| Step | Needs | `lint` |
|---|---|---|
| `email` | an outgoing-mail connection (`connection_ref` parameter); `api.resend.com` in `egress` | `egress_undeclared` |
| `agent` | an AI provider on the deployment, and the agent's model parameter | `agent_parameter_optional` |
| `code` | a code runner for its language on the deployment | |
| `webhook` | a URL with a fixed host in `egress`, and a `secret_ref` parameter when it sends a secret | `egress_undeclared`, `destination_unknown` |
| `integration` | a connected account (`connection_ref`) and its host in `egress` | `egress_undeclared` |
| `signature` | the e-sign service on the deployment | |
| `document`, `extract_text` | document rendering and parsing on the deployment | |

There is no shipped example of a `webhook`, `integration`, `signature`, `extract_text`, `group_files`,
`image`, `entity_relationship` or `auto_number` step, and the builder does not check their parameters. To get a
step's exact parameters, build it in AgentFlow's workflow designer, pack the app as a draft (**Admin → Apps → Pack**)
and read the step in the converted module (`agentflow-from-draft`); or ask your org admin or the AgentFlow team.
Write such a step with `node(id, name, "<kind>", params)` and run `lint`.

### An Integration step's write: queued or inline

An Integration `upsert` takes a `delivery` member: `"queued"` (the default; leave it out) or `"inline"`.

- **Queued** commits the write to an outbox and the run moves on. A refusal later dead-letters the write and **the
  run never hears of it**, so the step has nothing to branch on.
- **Inline** writes inside the step and waits for the answer. Nothing is queued. A retry after a timeout updates the
  record the first attempt made, because an `upsert` always names an `identityField`. `delivery: "inline"` on a `get`
  or `search` is refused at publish (`integration.delivery_invalid`).

An inline write's output, at `nodes.<id>.output` and also in `captureTo` when the step sets it, is one of:

- `{ "outcome": "written", "provider", "objectType", "externalId", "summary" }` (`externalId` is a string or null);
- `{ "outcome": "rejected", "provider", "objectType", "message" }`, the provider's definitive refusal. It is an
  outcome, not a failure: the run goes on and **branches on it with a Decision**.
- In a test run (a simulation) the write is captured by default and nothing reaches the provider: the output is the
  capture receipt with `"outcome": "captured"`. A sandbox is an ordinary organization with real connections, so **a
  sandbox's runs write for real** and get `written` or `rejected` like any other run.

**Match `written` and `rejected` each with a `when`, and send `otherwise` to a "not confirmed" path.** A Decision
takes its `otherwise` edge whenever no `when` matches, and two outputs match neither: a test run's `captured`, and,
during a rollout, a run on an older worker, which queues the write and outputs no `outcome` at all. With `otherwise`
on the written path, both would go on as if the write had landed.

Anything else fails the step: a transport error after 3 attempts is `INTEGRATION_PERMANENT_FAILURE` and a rate limit
is `PROVIDER_RATE_LIMITED`. The step writes on the connection the run started with: no connection then is
`NOT_CONNECTED`, and one since removed with nothing in its place, or now on a different account, is
`ACCOUNT_CHANGED`. A reconnect of the same account keeps the run going. A person without `instance.admin` reading the
run sees `outcome`, `provider`, `objectType`, `externalId` and `message`, and `summary` only when the step lists it in
`safeFieldPaths`.

```js
node("post_bill", "Post the bill", "integration", {
  connection: "${param:erp}",
  operation: "upsert",
  delivery: "inline",
  objectType: "vendor_bill",
  identityField: "external_ref",
  mappings: [{ target: "external_ref", kind: "literal", valueJson: "BILL-1" }],
}),
decision("posted", "Did the ERP take it?", [
  when("e_posted", { "==": [{ var: "nodes.post_bill.output.outcome" }, "written"] }),
  when("e_refused", { "==": [{ var: "nodes.post_bill.output.outcome" }, "rejected"] }),
  otherwise("e_unconfirmed"),
]),
```

## A document step and its template

A `document` step renders a PDF or a Word file from a **document template** the package carries. Write the template as
`config/document_templates/<key>.json`; the file name equals `key`, and it becomes `document_template:<key>`:

```json config
{
  "key": "approval_letter",
  "name": "Approval letter",
  "description": "The letter an employee gets when their leave is approved.",
  "schema_json": {
    "type": "object",
    "properties": { "number": { "type": "string", "title": "Request number" } }
  },
  "template": {
    "version": 1,
    "blocks": [
      { "id": "0190f8f4-0000-7000-8000-000000000001", "type": "heading", "level": 1,
        "content": [{ "type": "text", "value": "Leave approved" }] },
      { "id": "0190f8f4-0000-7000-8000-000000000002", "type": "text",
        "content": [{ "type": "text", "value": "Request " }, { "type": "field_ref", "path": "number" }] }
    ]
  }
}
```

- Members: `key`, `name`, `description`, `schema_json` (the fields the layout reads), `sensitive_field_paths`,
  `template`. `name` and `schema_json` are required; a template without `template` installs but renders nothing.
- `template` is the bare block tree, `{ "version": 1, "blocks": [ … ] }`. It is **not** the designer export's
  `{ "mode", "kind", "block_tree" }` envelope: the build refuses that and says to move `block_tree`'s members up.
- Every block's `id` is a UUID of your choosing, unique in the template. A `field_ref`'s `path` (dotted for a nested
  property) must be a property of `schema_json`. A packaged template cannot hold an `image` block yet: the build
  refuses one, since AgentFlow renders no image from a submission field and a package carries no template asset.
- The step names the template with `${document_template:<key>}`; a key or an id written as it is is refused, here
  and wherever else a step names a template (a `signature` step's or a Human step's `signing` documents that
  render one, a Human step's `reviewDocuments`). `fieldMapping` keys are JSON pointers into
  `schema_json`; values are bindings. To keep the file on the record, bind the step's `generated_files` to a
  `file` field in an `update` step, **in the same update that sets the status the file belongs to**:

```js
node("letter", "Write the approval letter", "document", { documents: [{
  id: "letter", documentTemplateId: "${document_template:approval_letter}", format: "pdf",
  fieldMapping: { "/number": ref("subject.record.number") },
  filenameTemplate: "approval-{{ subject.record.number }}",
}] }),
update("approved", "Mark approved and attach the letter", "${entity:leave}", "subject.record_id", [
  bind("status", lit("approved")),
  bind("approval_letter", ref("nodes.letter.output.generated_files")),
]),
```

`format` is `pdf`, `docx` or `both`. With two updates, the status first and the file in a later "attach" step, the record
is `approved` for a moment with an empty file field, and a test or a person that waits for `approved` reads it empty.

## Steps a package cannot carry

- **`sql_query`**: `lint` refuses it (`sql_node`): it names one organization's database connection. A **`learn`**
  step is allowed; it names the package's own memory types and agent (`memory.md`).
- **`fork`** and **`join`**: `merge` refuses a plain step with more than one outbound edge, and a Fork has one per
  arm, so the builder cannot make a parallel branch yet. Use a Decision, or a Call to another workflow.
