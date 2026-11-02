# Memory types and relationships

An agent can keep memory: facts it learns about records or about the organization, typed by a memory type and
linked by memory relationships. A package ships the **definitions**, never the memory itself.

## The two files

- `config/memory_types/<key>.json` becomes `memory_type:<key>`.
- `config/memory_relationships/<key>.json` becomes `memory_relationship:<key>`.

`key` equals the file name, and a memory type and a memory relationship share one key space: the same key in both
folders is refused (`memory_relationships#: known_issue is also a memory type`). References are
`${memory_type:<key>}` and `${memory_relationship:<key>}`, of the package's own objects only: a package never
names another organization's definition, and cannot export or require one. Objects build in the order entities,
memory types, memory relationships, skills, agents.

The installed key is the package prefix and the local key; keep the local key short.

### A type

Members: `name`, `describe`, `fields`, `title`, `review` (required), and `search_on`, `recall`, `max_per_about`,
`expire_after_days`, `never_store`, `grants` and `deprecated`. The builder refuses any other member.

- `fields` is a closed schema of one to 30 single-valued fields: `{ "type": "object", "properties": { "symptom": { "type": "string", "title": "Symptom" } } }`.
  A field key is lower case letters, digits and `_`, starts with a letter, is at most 40 characters and is never `about`.
  Each field has a `title` and one kind: text `{ "type": "string" }`, `{ "type": "number" }`, `{ "type": "boolean" }`,
  a date `{ "type": "string", "format": "date" }` (`"date-time"` for a moment), or a choice
  `{ "type": "string", "enum": ["low", "high"] }`, written `"oneOf": [{ "const": "low", "title": "Low" }, …]` to label
  each choice. A list (`"type": "array"`, a multiple choice) is refused (`lint`: `memory_definition_invalid`, "a memory
  field holds one value"). `"required": ["symptom"]` beside `properties` names the fields every item must have.
- `title` is text; each `{{ field }}` in it names a field of the type.
- `search_on` lists distinct text or choice fields, and the builder refuses any other kind. `lint` checks the rest of each field's shape.
- `review` is what waits for a person before it is kept: `none`, `changes` (a change to an item already known) or `all`.
  An item about nothing (org-wide) is always reviewed as `all`, whatever the type says, since it reaches every
  reader of the type. So a type that may hold org-wide items needs someone with `review` on it (see the grants
  below), or its proposals wait for a reviewer the organization has to add.
- `recall` is how the type's items about nothing reach an agent: `always` (in every prompt) or `search` (when the agent
  searches).
- `max_per_about` (1 to 1000) keeps that many active items about one record, expiring the least recently observed;
  `expire_after_days` (1 to 3650) expires an item not observed again for that long.
- `never_store` is at most 20 entries, each text of at most 200 characters naming what the agent must never keep, such
  as `"Payment card or bank details"`. It is guidance in the agent's prompt: nothing checks a finding against it.
- There is no `identity` member: a package does not declare how a type is identified.

### A relationship

Members: `name`, `description`, `from`, `to`, `review` (required), and `attributes` (at most 10 fields; leave it out
for none) and `deprecated`. An end is `{ "kind": "entity", "id": "${entity:<key>}" }` (or a required entity's
reserved id) or `{ "kind": "memory_type", "id": "${memory_type:<key>}" }`. The reference must match its `kind`.

## Grants and their default

`grants` is a list of `{ "to": …, "level": "read" | "review" }`: who may read the type's memory, or review its
proposals. `to` is `"everyone"` or `"${param:<key>}"` of a **`group_ref`** parameter; a literal group id is refused,
because the group is the installing organization's choice. Each principal appears once; at most 200.

- Leave `grants` out and the type is `[{ "to": "everyone", "level": "read" }]`. `"grants": []` means nobody reads it.
  Neither gives anyone `review`, so a type whose memory is proposed (its `review` is not `none`, or it holds
  org-wide items) also needs a `review` grant to a `group_ref` parameter, such as `{ "to": "${param:reviewers}",
  "level": "review" }`.
- A grant to an **optional** group parameter that the admin leaves unset is withheld, and the plan reports it
  (`memory_grant_withheld`). A required parameter is asked for at setup. Packing the installation again keeps the
  grant as declared.
