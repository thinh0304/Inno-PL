# Work: a record as a task

Write `work` on an entity whose records are tasks: people are assigned to them, claim them and finish them. It
puts the records in people's work lists (My Work), routes them to people, and runs clocks on them. It has at least one of `lifecycle`, `assignable`, `work_surface`, `deadline`:

- `assignable` and `deadline` need `lifecycle` (`needs work.lifecycle`);
- `work_surface` needs `assignable`.

Beside them, `module_page` names where a record opens in the package's UI module. It needs `work_surface` and the
package's `ui` (below).

## A record as a task, or a Human step's task

Two things give people a task:

- **`work` on an entity** makes each record a task. People claim the record, finish it by moving its status, and
  find it in My Work.
- **A Human step** opens a task about the run's record. The task is a record of AgentFlow's own Workflow task
  entity, and the step's run settles it: when the holder picks an action, when the step's deadline escalation
  advances it, when its end condition holds, or when the run ends. The action picks the run's next step.

Both on one record are two tasks: two lines in My Work, each claimed on its own, and claiming one leaves the other
offered. The Human step's task does not end when the record's work does, such as on a move to a done status by
hand, unless the step's end condition tests the record's status (`workflows.md`).

| | `work` on the entity | A Human step |
|---|---|---|
| The task is | the record itself | a separate task about the record |
| It ends when | any write moves the record's status into `done` or `cancelled`, a person's or a workflow's | its holder picks an action, its deadline advances it, its end condition holds (`endWhen`), or its run ends |
| A workflow reads who holds it | yes: `claimed_by` on the record | no: a package cannot name the Workflow task entity |
| Another run can end it | yes, by writing the record's status | through the step's end condition, which a write to the run's record can make true (`endWhen`, `workflows.md`, "Human steps") |
| Its outcome | the record's status | the action, or the end condition's label, which picks the run's next edge |

When a workflow must know whether someone holds the task, only `work` on the entity offers that. When the work may
be finished from outside one run, both do: `work` by any write of the record's status, `endWhen` by a condition over
the run's record, which keeps the step's actions and the run's edges.

## An example

```json config
{ "work": {
  "lifecycle": { "status_field": "status", "categories": { "todo": "active", "doing": "active", "done": "done", "cancelled": "cancelled" } },
  "assignable": { "claim": "readers", "rules": [{ "on": "start", "assign": [{ "kind": "dynamic", "source": { "type": "creator" } }] }] },
  "work_surface": { "priority": { "field": "priority", "values": { "low": "low", "medium": "normal", "high": "high", "urgent": "urgent" } } }
} }
```

An item is active while `todo` or `doing`; its creator gets it when work starts; anyone who can read it may
claim it; its `priority` field drives its priority in work lists.

## `lifecycle`

`{ "status_field", "categories" }`, both required. `status_field` is an own enum field. `categories` maps
every value of it, and no other, to `none`, `active`, `waiting`, `done` or `cancelled`.

## `assignable`

`{ "claim"?, "rules"? }`.

- `claim`: who may claim unassigned work: `candidates` (the people a rule assigned it to) or `readers`
  (anyone who can read the record).
- `rules`: at most 50 routing rules, each `{ "on", "when"?, "assign" }`:
  - `on`: `"start"` (when work starts) or `{ "enter": ["<status>", …] }` (when the record enters a status);
  - `when`: an optional condition object;
  - `assign`: 1 to 50 assignees.

The assignees:

| Assignee | Shape |
|---|---|
| a person | `{ "kind": "user", "id": "${param:<user_ref>}" }` |
| a group | `{ "kind": "group", "id": "${param:<group_ref>}" }` |
| a unit | `{ "kind": "unit", "anchor": { "type": "fixed", "unit_id": "${param:<unit_ref>}" }, "reach"?: "unit" or "subtree", "group"?: "${param:<group_ref>}" }` |
| from the record | `{ "kind": "dynamic", "source", "relation"?, "fallback"? }` |

For `dynamic`:

- `source`: `{ "type": "creator" }`, or `{ "type": "field", "key": "<people field>" }` (a field the entity
  declares, not a Units field);
- `relation`: `{ "type": "direct" }`, or `{ "type": "manager", "levels": 1 }` to `5` (a manager needs a single
  reference to Users);
- `fallback`: up to 50 `user`, `group` or `unit` assignees, for when the source gives no one.

