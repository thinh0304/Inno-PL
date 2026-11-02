# A read-only screen

The starter's screen is a list with a "New case" dialog, toasts and a create that shows its result at once. A
screen that only reads (a "due this week" list, a dashboard of counts) does not need that. This page says what to
delete, what to keep, and what will not tell you that you forgot something.

## What goes

- `src/module/NewCaseDialog.tsx`, **after** moving `todayIso` out of it: `src/module/CasesScreen.tsx` and
  `src/module/demo.tsx` import it from there. Put it in `src/module/text.ts` or a new small file.
- In the screen: the `creating` state, the `created` handler, the `useToasts` call and `{toasts.region}`, the
  "New case" button and its `PlusIcon`, and the `NewCaseDialog` element.
- In the API interface, the HTTP API and the memory API (`cases-api.ts`, `http-cases-api.ts`,
  `memory-cases-api.ts`): `create`, the `NewCase` type, `failNextCreate`.
- In `src/module/kit.tsx`: `Dialog`, `DateInput` and `useToasts`. Keep `useElement`, `Tooltip` and `LazyTooltip` if
  the screen uses a tooltip. **Keep a line that imports the kit's JSX types**, even once the type names on the
  first line (`AfToastElement`, `DateChangeDetail`, `DialogCloseDetail`) are unused: this file holds the only
  import of `@reflexify/agentflow-elements/jsx` in the module, and that import is what types `<af-tooltip>`
  (and every other kit tag). In a module built without the site, `tsc` then fails on the `af-tooltip` tag (the site's `src/App.tsx` also imports the types, which hides this). Replace the first line with `import type {} from '@reflexify/agentflow-elements/jsx';`.
- In `src/module/icons.tsx`: `PlusIcon`, and any icon nothing draws any more (`FlagIcon` goes with the "urgent"
  tag if you drop it).
- In `src/module/styles.css`: the rules only the dialog used: `.slot`, `.form`, `.field` and `.field label`,
  `.label`, `.input` and its states, `.field-error`, `.check`, `.check-label` and `.hint`; and `.head .af-button`
  with `.af-button .icon` if the header has no button.
- In `src/module/text.ts`, in both languages: `newCase`, `title`, `titlePlaceholder`, `titleMissing`,
  `urgentLabel`, `urgentHelp`, `openedOn`, `cancel`, `create`, `creating`, `createFailed`, `created`.
- In `src/module/demo.tsx`: the `?fail` switch and its `failNextCreate` call.
- In `test/module/cases-screen.test.tsx`: the tests of the create flow (the toast, the failed create, a create
  that lands while the list could not load, two creates together, reopening after a failure).

## What stays

- The three states: the skeleton after 150 ms, the empty state, and the error with Try again.
- `Following` in `src/module/mount.tsx` (language and theme change in place), the `<style>` mount, the tokens.
- Date formatting through `Intl` and `LazyTooltip` for a date, the counts through `Intl.NumberFormat`.
- The module's four test files under `test/module/`: the screen's test over the in-memory API, the HTTP API's test,
  `styles.test.ts` and `ui-build.test.ts`. The last two know nothing of the screen: keep them as they are.

## Renaming the screen means rewriting two test files

The screen's test and the HTTP API's test (in the starter, the files named for its cases) import the starter's
screen, API types, `Case` shape, entity key and sample data by name, so once you rename the files they import,
`pnpm typecheck` fails in both. For each:

- **The screen's test**: rename the file, change its imports to the renamed screen, API and memory API files, and
  rewrite what it asserts: the seed rows and what the list shows of them, the empty-state text, the date and count
  tests (they use the starter's seed dates, and `TEXT` keys you may have deleted), and the mounted-screen test, in
  the screen's own words. Delete the create-flow tests with the create flow (above).
- **The HTTP API's test**: rename the file and change its entity key, `logical_key` and field names to the objects the
  screen now reads (`package/objects/`, or the generated `types`), its error class and its import. Its cases (find
  the entity by its logical key and query it, read the objects once, the not-installed error, ask again after a failed load)
  stay.
- Search the other tests for the starter's entity and screen names too (`grep -ril` the old key in `test/`): the site's
  tests and the package's own tests name them as well, and each either goes with the site or is rewritten.

## What will not warn you

- `pnpm typecheck` refuses an unused **import** or local (`noUnusedLocals`), but never an unused **export**: a
  leftover `Dialog` or `PlusIcon` that nothing imports passes. Search for every name you deleted
  (`NewCaseDialog`, `useToasts`, `Dialog`, `DateInput`, `PlusIcon`, `FlagIcon`, `failNextCreate`, `todayIso`) and
  for each text key, and delete what remains.
- `test/module/styles.test.ts` judges the rules that are there (tokens, selectors, units); it does not know a
  rule is unused, so dead CSS passes. Search the stylesheet for each class the screen no longer renders.
- `test/module/ui-build.test.ts` judges the built bundle's shape (one entry, nothing imported by bare name, no
  `process.env.NODE_ENV`); it does not know about dead code either.
- The review checklist's items 19 and 20 (a change made in place, a confirmation) do not apply to a screen
  that changes nothing: answer them "not applicable", and say so in your hand-off.