- Two parameters pointed at one group become one grant, at the higher level.
- After an install the organization owns the access list. An upgrade adds what the release newly grants and keeps
  what the organization changed.
- The plan shows the admin each grant to everyone or a group it writes (`memory_grant_written`): every grant of a
  new type, and each one an upgrade adds, raises, lowers or removes. Raising `everyone` to `review` lets every person
  accept what agents propose, so expect the admin to read it closely.

## Using a type

- **A Learn step** names the package's own types and relationships in `learn`, and learns through the
  package's own agent, whose `read_limit` covers what the step reads. See [A Learn step](#a-learn-step).
- **An agent that saves memory** carries `profile.memorySave`: `{ "types": [...], "relationships": [...], "about": [...], "orgWide": false, "review": true, "instructions": "…" }`.
  `types` is required and may be empty when relationships are saved; at most 20 types and 10 relationships, one of
  the two not empty. `about` lists entities (`${entity:<key>}`) or the package's types, and may be empty only with
  `"orgWide": true`. `instructions` is plain text of at most 4000 characters, with no `{{`. **The agent's
  `read_limit.memory_types` must list every type it saves into** (and the type ends of the relationships it
  saves), or the builder refuses (`/read_limit/memory_types`) and `lint` reports `memory_save_read_limit_uncovered`.
  A package cannot save into a type it ships `deprecated`. The plan names each such agent to the admin before approval
  (`memory_save_declared`: the agent, its types and relationships, whether its saves are reviewed and whether it writes org-wide), since it
  will write memory. The agent saves in a conversation, and in an Agent step that names it with `agentRef` when
  the step's prompt reads text of its subject record. With `"review": true`
  (off by default) every chat save is proposed for review; otherwise, and always in a step, the type's `review`
  decides.
- **`read_limit.memory_types`** lists the types an agent may read:
  `{ "entities": [{ "entity": "${entity:<key>}", "operations": ["read", "list"] }], "memory_types": ["${memory_type:<key>}"] }`.
  At most 200, none twice, never an entity. A type has no operations: a listed type is read. `entities` stays required,
  and `[]` there means the agent reads no record: an Agent step that gives this agent its subject then fails with
  `AGENT_CEILING_DENIED`. List every entity the agent's steps hand it, as the example below does with `ticket`
  (`agents-and-skills.md`, "What the agent may read").

```json
{ "key": "triage", "name": "Triage agent",
  "profile": { "systemPrompt": "…", "model": "${param:triage_model}",
    "memorySave": { "types": ["${memory_type:known_issue}"], "orgWide": true, "instructions": "Save a fault only when two tickets report it." } },
  "access": { "mode": "restricted", "groups": ["${param:app_users}"] },
  "read_limit": { "entities": [{ "entity": "${entity:ticket}", "operations": ["read", "list"] }],
                  "memory_types": ["${memory_type:known_issue}"] } }
```

## A Learn step

A `learn` step reads one record and the records that hang off it, and writes what it finds into the package's
memory types. The builder has no helper for it: write it with `node(id, name, "learn", { … })` in a section
file under `config/build/`, listed in `merge`. It learns from a ticket, its messages, and the contact
who raised it.

```js
import { INITIATOR, restricted, node, start, end, edges, graph, workflow } from "@reflexify/agentflow-app-builder/workflow";

const TICKET = "${entity:ticket}";

export const workflows = {
  learn_from_ticket: workflow(
    "learn_from_ticket", "Memory · Learn", "Notes the known issues a ticket's messages report.",
    INITIATOR, restricted("desk_users"),
    graph("Memory · Learn", [
      start({ subject: TICKET }),
      node("learn", "Learn from the ticket", "learn", {
        agent_ref: { agentId: "${agent:triage}" },
        source: {
          entity: TICKET,
          record: "{{ subject.record_id }}",
          include: [
            { related: "messages", text: "body", drop_quoted: true,
              skip_when: { "==": [{ var: "author_kind" }, "unverified"] } },
          ],
        },
        about: [{ name: "customer", entity: "${entity:contact}", from: "requester" }],
        learn: { types: ["${memory_type:known_issue}"], relationships: ["${memory_relationship:affects}"] },
      }),
      end("end", "Done", "Learned"),
    ], edges(["e_start", "start", "learn"], ["e_learn", "learn", "end"])),
  ),
};

export const triggers = {};
export const actions = {};
```

