# Pitfalls

Each of these was met building a real app. Most build cleanly and fail later, when the app is installed or
used, so read this list against your config before you hand it off. Each entry gives the symptom, the cause,
and what to write instead.

## References and text

- **A `${param:…}` shows up literally in a name or a description.**
  Cause: an entity's or a workflow's `name` and `description` are carried as written, not translated.
  Instead: write plain text there. Put parameter values in workflow templates through `readParameters`.
- **`an authoring reference the builder does not know: Case for ${param:app_users}`.**
  Cause: a reference inside a longer string. References are whole strings.
  Instead: read the parameter into a variable (`readParameters("company_name")`) and use
  `{{ vars.company_name }}` in the template (`workflows.md`).
- **`entity key my-case holds a hyphen`.**
  Cause: only a skill name may hold `-`.
  Instead: use `_` in every other key.
- **An enum option shows no colour, or the install is refused for it.**
  Cause: a colour outside the platform palette, such as `green` or `red`. The builder and `lint` pass it; AgentFlow
  checks it at install.
  Instead: use `gray`, `sky`, `teal`, `amber`, `emerald`, `violet`, `indigo`, `rose` or `fuchsia`, or `#RRGGBB`.

## Access

- **An organization admin cannot see or change records.**
  Cause: there is no admin bypass of record access.
  Instead: give admins a group parameter with `"scope": "organization"` grants, and add that group as a
  stage-model mover wherever admins move records.
- **Setup refuses with `APP_GRANT_RECIPIENT_COLLISION`.**
  Cause: two grants on the same entity give access to the same group, which happens when the admin picks one
  group for two group parameters that each carry a grant on that entity (`loan_users` and `it_staff`, both on
  `loan`). The setup page lists the code under the plan's problems, and the plan cannot be approved until two different groups are chosen.
  Instead: write each such parameter's `help` to say it must be a different group from the other, naming it, and
  that members may overlap (a person can belong to both groups). Example: `"help": "IT staff who approve
  equipment loans. Must be a different group from Loan desk users (the same person may be in both)."`
- **`entities/case.json#/access/mode: one of everyone, restricted`.**
  Cause: `access.mode` left out. The installer would have defaulted it to Everyone.
  Instead: always write `"mode": "restricted"` (or `everyone`, deliberately).
- **A person carries a record into another parent they manage.**
  Cause: grants judge the stored parent, so anyone who may update the record and manages another parent
  can move it there.
  Instead: unless moving is a feature, fix the parent after create with a rule: `is_update` and
  `changed` on the parent field (`team_is_fixed` in `rules-and-stages.md`).
- **A view for "my records" with `{ "$bind": "viewer.id" }` in `filters` is refused by `pnpm build`.**
  The message reads `entities/<entity>.json#/views/<n>/filters/<m>/value: a fixed filter compares as written and
  never resolves $bind: put the filter in a preset in config.presets`.
  Cause: only a preset (`config.presets`) reads the person looking; a fixed filter compares the value as text, so
  the view would list nothing. (A build from SDK 0.3.0 or earlier let it through, and the view listed nothing.)
  Instead: a preset, or a record scope in the grant (`entities.md`, "Views"). A preset is never preselected and
  a launcher entry cannot open one; a record scope does not narrow a person who also holds a wider grant. For
  "my X" that is mine for everyone, including people with organization scope, use a UI module screen.
- **An "overdue" view lists the wrong records.**
  Cause: a `within last_<n>_days` filter, which includes today and drops anything older than n days.
  Instead: the fixed filter `due within before_today` beside the open statuses, sorted by the due date ascending
  (`entities.md`, "Views").
- **A label or category that other rules depend on is edited, and records using it stop saving.**
  Cause: other rules compare against its meaning.
  Instead: fix that field after create with a rule, as above.

## Rules

- **A rule meant for edits refuses every create.**
  Cause: on a create, every test of the record is false and its negation true.
  Instead: start an edit-only rule with `{ "kind": "write", "write": { "op": "is_update" } }`.
- **A rule about the stored value never fires, or fires on the wrong write.**
  Cause: a field leaf reads the value being written.
  Instead: use a `was` leaf for "the stored value is …" (`frozen_is_frozen` in `rules-and-stages.md`).
- **A rule or a stage move refuses the app's own workflow.**
  Cause: a workflow a trigger starts runs as a service principal, which passes only `in_group`, not
  `is_elevated_run`. A workflow people start runs as the person who started it, so a rule that refuses that
  person refuses the workflow.
  Instead: put the service principal in an automation group, and negate `in_group` on it in the rule, or list
  it as a mover. For a move only one group may make, let a trigger start the workflow that records it
  (`workflows.md`, the worked example).