A second rule that hands a record to a group when it enters a status (from the builder's README):

```json config
{ "on": { "enter": ["doing"] }, "assign": [{ "kind": "group", "id": "${param:automation_group}" }] }
```

## `work_surface`

`{ "priority": { "field", "values"? } }`: `field` is an own enum field, and `values` maps its values to
`urgent`, `high`, `normal` or `low`.

## `module_page`

`"module_page": "/items/{{ record_id }}"` beside the contracts makes a record open at that page of the package's module,
from My Work, from a work notification and from its email, with the record's id in place of `{{ record_id }}`. Only a
person who may open the app's module and read the record is sent there; anyone else, and every deployment with modules
off, gets AgentFlow's own pane.

- Write `{{ record_id }}` exactly so, with its spaces, at most once, and no other `{{` or `}}`
  (`a module path such as /items/{{ record_id }}`).
- It needs `work_surface` (`needs work.work_surface`) and the package's `ui` (`needs the package's ui`).
- It is a module path, as a launcher module entry's is (`dashboards-and-launcher.md`): it starts with `/`, with no `//`,
  `\`, or `.` or `..` segment. The 200-character limit counts the path with the record's id in it, so a template that holds
  `{{ record_id }}` is at most 179 characters. Lint reports a mistake as `work_module_page_invalid` or `work_module_page_without_ui`,
  and a page without `work_surface`, like any work member without the member it needs, as `work_dependency_missing`.
- The module reads the id from its own path (`host.onLocationChange` is called at once) and must open the record there
  whatever its status: a done or cancelled record is sent to the same page (the `agentflow-ui-module` skill).
- Do not link to `/inbox?record=…` for the app's own records from the module: AgentFlow sends that link straight back
  to the module.

## `deadline`

`{ "clocks": [...] }`, 1 to 5 clocks. A clock is `{ "key", "label", "start", "pause_in"?, "stop"?,
"sla_policy", "escalation_policy"? }`:

- `key`: `^[a-z][a-z0-9_]{0,23}$`. `label`: 1 to 80 characters.
- `start`: `{ "on": "work_start" }` or `{ "on": "enter", "statuses": [...] }`.
- `pause_in`: statuses in which the clock stops running.
- `stop`: `{ "statuses"?, "field"? }`; `field` is a field the entity declares itself. Entering a `stop` status
  stops the clock, and its outcome becomes `met` unless it already breached. A `done` status stops every clock
  too; a `cancelled` one cancels it.
- `sla_policy`: a `${param:…}` of type `sla_policy_ref`. `escalation_policy`: one of type
  `escalation_policy_ref`. A sandbox answers them with `@sla_policy:<key>` and `@escalation_policy:<key>`,
  policies `sandbox.json` declares (the `agentflow-app-release` skill's `sandbox-json.md`).

```json config
{ "deadline": { "clocks": [{ "key": "due", "label": "Due", "start": { "on": "work_start" },
  "pause_in": ["doing"], "sla_policy": "${param:sla}" }] } }
```

- **When it starts.** Work starts when a record is created in an active status or moves into one from a status
  that is not work, so a `work_start` clock starts on create. An `enter` clock starts when the status enters one
  of its `statuses`.
- **Its target** is the SLA policy's target for the work's priority, read through `work_surface.priority`; a value
  the binding does not map counts as `normal`. Changing the priority moves a running clock's target.
- **Business time** is the organization's business calendar: Monday to Friday, 09:00 to 17:00, in its time zone
  (UTC until an admin sets one; a sandbox takes `settings.timezone`), until an admin changes the days, hours or
  holidays.
- `<key>_state` is `running`, `paused`, `stopped` or `cancelled`; `<key>_outcome` is `pending`, `met` or `breached`.

## Escalation ladders

An escalation policy is the organization's, chosen at install (`escalation_policy`); an admin writes it on the
escalation policies page, and a sandbox declares one in `sandbox.json`. It is 1 to 10 steps, each
`{ "at", "action" }`. Only the variant names are camelCase; their members are as written here.

- `at`: `{ "kind": "beforeDue", "duration" }`, `{ "kind": "onDue" }`, `{ "kind": "afterDue", "duration" }` or
  `{ "kind": "pctOfDeadline", "pct" }` (1 to 100 percent of the target). A `duration` is `{ "value", "unit" }` with
  the SLA policy units (`minutes`, `hours`, `days`, `business_hours`, `business_days`), counted in the clock's own
  base: minutes and hours are minutes of that base whichever you write (30 `minutes` on a business clock is 30
  business minutes), and a day is 24 hours on a round-the-clock clock and one working day on a business one.
- `action`:
  - `{ "kind": "notifyCandidates" }`: tells whoever holds the work, or everyone it is offered to while nobody does.
  - `{ "kind": "notifyClaimantManager", "levels" }`: tells the holder's manager, 1 to 5 levels up.
  - `{ "kind": "assign", "to": [...] }`: offers the work to these assignees instead, clears the claim, and, when the entity
    has a `work_surface`, tells them (`work_assigned`, in AgentFlow and by email when the organization has it on). The assignees are the
    shapes a routing rule's `assign` takes.
  - `{ "kind": "raisePriority", "to" }`: `normal`, `high` or `urgent`, through `work_surface.priority`.
  - `{ "kind": "startWorkflow", "workflow_id" }`: starts a workflow of the organization on the record.
- No action tells a group or a person without offering them the work: to tell a group, `assign` to it.
- The people an `assign` names need no grant of the app's to take the work: an installed entity with `assignable`
  gets an Everyone grant of read and list over their work (the `work` scope in `access.md`), so they open and list
  the record while it is offered to them, claim it under `claim: "candidates"`, and, once they hold it, move its
  status. Editing its other fields still needs a grant that reaches them.
## The fields work seeds

Work adds fields to the entity. Views, rules, scopes and stage models may name them, but the entity may not
declare a field with one of these keys:

- `lifecycle`: `work_state`, `work_started_at`, `done_at`;
- `assignable`: `assigned_users`, `assigned_groups`, `assigned_units`, `claimed_by`, `assigned_at`,
  `claimed_at`, `minutes_to_claim`, `minutes_to_done`;
- each clock: `<key>_state`, `<key>_outcome`, `<key>_due_at`, `<key>_breached_at`, `<key>_stopped_at`,
  `<key>_minutes`.

They are read-only and sit in the record's `body` like any field, so a records query returns them. The `_at`
fields are date-times (an ISO 8601 string), `claimed_by` a user id, `assigned_*` lists of ids, the `minutes_*`
and `<key>_minutes` fields numbers, and `work_state`, `<key>_state` and `<key>_outcome` the values above.
`agentflow-app types` leaves them out of `EntityFields`, so a module reads them from `body` by name.

The views in `entities.md` show `claimed_by`, and their "Mine" preset filters on it.

## What a workflow reads and writes on a task

- **Who holds it:** `claimed_by`, a user id or empty, and `work_state`, the category of its status (`none`,
  `active`, `waiting`, `done` or `cancelled`). Every write stamps them from the work itself, so a step reads them
  as fields (`nodes.item.output.record.claimed_by`), and a trigger can test `claimed_by` in `event.changed`. A
  claim or release made anywhere, in the app's own screens or in AgentFlow's My Work, shows up the same way.
- **Finished work keeps its holder.** `claimed_by` stays set once the work is `done` or `cancelled`, so "nobody
  holds it" is `claimed_by` empty while `work_state` is `active` or `waiting`.
- **The status moves the work, in the same write, whoever writes it:** a person, a workflow, an automation.

  | The status moves | The work |
  |---|---|
  | into a `done` or `cancelled` status | ends, and leaves every work list |
  | between `active` and `waiting` statuses | stays live with its holder, and shows as waiting; a clock pauses in every waiting status, unless its `pause_in` names others |
  | from `done` or `cancelled` back to `active` or `waiting` | starts afresh, unclaimed, and the `"start"` rules route it again |
  | into a `none` status | is withdrawn from work lists |

  So a workflow that finishes the record takes it off people's lists by writing its status. A record moved to a
  `waiting` status stays on them, as waiting.
- **Routing rules run only when work starts, and when the record enters a status a rule lists.** A change to any
  other field, the priority included, routes nothing. To hand an escalated record to another group, move it into a
  status a rule lists, or reassign it (`POST /entities/{entity_id}/records/{record_id}/work/assign`, which needs
  `assign` on the record).
- **The holder finishes it.** On AgentFlow's record page, the person holding the work may move the record through
  its stage model without an `update` grant; a write through the records API still needs one, which an `update`
  grant with the `work` record scope gives to whoever holds the record. A candidate reads it while nobody holds
  it, and cannot move it.
- **People claim it** from My Work, or with `POST /entities/{entity_id}/records/{record_id}/work/claim`, and give it
  back with `…/work/release`.

## Acting only while nobody holds the record

A workflow that must leave a record alone while a person holds it reads the record, then tests the hold in a
Decision just before it acts, and acts on nothing in `otherwise`:

```js
decision("free", "Nobody holds it?", [
  when("e_free", { "!": [{ var: "nodes.item.output.record.claimed_by" }] }),
  otherwise("e_held"),
])
```

- A condition holds one comparison. When the record may already be finished, test `work_state` first, in a Decision
  of its own.
- A person can claim between the read and the write. Close the gap in the update itself:
  `update(…, { expect: { fields: { claimed_by: "" } } })`. An expected value that renders empty matches a field
  with no value, and the claim and the update both take the record's lock first, so the update writes while nobody
  holds the record and skips (`skipped: true`) once someone has claimed it. Keep the Decision when the workflow
  must do something else with a held record.

## With access and stage models

- `{ "kind": "work" }` as a record scope gives the people who hold work on a record access to it.
- `is_holder` is an actor test for the holder, in rules and as a stage-model mover. A transition to `done` whose
  only mover is `is_holder` lets only the holder finish the record.
- Both need `assignable`.