This one runs when a person starts it, as `INITIATOR`. To learn from every ticket as it changes (when its status
becomes resolved, say), start the workflow with a trigger instead, and run it as the package's service principal:
see "Triggers" and "Who a workflow runs as" in `workflows.md`.

The members are snake_case, except `agent_ref`'s, which keep the Agent step's camelCase (`agentId`).

- `source.entity` is the record's entity and `source.record` a template that renders its id.
- `source.include` lists what is read, 1 to 10 items. `{ "field": "subject" }` reads a text field of the source
  (or a formula whose result is text). `{ "related": …, "text": … }` reads child records: `related` is the
  `inverse_key` of a reference field on the child that points at the source (here `message.ticket`, whose
  `inverse_key` is `messages`), and `text` is the child's text field (or text formula). It may add `order_by` (a
  `datetime` field of the child, or a formula whose result is one: a `date` field is refused), `drop_quoted`,
  `skip_when` and `context`.
- An include's `context` lists at most **5** fields of the child shown beside each item as background, never
  quoted (here `author_kind`). Not its `text` field, none twice, and no `reference`, `reference_list` or `file`
  field: they hold ids, not text.
- `drop_quoted: true` strips quoted email history (`>` lines, "On … wrote:") before the model sees the text. It
  is off by default.
- `skip_when` is a JSONLogic condition over the **child record's own fields**, named by their bare key
  (`{ "var": "author_kind" }`, not `record.author_kind`). A child it matches is never shown to the model.
  Publish refuses a field the child does not have, or a secured one; a condition that cannot see its field
  when the step runs skips every child, since content it could not judge is never shown.
- `source.context` (at most 10 fields of the source) is background the model sees but never quotes, with the
  same rules: no field an include already reads, none twice, no reference or file field.
- `about` binds records the memory can be about: `name` is how the model names it (a lowercase key, never
  `source`, none twice), `entity` its entity, and `from` a `reference` field of the source that points at
  `entity` (here `ticket.requester`). At most 5.
- `learn.types` (1 to 10) and `learn.relationships` (up to 10) are the package's own definitions, none twice.
  Each end of a listed relationship is the source entity, an About entity or a listed type: `affects` runs from
  `known_issue` (listed) to `ticket` (the source). `org_wide` (default `true`) lets the step keep memory about
  nothing.
- `known_memory.max_nodes` (default 50, at most 200) caps the stored memory shown to the learner. `instructions`
  is plain text (at most 4000 characters, not a template) added after the agent's own.

The step's agent is the package's own, and its `read_limit` covers what the step reads: `read` on the source
entity and on each About entity, `read` and `list` on each related child, and each learned type in
`memory_types`. That is what verification checks. **Give the source and each About entity `list` as well.** An
agent reads an item back (in recall, through the memory tools, or as the known memory of a later visit) only
when its limit admits both `read` and `list` on the record the item is about and on each record it was learned
from; with `read` alone on `contact`, everything the step learns about a customer is invisible to the agent
that learned it. The `triage` agent's:

```json
{ "read_limit": {
    "entities": [
      { "entity": "${entity:ticket}", "operations": ["read", "list"] },
      { "entity": "${entity:message}", "operations": ["read", "list"] },
      { "entity": "${entity:contact}", "operations": ["read", "list"] }
    ],
    "memory_types": ["${memory_type:known_issue}"] } }
```

Verification refuses the package (`PACKAGE_BODY_INVALID`), and `lint` reports it first, when a Learn step:

- has no `agent_ref`, or learns through an agent that is not the package's own (lint: `learn_agent_not_own`),
  or one with no `read_limit` (`learn_read_limit_missing`);
- reads something the limit does not cover, an entity operation or a learned type (`learn_read_limit_uncovered`,
  one per gap, saying what to add);
- has an empty `learn.types`, more than 10 types or relationships, one named twice, or one that is not the
  package's own (`memory_reference_invalid` for a definition the package does not ship, `body_invalid` for the
  rest);
- lists a relationship with an end that is neither the source entity, an About entity nor a learned type, or
  names a type or relationship the package ships `deprecated` (`memory_reference_invalid`).