- **The automation group cannot be set up with only the service principal in it.**
  Cause: setup counts only people as a group's members.
  Instead: say in the group parameter's `help` to add one dedicated account that never signs in, and no one
  else.
- **A `$field` comparison never matches.**
  Cause: `$field` needs the same type on both sides, and a text formula is not an enum.
  Instead: compare through the reference (`label.base_status`) to the enum field.
- **A new field is editable by everyone with `update`.**
  Cause: `changed_any` names fields one by one, and the rule that guards its peers does not name it.
  Instead: add every new field to the rule that guards its peers.
- **A rule cannot express "at most 20 children".**
  Cause: rules may not read rollups.
  Instead: enforce it in the UI, or not at all.
- **Children are created under a closed parent.**
  Cause: nothing refuses them.
  Instead: a rule `is_new` and `parent.status` equals `closed` (`no_item_in_closed_team` in `rules-and-stages.md`).

## Fields and forms

- **A people list on a create form does not show a person picker.**
  Cause: `"format": "entity"` written on the array.
  Instead: put `"format": "entity"` under `items`, and keep `x-entity` on the array (`entities.md`).
- **A create through the records API drops fields it set.**
  Cause: `POST /entities/{id}/records` (a UI module, a service principal, a person on the create page) keeps
  only the fields the create form binds, and drops the rest silently. A workflow's `create` step is not
  filtered: it writes every field it binds.
  Instead: patch the other fields in a second write, or have a workflow create the record. Treat a failed
  second write as a partial create (the record exists): do not retry the create. Binding a field only to set it
  also shows it on AgentFlow's own create page.
