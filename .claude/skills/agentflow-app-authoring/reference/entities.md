# An entity file: `config/entities/<key>.json`

One file per entity. The file name, without `.json`, equals `key`. `name`, `fields`, `views` and `access` are
required; a file without one is refused with a location (`entities/note.json#/views: an array of views`).
Access, rules, stage models and work have their own reference files; `source` is at the end of this one.

| Member | Meaning |
|---|---|
| `key` | the entity key; equals the file name |
| `name`, `description`, `icon`, `accent` | carried as written (not translated) |
| `icon`, `accent` (values) | `icon` is one of the 40 names listed under `icon` in `dashboards-and-launcher.md`; `accent` is `sky`, `amber`, `emerald`, `violet`, `orange`, `rose`, `indigo`, `teal`, `cyan` or `slate`. Anything else installs: an unknown `icon` draws the database icon, an unknown `accent` slate. A deployment older than the release that added the gear, `settings`, does not know it and draws the database icon |
| `fields` | the fields, in display order |
| `natural_key` | the field sets that identify a record; `[]` for none |
| `seed` | records the install creates, once per natural key (below, "Starter records: `seed`") |
| `display_field` | the field shown as the record's title |
| `views` | the record lists |
| `create_form` | the form for creating a record |
| `access` | `{ "mode", "grants" }`: see `access.md` |
| `conversation` | declares the entity a conversation (below); write `null` for any other entity |
| `rules`, `stage_model` | see `rules-and-stages.md` |
| `work` | see `work.md` |
| `source` | fills the entity from a synced stream; its records are then read-only (below) |

A conversation is declared on the thread entity. It names the entity whose records are its messages, the
reference field on them that points at the thread (`via`), and the message fields that play each role; each
`speakers` value is `user`, `assistant` or `exclude`, and `attachments` is optional:

```json
{ "conversation": {
  "messages": { "entity_id": "${entity:message}", "via": "thread" },
  "order": "posted_at",
  "author": { "field": "author_kind", "speakers": { "person": "user", "bot": "assistant", "unverified": "exclude" } },
  "body": "body", "attachments": "attachments",
  "status": { "field": "status", "draft": "draft" },
  "key": "key"
} }
```

The fields have to fit, or the build is refused. `via` is a reference field that points at the thread entity.
`order` is a datetime, or an `auto_number` with no code format (a plain number). `author.field` and `status.field`
are enums, and `speakers` names every option of the author enum and nothing else. `draft` is one of the status
enum's options. `body` is a text field, `attachments` a file field, and `key` a text field that is the only member
of an alternate key. Each role needs a field of its own.

**What declaring a conversation gives.** Declare one when an entity's records are threads whose messages are
records of another entity, written by people and by an agent. Then:

