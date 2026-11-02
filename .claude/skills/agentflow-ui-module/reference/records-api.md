# Reading records: one filtered, sorted query

The starter's `src/module/http-cases-api.ts` lists every case with no filter. Most screens need a filter, a sort
and the names of the records a field refers to. The types are in the SDK, which your project has installed: open
`node_modules/@reflexify/agentflow-sdk/dist/generated/public.d.ts` and read `RecordQueryRequest`,
`EntityRecordFilters`, `RecordFieldFilter`, `RecordFilterOp`, `EntityRecordPage` and `EntityRecord` there. Reach
them as `components['schemas']['RecordQueryRequest']`, as the starter does for `EntityRecord`.

## The query

`POST /entities/{entity_id}/records/query` through `host.api`. The entity's id comes from the SDK's objects cache
(`getAppObjects(host.api)`, `await load()`, then `id('entity:loan')`, as `caseEntityId` in the starter does). Loans due in the next
seven days that are not finished, soonest first, 200 at a time:

```ts
import { ok, type AppHost, type components } from '@reflexify/agentflow-sdk';

type Wire = components['schemas']['EntityRecord'];
type Page = components['schemas']['EntityRecordPage'];

async function dueSoon(host: Pick<AppHost, 'api'>, entity_id: string, from: string, to: string): Promise<Wire[]> {
  const items: Wire[] = [];
  let cursor: string | null = null;
  do {
    const page: Page = await ok(host.api.POST('/entities/{entity_id}/records/query', { // typed: `cursor` reads it
      params: { path: { entity_id } },
      body: {
        filter: { field_filters: [
          { field: 'status', op: 'in', value: ['requested', 'approved', 'out'] },
          { field: 'due_date', op: 'between', value: [from, to] }, // 'YYYY-MM-DD', both ends included
        ] },
        sort: 'due_date', dir: 'asc', limit: 200, cursor,
      },
    }));
    items.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return items;
}
```