- **A rollup does not count what you meant.**
  Cause: a rollup written like a formula, or an `inverseKey` that no child reference declares.
  Instead: `"type": "formula"`, `"formula_result_type": "number"`, no `formula_expression`, and a `rollup`
  of `inverseKey` (camelCase: the child reference's `inverse_key`), `agg` and an optional `filter`.
- **A formula that reads through a reference hides the record's fields from workflow decisions.**
  Cause: a formula reading through a reference that can be empty (`label.base_status`).
  Instead: avoid such formulas for now; a rule can compare the hop directly.
- **Deleting a target with `on_target_delete: clear` is refused.**
  Cause: a clearing delete is all or nothing. The deleter needs `update` on every record that points at the
  target, or the platform answers 403 `ENTITY_RECORD_CASCADE_FORBIDDEN`; and more than 499 records pointing
  at it answers 422 `ENTITY_RECORD_CASCADE_TOO_LARGE`.
  Instead: say so in the UI with the count, and offer a rename.
- **Comments are on, but the record page shows no thread.**
  Cause: the package ships a `detail` view whose layout has no `comments` block. Installing does not add one,
  and a comment notice opens that page.
  Instead: put `{ "kind": "comments" }` at the bottom of the layout's wide column (`entities.md`, Comments).
- **AgentFlow's record form lets an admin change a field your app never changes (a key other records store).**
  Cause: a field is editable by everyone with `update` unless a rule says otherwise. There is no read-only flag.
  Instead: a rule that refuses changing it once the record exists (`rules-and-stages.md`, "A field fixed once the
  record exists"). The record page then shows the field as not editable, with the rule's message.
- **The app needs records the moment it is installed (a list of categories, say), and has none.**
  Cause: the entity has no `seed`, and nothing else creates records at install.
  Instead: for records that are the same in every organization, give the entity a `seed`: the install creates
  them once per natural key (`entities.md`, "Starter records: `seed`"). For records that depend on the
  organization, give the app a screen that creates them by natural key when an admin confirms (`entities.md`,
  "Starter records the app creates itself"). Until that screen has run, what depends on the records has nothing
  to work with: show that, and tell installers in the `changelog`.

## Workflows and triggers

- **A workflow's decisions take the default branch, as if the record had no fields.**
  Cause: the workflow's run-as principal cannot read something the record carries: most often a formula
  that reads through a reference to an entity the principal has no grant on. Everyone never covers a service
  principal, so a grant to Everyone alone does not count. (On an AgentFlow release before rollups were read
  as fields, a record with a rollup was withheld the same way.)
  Instead: give the principal's group read on every entity a formula of the record reads through (an automation
  group that reads `tag` for a formula `tag_status` on `item`). Give a decision an `otherwise` branch that writes
  nothing, and test `==` on the values you act on, never `!=`: a withheld value reads as null.
- **A record trigger's input arrives empty, or the install fails on the trigger.**
  Cause: an `input_mappings` entry written `{ "from": "status" }`.
  Instead: every `from` starts with `event.`: `event.<field>`, or `event.event.previous.<field>` for the value
  before the change. The run reads it as `input.<to>`.
- **`lint` says `run_as_not_initiator`.**
  Cause: a workflow that people start (a start grant, an entity action, a Call from one of those) runs as a
  service principal.
  Instead: run it as `INITIATOR`. What only a group may do belongs to a workflow a trigger starts.
- **`lint` says `bare_key` in a workflow.**
  Cause: a position that takes a key holds a bare key or an id-form reference. A start form's `x-entity` is
  not one of these: the builder writes its key form. A workflow variable's `entity` or a relationship step's key
  is, when written as a plain string or `${entity:…}` by hand.
  Instead: write `"x-entity": "<entity key>"` and let the builder translate it. That only makes the schema
  valid: AgentFlow draws no launch form from `inputSchema`, so to let a person choose a record use an entity
  action with `subject`, or make the request a record (`workflows.md`, "Start forms").
- **`build` refuses an `x-entity`.**
  Cause: a start form's or a create form's `x-entity` names something that is not an entity of the package, `user`
  or `org_unit` (a typo, or an entity another package owns).
  Instead: name an entity key of this package, or `user` or `org_unit`.
- **A Human step's task stays in a person's list after another workflow finished the record.**
  Cause: only the run that opened a Human step's task settles it, and no step reads it or ends it from another run,
  unless the step declares an end condition.
  Instead: when the work may be finished from outside that run, either make the record the task with `work`: writing
  its status then ends the work, whoever writes it (`work.md`, "A record as a task, or a Human step's task"); or give
  the Human step an `endWhen` over the run's record, which ends the step when a write makes it true and keeps its
  actions and edges (`workflows.md`, "Human steps").
- **A step after one set to `continue` reads the substituted output as empty.**
  Cause: in an installed app's run, a step that fails and continues hands later steps its `default_output` as a
  value of unknown origin, which reads as null, and so does everything computed from it. A record write from it
  writes empty values.
  Instead: right after the step, a Decision that tests a value only its real output carries
  (`{ "!!": [{ var: "nodes.<step>.output.<field>" }] }`), and an `otherwise` branch that skips the writes.
- **Every call of an Agent step fails with `model … is not permitted for this deployment's LLM gateway credential`.**
  Cause: the deployment routes models through its LLM gateway, and the model is not registered there. Another
  model of the same provider may work.
  Instead: set the model parameter to a model the deployment offers, or ask its operator to register this one.
  The package does not change.
- **An Agent step that reads a conversation fails with `AGENT_CONVERSATION_EMPTY`.**
  Cause: its prompt is blank and the thread's newest message is the agent's own reply, so there is nothing to
  answer. A trigger that also fires on the agent's own messages starts it there.
  Instead: start the step only on a message from the other side (filter the trigger on the author), or give it a
  prompt (`workflows.md`, "Agent steps that read a conversation").
- **A Human step assigned to a group is never done.**
  Cause: nobody claimed it, or the group has no active person. A member must claim it before filling it in.
  Instead: tell the group's members to claim it from My Work, and keep the group's membership up to date.
- **A step that removes a list item fails with `VALIDATION_ERROR`, or the package is refused at upload.**
  Cause: `listMode: "remove"` is only for an `update` step on a `list` field (publish refuses it elsewhere), and its
  value must be one item id or an array of them (an item stands for its `id`). An AgentFlow build without remove
  refuses the package (`body_invalid`), and an older designer saves the step as a replace.
  Instead: bind the item's id on an update step (`workflows.md`, "Limits to design around"), and name the release
  that has remove in the `changelog`.
- **A trigger added in an upgrade never runs.**
  Cause: an upgrade never changes whether a trigger is on, and a new trigger, or one moved to another
  workflow, lands off.
  Instead: tell installers, in the `changelog`, which new triggers to turn on.
- **The install fails with `APP_STEP_FAILED on trigger:<key>`, and the build passed.**
  Cause: two triggers name the same workflow. A workflow has at most one trigger.
  Instead: make one workflow per trigger, both built by one helper that takes what differs between them
  (`freeze_on_close` and `unfreeze_on_reopen`, say), and give each its own trigger.
- **An Agent step fails with `AGENT_CEILING_DENIED: <agent> cannot read <entity>`, and nothing reaches the model.**
  Cause: the agent declares a `read_limit` that leaves out an entity the step gives it, usually the run's subject.
  `"read_limit": { "entities": [] }` leaves out every entity. `lint` reports a step that gives the agent its subject
  (`agent_read_limit_uncovered`); any other record a step hands over is caught only by the install plan, which warns
  `read_limit_step_uncovered` and installs anyway. `cannot read <Entity>.<field>, a computed field …` means a
  rollup or formula over an entity the limit leaves out, reached through a search, even one passed through a Code step
  (`agents-and-skills.md`, "What a search hands the agent").
  Instead: leave `read_limit` out unless you mean to restrict the agent, or list every entity its steps hand it
  (`agents-and-skills.md`, "What the agent may read"). Once installed, dropping `read_limit` in a later release does
  not lift the limit: release a limit that lists the entities, or have an admin grant them on the entity's Access
  tab.
- **A failed step's `error` reads `null` in an installed app's run, and nothing says why.**
  Cause: an installed app's run always blanks a step's `error`, whoever reads it. The run's `error_message`, the
  run's input and output, and a step's `input` and `output` are blanked only for a reader who may not see them, so
  `error_message` can arrive populated. The `error_code` and `error_meaning` of a step and of the run stay, since
  they are platform text.
  Instead: read the step's `error_code` and `error_meaning` in `node_runs[]` (the run has its own), and `withheld`,
  which lists each field that was blanked while it held a value; a `null` it does not list is really empty. A step
  coded `STEP_FAILED` names no more specific code: read the run's `error_message` if `withheld` does not list it, or
  run the same workflow outside an installed app, where a step's `error` is shown (`sandbox-testing.md` of the
  `agentflow-app-release` skill, "When a run fails").
