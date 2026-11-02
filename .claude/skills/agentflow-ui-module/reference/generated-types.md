# Using the generated types

`pnpm build`, then `pnpm exec agentflow-app types`, writes `src/generated/app.ts` from `package/`. Commit it, and put
`agentflow-app types --check` after the build check in the app's test script
(`vitest run && agentflow-app build --check && agentflow-app types --check`): a file that no longer matches `package/`
fails the tests with `TYPES_STALE`. Run `pnpm build` before `types`, because it reads `package/`, not `config/`.
Rerun it after every change under `config/` that adds, renames or removes an entity, a field, an option or a
workflow input.

The file exports:

- `PACKAGE` (`id`, `version`) and `OBJECTS` (every object of the package by logical key, with the contract version
  the code was written against), and `LogicalKey`, the union of those keys;
- `EntityKey` and `WorkflowKey`, the unions of the entities' and workflows' local keys;
- `EntityFields`, each entity's field values as a record's `body` carries them; every field is optional and may be
  `null` (an `enum` is the union of its option values). The fields `work` seeds (`claimed_by`, `<clock>_due_at`
  and the rest) are in `body` but not in these types: read them by name, as `work.md` in the authoring skill lists them;
- `WorkflowInputs`, what starting each workflow takes.

Pass `LogicalKey` to `getAppObjects`, and `find`, `id` and `satisfies` take only the package's own keys: a typo fails
the compile. A bound or exported object belongs to another package, so with `{ source: 'bound' }` or
`{ source: 'exported' }` the key stays a `string`. Without the type argument, `getAppObjects` takes any string. Use
`EntityFields['<entity>']` on a record's body.

`getAppObjects` works where the caller is the installed app: module code, through `host.api`. The same call from a
sandbox test as a person (`as('alice')`) is refused with `APP_CALLER_REQUIRED`, because that request does not come
through the installed app. In a test use `idsByKey<LogicalKey>()` from `@reflexify/agentflow-sdk/testing`, which reads
the same ids from `.agentflow/sandbox.json` and types the keys by the same `LogicalKey`
(`sandbox-testing.md` of the `agentflow-app-release` skill).

```ts
import { getAppObjects, type AppHost, type components } from '@reflexify/agentflow-sdk';
import type { EntityFields, LogicalKey } from '../generated/app.js';

export async function loanEntityId(host: Pick<AppHost, 'api'>): Promise<string | null> {
  const objects = getAppObjects<LogicalKey>(host.api);
  await objects.load();
  return objects.id('entity:loan'); // still string | null: null when the object is absent or switched off
}

export function toLoan(record: components['schemas']['EntityRecord']) {
  const body = record.body as EntityFields['loan']; // body.status is 'requested' | 'approved' | … | null | undefined
  return { id: record.id, status: body.status ?? 'requested', due: body.due_date?.slice(0, 10) ?? null };
}
```

Write your own entity and field keys. A field that is a `date` is typed `string` (`YYYY-MM-DD`); a `reference` is the
target record's id, as a `string`; a `reference_list` is a list of ids. A `file` field is typed `unknown`: its value is a
list of attachment ids, so narrow it yourself (`(body.approval_letter ?? []) as string[]`) and read the file with the two
calls in `records-api.md`, "One record".
