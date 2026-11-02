# Agents and skills

An agent is an AI worker a workflow step calls. A skill is a Markdown document an agent loads when it needs
it.

## An agent: `config/agents/<key>.json`

`key` equals the file name. The other members are carried to the `agent:<key>` object with references
translated: `name`, `description`, `profile`, `access` and `read_limit`.

- `profile.systemPrompt`: the agent's instructions.
- `profile.skills`: the skills it may load, each `{ "skillId": "${skill:<name>}", "activation": "on_demand" }`.
- `profile.model`: the model, as a `${param:…}` of type `text`, so each organization chooses its own. Its value
  is `<provider>/<model>`, with a provider the deployment has, such as `"openai/gpt-5.4"` or
  `"anthropic/claude-sonnet-5-5"`; the providers are on the Model tab of AgentFlow's agent builder. A bare model id
  is reported on the setup page as `model_without_provider`, because it would run on whatever provider the
  deployment defaults to. Nothing checks that the provider serves the model, and the id is matched as written,
  case included, so copy it exactly. Give it in `sandbox.json` and in the parameters you deploy with. A sandbox
  runs on the deployment's own models with nothing to set up: name one the deployment offers every organization
  (an id with no organization prefix). A model the deployment does not serve fails the run at the Agent step.
- `access`: `{ "mode": "restricted", "groups": ["${param:<group_ref>}"] }`, the groups that may use the agent;
  restricted access names at least one group, and `{ "mode": "everyone" }` names none. Access is asked of the
  person who publishes a workflow using the agent or starts a draft of one, never of a run: a workflow started by a
  trigger or run by your service principal runs the agent without that principal being in the groups. At install
  the person asked is the admin who approves it, who holds `agent.publish` and passes every agent's access, so
  `access` never stops an install: it decides who may put the agent in their own workflows afterwards.
- The parameters that hold the agent's `model` (type `text`) and its access groups (type `group_ref`) must be
  `"required": true`, or `lint` reports `agent_parameter_optional`. A literal model or group id is refused
  (`slot_not_parameter`).
- `name` and `description` carry no space at either end. A package's agent has no MCP servers or knowledge
  documents (`agent_profile_mcp`, `agent_profile_knowledge`): the organization attaches its own after installing.
  An agent step may not carry its own tools, MCP servers or knowledge either, and names its agent only as
  `{ "agentId": "${agent:<key>}" }` (`agent_ref_not_sentinel`).

A drafting agent, with its prompt shortened:

```json
{
  "key": "assistant",
  "name": "Reply assistant",
  "description": "Drafts every reply to a person who wrote in.",
  "profile": {
    "systemPrompt": "You draft replies on behalf of our team. …",
    "skills": [
      { "skillId": "${skill:returns}", "activation": "on_demand" },
      { "skillId": "${skill:account-access}", "activation": "on_demand" }
    ],
    "model": "${param:assistant_model}"
  },
  "access": { "mode": "restricted", "groups": ["${param:app_users}"] }
}
```

## What the agent may read

**Leave `read_limit` out unless you mean to restrict the agent.** An agent without one reads whatever the run, or
the person chatting, may read. An agent with one reads only the entities it lists, and every Agent step that uses it
fails when it runs, before the model is called, if the step gives it a record of an entity the limit leaves out:

```
agent step classify failed: AGENT_CEILING_DENIED: Document classifier cannot read Case
```