- **`APP_FILE_INVALID: agentflow.app.mjs: add open_case to ORDER`.**
  Cause: a workflow in a module that `ORDER` does not list.
  Instead: add it to `ORDER`, after every workflow it calls.
- **Publish refuses a Code step with `code.input_unbound`, and its input is `lit(null)` or `lit("")`.**
  Cause: an AgentFlow build from before 2026-10-31 reads `lit(null)` as no binding, and an older SDK writes `lit("")`
  as one.
  Instead: update the SDK and AgentFlow, or pass an empty value the code tests for, such as `lit([])`, `lit(false)` or
  `lit(0)` (`workflows.md`, "Code steps").
- **A template prints a file's details as JSON, not its id.**
  Cause: a file in free text (`See {{ subject.record.contract }}`) reads as the file object. A field holding
  nothing but the file still stores or sends its id.
  Instead: write `.name` for its name, `.id` for its id, or `| content` for its text (`workflows.md`, "A file's
  text").
- **The install plan reports `reference.content_not_available` or `atomic.file_content`.**
  Cause: `content()` is in a field that does not read file text (a Decision's condition, a review document's
  field mapping, a name or id), or in an all-or-nothing workflow. `build` and `lint` pass it.
  Instead: move the read to a field that allows it, for example a Set Variable step before the Decision, and test
  `vars.<name>`. For an all-or-nothing workflow, read the text in the workflow that calls it and pass it in.
- **A step that reads a file's text fails with `FILE_CONTENT_FAILED`.**
  Cause: the file has no text to read: an image, a scan with no text layer, an unsupported type, or more than
  1 MiB of text.
  Instead: send files that may be images or scans to an Agent step's prompt, which sends a PNG, JPEG, GIF or WebP to
  the model as a picture (`workflows.md`, "A file's text"). Or give the step an
  error strategy that routes the failure, since `FILE_CONTENT_FAILED` goes through it.
- **A record write fails `ENTITY_ATTACHMENT_INVALID`: `attachment <id> is already attached to another record`.**
  Cause: the file belongs to another record, typically a For Each over a parent's file field writing each file to a
  child record.
  Instead: mark the binding `bind("docs", ref("input.item"), { copy: true })` to give the record its own copy, or
  reference the record that holds the file. An AgentFlow build from before 2026-10-30 has no `copy`. With `copy`, the
  write still fails when the run cannot read the record that holds the file (`belongs to a record this run cannot
  read`), or when the file is in a secured field and the field it is copied to is not.
- **A For Each over files hands its Agent step an id, or empty text.**
  Cause: the list source is not typed as files (a Document or Image step's `generated_files`, or
  `subject.record.<file field>` on an AgentFlow build from before 2026-10-30), so each child's item is a bare id, and
  publish says nothing.
  Instead: loop over a typed source, or read the text with `content(input.<itemAlias>)` in a Set Variable inside the
  child (`steps.md`, "Looping over files").
- **A For Each child's `parent.subject.record.…` is refused at publish (`reference.template_broken`,
  `reference.unknown`).**
  Cause: a child may not read the parent run's record body.
  Instead: `getById(…, "parent.subject.record_id")` in the child, or a parent step or variable that carries the value
  (`steps.md`, "What a child reads from its parent").