**Keep each related child inside the package.** Verification and `lint` find a related include's child among
the package's own reference fields, so for one the package does not declare nothing checks that the agent's
`read_limit` covers it, and the limit can name only an entity the package declares or requires. Unless the limit
gives its entity `read` and `list`, installing grants the agent nothing on it: the plan warns
`read_limit_learn_step_refused` (rule `learn.ceiling_denied`), and the step fails when it runs until an admin
grants the agent that entity.

**Everything else about the step is judged when AgentFlow publishes the workflow, at install.** `build` checks
only that the references resolve, and `lint` only what is listed above: a sixth `context` field of an include, an
`order_by` on a `date` field, a `from` that is no reference, a misspelt `related` or a `record.` in `skip_when` all
build and lint clean. The install plan refuses them: one finding per broken rule on the workflow, coded with the
rule and placed at the step's field, such as `learn.context_invalid on workflow:learn_from_ticket at
learn.source.include`. The rules include `learn.include_invalid`, `learn.context_invalid`, `learn.skip_when_invalid`,
`learn.about_invalid`, `learn.source_invalid`, `learn.known_memory_invalid`, `learn.instructions_invalid`, and
`learn.params_invalid` for settings it cannot read at all. What the agent's ceiling refuses (`learn.ceiling_off`,
`learn.ceiling_denied`) is a warning at install, not a refusal, as above. A misspelt member of the step itself (`knownMemory` for `known_memory`) is refused by none of them: it is
ignored, and the default applies. The setup page lists the findings, and so do `deploy --sandbox`, `deploy --wait`
and `status` (`agentflow-app-release`). Keep to the rules above, and install a Learn step in a sandbox before you
send it to an admin.

## Example: the desk's `known_issue`

The type, in the file named for its key under `memory_types/`:

```json
{
  "key": "known_issue",
  "name": "Known issue",
  "describe": "A fault the support team already knows about, with how to recognise it and what to tell the customer",
  "fields": { "type": "object", "properties": {
    "symptom": { "type": "string", "title": "Symptom" },
    "workaround": { "type": "string", "title": "Workaround" } } },
  "title": "{{ symptom }}",
  "search_on": ["symptom", "workaround"],
  "review": "changes",
  "grants": [{ "to": "everyone", "level": "read" }, { "to": "${param:support_group_id}", "level": "review" }]
}
```

The relationship, from the issue to the `ticket` entity, under `memory_relationships/`:

```json
{
  "key": "affects",
  "name": "Affects",
  "description": "A known issue affects a ticket",
  "from": { "kind": "memory_type", "id": "${memory_type:known_issue}" },
  "to": { "kind": "entity", "id": "${entity:ticket}" },
  "review": "none"
}
```

## Content never ships

A package carries definitions only. Nodes, edges, proposals and sources are the organization's memory; installing
creates none, and packing an installation (or a draft) carries none out.

## Upgrades, drops and undo

- **An upgrade is blocked with `APP_MEMORY_DEFINITION_FROZEN`**, naming the definition, only when it would **write**
  a change that the definition's memory forbids: removing or retyping a field of a type that holds memory, removing a
  choice, moving a relationship's ends once it has edges, removing or retyping a relationship's attribute. Growing a
  type (a new field, a new choice, a changed title or description) is never blocked, and neither is a definition the
  organization changed while the release left it alone. To reshape one that holds memory, add a field or a type instead.
- **A memory type or relationship you remove from a later release is archived on upgrade, never deleted.** Its
  memory stays and can be read. Set `"deprecated": true` to archive one while the release still ships it.
  A reattach does not archive a definition the release no longer ships.
- **Undo is blocked** while any memory exists, in any state (a rejected proposal counts), in a type or relationship
  the installation created. It is also blocked by an organization's own relationship that ends on a created
  type or entity, and by the organization's agents or workflows that name a created definition. The undo screen
  names each one.
- A key held by an organization's own memory definition is `APP_KEY_HELD_BY_TENANT`.

## Lint codes

`memory_definition_invalid` (a type or relationship the memory designer would refuse, including one key in both
kinds), `memory_reference_invalid` (a Learn step, `memorySave` or `read_limit` entry naming no definition of the
package, a deprecated one where it cannot be, or a relationship end the step cannot bind) and
`memory_save_read_limit_uncovered`. `learn_step` no longer exists: a Learn step is allowed. The codes are explained in
the release skill's lint-problems reference.