- an Agent step reads a thread as the conversation it answers (`workflows.md`, "Agent steps that read a
  conversation");
- a step that saves from an agent's answer can skip the write when a message joined the thread after the agent
  read it (`workflows.md`, "Saving from an agent's answer: the conversation check").

In an installed app the roles are the app's contract: the organization may add an option to `speakers`, but not
move a role to another field, map an option to another speaker, or clear the conversation (`APP_OBJECT_GUARDED`).

When you add an entity, add its key to `entityOrder` in `agentflow.app.mjs` if that file has one: an entity
file that `entityOrder` does not name is refused, and so is the reverse.

## The case desk's entity

`config/entities/case.json` in the starter, with its access as the starter has it. Its `rules` and `stage_model`
are left out here: they are in `rules-and-stages.md`, and an entity without them is valid as it stands.

```json config
{
  "key": "case", "name": "Case", "description": "A case someone opened, and how its review ended.", "icon": "inbox", "accent": "sky",
  "fields": [
    { "key": "title", "label": "Title", "type": "text", "required": true, "searchable": true },
    { "key": "urgent", "label": "Urgent", "type": "boolean", "default": { "kind": "literal", "value": false } },
    { "key": "opened_on", "label": "Opened on", "type": "date" },
    { "key": "summary", "label": "Summary", "type": "text", "format": "richtext" },
    { "key": "amount", "label": "Amount", "type": "number" },
    { "key": "status", "label": "Status", "type": "enum", "facetable": true,
      "enum_values": [ { "value": "open", "label": "Open", "color": "sky" }, { "value": "approved", "label": "Approved", "color": "emerald" },
                       { "value": "rejected", "label": "Rejected", "color": "rose" } ],
      "default": { "kind": "literal", "value": "open" } },
    { "key": "opened_by", "label": "Opened by", "type": "reference", "target_entity_id": "ffffffff-0000-0000-0000-000000000001",
      "default": { "kind": "creator" } }
  ],
  "natural_key": [], "display_field": "title",
  "views": [ { "key": "all", "name": "Cases", "columns": ["title", "urgent", "status", "opened_on"] } ],
  "create_form": { "name": "Case", "schema": { "type": "object", "properties": {
    "title": { "type": "string", "x-entityField": "title" },
    "urgent": { "type": "boolean", "x-entityField": "urgent" },
    "opened_on": { "type": "string", "format": "date", "x-entityField": "opened_on" } } } },
  "access": { "mode": "restricted", "grants": [
    { "principal": { "kind": "group", "id": "${param:app_users}" }, "design": false,
      "operations": [ { "operation": "read", "scope": "organization" }, { "operation": "list", "scope": "organization" },
                      { "operation": "create", "scope": "organization" },
                      { "operation": "update", "record_scopes": [ { "kind": "field", "field": "opened_by" } ] } ] } ] },
  "conversation": null
}
```

## Fields

Each field becomes an `entity_field:<entity>/<key>` object. A field takes these members and no other:
`key`, `type`, `label`, `description`, `required`, `searchable`, `filterable`, `facetable`, `sortable`,
`enum_values`, `default`, `format`, `format_options`, `inverse_key`, `inverse_label`, `target_entity_id`,
`on_target_delete`, `auto_number_scope`, `auto_number_format`, `formula_expression`, `formula_result_type`,
`rollup`, `item_fields`, `constraints`, `reference_filter`. Anything else, `sensitive` included, is refused
with `not a member the package's entity_field lists`.

**Every entity has a text field `name`** (label "Name"). When `fields` declares none, the install adds it first in
field order, and an entity with no `display_field` shows it as the record's title (below, "The display field").
Declare a field keyed `name` to give it your own label or settings; it must be a scalar. An entity whose title is
another field still has `name`, empty unless something writes it.

The builder does not check `type`, `format`, `format_options` or `constraints`, and neither does `lint`:
AgentFlow checks them when the package is installed, so a mistake shows on the admin's setup page or fails the
activation, long after your build. Use only these. The thirteen types and what each takes:

| `type` | Notes, and what it accepts |
|---|---|
| `text` | `"format"`: `email`, `url`, `phone` or `richtext` (long text: `summary` above). `"format_options": { "mentions": true }` lets its value hold `@` mentions of people and records, never on the display field. Constraints: `min_length`, `max_length`, `pattern`, `enforce_format` |
| `number` | `"format"`: `currency` (with `format_options.currency_code`, three capital letters), `percent`, `duration` (`duration_unit` `seconds`, `minutes` or `hours`; `duration_format` `human`, `hh_mm` or `hh_mm_ss`) or `rating` (`rating_max` 1 to 10). `format_options`: `decimal_places` 0 to 8 (`"format_options": { "decimal_places": 2 }`), `separators`. Constraints: `minimum`, `maximum` |
| `boolean` | |
| `date`, `datetime` | `"format"`: `dd_mm_yyyy`, `mm_dd_yyyy`, `iso`, `long`, `month_year` or `relative`. A `datetime` also takes `format_options.time_style`: `12h` or `24h` |
| `enum` | one choice from `enum_values` of `{ "value", "label", "color"? }`; colours: `gray`, `sky`, `teal`, `amber`, `emerald`, `violet`, `indigo`, `rose`, `fuchsia`, or a custom `#RRGGBB` |
| `multi_select` | several choices from `enum_values`; stored as a list, filtered with `in` and `not_in`, never sortable. Constraints: `min_items`, `max_items` |
| `reference` | one record: `target_entity_id` (below), `inverse_key` and `inverse_label` name the list on the target |
| `reference_list` | many records; give it `"sortable": false`. Constraints: `min_items`, `max_items` |
| `list` | rows of `item_fields` (below). Constraint: `max_items` |
| `file` | `"format": "image"` for pictures; `"format_options": { "max_files": 20 }`, 1 to 500 |
| `formula` | a computed value: `formula_expression` and `formula_result_type` (`text`, `number`, `boolean`, `date` or `datetime`), or a `rollup` (below) |
| `auto_number` | `auto_number_scope` and `auto_number_format` (below) |

**Long text.** A `text` field with `"format": "richtext"` is the only long-text kind: there is no plain multi-line
format (`text` takes `email`, `url`, `phone` and `richtext`). The value is stored, and arrives in a record's `body`,
as a **Markdown string** in the form AgentFlow's own editor and the kit's `af-rich-editor` both read and write
(`*em*`, `**bold**`, `- ` bullets, `[text](url)` links, a backslash for a hard break). To show it in a UI module,
use `af-rich-editor` with `readonly` and the Markdown as its `value` (`@reflexify/agentflow-elements/kit`; a
read-only editor has no toolbar and cannot be edited), and to edit it, the same element without `readonly`, which
reports the new Markdown in its `change` event. The kit exports no function that turns Markdown into HTML: if you
render it yourself, never put the result in `innerHTML`. For a plain note a person types in one go, a `text` field
with `max_length` and no `format` holds any string you put in it, but nothing in the config asks the record page
for a multi-line box.

A `format` the type does not take, or a constraint it does not allow, is refused at install. What a
field can do in a list, a filter or a sort follows from its type unless you set it:

| `type` | `filterable` | `sortable` | `searchable` | `facetable` |
|---|---|---|---|---|
| `text` | yes | yes | yes | no |
| `number`, `date`, `datetime`, `auto_number` | yes | yes | no | no |
| `boolean`, `enum`, `reference` | yes | yes | no | yes |
| `multi_select`, `reference_list` | yes | no | no | yes |
| `list` | yes (emptiness only) | no | no | no |
| `file` | no | no | no | no |
| `formula` | as its result type | as its result type | no | as its result type |

A view's `filters` need `filterable`, and its `sort` needs `sortable`.

- **`default`**: `{ "kind": "literal", "value": … }`, or `{ "kind": "creator" }` for a people field that starts
  as the person who creates the record (`opened_by` above). **Only a person is a creator.** A record made with a
  service key (a deploy key, an import, a test script) has no `created_by`, so the default fills nothing: the field
  stays empty, a `required` one refuses the create (422), and a record scope on that field (`kind: "field"`)
  matches nobody, so that scope admits no one; only people another grant admits (organization-wide, a unit, their
  work, another field) can read the record. Make test and
  import records as a person (in a sandbox, `as(handle)`), or name the person in the field yourself.
- **`target_entity_id`**: `"${entity:<key>}"` for an entity of the package, or a platform entity by id:
  Users `ffffffff-0000-0000-0000-000000000001`, Units `ffffffff-0000-0000-0000-000000000003`. A reference or
  reference list to Users or Units is a **people field**, which grants, rules and stage models test. A package
  cannot name the Groups entity (`not an entity reference or a reserved entity id`): to involve a group, use a
  `group_ref` parameter in a grant, a rule or a mover, and a Users field for people.
- **`on_target_delete`**: `restrict`, `clear` or `cascade`, for what happens when the target is deleted.
  With `restrict` on an item's reference to its team, a team that has items cannot be deleted.
- **`natural_key`**: a list of `{ "id", "name", "fields" }`, such as
  `[{ "id": "by_name", "name": "Name in its team", "fields": ["team", "name"] }]` for a name unique within a team.
- **Order**: a formula after the fields it reads.
- **`auto_number`**: `"auto_number_scope": "item:{{ year() }}"` and
  `"auto_number_format": "IT-{{ year() }}-{{ value | pad(4) }}"` number items like `IT-2026-0001`.

A reference to another entity of the package, with its inverse:

```json config
{ "key": "team", "label": "Team", "type": "reference", "target_entity_id": "${entity:team}",
  "inverse_key": "items", "inverse_label": "Items" }
```

### A list field

`item_fields` is a list of columns: `key`, `label`, `type` (`text`, `number`, `boolean`, `date` or `enum`),
`required`, `history`, `enum_values`, `mentions` (a `text` column whose values may hold mentions: written on the column itself, not as `format_options`, which the builder refuses there). `constraints` takes `min_length`, `max_length`, `pattern`, `minimum`,
`maximum`, `min_items`, `max_items`, `enforce_format`. A checklist:

```json config
{ "key": "checklist", "label": "Checklist", "type": "list", "sortable": false,
  "item_fields": [
    { "key": "text", "label": "Text", "type": "text", "required": true, "mentions": true },
    { "key": "done", "label": "Done", "type": "boolean", "required": false, "history": false }
  ],
  "format_options": { "display": "checklist", "done_field": "done" },
  "constraints": { "max_items": 20 } }
```

### A file belongs to one record

A file field holds files that belong to its record, and a file belongs to exactly one record. A step that writes a
file another record already holds fails with `ENTITY_ATTACHMENT_INVALID`
(`attachment <id> is already attached to another record`), and the run fails on that first attempt (an AgentFlow
build from before 2026-10-30 retries the step three times first). A file the run itself holds, one uploaded through a start or Human form
or made by a Document or Image step, is copied on each write, so one run may put it on several records. To put a file
another record holds on a second record, mark the binding: `bind("docs", ref("input.item"), { copy: true })`. The
record gets its own copy. The run must be able to read the record that holds the file, as a Get of it would, and a
file in a secured field is copied only into a secured field. The copy is not automatic
because everyone who can read the new record can read it. To show one file in two places without copying it,
reference the record that holds it. `copy` needs an AgentFlow build from 2026-10-30 or later.

### Formulas and rollups

A formula reads the record's own fields: `{ "key": "checklist_done", "type": "formula",
"formula_expression": "count_if(checklist, \"done\")", "formula_result_type": "number" }`.

Dates are the other common formula. `date_diff(from, to, "days")` is `to - from` in the unit you name (`days`,
`weeks`, `months` or `years`), and `date_add(value, 3, "months")` is the date that much later. The two operands are
field keys, not quoted strings; only the unit is quoted. So a leave request's length, counting both ends, is
`{ "key": "days", "type": "formula", "formula_expression": "date_diff(from_date, to_date, \"days\") + 1",
"formula_result_type": "number" }`, which is 3 for the 21st to the 23rd. A formula cannot call `today()`, `now()` or
`year()`: a stored value would drift between saves. The functions and filters a formula may use are listed in the
guide's "Variables & expressions" page, `<AGENTFLOW_URL>/guides/en/quy-trinh/bien-va-bieu-thuc`.

A rollup counts or sums child records. It is a `formula` with a `rollup` and no `formula_expression`.
`rollup` has `inverseKey` (camelCase, unlike every other member: the `inverse_key` of the child's reference
to this entity), `agg`, an optional `field`, and an optional `filter` of `{ field, op, value }`. A
team counts its done items:

```json config
{ "key": "items_done", "label": "Done", "type": "formula", "formula_result_type": "number",
  "rollup": { "inverseKey": "items", "agg": "count", "filter": [{ "field": "status", "op": "eq", "value": "done" }] } }