## Dashboards and the launcher

- **`dashboards/o.json#/filter_bar: a package cannot install a filter bar yet`.**
  Instead: ship tiles only.
- **`... is open-ended, so it has no previous period to compare with`.**
  Cause: a tile compares with `previous_period` over `before_today` or `after_today` alone, which have no length.
  Instead: leave the comparison off; for an overdue count that is the answer. A bounded window on the same field
  (`this_month`) gives the comparison a length. `previous_year` over an open window means something only on a
  chart split by a date bucket: on a single number it counts the records overdue by more than a year.
- **Nobody but the installer sees the dashboard, or its launcher entry.**
  Cause: a packaged dashboard installs private, and an entry is hidden from anyone who cannot open its target.
  Instead: tell installers to share the dashboard with the audience group after installing.
- **`a module target needs the package's ui`.**
  Cause: a `module` launcher entry in a package with no `ui` member.
  Instead: add `ui`, or target an object.
- **An object target is refused.**
  Cause: it names a workflow, an object the package does not build, or uses a form other than a reference.
  Instead: `${dashboard:…}`, `${entity:…}` or `${entity_view:…}` of this package.
- **A launcher label appears in an unexpected language.**
  Cause: with neither the person's language nor `contentLocale` given, the sidebar takes the first tag in
  alphabetical order, not the first written.
  Instead: give every language you need, `contentLocale` among them.
- **A module path is refused.**
  Cause: `//` anywhere (even after `?` or `#`), a backslash, a control character, or a `.` or `..` segment.
  Instead: percent-encode a URL inside a query, and write plain paths.
- **A `launch_url` is refused, or the package's value does not show.**
  Cause: anything but lowercase `https://`, or a user or password in it; or an admin's override, which wins
  and which an upgrade never changes.
  Instead: write a plain `https://` address.
- **A module entry is listed to someone who can read no record.**
  Cause: a module entry is listed to everyone in the app's audience; what they may open inside it is the
  module's business.
  Instead: have the module handle a person with no access.

## What `build` does not check

`pnpm build` refuses a view `filters` entry or a preset rule whose field is not a field of the entity (or, with
`reference.field`, of the package entity the reference points at), whose `op` does not suit the field's type, whose
`within` value is not a window, or whose value has the wrong shape for its `op`; a `$bind` in a fixed filter; a
`ui.kind` other than `module` and a `ui.contract` other than 1 or 2. It warns about a launcher icon AgentFlow does
not have. A green build still does not prove the package installs. These are refused only when the package is
installed, so the first place they run is `deploy --sandbox`:

- a view's role field of the wrong type (`group_by_field`, `date_field` and the others in `entities.md`);
- a filter on a field that is not `filterable`;
- a `$bind` token that is not one AgentFlow knows, or one used with an operator it does not take;
- a filter that hops through a reference to an entity outside the package;
- a rule's fields and operators;
- an enum colour outside the palette, a `format` or constraint a field type does not take.

A `ui.contract` the AgentFlow you deploy to does not know is refused earlier, at `lint` and at upload, as
`manifest_invalid` at `manifest.json`, and the message does not name `ui.contract`.

## The project

- **`config/build/` is missing from a commit.**
  Cause: a repository `.gitignore` that ignores `build/`.
  Instead: add an exception for the app's `config/build/`.
- **The install is refused with `human.assignee_fallback_required`.**
  Cause: a Human step whose every candidate is dynamic (the initiator, a field, a manager) and none has a
  `fallback`. The build does not report it.
  Instead: add `fallback: [{ kind: "group", id: "${param:app_users}" }]` to the candidate (`workflows.md`).
- **`pnpm check` names `ui/…` files `stale`, `missing` or extra in a project with a UI module.**
  Cause: `pnpm check` compares package/ui with the module when package/ui exists, and a module change is in it
  only after a build. Without `package/ui` (git ignores it) the check says nothing of the module, and `seal` refuses.
  Instead: run `pnpm build`, then `pnpm check`.
- **A module's `@` menu fails ("Không tìm được") once the app runs under a ceiling.**
  Cause: `GET /mentions/people` is refused with `403 APP_CEILING_DENIED` unless the package requires the `user`
  entity and lists its `name` (the email is told, and matched, only while `email` is listed too). `fields: {}` tells
  nothing.
  Instead: `requires.entities: [{ "key": "user", "access": "read", "fields": { "name": "text", "email": "text" } }]`.
  An embedded module calls as the person and is not cut.
