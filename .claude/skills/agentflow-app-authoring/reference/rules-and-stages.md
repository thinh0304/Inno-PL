# Rules and stage models

Grants say who may write a record at all. Rules refuse particular writes, and a stage model says who may
move a status field from one value to another. Both live in the entity file.

## Rules

`rules` is a list of at most 50 rules. **A rule refuses a write when its condition holds**, so describe the
write to refuse, not the write to allow. Members: `key`, `name`, `condition`, `message`, `field`, `enabled`. Only `key`,
`condition` and `message` are required: a rule with no
`name` installs, and AgentFlow names it from what its condition reads. A blank `name` is refused.

- `key`: lowercase, starts with a letter, at most 40 characters of letters, digits and single `_`; unique in
  the entity.
- `name`: 1 to 120 characters. `message`: 1 to 300, shown to the person refused.
- `field`: the field the message belongs to on a form. `enabled`: a boolean.
- `condition`: `{ "join"?: "and" | "or", "leaves": [...] }`, 1 to 20 leaves.

The case desk's one rule (`config/entities/case.json`):

```json config
{ "rules": [
  { "key": "title_required", "message": "A case needs a title", "field": "title",
    "condition": { "join": "and", "leaves": [ { "kind": "field", "rule": { "field": "title", "op": "is_empty" } } ] } }
] }
```

### Leaves

- **A field leaf**, `{ "kind": "field", "rule": { "field", "op", "value"? } }`, tests the value being written. `field` is an own field, a field the entity's `work` seeds, or one hop through a single
  reference to an entity of the package (`project.status`). `op` is one a view filter takes for that field's
  type (`entities.md`, "Views"): `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `not_contains`,
  `starts_with`, `ends_with`, `between`, `is_empty`, `is_not_empty`; a rule refuses `within`.
  A `value` is a literal, `{ "$field": "<other field>" }`, `{ "$bind": "viewer.id" }` or
  `{ "$date": { "offset": -18, "unit": "years" } }` (`unit`: `days`, `weeks`, `months`, `years`).
  - **`$date` is a day counted from today**, and `{ "offset": 0, "unit": "days" }` is today itself. Both members are
    required; a negative `offset` is in the past, and its size is at most 10,000. Today is the organization's
    today: the day it is now in the zone of the organization's business calendar (UTC when none is set), not the
    server's and not the person's. It is read once for each write, so a batch is judged against one day, and a
    stored value is never re-checked as days go by.
  - It is a bound: only `gt`, `gte`, `lt` and `lte`, on a `date` or `datetime` field (any other operator or field
    type is refused when the package installs). On a `date`, `lt` is before today and `gte` is today or later: the
    rule that refuses a due date in the past is `due_date lt { "$date": { "offset": 0, "unit": "days" } }`, with a
    `changed` leaf beside it when edits may keep an old date (the worked example below). On a `datetime`, today is the whole local day:
    `gte` and `lt` compare with today's midnight, `gt` means after today has ended and `lte` means before it ends.
- **A write leaf**, `{ "kind": "write", "write": { "op", … } }`, tests the write itself:
  - `{ "op": "is_new" }`: a create. `{ "op": "is_update" }`: a change to an existing record.
  - `{ "op": "changed", "field" }` and `{ "op": "changed_any", "fields": [...] }`: the write changes that field.
  - `{ "op": "was", "rule": { "field", "op", "value"? } }`: the value stored before the write (no hop).
  - `{ "op": "actor", "test": {…}, "negate"?: true }`: who is writing (below). `negate` exists only here.

### Actor tests

Used in an `actor` leaf and as a stage model's `movers`. `kind` is one of:

| `kind` | True when the writer | Needs |
|---|---|---|
| `is_owner` | owns the record | |
| `is_holder` | holds the record's work | `work.assignable` |
| `in_field` | is in a people field of the record | `field` |
| `in_parent_field` | is in a people field of the record's parent | `field`, `parent_field` |
| `in_group` | is in a group | `group_id`: a `${param:…}` of type `group_ref` |
| `is_elevated_run` | is a run with elevated rights; a trigger-started workflow's service principal does not pass it | |

A workflow a trigger starts runs as a service principal, which passes only `in_group`. To let its writes through
a rule, put its service principal in an automation group and negate `in_group` on that group. A workflow people
start runs as the person who started it (`INITIATOR`), and its writes are judged on that person like any
of theirs: see `workflows.md`, "Who a workflow runs as".

### Worked examples

Rules on an item that belongs to a team. Only the holder or a team manager may change the content, once the item exists. `is_holder` needs `work.assignable` on the entity, so the item's `work` declares it:

```json config
{ "key": "content_by_owner_or_manager", "message": "Only the owner or a team manager changes this", "field": "title",
  "condition": { "join": "and", "leaves": [
    { "kind": "write", "write": { "op": "is_update" } },
    { "kind": "write", "write": { "op": "changed_any", "fields": ["title", "description", "due", "priority", "collaborators"] } },
    { "kind": "write", "write": { "op": "actor", "negate": true, "test": { "kind": "is_holder" } } },
    { "kind": "write", "write": { "op": "actor", "negate": true,
      "test": { "kind": "in_parent_field", "field": "team", "parent_field": "managers" } } } ] } }
