# Access: who may do what

An entity's `access` is `{ "mode", "grants" }`. Nobody reaches a record except through a grant: there is no
bypass for organization admins, and a workflow a trigger starts, which runs as a service principal, needs a grant for that principal's group too.

## `mode`

`restricted` or `everyone`, and it is required: a file without it is refused
(`entities/case.json#/access/mode: one of everyone, restricted`), because the installer would otherwise
default the entity to Everyone. Every example uses `restricted`.

## A grant

`{ "principal", "design"?, "operations" }`:

- **`principal`** is `{ "kind": "group", "id": "${param:<group_ref parameter>}" }` or `{ "kind": "everyone" }`.
  Nothing else: not a user, not a service principal (`a package grants to a group or everyone only`). An
  Everyone grant has no `id`, and an entity has at most one.
- **`design`** is absent or `false` (`a package grant never carries design authority`).
- **`operations`** is a list of `{ "operation", "scope"?, "record_scopes"? }`, each operation at most once per
  grant. `operation` is `read`, `list`, `create`, `update`, `delete` or `assign`. An entry needs `scope`,
  `record_scopes`, or both.
  - `scope` is a string such as `organization` (every record) or `own`.
  - `record_scopes` limits the operation to records the caller is tied to (below).

Each grant becomes an entry of the manifest's `grants`, keyed `<entity>_<recipient>`: the parameter's key
without a trailing `_group_id`, or `everyone`. The case desk's grant is `case_app_users`.

## Record scopes

- `{ "kind": "field", "field": "<people field>" }`: the caller is in that field of the record. The field is
  a reference or reference list to Users or Units that the entity declares (not one its `work`
  seeds).
- `{ "kind": "parent_field", "field": "<reference>", "parent_field": "<people field>" }`: the caller is in a
  people field of the record's parent. `field` is a single reference to another entity of the package.
- `{ "kind": "work" }`: the caller holds work on the record. The entity needs `work.assignable`.
- On `create`, only a `parent_field` scope is allowed.

## Worked examples

**One group, organization-wide, with changes limited to the opener.** The case desk
(`config/entities/case.json`): everyone in `app_users` reads, lists and creates cases, and changes the cases
they opened.

```json config
{ "access": { "mode": "restricted", "grants": [
  { "principal": { "kind": "group", "id": "${param:app_users}" }, "design": false, "operations": [
    { "operation": "read", "scope": "organization" },
    { "operation": "list", "scope": "organization" },
    { "operation": "create", "scope": "organization" },
    { "operation": "update", "record_scopes": [ { "kind": "field", "field": "opened_by" } ] } ] } ] } }
```

**Membership on the record, roles by group.** A team: an Everyone grant scoped to the team's own people
fields, then one group grant per role.

```json config
{ "access": { "mode": "restricted", "grants": [
  { "principal": { "kind": "everyone" }, "operations": [
    { "operation": "read", "record_scopes": [{ "kind": "field", "field": "managers" }, { "kind": "field", "field": "members" }] },
    { "operation": "list", "record_scopes": [{ "kind": "field", "field": "managers" }, { "kind": "field", "field": "members" }] },
    { "operation": "update", "record_scopes": [{ "kind": "field", "field": "managers" }] } ] },
  { "principal": { "kind": "group", "id": "${param:team_creators}" }, "design": false,
    "operations": [{ "operation": "create", "scope": "organization" }] },
  { "principal": { "kind": "group", "id": "${param:automation_group}" }, "design": false,
    "operations": [{ "operation": "read", "scope": "organization" }, { "operation": "list", "scope": "organization" }] },
  { "principal": { "kind": "group", "id": "${param:admin_group}" }, "design": false, "operations": [
    { "operation": "read", "scope": "organization" }, { "operation": "list", "scope": "organization" },
    { "operation": "update", "scope": "organization" }, { "operation": "delete", "scope": "organization" } ] }
] } }
```

**Membership on the parent.** An item reaches its people through its `team`, and names `assign` apart from
`update`, so only managers assign:

```json config
{ "access": { "mode": "restricted", "grants": [
  { "principal": { "kind": "everyone" }, "operations": [
    { "operation": "read", "record_scopes": [
      { "kind": "parent_field", "field": "team", "parent_field": "managers" },
      { "kind": "parent_field", "field": "team", "parent_field": "members" },
      { "kind": "field", "field": "collaborators" } ] },
    { "operation": "create", "record_scopes": [
      { "kind": "parent_field", "field": "team", "parent_field": "managers" },
      { "kind": "parent_field", "field": "team", "parent_field": "members" } ] },
    { "operation": "assign", "record_scopes": [{ "kind": "parent_field", "field": "team", "parent_field": "managers" }] },
    { "operation": "delete", "record_scopes": [{ "kind": "parent_field", "field": "team", "parent_field": "managers" }] } ] }
] } }
```

(Abridged: a full file also grants `list` and `update`, and grants to the automation and admin groups.)

## How to design access

1. Make a table: one row per entity, one column per operation (`read`, `list`, `create`, `update`,
   `assign`, `delete`), and in each cell who may do it.
2. **Membership** ("the people on this project") becomes one Everyone grant with `record_scopes` per
   operation: `field` for a people field on the record, `parent_field` for one on the parent.
3. **Organization-wide roles** ("project admins see everything") become a group grant to a group
   parameter with `"scope": "organization"`. Organization admins get nothing implicitly: give them a role
   group, and add it as a stage-model mover where they move records.
4. **Workflows a trigger starts** run as a service principal and need a grant to the group that holds it, for
   each operation their steps perform. A workflow people start runs as the person, who needs the grants for what
   its steps do.
5. Name `assign` explicitly wherever it differs from `update`.
6. What a grant cannot say (only the owner edits the title; a closed parent takes no new children) becomes a
   rule: see `rules-and-stages.md`.
7. Grants judge the stored parent. A person who may update a record and manages another parent can move
   the record there. Unless moving is a feature, fix the parent after create with a rule
   (`team_is_fixed` in `rules-and-stages.md`).

## What a running app answers

When the installed app is tested as several people: a record outside the caller's record scopes answers
404, an operation no grant gives answers 403, and a rule refusal answers 422 `ENTITY_VALIDATION_RULE_FAILED`.
Test every cell of your access table this way.