```

A rule cannot read a rollup, and a workflow should not read a record that has one: see `pitfalls.md`.

### The display field

`display_field` names the field whose value is the record's title: in pickers, in a reference's label
(`ref_labels`), in the inbox and in lists. Declare it for every entity.

- It must be one of the entity's own `fields`, a scalar and not a system field: `text`, `number`, `boolean`,
  `date`, `datetime`, `enum`, `multi_select`, `formula` and `auto_number` all work (use a `text`, `auto_number` or `formula` field for a title people read). A `reference`,
  `reference_list`, `file` or `list` field cannot be one (the install refuses it).
- Without one, the title is `name` (Fields, above), which is empty unless something writes it.
- A sensitive field's value is withheld from people without access to it, so do not make one the title.
- **An entity with no natural title** (a loan, a visit, a request) gets an `auto_number` field and names it:
  `"display_field": "number"`.

```json config
{ "fields": [
    { "key": "number", "label": "Number", "type": "auto_number",
      "auto_number_scope": "loan:{{ year() }}", "auto_number_format": "LN-{{ year() }}-{{ value | pad(4) }}" },
    { "key": "item", "label": "Item", "type": "reference", "target_entity_id": "${entity:equipment}", "required": true }
  ],
  "display_field": "number" }
```

A person cannot type the number: it is minted when the record is created, so leave it out of the create form.

## Views

Each view becomes an `entity_view:<entity>/<key>` object. Members: `key`, `name`, `description`, `type`,
`config`, `columns`, `filters`, `sort`.

- `type`: `grid` (the default), `kanban`, `calendar`, `gallery`, `timeline`, `map`, `inbox` or `detail`.
  Others are refused (`a view type the builder has no rule for: matrix`). Most types need a field in `config`:

  | `type` | `config` member | Field it takes |
  |---|---|---|
  | `grid` | `group_by_field` (optional) | an enum, reference, boolean or text field |
  | `kanban` | `group_by_field` (required) | an enum field |
  | `calendar` | `date_field` (required), `end_field` | a date or datetime field |
  | `timeline` | `start_field`, `end_field` (both required) | date or datetime fields |
  | `inbox` | `sort_field` (required) | a number, date or datetime field |
  | `gallery` | `cover_field` (required) | a file field |
  | `detail`, `map` | none; no field can fill a `map` yet | |

  AgentFlow refuses a view whose role field has the wrong type when the package is installed, not at `lint`.
- `columns`: field keys of the entity, including those its `work` seeds. A key that is not a field is
  refused (`nope is not a field of case`).
- `filters`: a list of `{ "field", "op", "value" }`, **fixed**: each `value` is a literal and is compared as
  written. `field` may be `reference.field` to filter through one reference. `op` depends on the field's type:

  | Field type | `op` |
  |---|---|
  | `text` | `eq`, `ne`, `contains`, `not_contains`, `starts_with`, `ends_with` |
  | `number` | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `between` (`[low, high]`) |
  | `date`, `datetime` | the number operators, and `within` (`today`, `last_<n>_days`, `this_month`, `this_quarter`, `this_year`, `before_today`, `after_today`) |
  | `enum`, `reference` | `eq`, `ne`, `in`, `not_in` (a list value) |
  | `boolean` | `eq`, `ne` |
  | `multi_select`, `reference_list` | `in`, `not_in` |
  | any | `is_empty`, `is_not_empty` (no value) |

  `pnpm build` checks each fixed filter and each preset rule against the entity: the field exists (a hop,
  `reference.field`, is checked against the package entity the reference points at), the `op` suits the field's type,
  a `within` value is a window and an `in`, `between` or `range_any` value has its shape, and `$bind` stands only in a
  preset. It does not check that the field is `filterable`, or a hop to an entity outside the package; AgentFlow
  refuses those at install (`pitfalls.md`, "What `build` does not check").

  A rule's field leaf takes the same operators, except `within` (use a `$date` value, `rules-and-stages.md`).

  `within` windows are days counted from the organization's today: `last_<n>_days` is the last n days counting
  today (n from 1 to 3660, no leading zero), and `this_month`, `this_quarter` and `this_year` run to the period's
  end. `before_today` is every day before today and `after_today` every day after it; neither includes today.
  An AgentFlow build older than the release that added those two refuses them at install, and
  `minPlatformVersion` is a month, so it cannot tell such a build from a later one in the same month: check the
  deployment's release before relying on them.

  **An "overdue" view.** Ship a view whose fixed filters are the open statuses and
  `{ "field": "due", "op": "within", "value": "before_today" }`, with `sort` `{ "key": "due", "dir": "asc" }` so
  the longest overdue come first. For loans the other fixed filter is `status eq approved`. Do not approximate
  with `within last_365_days`: it lists records due today and drops older ones.

  **An "overdue" list a person opens from the launcher.** An `object` entry opens the view itself
  (`${entity_view:loan/overdue}`), so the view above is the list; name the entry for what it lists ("Overdue
  loans"). A list that needs a preset or a query a fixed filter cannot say is a `module` entry instead
  (`"target": { "module": "/overdue" }`), whose screen sends the comparison through the records query (the
  `agentflow-ui-module` skill, "Reading records"). The entry needs the manifest's `ui`, it is listed to everyone
  in the app's audience, and what a person sees in it is still decided by their grants.
- `sort` defaults to `{ "key": "updated_at", "dir": "desc" }`; `key` is a `sortable` field, `updated_at` or
  `created_at`.
- `config.presets`: quick filters a person picks from the view's toolbar, each `{ "id", "label", "rules" }`
  (`id` is a UUID, fixed in the file; `lint` does not count it as `uuid_literal`). Only here does a value read the person looking: `{ "$bind": "viewer.id" }`
  (with `eq`, `ne`, `in`, `not_in`), `{ "$bind": "viewer.groups" }` (with `in`, `not_in`) and
  `{ "$bind": "today" }` (a `date` field with `eq`, `ne`, `gt`, `gte`, `lt`, `lte`; a `datetime` field with `gt`, `gte`, `lt`, `lte`).

**`$bind` in a fixed `filters` entry is refused.** `pnpm build` stops with `entities/<entity>.json#/views/<n>/filters/<m>/value:
a fixed filter compares as written and never resolves $bind: put the filter in a preset in config.presets`. A package
built with SDK 0.3.0 or earlier got through, and the platform compared the value as the text
`{"$bind":"viewer.id"}`, so the view listed nothing, for everyone. For "my records":

- a **preset** `Mine`, as below, when the person may choose it;
- a **record scope** in the grant (`{ "kind": "field", "field": "borrower" }`, `access.md`) when a person may see
  only their own records whatever they pick: the view then lists exactly those;
- in a UI module, a filter the module sends itself, with `host.context.person.id` (`agentflow-ui-module`).

**A preset is never the default, and a launcher entry cannot open one.** A view opens with no preset chosen: a
view has no "default preset" member, and a launcher entry's `object` target opens the view itself
(`/entities/<id>/records?view=<view id>`), with no way to name a preset. So a `Mine` preset is a click the
person makes, for everyone. A record scope, the other way to get "my records", **narrows only the people it is
the sole grant for**: a person who also holds a wider grant (an IT group with organization scope) sees every
record in the same view, because grants add up. To give those people "my X" too, give them a UI module screen
that sends the filter itself with `host.context.person.id`, or tell them to pick the preset. Do not promise a
"My X" launcher entry that is mine for everyone.

An entity's views, one with a preset and one with a fixed filter:

```json config
{ "views": [
  { "key": "all", "name": "Items", "columns": ["title", "team", "status", "priority", "due", "claimed_by"],
    "config": { "presets": [{ "id": "0190f8f4-0000-7000-8000-0000000000f1", "label": "Mine",
      "rules": [{ "field": "claimed_by", "op": "eq", "value": { "$bind": "viewer.id" } }] }] } },
  { "key": "open", "name": "Open items", "columns": ["title", "team", "status", "priority", "due", "claimed_by"],
    "filters": [{ "field": "status", "op": "in", "value": ["todo", "doing"] }] }
] }
```

## The create form

`create_form` is `{ "name", "description"?, "schema" }` and becomes the `form:<entity>` object. `schema` is a
JSON Schema of `"type": "object"`; each property names the field it fills with `x-entityField`.

- **Every `required` field needs a property in the form**, or no `required`. A required field that no property
  binds cannot be filled in, and the install refuses the form; `lint` reports it as `required_field_unbound` on the
  field, at `/required`. A field with a `default` (the creator, a literal) is filled without the form, so drop
  `required` from it rather than bind it.
- An enum property repeats the field's values: `{ "type": "string", "enum": ["annual", "sick"], "x-entityField":
  "leave_type" }`.
- A reference property has `"format": "entity"` and `x-entity`: an entity key of the package, `user`,
  `org_unit`, or the field's `${dep:<package id>#entity:<key>}` when it targets a required package's entity.
- A people-list property puts `"format": "entity"` under `items`, and keeps `x-entity` on the array.
- A `date` field's property is `{ "type": "string", "format": "date" }`, and a `datetime` field's is
  `{ "type": "string", "format": "date-time", "x-entityField": "start" }`. AgentFlow sets the `type` and
  `format` of a bound date or datetime property from the field itself, so a missing or wrong one is corrected,
  not refused. The value the form accepts for a `datetime` is an RFC 3339 timestamp with a time and an offset,
  such as `2026-03-01T09:00:00Z`; `2026-03-01` or `2026-03-01T09:00` is refused as a bad `format`.
- A `file` field's property is always a list of file ids, even when `max_files` is 1:
  `{ "type": "array", "items": { "type": "string", "format": "attachment" }, "x-entityField": "document" }`.
  `build` and `lint` do not check a property's shape, so write it as shown.
- The layout is always vertical; you write no UI schema.
- The form decides what a create **through the records API** may set (a person on AgentFlow's own create page,
  a UI module, a service principal): `POST /entities/{id}/records` keeps only the keys the form binds. A
  workflow's `create` step does not go through the form: it writes every field it binds (a status, a
  position, `opened_by`), whether or not the form shows it. A UI module that must set another field on create
  patches it in a second write, or starts a workflow that creates the record.