So a limit lists every entity each of the agent's steps hands it: the run's subject (a record trigger's record, an
entity action's record) and what its `subject.record` paths walk through, a `record("<key>", …)` lookup in the prompt,
an Entity Record step's output and a ForEach over it, the input of a workflow an entity trigger starts, and a record
thread the step names through the subject. Give each entity `read`, and `list` too when a step lists or searches it.
`lint` reports a step that gives the agent the run's subject when the limit lacks `read` on the subject's entity
(`agent_read_limit_uncovered`). The other ways a step hands over records need the organization's entities, so only
the install plan sees them: it warns `read_limit_step_uncovered` and installs anyway, and the step fails at run time.

**The limit stays on once installed.** The first release that declares a `read_limit` turns the agent's limit on, and
no upgrade turns it off: a later release that drops `read_limit` leaves the installed agent limited to whatever it was
granted. To widen an installed agent, release a limit that lists the missing entities, or have an admin grant them on
the entity's Access tab (the agents section) or turn the agent's limit off.

An agent's `read_limit` lists the records it may read, as `{ "entities": [{ "entity": "${entity:<key>}", "operations": ["read", "list"] }] }`.
`read` opens a record by id, `list` searches and lists records, and nothing else is a valid operation. An entity is a
`${entity:<key>}` of an entity the package declares (never a literal id or a parameter; the package format also accepts
required and dependency entities, which the builder does not write from this file), is named
once with all its operations, and has at least one operation. At most 200 entities. `{ "entities": [] }` is a limit that
lets the agent read no record, so every Agent step that gives it one fails. The limit itself is not refused: it is
right for an agent no step gives a record to, and `lint` reports the steps that do give it one. The builder refuses a member other than `entities`, `memory_types`, `entity` and `operations`
(`fields` among them: a limit is by entity, not by field).

```json
{
  "key": "triage",
  "name": "Triage agent",
  "profile": { "systemPrompt": "…", "model": "${param:triage_model}" },
  "access": { "mode": "restricted", "groups": ["${param:app_users}"] },
  "read_limit": {
    "entities": [
      { "entity": "${entity:ticket}", "operations": ["read", "list"] },
      { "entity": "${entity:customer}", "operations": ["read"] }
    ]
  }
}
```

- Installing a package whose agent has a `read_limit` turns the agent's limit on and grants exactly those pairs; an
  agent without one is left as the organization has it. An upgrade merges the release's limit with what the
  organization has done since: what the admin removed stays removed, and the plan says so (`read_limit_withheld`).
- A secured field is the organization's decision. The limit says which entities the agent reads, never which
  fields: a field the organization secures reaches the agent only through a profile the organization grants it, and
  the plan warns (`agent_read_limit`) where a step needs a field no profile gives.
- A Learn step learns through an agent of the package itself (`@obj:agent:`), and that agent's limit must cover
  everything the step reads: the source entity and each About entity with `read`, each related child with `list`
  and `read`. Lint reports a Learn step that names another agent (`learn_agent_not_own`), an agent with no limit
  (`learn_read_limit_missing`) and each pair the limit lacks (`learn_read_limit_uncovered`). The limit also covers the memory a step learns: each type in `learn.types` must be in
  `read_limit.memory_types`, and a Learn step is allowed in a package (`memory.md`).
- `memory_reference_invalid` reports a `memory_types` entry that is no memory type of the package.
- `read_limit_invalid` is lint's report of an entry naming a built-in directory entity (users, groups, units), an
  entity twice, an empty or repeated operations list, or a 201st entity. The builder refuses most of these before
  lint runs.

### What a search hands the agent

In a run of an installed app, before the model is called, AgentFlow judges everything the prompt's inputs were built
from. A search step's output was built from every field of every record it returned (or from the `fields` it names),
and a Code step's output, or a
For Each item, carries everything its own inputs were built from: passing records through Code does not hide them.
The step fails with `AGENT_CEILING_DENIED` when any of them is:

- a record of an entity the limit does not grant;
- a secured field the organization has given the agent no profile for;
- a rollup, formula or auto-number field made from an entity or field the limit does not grant;
- a search's filter or sort field that is one of these.

Users, groups and units are always readable. The message names the field and says which it is: `cannot read the
secured field <Entity>.<field>` for a secured one, `cannot read <Entity>.<field>, a computed field made from records or
fields its read limit does not grant` for a computed one. (An AgentFlow build from before 2026-10-30 calls both
secured.) A limit has no `fields` member, but a search can name the fields it returns:
`search(id, name, entity, filters, { fields: ["title", "status"] })` returns each record's `id`, `metadata` and those
fields only, and only they count, beside the fields the search filters, sorts or searches on, which chose the records.
Leave a secured or computed field out of `fields` and the agent is not judged on it. Otherwise list every entity the
chain reaches with `read` (a rollup's source entity too), or keep records with such fields out of what the prompt reads.
Naming `fields` needs an AgentFlow build from 2026-10-30 or later.

An agent's `read_limit` may also list `memory_types`: `"memory_types": ["${memory_type:<key>}"]`, the package's own
types it may read (at most 200, none twice; `entities` stays required, and may be empty only for an agent no step
gives a record to). An agent that saves memory
carries `profile.memorySave`, and its `read_limit.memory_types` must cover every type it saves into
(`memory_save_read_limit_uncovered` in lint; the builder refuses it too). The members of `memorySave` (`types`,
`relationships`, `about`, `orgWide`, `review`, `instructions`), the types and their grants are in `memory.md`.
The agent reads an item only when its limit has both `read` and `list` on the record the item is about and on
each record it was learned from, so give those entities both operations.

A workflow calls an agent with an `agent` step:

```js
node("triage", "Triage", "agent", {
  agentRef: { agentId: "${agent:triage}" },
  conversation: { thread: "{{ subject.record_id }}", window: 10 },
  promptTemplate: "",
  outputSchema: { type: "object", properties: { intent: { type: "string" }, confidence: { type: "number" } } },
}),
```

`outputSchema` is the JSON Schema of what the agent returns, read by later steps as
`nodes.<id>.output.<member>`. AgentFlow checks only that the members the root lists as `required` are there (one
retry, then the step fails with `AGENT_STRUCTURED_OUTPUT_INVALID`); it does not check `enum`, types or nested
members, though an Anthropic model generates within the schema. Before a step writes an answer into an `enum` field,
check it, with a Decision step, or the write fails the run on a value the field does not take.

When the step has sources to cite (the agent's knowledge sources, or file text placed in its prompt) and
`outputSchema` is an object, the output also carries `_citations`: a map from a JSON pointer into the output to the
ids of the chunks that support it, such as `{ "/summary": ["<chunk id>"] }`, possibly `{}`. AgentFlow adds it to the
schema; do not declare it, and expect it in the object when you pass the whole output on rather than its members.
A step in text mode has none.

## A skill: `config/skills/<file>.SKILL.md`

The file is read the way the installer reads it: a frontmatter between the first two `---` lines, then the
body, kept exactly.

```
---
name: account-access
description: How to answer a customer who cannot log in or reach their account, and what you must never ask for or confirm.
---

# Login and account access
```

- The frontmatter holds exactly `name` and `description`, each a plain `name: value` line. A value may not
  start with a quote or another YAML character (`[`, `{`, `|`, `>`, `&`, `*`, `!`, `#`, `%`, `@`, `?`, `:`, `,`, `-`),
  and may not hold `: ` or ` #` or end with `:`, because YAML would read the rest as a new key or a comment.
  A quote in the middle of a value is fine. A description such as `Answers "what have I booked": rooms` fails on
  its `: `: write `Answers "what have I booked" for rooms`.
- The file is named for the skill with each `-` in `name` written `_`: `name: account-access` is
  `account_access.SKILL.md`, the object `skill:account_access`.
- References use the name as written: `${skill:account-access}`. A skill name is the only key that may hold a
  hyphen.
- Write the description so the agent knows when to load it: what the customer asks, and what the skill
  settles.

### Offering a skill to the assistant

Any skill of the package, used by its own agents or by none, is something the organization's assistant (the
chat panel) can load, when `assistant.skills` in the manifest lists it (`manifest.md`). A skill with no agent is
fine: activation links it to the organization's default agent, which is the assistant. The assistant is the organization's
default agent: it reads records as the person asking and proposes changes as confirmation cards, and an
offered skill is how it learns your app's vocabulary and rules. Write such a skill for that reader:
what a person asks (in their words), which entity and fields it concerns, what the assistant should
propose and what it should refuse to guess. A skill guides and grants nothing: the assistant still acts as the
person asking, so it can only do what that person may. In the manifest the key is the local key with
underscores (`create_team`), never the hyphenated skill `name`. Keep one subject per skill; the assistant loads a skill when
its description matches the question.

What the assistant can call, so a skill names only these:

- **Reads**: `find_work`, `get_task_detail`, `find_runs`, `get_run_status`, `list_entities`, `search_records`,
  `get_record`, `get_dashboard`, `describe_entity`, `find_workflows`, `get_workflow_form`,
  `get_entity_create_form`, `get_task_form`, and `search_content` when the organization has content bound. It
  draws a chart with `draw_chart`.
- **Proposals** (a confirmation card the person presses): `propose_record_create`, `propose_records_create`,
  `propose_record_update`, `propose_bulk_update`, `propose_task_submit`, `propose_workflow_launch`,
  `propose_dashboard_create`, `propose_tile_add`, `propose_view_create` and `propose_metric_create`, and
  `offer_workflow_picker` to let the person choose a workflow.
- `load_skill`, for the skills it carries.

**A filter cannot name the person asking yet.** The assistant knows the person's name, not their id, and a
record filter has no "me" value. So lean on access: when a grant narrows a person to their own records (a `field`
record scope, `access.md`), `search_records` already returns only theirs. For people who see everything, tell the
skill to say so and to ask whose records they mean, rather than filter by a guessed id. Not yet supported:
"my records" for a person whose grants reach everyone's.

A skill that leads the assistant to a card names the tool it calls (`propose_records_create` for several related
records, `propose_bulk_update` for one change to many), the limits your app keeps, the calls to make first
(`get_entity_create_form` for each entity), and what must never be guessed: a holder nobody named, a person a
search did not find, a weekday where a date belongs. The card can set only the fields the entity's create form
binds, so bind the ones the skill writes. When a skill repeats data your app also holds (a skill that lists
the team templates the app also stores), keep the two in step with a test that parses the SKILL.md.

A skill that has the assistant name a repeat sets `duplicate_of` on the row it proposes (on each row of
`propose_records_create`, at the top level of `propose_record_create`) to the id of the existing record the new one
repeats. Write into it:

- what "the same" means for your entity, in your app's terms. For a task in a team: the same team, still open, and the
  same outcome, so "Thiết kế logo trang chủ" repeats "Thiết kế logo" and "In logo lên áo" does not; sharing a few words
  is not enough. Say which records count as open (for example status `todo` or `doing`); the card shows only a match that is
  open and that the person may read, so a skill must not tell the assistant to mention one the card leaves out;
- how to find candidates, and that the id is always one a search returned and never guessed. Use `search_records`
  with filters alone when the entity's searchable fields are not indexed (an installed app's are not yet), and compare
  titles in the skill's own words; give a word search only as a narrowing step;
- that the assistant never refuses or drops the row because of a repeat, and never writes the warning itself: the
  card names the existing record, leaves the row unticked and lets the person tick it back ("Vẫn tạo"). The assistant
  says in its reply which two records look alike, by name.

Names a skill cites (statuses, templates, who may do what) go out of date silently, so keep them in step with the app
by a test that parses the SKILL.md and compares each name with the app's own config.

## The refusals you will meet

```
BUILD_REFUSED: skills#: triage.md is not a .SKILL.md file: a skill's file is <name>.SKILL.md
BUILD_REFUSED: skills/account-access.SKILL.md#: is named for account-access, so it must be account_access.SKILL.md
BUILD_REFUSED: skills/account_access.SKILL.md#: frontmatter line is not a plain "name: value" or "description: value", because it has a value that starts with a quote, which is YAML syntax: begin the value with a plain word and leave the quotes out: description: "How."
BUILD_REFUSED: objects/agent/a.json#/profile/skills/0/skillId: @obj:skill:account_acess names no object, parameter or required entity of the package
```

- Only `.SKILL.md` files go in the skills folder.
- Rename the file for its `name`, with `_` for each `-`.
- The refusal says which rule broke (a value that starts with a quote or other YAML syntax, holds `: ` or ` #`,
  or ends with `:`, or a key other than `name` and `description`): reword that line, keeping `name` and
  `description` each on one plain line.
- A reference that names nothing is reported against the built object (`objects/agent/<key>.json`); fix it at the
  same pointer in `config/agents/<key>.json`. Check the spelling, and the `-` and `_` rule.
