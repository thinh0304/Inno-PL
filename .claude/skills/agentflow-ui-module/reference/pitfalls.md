# Pitfalls

Each of these was met in a real module, and most pass the demo and fail only inside AgentFlow or after a
release, so read this list against your module before you hand it off. Each entry gives the symptom, the cause,
and what to write instead.

## Styles and layout

- **The focus ring, or another style built on a token, vanishes inside AgentFlow but not in the demo.**
  Cause: custom properties declared on `:host`. AgentFlow maps each `--af-*` token on the host element from one
  of its own names (`--af-ring: var(--ring)`); a module property of that name on `:host` (`--ring: var(--af-ring, …)`)
  makes the two refer to each other, and both compute to nothing, fallback and all.
  Instead: declare every custom property on the module's root element and its `[data-theme='dark']` rule.
  `:host` carries layout only (`display: block; position: relative`).
- **The module's styles do nothing, or the page around the module changes.**
  Cause: a second stylesheet (a `<link>`, a `.css` file beside the entry, a second `<style>`), or a selector on
  `:root`, `html` or `body`. Inside a shadow root those selectors match nothing; on a standalone page they style
  the page.
  Instead: one `<style>` prepended to the shadow root, `KIT_CSS` first and then the module's CSS imported with
  `?inline`, as `mountCases` in `src/module/mount.tsx` does.
- **The layout breaks inside AgentFlow at a width that looked fine in the demo.**
  Cause: a width `@media`, a viewport unit such as `vh`, or `window.innerWidth`. AgentFlow's sidebar takes part of
  the window, so the module's width is not the window's.
  Instead: the root declares `container: <name> / inline-size`, and every responsive rule is an `@container`
  query on it.
- **A typeface declared with `@font-face` in the module's CSS never loads.**
  Cause: browsers ignore `@font-face` inside a shadow root.
  Instead: inside AgentFlow, use the host's faces through `--af-font-sans` and `--af-font-mono` (Geist and Geist
  Mono), with a fallback. For a face the host lacks, put the `.woff2` beside the module's source, reference it with
  `new URL(…, import.meta.url)` so the module build carries it, and register it on the document, which the shadow
  root shares, with the kit's `loadFonts`. The module build inlines the file into `index.js` as a `data:` URI,
  whatever its size, so `package/ui` holds no `.woff2` and the script grows by a third more than the file: subset the
  face to the weights and characters you use. AgentFlow's pages send no Content-Security-Policy, so a `data:` face
  loads:

  ```ts
  import { loadFonts } from '@reflexify/agentflow-elements/kit';

  await loadFonts([{ family: 'Display', url: new URL('./display.woff2', import.meta.url).href }]);
  ```

  It adds a face once per page, even when two modules ask for it, gives each weight (`descriptors: { weight: '700' }`)
  its own face, leaves a family the host already has alone, and warns rather than rejects when a face does not load.
  A family name belongs to the whole page, so another app's face under the same name can replace yours: name the
  family after your app.

  Then make the face the module's font, the kit's elements included: their tooltips, toasts and dialogs read
  `--af-font-sans`. Declare it on the module's root, as a stack that does not read itself:
  `--af-font-sans: 'Display', ui-sans-serif, system-ui, sans-serif;`. The kit's elements inside the root inherit it,
  in the top layer too. On `:host` it does nothing inside AgentFlow, whose own value on the host element wins.

  On the standalone page, declare the faces in the page's own CSS.