A create form with a people list:

```json config
{ "create_form": { "name": "Team", "schema": { "type": "object", "properties": {
  "name": { "type": "string", "x-entityField": "name" },
  "managers": { "type": "array", "items": { "type": "string", "format": "entity" }, "x-entity": "user", "x-entityField": "managers" }
} } } }
```

And a reference to another entity of the package:
`"team": { "type": "string", "format": "entity", "x-entity": "team", "x-entityField": "team" }`.

## Comments

`comments` makes an entity's records take a comment thread: `{ "enabled": true, "closed_when": { "join": "and",
"leaves": [{ "kind": "field", "rule": { "field": "frozen", "op": "eq", "value": true } }] } }`. `closed_when` is
optional and makes a record's thread read-only while it holds. Its leaves are field leaves over the entity's own
declared fields (no `reference.field` hop): posting a comment writes nothing, so a write leaf is refused. Once
installed the setting is the app's: an administrator's change is refused until the app is detached. A release
that drops `comments` turns comments off and keeps the comments already posted.

**A package that ships a `detail` view places the thread itself.** Installing never adds the block: the record
page draws the stored layout as written, so a layout without one shows no comments, and a comment notice links
to that page. Put `{ "kind": "comments" }` in the layout, at the bottom of the wide column (the generated default
puts it there). A package with no `detail` view gets the generated default, which already holds it.

## Starter records: `seed`

Some apps need records the moment they are installed: a list of categories that other records point at, say.
There are two ways to give them, and each fits a different kind of data:

- **A seed** (this section), for data that is the same in every organization: the same codes and names, chosen
  before anyone has looked at the organization. The install creates the records, the setup page shows how many each
  entity creates and which keys a record of the organization already holds before the admin approves, and nobody
  has to do anything else. It costs literals only, records fixed once seeded (a later release cannot change them),
  no owner or creator on them, and an AgentFlow deployment from before seeds refuses the whole package.
- **The app's own screen** (next section), for data that depends on the organization: names in the admin's
  language, values taken from records the organization already has, a choice the admin makes. It costs a screen
  and its code, and a person has to confirm it.

`seed` is a list of record bodies on the entity, each naming fields by key with literal values. A `category`
entity keyed by its code:

```json config
{ "fields": [
    { "key": "code", "label": "Code", "type": "text", "required": true },
    { "key": "active", "label": "Active", "type": "boolean", "default": { "kind": "literal", "value": true } }
  ],
  "natural_key": [{ "id": "by_code", "name": "Code", "fields": ["code"] }],
  "seed": [
    { "code": "general", "name": "General" },
    { "code": "billing", "name": "Billing" }
  ] }