```

A frozen item stays frozen, except for the automation group's workflow (the stored value, so `was`):

```json config
{ "key": "frozen_is_frozen", "message": "This item is frozen because its team is closed",
  "condition": { "join": "and", "leaves": [
    { "kind": "write", "write": { "op": "is_update" } },
    { "kind": "write", "write": { "op": "was", "rule": { "field": "frozen", "op": "eq", "value": true } } },
    { "kind": "write", "write": { "op": "actor", "negate": true,
      "test": { "kind": "in_group", "group_id": "${param:automation_group}" } } } ] } }
```

A date in the past is refused on a create and on a change, by **one** rule: a condition is one `join` over one flat
list of leaves, so "a create, or a change of the date" cannot be written with `is_new` and `is_update` side by
side, but `changed` already covers both. On a create it holds for every field the create sets (there is no earlier
record to differ from), and on an update only for a field the write moves. A create that leaves the date empty, and
an edit that keeps the stored date (closing the record after the date passed, say), are not refused:

```json config
{ "key": "due_not_past", "message": "The due date cannot be in the past", "field": "due_date",
  "condition": { "join": "and", "leaves": [
    { "kind": "write", "write": { "op": "changed", "field": "due_date" } },
    { "kind": "field", "rule": { "field": "due_date", "op": "lt", "value": { "$date": { "offset": 0, "unit": "days" } } } } ] } }
```

Write two rules only when the two cases need different messages. Put `is_new` in a rule only to confine it to
creates, and `is_update` only to confine it to edits.

**A field fixed once the record exists** (read-only after create, such as a key other records store): an item
cannot move to another team. And a closed team takes no new items:

```json config
{ "rules": [
  { "key": "team_is_fixed", "message": "A record cannot move to another team", "field": "team",
    "condition": { "join": "and", "leaves": [
      { "kind": "write", "write": { "op": "is_update" } },
      { "kind": "write", "write": { "op": "changed", "field": "team" } } ] } },
  { "key": "no_item_in_closed_team", "message": "A closed team takes no new items", "field": "team",
    "condition": { "join": "and", "leaves": [
      { "kind": "write", "write": { "op": "is_new" } },
      { "kind": "field", "rule": { "field": "team.status", "op": "eq", "value": "closed" } } ] } }
] }
```

On a record that exists, the record page shows a fixed field as not editable, with the rule's message, and a save
that changes it anyway is refused with the same message.

A hop compared with an own field: `{ "field": "folder.team", "op": "ne", "value": { "$field": "team" } }`
refuses a folder of another team (`folder_in_team`).

### How rules go wrong

- **On a create, every test of the stored record is false, and its negation true.** A rule meant for edits
  must start with `{ "op": "is_update" }`, or it refuses every create.
- **A field leaf reads the value being written.** For "the stored value is …", use a `was` leaf.
- **`$field` needs the same type on both sides.** Compare the hop (`label.base_status`) with the enum, not a
  text formula.
- **`changed_any` names fields one by one.** A field added later is open to everyone with `update` until you
  add it to the rule that guards its peers.
- **A rule cannot read a rollup** ("at most 20 children"). Enforce that in the UI, or not at all.

## Stage model

`stage_model` gates changes of one status field: `{ "status_field", "initial_statuses"?, "transitions" }`.

- `status_field`: an enum field the entity declares (not a seeded one).
- `initial_statuses`: the values a record may be created in.
- `transitions`: each `{ "from", "to", "required_fields"?, "condition"?, "movers"? }`. `from` and `to` are
  values of the field (`closed is not a value of status` otherwise). `required_fields` must be set for the
  move. `movers` is a list of actor tests: whoever passes any one may make the move.

A move that no transition allows is refused, and the running app answers 422 `STAGE_TRANSITION_NOT_ALLOWED`.
The mover also needs `update` on the record from a grant.

The case desk (`config/entities/case.json`): a case starts `open`, and its opener may approve or reject it.
The "Open a case" workflow is started by people, so it runs as them and makes the same moves as the person who
started it. When only one group may move the status, the workflow that records the decision is started by a
trigger and runs as a service principal that is a mover through the automation group: the worked example in
`workflows.md`.

```json config
{ "stage_model": { "status_field": "status", "initial_statuses": ["open"], "transitions": [
  { "from": "open", "to": "approved", "required_fields": [], "movers": [ { "kind": "in_field", "field": "opened_by" } ] },
  { "from": "open", "to": "rejected", "required_fields": [], "movers": [ { "kind": "in_field", "field": "opened_by" } ] }
] } }
```

A team that its managers or the admin group may close:

```json config
{ "from": "active", "to": "closed", "required_fields": [],
  "movers": [{ "kind": "in_field", "field": "managers" }, { "kind": "in_group", "group_id": "${param:admin_group}" }] }
```

- Write one transition per pair of values a person may move between, both ways where both are allowed.
- Add the admin group as a mover wherever admins move records: they get no bypass.
- `is_holder` as a mover needs `work.assignable` (`is_holder needs work.assignable`).