- **The focus ring is hard to see.**
  Cause: a ring drawn with `--af-ring`, the primary at 40% alpha, about 1.6 to 1 on white.
  Instead: `outline: 2px solid` in `--af-primary` (the starter's `--accent`), offset 2 px, through
  `:focus-visible` only.

## Behaviour

- **Typing in a field fires one of the module's shortcuts, or keys typed in AgentFlow's own page reach the module.**
  Cause: a `keydown` listener on `document` (or `window`). It sees a key typed inside a shadow root as typed on
  the host element, so it cannot tell a field from a shortcut, and it hears the host's page too.
  Instead: listen on the shadow root and read the real target with `composedPath()`. The listeners a library may
  keep, each live only during its own interaction: Zag's dismissable layer (Escape while an overlay is open), its
  focus-visible tracker, its toast-group hotkey, Svelte 5's delegated dispatcher, dnd-kit's keyboard and pointer
  sensors during a drag, and the one `pointerdown` listener `af-dialog` adds while it is open.
- **The module shows nothing in another organization, or reads its objects twice.**
  Cause: a hard-coded id or API base, or `GET /app/objects` read in an effect, which React's StrictMode runs
  twice in development.
  Instead: read ids through `getAppObjects(host.api)` (`src/module/http-cases-api.ts`): one shared request, and
  a failed load is asked again by the next call. Make every address the browser opens itself, a download link or an
  `<img src>`, with `host.apiUrl`.
- **A newer feature is switched on for an org that has not got it, or off for one that has.**
  Cause: comparing `AppHost.contractVersion`, the host contract, with a package version. They are different
  numbers, and the installed version says nothing about an object an admin kept as their own copy.
  Instead: `getAppObjects(host.api).satisfies('<logical key>', '<the version that added the feature>')`.
- **The install is refused, or the module shows "needs a newer AgentFlow", after the manifest says `contract: 2`.**
  Cause: contract 2 (`host.assistant`) needs an AgentFlow that implements it; an older API refuses the package
  at `lint` and at upload as `manifest_invalid` at `manifest.json` (not `platform_too_old`; no platform version
  or route tells the two builds apart), and an older frontend will not mount it.
  Instead: declare `contract: 2` only when the module calls `host.assistant`. AgentFlow reads contract 2 from its
  release `v0.4.0` (AgentFlow's own tag, not the SDK's `sdk-v0.4.0`; a deployment reports a platform month such as
  `2026.10`, which `minPlatformVersion` compares and which does not tell the two apart). Run `lint` with `contract: 2` and then with `1`, and if only 1 passes the deployment predates
  contract 2, so declare 1. Keep `contract: 1` for a module that does not call `host.assistant`.
- **The assistant button shows the wrong record, or none, or the call throws in the app's own site.**
  Cause: a name or label passed to `setContext` (it takes only `{ entity, record }`), the entity's id instead of
  its key, a call that is not set from the route, or `host.assistant.setContext` without the `?.` where the host
  has no assistant.
  Instead: `host.assistant?.setContext(itemId ? { entity: 'item', record: itemId } : null)` from an effect
  that depends on the id parsed from the module's path (`host.onLocationChange`, SKILL.md step 4), and nothing else.
- **The module calls `setContext`, its tests pass, and AgentFlow still offers no button.**
  Cause: the console says `assistant.setContext: this app has no entity "item"`. Either the deployment's host
  predates matching the package key and took only the installed key (`acme_items__item`), or the tests' answer to
  `GET /app/objects` gives an object the same `key` and `logical_key`, which no installation does, so they never
  saw the difference.
  Instead: send the package key, give the test fixture installed keys (`routes.md`, "A test host"),
  and check the running build in the sandbox: the served `ui/index.js` should call `setContext`, and `GET /me`
  should answer `ai_mode_available: true` for the person.
- **Live updates never arrive in development, or stop after a reload.**
  Cause: `host.realtime.close()` in an effect's cleanup. React's StrictMode runs every effect twice in
  development, so the cleanup closes the stream right after it opens; the host owns the stream, and once closed
  it never reopens for that mount.
  Instead: never call `close()` on `host.realtime`. Unsubscribe your own listeners only.
- **Switching the language closes the open dialog and loses what was typed.**
  Cause: the module remounts on a language or theme change.
  Instead: subscribe with `host.onLocaleChange` and `host.onThemeChange` and re-render in place, as `Following`
  in `src/module/mount.tsx` does.
- **A dialog's fields are missing, or stay behind after it closes.**
  Cause: content slotted into a kit element moved into a portal. A `<slot>` does not follow it.
  Instead: keep slotted content where it is; the kit's overlays already rise into the top layer. Put the module's
  own overlays in `host.portalRoot`.
- **A kit property or method is missing at run time, though the types have it.**
  Cause: another module's older kit registered the tag first. Registration is global, and the first copy wins.
  Instead: feature-detect anything newer than the kit version you require (`'label' in el`); read
  `customElements.get(tag).kitVersion` to see which copy you got.
- **A screen reader reads no reason for a locked control, or no name for a kit input.**
  Cause: `aria-describedby` pointed through `af-tooltip`, or a `<label for>` pointed at a kit input. Neither
  crosses a shadow boundary.
  Instead: a visually hidden `<span id="…">` with the reason beside the control, named by its `aria-describedby`,
  plus the `af-tooltip` for sight; name `af-date`, `af-person-picker` and `af-rich-editor` with their `label`.
- **A kit element stays disabled after `disabled="false"`.**
  Cause: the kit's Boolean attributes follow presence semantics: present means true, whatever the value.
  Instead: leave the attribute out, or set the property to `false` through the wrapper
  (`kit-in-react.md`, beside this file).

## Build and serving

- **AgentFlow cannot load the module, or `pnpm build` refuses it.**
  Cause: a library build that is not the shape AgentFlow loads.
  Instead: keep `vite.module.config.ts` as the starter has it: `process.env.NODE_ENV` defined as production; one
  ES entry, `index.js`, ending `export { mount };`; chunks under `chunks/`; no `.css` beside the entry; nothing
  imported bare (React, the kit and the SDK bundled); only the extensions AgentFlow serves, and no HTML. A package
  whose `ui/` holds another file type is refused on upload with `PACKAGE_UI_FILE_INVALID`.
- **`seal` refuses with `UI_ENTRY_MISSING`.**
  Cause: `package/ui` is built output, which git ignores, and it was never built in this checkout.
  Instead: run `pnpm build` before `pnpm seal`.
- **The sidebar entry opens a notice that apps do not open inside AgentFlow on this deployment.**
  Cause: the module check answers `off`: the deployment has `APP_MODULES_ENABLED` turned off.
  Instead: nothing in the package changes it. The deployment's operator decides; the package still installs and
  its workflows and records work.
- **A standalone site's upload or person lookup is refused with an app token.**
  Cause: `POST /attachments`, `GET /groups/{id}`, `GET /identities` and `GET /units` are refused under a packaged
  ceiling. An embedded module calls as the person, so it never meets this.
  Instead: make those calls from the module inside AgentFlow, or as the signed-in person. A site registered outside
  the package has no ceiling.
- **A text with mentions shows raw `@[name](mention:…)` tokens, or a chip with a title the viewer may not read.**
  Cause: the editor was given the text but not the record's `mentions` map, or the module built the chip from the
  token's stored label. A record's response carries the map, keyed `<kind>/<id>`, and has already blanked the label of
  anything the viewer cannot read.
  Instead: pass `mentionMap` (the record's `mentions`) to every `<af-rich-editor>` that shows the text, read-only ones
  included, and let the kit draw a target the map lacks as restricted. Keep the `mentions` map on the module's own
  type for the record so an optimistic update spreads it along.
- **`@` does nothing in an editor, or reopens its menu on every render.**
  Cause: `mentions` is unset (the kit offers no menu without a source, and a read-only editor needs none), or it is a
  new function each render.
  Instead: build the source once with the SDK's `mentions.menuSource(client, { entity_id, record_id, copy })` inside
  `useMemo`, bound to the record being written about, and give it only to editors the viewer may write.
- **Enter or Escape in a one-line mention editor both saves and picks a person.**
  Cause: the editor keeps Enter and Escape for its menu while one is open, but a one-line editor also swallows Enter
  when it is not, so `defaultPrevented` tells nothing.
  Instead: treat the key as the field's own only when no element on the event's `composedPath()` has
  `aria-expanded="true"` (the editor's text field says so while the menu is open); commit the field on `focusout`.
- **A call to an operation the contract does not list yet fails the module's published-operations test.**
  Cause: that test replays every call against the repository's contract.
  Instead: keep the one call in a small adapter of its own, so the day the
  operation is published only the adapter and the test's allowance change.
- **A reload on one of the module's routes of a standalone site answers 404.**
  Cause: the route sits under a path the server answers itself, `/agentflow/` (the SDK's routes) or a prefix of
  the app's own, such as `/site/`, so the server never falls back to the page.
  Instead: keep the server's own files under prefixes the module never routes to.

## Tests

- **A test of the module's styles sees no CSS.**
  Cause: under Vitest a stylesheet imported with `?inline` is an empty string, so a screen or mount test renders
  without the module's CSS.
  Instead: read the file, as `test/module/styles.test.ts` does:
  `readFileSync(new URL('../../src/module/styles.css', import.meta.url), 'utf8')`.
- **A node test fails on import with `Class extends value undefined is not a constructor or null`.**
  Cause: it imports, directly or through `mount.tsx`, a file that imports the kit, and the kit's elements need a
  DOM. The starter's tests run in node unless a first line says `// @vitest-environment jsdom`.
  Instead: give the test that line, or move what a node test needs (a constant, a pure function) into a file that
  does not import the kit.

## Comments

- **A mention shows a name the reader may not see, or a name that has since changed.**
  Cause: the chip was drawn from the label inside the stored token (`@[Label](mention:user/<id>)`), which is what
  the author saw when they wrote it.
  Instead: draw every chip from the response's `mentions` map, keyed `user/<id>` or `record/<entity>/<record>`. A
  target missing from the map, or `restricted`, is drawn restricted with no name; `deleted` as a deleted record.
- **Editing a comment loses a mention, or leaks a record's name back.**
  Cause: the edit box showed raw tokens, or rebuilt them from the visible `@Name`.
  Instead: show `@Name` for a person's token and keep the picked people beside the text; write tokens again on send.
  Send a token whose label came back empty exactly as it came back (the server keeps the label it stored).
- **The section shows an error where the entity takes no comments.**
  Cause: `COMMENTS_DISABLED` (409) or a ceiling's refusal (403/404) treated as a load failure.
  Instead: those mean there is nothing to show. Render nothing and do not retry.
- **The paperclip works in the demo and is refused on the standalone site.**
  Cause: `upload_attachment` is refused to an app's token.
  Instead: hide the button where the host is standalone (not under `/apps/`: `!host.basePath.startsWith('/apps/')`).
- **Escape in a half-written comment closes the drawer and loses it.**
  Cause: the drawer's own Escape runs after the box's.
  Instead: with the `@` menu open, Escape closes the menu (the box is `role="combobox"` with `aria-expanded`, which
  the drawer reads as taken); with text typed and the menu closed, `preventDefault` and blur the box.

## Adding a module to a `--no-ui` project

Step 1 of the skill copies the scratch project's `src/module/` and `test/module/` whole, and they hold the case desk's
screens. Keep what is generic, keep the shape of the pattern files, and replace what reads `entity:case`:

| Keep as it is | Keep the shape, change the names | The case desk's own: replace with yours |
|---|---|---|
| `src/module/kit.tsx`, `test/module/styles.test.ts`, `test/module/ui-build.test.ts`, `vite.module.config.ts`, `vitest.config.ts` | `mount.tsx`, `module.tsx`, `demo.tsx`, `module.html`, and the token block at the top of `styles.css` (the `--bg` to `--info-soft` variables on the module's root class) | `CasesScreen.tsx`, `NewCaseDialog.tsx`, `cases-api.ts`, `http-cases-api.ts`, `memory-cases-api.ts`, `icons.tsx` (it imports `CaseStatus`), `text.ts`, the rest of `styles.css`, `test/module/cases-screen.test.tsx` and `test/module/http-cases-api.test.ts` |

`examples/leave-tutorial` copies `kit.tsx` and the two generic tests from the scratch project, writes the two config files
(`vite.module.config.ts`, `vitest.config.ts`, the second replacing the `--no-ui` project's own) and the middle and right
columns for a leave-request entity.
