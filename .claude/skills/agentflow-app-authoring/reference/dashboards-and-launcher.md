# Dashboards, the launcher and the `ui` member

## A dashboard: `config/dashboards/<key>.json`

`key` equals the file name. Members: `key`, `name`, `description`, `tiles`. It becomes `dashboard:<key>`.

- `tiles` is a list; each tile has a `kind` of `number`, `chart`, `list` or `text`, and the rest of the tile
  is carried to the platform. At most 24 tiles count (a `text` tile does not).
- Every tile has an `id` and a `position` `{ "row", "col", "w", "h" }` on a grid 24 columns wide
  (`col + w` at most 24), and each kind has a size range of its own (below). A tile outside its range builds, and
  `lint` reports it as `tile_position_invalid` at `/tiles/<n>/position/<member>`; an older AgentFlow passes the
  package and refuses the install plan instead.
- Every `entity_id` inside a tile is an entity: `${entity:<key>}` of the package, or a platform entity's id.
- Each tile, and each measure, has an `id` of its own: a UUID, fixed in the file.
- A `filter_bar` is refused (`a package cannot install a filter bar yet`): ship tiles only.
- "Due before today" is `{ "field": "due", "op": "within", "value": "before_today" }`, in a tile's filter as in a
  view's: an overdue count is a `count` Number tile with it and the open statuses, and no `compare`. Leave the
  comparison off an overdue count. `before_today` and `after_today` have no length, so `previous_period` over
  one alone is refused (a bounded window on the same field, such as `this_month`, gives it a length again).
  `previous_year` is accepted, but on a single number it counts the records overdue by more than a year, which
  is not "overdue a year ago"; it reads meaningfully only on a chart split by a date bucket. The "overdue"
  recipes are in `entities.md`, "Views".
- A packaged dashboard installs private to the installer. Tell installers to share it with the audience
  group, or nobody else sees it, nor the launcher entry that opens it.

The four kinds (the whole file builds and lints clean):

| `kind` | Members besides `id`, `label`, `position` |
|---|---|
| `number` | `query`: `{ "entity_id", "measures", "filter"? }`. One figure. |
| `chart` | `query` as above, `chart` (`bar`, `column`, `line`, `pie` or `donut`), `split_by` (`{ "field", "bucket"? }`: `bucket` is `day`, `week`, `month` or `quarter` and is required for a date field, refused for any other), and for a bar or column `stack_by` (a second `split_by`) |
| `list` | `entity_id` and `view_id`: `${entity_view:<entity>/<key>}`, the records of a view of this package |
| `text` | `body`, a string |

A tile's size, in grid units, by kind:

| `kind` | `w` (width) | `h` (height) |
|---|---|---|
| `text` | 4 to 24 | 3 to 12 |
| `number` | 3 to 12 | 5 to 10 |
| `list` | 6 to 24 | 5 to 40 |
| `chart` | 6 to 24 | 6 to 30 |

A `measures` entry is `{ "id", "fn", "field"?, "primary"?: true, "label"? }` (exactly one `primary`): `fn` is `count`
(no `field`), `sum`, `avg`, `median`, `min`, `max`, `count_distinct`, `count_filled`, `count_empty` (each with a
`field`) or `ratio` (`"ratio": { "of": "<field>", "per": "<field>", "using": "count_filled" }`, for a figure such as "% complete").
A tile's `filter` is `{ "field_filters": [{ "field", "op", "value" }], "relative_dates": [{ "field", "window" }] }`: the
operators are a view filter's (`entities.md`), and `window` is `today`, `last_<n>_days`, `this_month`,
`this_quarter`, `this_year`, `before_today` or `after_today`.

```json config
{ "tiles": [
  { "kind": "text", "id": "0190f8f4-0000-7000-8000-0000000000c1", "label": "How to read this", "body": "Counts exclude declined loans.",
    "position": { "row": 0, "col": 0, "w": 24, "h": 3 } },
  { "kind": "chart", "id": "0190f8f4-0000-7000-8000-0000000000c3", "label": "Loans per month", "chart": "line",
    "query": { "entity_id": "${entity:loan}", "measures": [{ "id": "0190f8f4-0000-7000-8000-0000000000d3", "fn": "count", "primary": true }] },
    "split_by": { "field": "due_date", "bucket": "month" },
    "position": { "row": 3, "col": 0, "w": 12, "h": 8 } },
  { "kind": "list", "id": "0190f8f4-0000-7000-8000-0000000000c4", "label": "All loans",
    "entity_id": "${entity:loan}", "view_id": "${entity_view:loan/all}",
    "position": { "row": 11, "col": 0, "w": 24, "h": 10 } }
] }
```

A dashboard file with its first tile:

```json config
{
  "key": "team_overview", "name": "Team overview",
  "description": "Open, blocked and completed items across the teams you can see.",
  "tiles": [
    { "kind": "number", "id": "0190f8f4-0000-7000-8000-0000000000a1", "label": "Open items",
      "query": { "entity_id": "${entity:item}", "measures": [ { "id": "0190f8f4-0000-7000-8000-0000000000b1", "fn": "count", "primary": true } ],
        "filter": { "field_filters": [ { "field": "status", "op": "in", "value": ["todo", "doing"] }, { "field": "frozen", "op": "ne", "value": true } ] } },
      "position": { "row": 0, "col": 0, "w": 6, "h": 5 } }
  ]
}
```

## The `launcher` member

The entries the package adds to the Apps section of AgentFlow's sidebar. It sits in
`config/package-manifest.json`, and it is the one manifest member the builder translates, so its object
targets are written as references.

```json config
{ "launcher": {
  "launch_url": "https://app.example.com",
  "entries": [
    { "key": "my_work", "label": { "en": "My Work", "vi": "Việc của tôi" }, "icon": "inbox", "target": { "module": "/" } },
    { "key": "dashboard", "label": { "en": "Dashboard", "vi": "Tổng quan" }, "icon": "layout-dashboard",
      "target": { "object": "${dashboard:team_overview}" } },
    { "key": "open_items", "label": "Open items", "icon": "list-checks", "target": { "object": "${entity_view:item/open}" } }
  ]
} }
```

(The case desk has one module entry, `cases`.)

- **`entries`**: at most 12. Each has `key`, `label`, `icon` and `target`.
- **`key`**: `^[a-z](?:[a-z0-9]|_(?!_)){0,39}$`: letters, digits and single underscores, no hyphen; unique
  among the entries.
- **`label`**: a string, or a map from language tag to string, each 1 to 40 characters. The sidebar uses the
  person's language, then its base language, then the package's `contentLocale`, then the first tag in
  alphabetical order (not the first written). Give every language you need, `contentLocale` among them.
- **`icon`**: optional, one of AgentFlow's 40 icon names, written exactly as listed (they are AgentFlow's own,
  not Lucide's names: `building`, `group`, `pin`, `bank`, `cart`, `card`, `file`, `contract`, `boxes`):
  `database`, `building`, `users`, `group`, `contact`, `truck`, `package`, `cart`, `receipt`, `card`, `wallet`, `file`, `contract`, `clipboard`, `folder`, `tags`, `box`, `boxes`, `briefcase`, `calendar`, `factory`, `bank`, `pin`, `phone`, `wrench`, `shield`, `ticket`, `rocket`, `globe`, `star`, `flag`, `bell`, `bookmark`, `archive`, `layout-dashboard`, `list-checks`, `inbox`, `bot`, `pause`, `settings` (a gear). An unknown name installs, and draws a dot; a name that is not lowercase letters, digits and hyphens (starting with a letter, at most 64 characters) is refused at upload.
  A deployment older than the release that added the gear, `settings`, does not know it and draws a dot.
- **`target`**: exactly one of `module` and `object`.
  - `module`: a path inside the package's UI module (`"/"`, `"/board"`), at most 200 characters, with no
    `//` (even after `?` or `#`: percent-encode a URL inside a query), no backslash, no control character
    and no `.` or `..` segment. It needs the manifest's `ui` member. A module entry is listed to everyone in
    the app's audience.
  - `object`: `${dashboard:<key>}`, `${entity:<key>}` (its record list) or `${entity_view:<entity>/<key>}`,
    of this package. A workflow, or an object the package does not build, is refused. An `object` entry opens the
    record list or view itself: it cannot name a preset or a query. A list that needs one is a `module` entry
    whose route sends it (`entities.md`, "Views").
- **`launch_url`**: optional, the address of the app's own site, if it has one. It must be `https://`
  (lowercase), with no user or password. It is a suggestion: an admin may override it, and an upgrade
  never changes an admin's value. A package whose app runs on its own site may give `launch_url` and no
  entries.

The builder's refusals for the launcher:

```
package-manifest.json#/launcher/entries/0/target/module: a module target needs the package's ui
package-manifest.json#/launcher/entries/0/target: exactly one of module or object
package-manifest.json#/launcher/entries/0/target/object: must be a ${dashboard:key}, ${entity:key} or ${entity_view:entity/key}
```

## The `ui` member

A UI module is a screen the package ships, which AgentFlow opens in its own pages. The manifest declares it
with `"ui": { "kind": "module", "entry": "ui/index.js", "contract": 1 }`, or `2` for a module that
calls `host.assistant` (`manifest.md`, "`ui`").

- `pnpm build` then builds the module into `package/ui` with Vite (the starter's `vite.module.config.ts`,
  whose entry is `src/module/module.tsx`). Without Vite installed it refuses with `UI_TOOL_MISSING`.
- `package/ui` is built output, and git ignores it. `pnpm check` compares package/ui with the module when package/ui
  exists, so a module change not yet built is `PACKAGE_STALE` until `pnpm build`; without the folder it says nothing of it.
- Without a module, remove `ui` and every `module` launcher entry. `agentflow-app init --no-ui` makes such a
  project.
- The module's screens, styles, tests and review: the `agentflow-ui-module` skill.