```

A seed may set `name` without declaring it (Fields, above). What a seed may hold:

- **Only on an entity with a `natural_key`.** Every body sets every field of the first key set (`by_code` here),
  and no two bodies share a key. The key is how the install tells a record it has already seeded from one it has
  not.
- **Literals for the entity's own fields**: a string for `text`, `date` and `datetime`, a number for `number`,
  `true` or `false` for `boolean`, one of the values for `enum`, a list of values for `multi_select`. A
  `reference`, `reference_list`, `file`, `list`, `formula` or `auto_number` field cannot be set, nor a rollup, nor a
  field the entity does not declare, the fields its `work` seeds included. A field the body leaves out takes its
  `default`, and an `auto_number` is drawn as for any record.
- **No references.** A seed is copied as written, never translated, so a string that contains `${` or starts with
  `@` is refused. A seed cannot point at another record or read a parameter.
- **At most 1,000 bodies in the package**, across all its entities.

`pnpm build` refuses a `seed` that is not a list, a body that is not an object, a `${`, a leading `@`, and more
than 1,000 bodies in one file. It does not check the key or the field types, and neither do `lint` and `seal`:
AgentFlow refuses those when the package is uploaded, with `PACKAGE_BODY_INVALID` and the place,
`objects/entity/<key>.json seed/<index>/<field>`. An AgentFlow deployment from before seeds existed refuses every
package that has one, with the same code.

**What the install does.** It creates each body as a record after the entity's rules and stage model are in place,
and they judge it as they judge any create: a rule about the record applies, a rule about the person writing does
not (nobody is writing), and the status must be one the stage model lets a record start in. A seed has **no owner
and no creator**. So a `creator` default fills nothing (and a `required` field with one refuses the seed), a grant
with `own` scope never reaches a seed, and a record scope on a people field matches nobody until someone fills the
field: give the people who use these records a grant with `organization` scope. A seed AgentFlow refuses (a rule,
a required field left empty, a status the stage model does not start in, a malformed date) shows on the setup page
as `APP_STEP_FAILED` on the entity at `<code>:/seed/<index>`, with AgentFlow's message, and the plan cannot be
approved while it stands. On an upgrade the organization's own rules on the entity judge a new seed too. The
setup page lists, under "Starter records", how many records each entity creates and which keys a record of the
organization already holds; the run page lists what was created.

**Upgrade, undo and reattach.**

- **An upgrade creates only the seeds whose key the app has never seeded in this organization.** A seed already
  created is never written again: an admin's edit stays, a record the admin deleted stays deleted, and new values
  for that key in a later release change nothing. A release that drops a seed leaves its record. To change records
  already seeded, change them another way: the admin, or a workflow a person starts.
- **A key a record of the organization already holds** is left as it is, and the setup page lists it as already
  there.
- **A seed an upgrade adds is a new record like any other**, so an armed trigger on the entity starts for it. A
  first install's seeds start nothing, because triggers install off.
- **Undo removes the seeds nobody changed**, with their entity. A seed someone edited or commented on blocks undo,
  as any record does, and so does a record of the organization that held a seed's key. After an undo, installing again seeds
  again.
- **Detach keeps what was seeded**, so a reattach seeds only keys the app has never seeded.
- **Seeds stay keyed by the key set the app's first seeds of the entity were recorded under**: the entity's first
  key set at that install. A later release may add key sets or list them in another order, but every seed must keep
  setting that key's fields; one that does not is refused at `VALIDATION_ERROR:/seed/<index>`.
- **An entity's first natural key and its first seeds may come in one release**, but when the entity already holds
  records its seeds wait: the key is built after the install, so the install creates none of them and the setup
  page and the run page say the entity waits for its key. The next upgrade (or a reattach) creates them, once the
  key has finished building. An entity with no records yet, or one that already has a key set, seeds at once.
  Only a later release (installing the same version again is refused, `APP_VERSION_NOT_NEWER`) or a detach and
  reattach seeds a waiting entity, so adding the key in one release and the seeds in the next seeds them sooner.
- **`agentflow-app init --from` does not carry seeds**, because AgentFlow's Pack does not write them: add them to
  the converted config by hand.

## Starter records the app creates itself

For data that depends on the organization, give the app a screen that proposes the records and creates them when
an admin confirms: a UI module (the `agentflow-ui-module` skill). A seed cannot do this: it is written at install,
before anyone has looked at the organization, and holds literals only. A screen can read what the organization
has, word the records in its language, and ask. What keeps pressing it again, or after a change, safe:

- **Show what will be created first.** List the records with their values, and the ones already there, and create
  nothing until the admin confirms.
- **Create each by its natural key.** Give the entity a `natural_key`, and send each record as a create,
  `POST /entities/{entity_id}/records` (`records-api.md` of the `agentflow-ui-module` skill). A `409` with
  `ENTITY_NATURAL_KEY_CONFLICT` means a record already holds that key: count it as already there and go on, so a
  second press creates nothing twice.
- **Use a create, not an `upsert`.** An upsert (a workflow's `upsert` step, say) finds the record by its key and
  writes its values over it, so a second press would undo whatever the admin changed. A create leaves a record that
  exists as it is.
- **Count a record the admin retired as present.** Give the entity a way to retire a record that keeps it, such as
  the `active` field above, and count a retired one as there, so the screen never brings it back. A deleted record
  frees its key: the next create of that key makes a new record, and the key alone cannot tell it from one never
  created. If deleted records must stay deleted, the screen has to remember what it created, in a record of the
  app's own.
- **Order the creates so a failure part-way leaves a safe state.** Each create is its own write, and nothing undoes
  the ones before a failure. Create the records others point at first (a team before the items under it), and
  anything that turns behaviour on last, so a stop half-way leaves records nothing uses yet; the next press
  creates the rest by key.
- **The create runs as the person who confirms.** They need a `create` grant on the entity, rules about the person
  writing judge them, and they are the record's creator. The create keeps only the fields the entity's create form
  binds ("The create form", above).

## A source: an entity filled from a synced stream

`source` fills an entity from a stream that a connection syncs: an ERP's `purchase_order`, HubSpot's `contacts`.
AgentFlow does the work itself, from the connection's changes: it creates and updates the records, removes the
lines the source dropped, resolves references between the entities you map, and honours deletes. You write only
the map:

```json
{ "source": {
  "connection": "${param:erp}", "stream": "purchase_order",
  "fields": {
    "po_number": { "from": "number" },
    "status": { "from": "status", "values": { "pending_approval": "draft" } },
    "vendor": { "ref": "${entity:vendor}", "key": ["company_erp_id", "vendor_erp_id"] },
    "taxes": { "from": "taxes", "items": { "rate": { "from": "rate" } } }
  },
  "lines": {
    "entity": "${entity:po_line}", "from": "lines", "key": ["erp_line_id"], "parent": "purchase_order",
    "fields": {
      "item": { "ref": "${entity:item}", "key": ["^company_erp_id", "item_erp_id"] },
      "qty": { "from": "qty_ordered" }
    }
  },
  "on_delete": "delete"
} }
```

- **`connection`** is a `${param:…}` of type `connection_ref` (`manifest.md`). The admin chooses the connection when
  installing, and the stream is read through it. Give a package one parameter per connection it maps from.
- **`stream`** is an ERP's object name (`purchase_order`, `vendor`) or a stream the connector offers (`contacts`,
  `deals`). Two entities in a package cannot read one stream through one connection.
- **`fields`** maps a field key of this entity to where its value comes from. `{ "from": "number" }` copies a
  path of the stream's record (dotted, `properties.<name>` for HubSpot). `values` maps an enum's source values
  to the field's options. `{ "from": "taxes", "items": { … } }` writes a list of objects into a `list` field,
  copying each item's paths into its columns. `{ "ref": "${entity:vendor}", "key": [ … ] }` points at the record
  of another mapped entity: `key` has one path per key part of the target's stream (an ERP record is keyed by
  `company_erp_id` and `erp_id`), and `""` stands for a part that stream leaves empty. Add `"line": [ … ]` to
  point at a line of a lines entity.
- **`lines`** writes one list in the record to a child entity, a record to a line. `key` is the paths, inside a
  line, that identify it; `parent` is the lines entity's reference field that points back at this entity; `fields`
  is mapped as above, and `^path` reads the parent record. One level only: anything deeper is a `list` field.
- **`on_delete`** is `"delete"` (the record and its lines go to the trash) or `{ "flag": "<boolean field>" }`
  (the record stays and the field is set true, since records have no archive).

**The records are read-only.** Only AgentFlow writes a sourced entity and its lines entity. A person, a script, an
API call and a workflow step are all refused with `ENTITY_SOURCE_OWNED` (409); formula, rollup and auto-number
fields still compute. Keep what people add (notes, a decision, a flag) on an entity of your own that references
the synced record. If the admin detaches the app, the records become the organization's to edit.

**The build refuses**, at the pointer verification would name (so you learn at build, not at seal):
- a `connection` that is not a `connection_ref` parameter;
- `rules`, `stage_model`, `work` or `create_form` on a sourced entity or its lines entity: nothing but AgentFlow
  writes them, so there is nothing to govern;
- a mapped field the entity lacks; a copy into anything but a text, number, boolean, date, datetime or enum field;
  `values` onto a value that is not one of the field's options, or into a field that is not an enum; `items` into
  a field that is not a `list`, or into a column it lacks;
- a `ref` into a field that is not a reference to that entity, to an entity that is not read through the same
  connection, or from a field that is `required` (a reference is written after its record, and is empty until the
  target arrives);
- a `^` path outside `lines`; a `lines.parent` that is not a reference field of the lines entity to this entity;
  a flag that is not a boolean field;
- a lines entity that has a source of its own or that a second source names, and a second source on one stream of
  one connection.

A `ref` or a lines entity names an entity of this package, or `${dep:<package id>#entity:<key>}` of a package in
`requires.packages` (`manifest.md`, "Depending on another package"). The builder takes a required package's entity
on trust: it cannot see that package, so it does not check the key it exports, the fields of a lines entity it
owns, or the connection it is read through. A reference field to it names the same `${dep:…}` as its
`target_entity_id`.

**`lint` checks the rest against the stream** (`lint-problems.md` in the release skill): that the stream and every
path exist, that a path's type fits its field, that every enum option the stream can send has a place, and that a
`ref` has as many key parts as its target's stream. A custom HubSpot property is not judged by `lint`: the setup
page checks it against the connected account.

Things that build and then cost you:
- **A reference to a synced entity wants `"on_target_delete": "clear"`.** The default, `restrict`, refuses the
  ERP's delete of the target, and that version stays unapplied (`constraint_failed`) until someone intervenes.
- **A version that will not save is retried, then parked.** A `required` field the source leaves empty, or an enum
  value with no option, fails that record only; after 24 attempts it shows in the app's needs attention and an
  admin retries it. A newer version of the record clears it.
- **A freshly installed app holds only what changes after install.** There is no first load of existing records
  yet.
- **An installed source cannot move.** Choosing another connection once records exist is refused
  (`APP_SOURCE_CONNECTION_LOCKED`): undo and install again. An upgrade cannot change the stream or a lines `key`,
  or drop `lines` (`APP_SOURCE_INCOMPATIBLE`).