- `filter.field_filters` is a list of `{ field, op, value }`. The operators for each field type are the ones a
  view filter takes (the authoring skill's `entities.md`, "Views"); `in` takes a list, `between` a `[low, high]`
  pair, `is_empty` and `is_not_empty` no value. The filters are ANDed.
- Through one reference: `filter.ref_filters: [{ ref_field: 'item', target_field: 'kind', op: 'eq', value: 'laptop' }]`.
- `filter.q` is a free-text search.
- `sort` is a sortable field's key (`ref.field` for one hop, or `created_at`, `updated_at`), `dir` is `asc` or
  `desc`. `limit` is 1 to 200; `next_cursor` is `null` on the last page.
- `view_id` (the id of one of the entity's views, other than a `detail` view) cuts each record to the view's
  `columns` and sends smaller pages. Leave it out unless you want that; with it, a field the view does not list is
  not in `body` or in `ref_labels`. It does not filter: to show a view's records, send the view's filters yourself.
- "Only my records" is a filter you send yourself, `{ field: 'borrower', op: 'eq', value: host.context.person.id }`.
  It is not a security boundary: what the person may read is decided by their grants.

## One record

`EntityRecord` is `{ id, entity_id, body, created_at, updated_at, ref_labels?, … }`.

- `body` holds the field values by key: text, number and boolean as they are; a `date` as `YYYY-MM-DD`; an `enum`
  as its `value`; a `multi_select` as a list of values; a `reference` as the target record's **id**; a
  `reference_list` as a list of ids; a `file` as a list of **attachment ids** (strings). A field the person may not
  read is redacted or left out.
- To read a file, call `GET /attachments/{attachment_id}` for its metadata (`original_filename`, `content_type`) and
  `GET /attachments/{attachment_id}/download` for its bytes, as a person who can read the record (a test:
  `client.GET('/attachments/{attachment_id}/download', { params: { path: { attachment_id } }, parseAs: 'arrayBuffer' })`).
  The id list is `(record.body.approval_letter ?? []) as string[]`; the generated `EntityFields` types a `file` field
  `unknown`, so narrow it yourself.
- `ref_labels` is `{ [fieldKey]: { [referencedId]: label | null } }`: for each readable reference field, the
  display label of each record it names. A label is `null` when the target is gone or its title is hidden from this
  person. Read a name as
  `record.ref_labels?.borrower?.[record.body.borrower as string] ?? ''`, and for a list field map over
  `body.<field>`. Never show a raw id.

```ts
const toLoan = (record: Wire) => {
  const body = record.body as Record<string, unknown>;
  const labels = record.ref_labels ?? {};
  const named = (field: string) => {
    const id = body[field];
    return typeof id === 'string' ? (labels[field]?.[id] ?? null) : null;
  };
  return {
    id: record.id,
    item: typeof body.item === 'string' ? body.item : '',
    borrower: named('borrower'),
    due: typeof body.due_date === 'string' ? body.due_date.slice(0, 10) : null,
    status: String(body.status ?? ''),
  };
};
```

## A record's runs, and what a run did

A module can list the workflow runs about a record and read what each one did, as counts and timings. Anyone who can
read the record can; through an installed app, only the runs of workflows the package's ceiling covers count. In the
list a run the ceiling does not cover is simply absent; the trace of one answers `404`. A run with no record behind it
(no record subject; a run about a set of records counts too) is its starter's and the admins'; a run about a record is
traced only if the app can read that record, whoever started it.

- `GET /entities/{entity_id}/records/{record_id}/runs`, with `cursor` and `limit` (1 to 200, 50 when absent), answers
  `{ items, next_cursor, prev_cursor }`, newest first, `next_cursor` `null` on the last page. It is a forward feed, so
  `prev_cursor` is always `null`. Each item is a run header:
  `{ id, workflow: { id, key, name }, status, started_at, completed_at, outcome, subject }`. `outcome` is the run's
  outcome label, or `null` (no outcome yet, or the run holds captured values the person may not read).
- `GET /instances/{instance_id}/trace` answers `{ run, steps }`: `run` is the same header, and `steps` are the steps
  that ran, in order. Each is `{ node_id, label, kind, status, started_at, completed_at, attempts }`; `attempts` counts
  how many times the step ran.
  - An agent step adds `agent: { key, name, skills: [{ name, how }], tools: { name: count }, memory: { total, by_type } }`.
    `how` is `always_on` or `loaded`; `tools` counts each tool's calls; `by_type` counts the memory the step drew on by
    memory type key. A type the package does not declare counts as `other`, as does a tool name that is not a plain
    name. `key` and `name` are `null` for a step that sets its agent inline.
  - A Learn step adds `learn`, a map of the counts its last write reported.
- A trace never holds error text, token counts, inputs, outputs, prompts, tool payloads or memory titles. A person who
  needs those opens the run's page in AgentFlow as an admin; a module cannot show them.

```ts
import { ok, type AppHost } from '@reflexify/agentflow-sdk';

async function newestRun(host: Pick<AppHost, 'api'>, entity_id: string, record_id: string): Promise<string[]> {
  const { items } = await ok(host.api.GET('/entities/{entity_id}/records/{record_id}/runs', {
    params: { path: { entity_id, record_id }, query: { limit: 1 } },
  }));
  if (items.length === 0) return [];
  const { steps } = await ok(host.api.GET('/instances/{instance_id}/trace', {
    params: { path: { instance_id: items[0].id } },
  }));
  return steps.map((step) => `${step.label}: ${step.status}`);
}
```

## An app's agents over a window

A module can show what each agent its package installed did over a period, as counts: how many of its steps succeeded
and failed, and what its Learn steps wrote. Only an installed app can ask; the first-party session and a service
principal are refused.

- `GET /app/agents/activity`, with `from` and `to` (date-times; `from` is inclusive, `to` exclusive). `to` is now and
  `from` is 30 days before `to` when absent. The window spans at most 92 days and `from` must come before `to`; any
  other window is `400 VALIDATION_ERROR`. The answer repeats the window:
  `{ from, to, agents: [{ agent: { key, name }, steps: { succeeded, failed }, learn: { proposed, created, confirmed, dropped } }] }`.
- `agents` lists every agent the package installed, sorted by `key`, with zeros for one that did nothing in the window,
  so a module can draw the whole roster. An agent of an optional feature that is off, an agent another package exports
  and the organization's own agents are not listed.
- `key` is the installed key, the same one a trace's `agent.key` carries, so a module can match an agent here to the
  steps of a run's trace.
- A step is one visit of a workflow step that calls the agent, as a trace shows it. A step that retried counts once, by
  how its last attempt ended: `succeeded` or `failed`. A step still waiting or running counts as neither. A step falls
  in the window of its first call, so a step that began before `from` belongs to the earlier window and two adjacent
  windows never count one step twice. A Learn step is a step too, so it is in `steps` and in `learn`.
- `learn` sums what the last write of each of the agent's Learn steps reported, and only a write that succeeded:
  `proposed` memory items and links left for a person to review, `created` items (links are not counted), `confirmed`
  items, and `dropped` candidates. An agent with no Learn step has zeros.

Only runs the person could see through the app count, so two people can get different numbers for the same window. A
run about a record counts only if the person holds `entity.read` and `entity.list` and may both list and read that record, through an
entity the app may read, and only for a workflow the package's ceiling covers. A run about a Workflow task record counts
only while the workflow that opened the task is covered. A run about no record (no subject, or a set of records) counts
only for a person who holds `instance.read.any` or `instance.admin`. A run whose record was deleted or is in the trash,
and a test run, never count. What the person may not see is left out without an error.

The counts say what the agents did, not what happened to the records. For a figure about the records themselves, such
as how many items were closed or how many sit in each status, count the app's own records with `count_records` or a
dashboard the package ships (below). Nothing here names a run or a record, and no prompt, output, tool, error text,
token count or memory title is told; a module cannot show them.

```ts
import { ok, type AppHost } from '@reflexify/agentflow-sdk';

async function agentFailures(host: Pick<AppHost, 'api'>, days: number): Promise<Record<string, number>> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const { agents } = await ok(host.api.GET('/app/agents/activity', {
    params: { query: { from: from.toISOString(), to: to.toISOString() } },
  }));
  return Object.fromEntries(agents.map((a) => [a.agent.key ?? a.agent.name, a.steps.failed]));
}
```

An answer for a package `acme_cases` with one agent, over a window in which it ran four steps, one of them failing,
reads `{ agent: { key: 'acme_cases__helper', name: 'Helper' }, steps: { succeeded: 3, failed: 1 }, learn: { proposed: 0, created: 0, confirmed: 0, dropped: 0 } }`.

## Counting, and figures over many records

Count on the server rather than paging records into the browser to count them:

- `POST /entities/{entity_id}/records/count`, body `{ filter }` (the query's `filter`), answers `{ count, capped }`:
  exact up to 100,000, and `capped` past that. One call per figure.
- A figure split by a field or by a date bucket comes from a dashboard the package ships (the authoring skill's
  `dashboards-and-launcher.md`): `POST /dashboards/{dashboard_id}/compute` computes every tile within the person's
  own access, and `filter_values` answers the dashboard's filter bar for this call. The id is
  `getAppObjects(host.api).id('dashboard:<key>')` after `load()`. The dashboard also appears in the organization's
  Dashboards list.

## Writing records, and doing work

All through `host.api`, as the signed-in person; each refusal is AgentFlow's own and comes back as an
`AgentFlowError` (below). The SDK sends an `Idempotency-Key` for you.

| To | Call | Notes |
|---|---|---|
| create | `POST /entities/{entity_id}/records`, body `{ form_payload: { … } }` | only the keys the entity's create form binds are kept (`http-cases-api.ts` in the starter) |
| change fields | `PATCH /entities/{entity_id}/records/{record_id}`, body `{ changes: { field: value }, expected_updated_at }` | `changes` is by field key; `null` clears a field; `expected_updated_at` is the record's `updated_at` as you last read it, and a stale one is 409 `STALE_VERSION` (read the record again) |
| move a status | the same `PATCH`, `changes: { status: 'approved' }` | 422 `STAGE_TRANSITION_NOT_ALLOWED` when the person is not a mover of that move; 422 `ENTITY_VALIDATION_RULE_FAILED` when a rule refuses it (the message is the rule's own) |
| delete | `DELETE /entities/{entity_id}/records/{record_id}?expected_updated_at=…` | |
| take a task | `POST /entities/{entity_id}/records/{record_id}/work/claim` | for a task offered to a group; `entity_id` is the line's `entity_id` and `record_id` is its `id`, as `GET /work?view=claimable` lists them |
| give a task back | `POST /entities/{entity_id}/records/{record_id}/work/release` | the person releases what they hold |
| tell who holds a record that is a task (its entity has `work`) | read its `claimed_by` (a user id, or empty) and `work_state` | `claimed_by` stays set after the work ends; the authoring skill's `work.md` says what each status does to the work |
| finish a record that is a task | move its status with the `PATCH` above | the holder needs `update` on it: an `update` grant with the `work` record scope gives it to whoever holds the record |
| read a task | `GET /entities/{entity_id}/records/{record_id}/step` | the step's panel, with its `actions` (each an `id` and a `label`) |
| finish a task | `POST /entities/{entity_id}/records/{record_id}/step/submit`, body `{ payload: { _action: '<action id>' } }` | only the person who claimed it: `WORK_NOT_CLAIMANT` (403) otherwise; `HUMAN_ACTION_REQUIRED` or `HUMAN_ACTION_UNKNOWN` (400) for a missing or wrong action |
| start a workflow | `POST /workflows/{workflow_id}/instances`, body `{ name: '<a name for this run>', params: { …the run's input, as the workflow's inputSchema names it } }`, or `{ name, subject: { kind: 'record', record_id } }` for a workflow that starts on a record | `workflow_id` is `getAppObjects(host.api).id('workflow:<key>')` after `load()`; the person needs a start grant |

A 403 or 404 on any of these means the person has no grant for it: show the screen as read only for them rather
than a failure.

## Failures

A refused call is an `AgentFlowError`: show `error.detail` with its leading `CODE:` stripped, or the first of
`error.fieldErrors`, as `toCasesError` in the starter does. `404` on the entity or a record means the person may
not read it; `403` means no grant allows the operation. A person with no access to the entity gets an empty or
refused answer: the module shows its empty or error state, never a crash.
