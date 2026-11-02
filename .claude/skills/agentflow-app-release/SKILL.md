---
name: agentflow-app-release
description: Use when building, checking, sealing, deploying or testing in a sandbox an AgentFlow app package with the agentflow-app CLI (build, seal, lint, deploy, sandbox), or when one of them is refused.
---

# Building, checking, sealing and deploying an AgentFlow app

The `agentflow-app` CLI ships in `@reflexify/agentflow-app-builder`. It has eleven commands: `init` starts a project, `build` turns `config/` into `package/`, `keygen` makes a signing key, `seal` signs `package/` into an `.afpkg` file, `lint` checks `package/` against an AgentFlow deployment, `deploy` uploads the sealed file and asks for it to be installed, which an admin then approves, `publish` and `withdraw` put a sealed package in the deployment's app catalog and take a version out, `sandbox` makes a disposable organization to test the app in (`deploy --sandbox` installs there without an admin), and `types` writes TypeScript for the package's objects from `package/`; `status` reads where the package's deployments stand and changes nothing. What goes in `config/` is the `agentflow-app-authoring` skill; converting a designer draft is `agentflow-from-draft`.

The guide's pages are on your AgentFlow deployment, and the skills link them as `<AGENTFLOW_URL>/guides/…`.
`<AGENTFLOW_URL>` is the address your team opens AgentFlow at (what the `AGENTFLOW_URL` variable holds, below). If
you do not know it yet, ask your org admin.

## What you need

- Node 22.9 or later (the project's `engines` is `>=22.9.0`) and pnpm.
- The builder as a development dependency, from git at one SDK release tag. A project made by `init`
  already has it:

```bash
pnpm add -D "github:reflexify/agentflow-sdk#sdk-v0.7.0&path:packages/agentflow-app-builder"
```

- Two pnpm settings in the project's `pnpm-workspace.yaml`, which `init` writes:

```yaml
blockExoticSubdeps: false
allowBuilds:
  esbuild: true
```

  Without the first, pnpm refuses the SDK's packages, which refer to each other by git reference
  (`ERR_PNPM_EXOTIC_SUBDEP`). Without the second, it refuses to run esbuild's install script, which the
  starter's tooling needs (`ERR_PNPM_IGNORED_BUILDS`).

In a project, run the CLI through the package scripts (`pnpm build`, `pnpm check`, `pnpm seal`) or as `pnpm exec agentflow-app <command>`.

## Starting a project: `init`

```bash
pnpm dlx --package "github:reflexify/agentflow-sdk#sdk-v0.7.0&path:packages/agentflow-app-builder" \
  agentflow-app init my-app --prefix acme
cd my-app && pnpm install && pnpm build
```

`pnpm dlx` fetches the builder from GitHub, so it needs the network. Offline, in any project where `pnpm install`
has run, the builder is in `node_modules`: `pnpm exec agentflow-app init ../my-app --prefix acme` does the same.

- `--prefix <prefix>` (required): your package prefix: you choose it (2 to 16 lowercase letters and digits, starting with a letter).
- `--key <key>`: the package key; it defaults to the folder's name. 1 to 40 lowercase letters, digits and
  hyphens, starting with a letter, with no double or trailing hyphen. The package id is `<prefix>/<key>`.
- `--no-ui` leaves out the UI module, and `--no-site` the standalone site. With both, the project is the package alone.
- `--from <draft.zip>` converts a draft instead: see the `agentflow-from-draft` skill.

The project is the starter, the case desk, under your names. Its scripts:

| Script | Runs | Does |
|---|---|---|
| `pnpm build` | `agentflow-app build` | writes `package/` from `config/`, and builds the UI module into `package/ui` when the manifest declares one |
| `pnpm check` | `agentflow-app build --check` | compares `package/` with what `config/` builds, and changes nothing |
| `pnpm test` | the Vitest tests, if any, then the check | |
| `pnpm seal` | `agentflow-app seal` | signs `package/` into `dist-app/` |

### Starting from a copy of the template instead

Let `init` rename and strip the template for you; do not rename by hand. The steps, and the `diff` that keeps a copy you already changed, are in `reference/template-copy.md`.

## `build` and `build --check`

`pnpm build` prints `wrote 12 package files` and `ui: none`, `ui: built` or `ui: copied`. It deletes
`manifest.json` and `objects/` under `package/` and writes them again, so `package/` never holds a file the
config does not make. Never edit `package/` by hand: commit it with `config/`, so a reviewer reads what
ships.

`pnpm check` prints `package/ matches the config`, or refuses:

```
PACKAGE_STALE: package/ does not match the config (stale: objects/entity/case.json): run pnpm build
```

It names each file that is `stale` (differs), `missing`, or `not from the config` (a file the build does not
make). `pnpm check` compares package/ui with the module when package/ui exists, byte for byte (the `prebuilt` folder, or a Vite build into a temporary `.agentflow/ui-check-*` folder, as deep as `package/ui` so source maps match);
without `package/ui`, which git ignores, it says nothing of the module, and `seal` refuses a module never built. Run it in CI and before every commit.

## Typed keys: `types`, after `build`

`pnpm exec agentflow-app types` writes `src/generated/app.ts` (`--out <file>` elsewhere): TypeScript for the objects in `package/`
(`LogicalKey`, `EntityFields`, `WorkflowInputs`) that a module or a site imports; `generated-types.md` in the `agentflow-ui-module`
skill shows the use. It reads `package/`, not `config/`, so run `pnpm build` first (without a `package/` it is `PACKAGE_MISSING`; with an old one it
writes old types). A project that commits the file puts `agentflow-app types --check` after the build check in its `test` script
(`vitest run && agentflow-app build --check && agentflow-app types --check`); a stale file is `TYPES_STALE`, fixed by `pnpm build` and
`pnpm exec agentflow-app types`. A project `init` made with its UI module ships the file and that `test` script; one made with `--no-ui` has neither until you add them.

## Keys: `keygen`, once per publisher

```bash
pnpm exec agentflow-app keygen --key-id acme-2026
```

- It writes `keys/<id>.pem` (an ed25519 key in PKCS#8 PEM, mode `0600`, readable only by you) and prints the file
  and the key id, with a reminder that the key is secret. `--out <file>` writes the key elsewhere.
- Make one key per publisher, once, and use it for every package and every release. `keygen` never
  overwrites a key (`KEY_EXISTS`), so leave it out when you seal again.
- **Keep the key secret.** Git ignores `keys/`; never commit it, never paste it, never print it, and never
  copy it into a report, a log or a test. If its mode changes, `seal` refuses it until you run
  `chmod 600 keys/<id>.pem`.
- `keygen` accepts a key id of letters, digits, `.`, `_` and `-`, at most 64 characters, starting with a letter or digit (otherwise `KEY_ID_INVALID`). `seal` uses the file's name, without `.pem`, as the signer unless
  you pass `--key-id`.
- The key seals the package. AgentFlow checks that it is intact and records the key id on the release; the key id and the
  package id's prefix are claims it does not check, and nobody has to trust the key first: there is no key to give an admin or enable.
  Any intact sealed package installs, whatever its prefix (a second publisher may share one) and whichever key sealed it, and a leaked
  key changes nothing (keep it private anyway: it is how you seal). The gate is the admin's approval of each install and upgrade. The
  one lock is on content: a package id and version hold one content, so a changed package under a version already uploaded is refused
  (raise `version`). The catalog is the exception for prefixes: the first `publish` under one claims it (`reference/publishing.md`).
  The guide page on keys is `<AGENTFLOW_URL>/guides/en/xay-dung-ung-dung/khoa-ky` (Vietnamese `<AGENTFLOW_URL>/guides/xay-dung-ung-dung/khoa-ky`).

## What to send your org admin

One message, before the first `deploy`. Everything an admin does for your app is on this list; none of it can
be done with a key from your side. A message to adapt is in `reference/admin-message.md`.

1. **The service keys for CI**: a deploy key (a service principal with `integration.admin`) and, for pull requests, a
   lint-only key. The steps are in the admin guide, `<AGENTFLOW_URL>/guides/en/quan-tri/cai-dat-ung-dung`
   ("The publisher's CI keys"). Ask also for the deployment address, `AGENTFLOW_URL`. Skip this item when the keys exist already.
2. **The parameters**: for each one in `parameters`, what to choose and which role its members need (the parameter's
   `help` says so). Put the answers you know in `parameters.json` (below); the admin answers the rest on the setup page. Tell them to put a run-as service principal in its workflow's automation group (setup only warns it lacks record access; a stage move fails at run time). Ask whether the `name` of each workflow and agent you ship is free: a taken one fails the plan (`DUPLICATE`, `reference/refusals.md`), and neither a sandbox nor `lint` can see it.
3. **What to do after the install**: **turn on the triggers** (a trigger always ships off, and `deploy --sandbox` arms them, so a green sandbox test hides this step; it reacts only to changes made after it is on, and a key cannot read whether it is), the dashboards to share
   with the audience group, and anything else the `changelog` or the app's README tells installers.
4. **Which release you mean**: the package id, the `version`, and the file `seal` printed (its `digest`).

The admin's own guide page is `<AGENTFLOW_URL>/guides/en/quan-tri/cai-dat-ung-dung` (approving); send it.

## Sealing a release

1. Raise `version` in `config/package-manifest.json` (SemVer), and write `changelog` for the release.
2. `pnpm build`. Fix every refusal (the `agentflow-app-authoring` skill reads them).
3. `pnpm test`, which ends with the check (and `types --check`, if your `test` script has it: `pnpm build` first).
4. `pnpm exec agentflow-app lint` (Connecting to AgentFlow, below). It reads `package/`, so it needs no signing key and no seal (only the connection variables): fix every
   problem in `config/`, `pnpm build`, and lint again **before** sealing, so a lint problem never costs a re-seal (`SEAL_OUT_EXISTS`, below).
5. `pnpm exec agentflow-app keygen --key-id <id>`, the first time only. Keep the file private.
6. `pnpm seal`. It signs `package/` with the one ed25519 key in `keys/` (it ignores any other key there, such
   as the standalone site's RSA key; with more than one ed25519 key, pass `--key keys/<id>.pem`) and prints `sealed <the file>`, then the `package` and version, the `digest` and the `signer`.
7. `pnpm exec agentflow-app deploy --wait` (below). An admin approves the install. `pnpm exec agentflow-app status` shows where this package's deployments stand at any time, and changes nothing.

- The file is `dist-app/<prefix>-<key>-<version>.afpkg`. Git ignores `dist-app/`, which is not `dist/`: a Vite build empties `dist/`. `--out <dir>` writes elsewhere.
- The archive limits, the same in `seal` and on the server's upload: 2,000 entries (1,998 of yours plus `hashes.json`
  and `signature`), 5,000,000 bytes per file and 100,000,000 in all, uncompressed, and 20,000,000 bytes for the
  archive (checked when `seal` writes it, when a zip is read, and by the server). A module using the UI kit can
  come to about 1.5 MB; that is within them.
- Sealing the same package again succeeds: the first line is `unchanged: <file>` instead of `sealed <file>`, then
  `package`, `digest` and `signer`, and the file is not rewritten (`--json`: `"unchanged": true`). A changed package
  under a version already sealed is refused (`SEAL_OUT_EXISTS`): **raise `version` on every release**. If that version never reached a
  deployment or the catalog (`deploy`, `publish` or the packages page stored it; `lint` and `seal` do not), delete the file the message names and seal again
  (`reference/upgrading-the-sdk.md`). `pnpm check` compares `package/ui` too, so a module-only change that was not built is `PACKAGE_STALE`.
- `seal` signs what is in `package/`; it does not rebuild. Run `pnpm build` first, so `package/ui` is current.

## Connecting to AgentFlow: two variables

`lint`, `deploy`, `publish` and `withdraw` talk to one AgentFlow deployment, in your organization. They read:

| Variable | Holds |
|---|---|
| `AGENTFLOW_URL` | the address you open AgentFlow at, such as `https://agentflow.example.com`. `--url <url>` overrides it. It must be `https://`; `http://` works only on `localhost`, `127.0.0.1` and `[::1]`. |
| `AGENTFLOW_TOKEN` | a service principal's key, `afk_…`. An admin makes the principal under **Admin → Service principals**, gives it a role with `integration.admin` (deploy needs it; lint needs only a key of the organization) and makes a key. |

```bash
export AGENTFLOW_URL=https://agentflow.example.com
read -rs AGENTFLOW_TOKEN && export AGENTFLOW_TOKEN
```

`read -rs` takes the key without showing it, and keeps it out of your shell history. **Keep the key secret**: never write it into a file, a script, a report, a log or a test, and never pass it on a command line. The CLI sends it only in the `Authorization` header to `AGENTFLOW_URL`, never follows a redirect, and prints `[redacted]` wherever an answer would show it.

## Checking against AgentFlow: `lint`

```bash
pnpm exec agentflow-app lint
```

1. It reads `AGENTFLOW_URL` and `AGENTFLOW_TOKEN` (either missing is `DEPLOY_NOT_CONFIGURED`), then runs `build --check` before any request: a stale `package/` is `PACKAGE_STALE`, so lint judges what `config/` says. Run `pnpm build`.
2. It zips `package/` as it stands (no key, no seal) and sends it. AgentFlow runs the archive limits, the manifest check, the platform-version check and every lint rule, with its own code, and stores nothing.
3. It prints each problem on one line, then a count:

```
run_as_not_initiator  workflow "workflow:request_loan"  /runAs: People can start this workflow, directly or through a Call, so it must run as its initiator, not @param:automation_principal (fix: Set runAs to "initiator".)
1 problem (AgentFlow 2026.10)
```

Exit `0`: `no problems`. Exit `1`: problems, or a refusal. Each problem's code is explained, with its fix, in `reference/lint-problems.md`. An agent's `read_limit` has its own codes there (`read_limit_invalid`, `agent_read_limit_uncovered`, `learn_agent_not_own`, `learn_read_limit_missing`, `learn_read_limit_uncovered`), and memory types have three (`memory_definition_invalid`, `memory_reference_invalid`, `memory_save_read_limit_uncovered`); an entity's `source` has four (`source_path_unknown`, `source_type_mismatch`, `source_enum_unmapped`, `source_key_mismatch`); a Learn step is no longer a problem (`learn_step` is gone). A memory type or relationship dropped from a later release is archived on upgrade, never deleted; an upgrade is blocked (`APP_MEMORY_DEFINITION_FROZEN`) only when it would write a change the type's memory forbids (a field removed or retyped, a choice removed, a relationship's ends moved), never for a type the organization changed while the release left it alone; and an undo is blocked while memory exists in a type or relationship the app created (`memory.md` in the authoring skill). Installing turns an agent's limit on and grants the pairs it declares; an upgrade merges the release's limit with the organization's changes, never re-granting what an admin removed. Fix each in `config/` (the pointer is into the built object under `package/objects/`: find the same place in the config file that makes it), `pnpm build`, and lint again. A package the builder accepts can still have problems here: AgentFlow is the authority. `lint` does not judge an entity's field values (a `type`, a `format`, an option colour): AgentFlow checks those when the package is installed, so keep to the values `entities.md` lists. `platform_too_old` means this deployment is older than `minPlatformVersion`: ask the AgentFlow team to upgrade the deployment, or deploy to one that runs that version. Lowering `minPlatformVersion` is possible only down to the value this SDK release states, never below it (edit `config/package-manifest.json`, build, seal, then deploy; raise `version`, or delete the sealed file, if this version was sealed before). `--json` prints AgentFlow's answer as it is.

**Without a deployment**, `lint` stops at `DEPLOY_NOT_CONFIGURED` and checks nothing. Run `pnpm exec agentflow-app build --check` for freshness, and read `reference/lint-problems.md` against the package yourself. Every lint rule, the install plan's checks (`human.end_when_invalid`, `reference.*` and the others in the authoring skill's `workflows.md`) and an entity's field values stay unchecked until `lint` or an install runs: report the package as built, not as checked.

## Deploying: `deploy`, then an admin approves

The guide page `<AGENTFLOW_URL>/guides/en/xay-dung-ung-dung/kiem-tra-va-trien-khai` (Vietnamese `<AGENTFLOW_URL>/guides/xay-dung-ung-dung/kiem-tra-va-trien-khai`) walks the same flow, with a CI example.

```bash
pnpm exec agentflow-app deploy --parameters parameters.json --wait
```

1. It finds the sealed file for the version in `package/manifest.json`, `dist-app/<prefix>-<key>-<version>.afpkg`, or the one `--file <file>` names. None is `SEAL_MISSING`: run `pnpm seal`.
2. It uploads it. AgentFlow checks that the archive is intact and sealed, the platform version and lint, then stores the release. Bytes uploaded before print `already uploaded` and carry on.
3. It asks AgentFlow to install that release in the key's organization, with the setup answers in `--parameters <file>`, a JSON object by parameter key such as `{"app_users":"<group id>"}` (The parameters file, below), and `--decisions <file>`. Both are optional: whatever they leave out, the admin fills in. An upgrade keeps the installed answers and asks only for new parameters; the setup page asks only for the new ones.
   - Every key in `parameters.json` must be one of the manifest's `parameters`. A key it does not declare, such as a typo, is refused with 422 `VALIDATION_ERROR`, which names each unknown key.
   - `--decisions` may only **decline** grants of this package: `{"grants": {"<prefix>/<key>": {"<grant key>": "declined"}}}`. A request may only narrow what the app gets. `deploy` checks the file's shape before anything is sent: a member other than `grants`, or a value other than `"declined"` (a grant sent to another principal, approved clients, features, choices), is `USAGE`. AgentFlow then refuses another package, or a grant key the manifest does not declare, with 422 `VALIDATION_ERROR` naming the path. The admin who approves decides all of that on the setup page.
4. It prints `awaiting approval: <link>`, then what runs meanwhile (`until a person approves it, the installed version <v> keeps running, and runs started meanwhile use it`, or `nothing is installed until a person approves it`), and exits `0`. When a person has planned the setup and something stopped its approval, it prints those findings on stderr too. **A key never installs.** Send the link to an admin of the organization. Its origin is the API's `HTTP_FRONTEND_BASE` setting (default `http://localhost:4000`), which may differ from your `AGENTFLOW_URL`: if it opens nowhere for the admin, send them the path `/admin/apps/deployments/<id>` to open at their own address, and ask the deployment's operator to set `HTTP_FRONTEND_BASE` (`reference/admin-message.md`). It opens the app's setup page with your answers filled in. They read what the app is, the access it asks for and what it creates, complete the setup, and press **Approve and activate**.
5. With `--wait` it waits as long as approval takes: `installed` exits `0`; a failed install or a cancelled deployment is `DEPLOY_FAILED` with the reason, exit `1`. Findings the admin answers on the setup page (a parameter, a feature) are printed and waited on; any other finding a person's plan stores stops it with `DEPLOY_NOT_APPROVABLE`, exit `1`, naming the findings: the deployment stays awaiting approval, and a person who may grant what is missing can still approve it. A key cannot plan, so `deploy` never sees a plan's warnings; `deploy --sandbox` prints them. Ctrl-C stops the waiting (exit `130`); the deployment stays, and the admin can still approve it.

The admin may finish what your answers leave open (a binding, a feature, a client) on the setup page; `--wait` ends when they approve and activate it, wherever they do. Approving is always a person's step: never try to approve with the key, and never ask for a person's session to do it.

- The CLI has no command to uninstall, detach or roll back an app. An admin does those in **Admin → Apps**; to go back to an earlier behaviour, raise `version` and deploy the change.
- When an admin has a change to the same app approved and not yet activated, the deployment waits until it is activated or withdrawn.
- If the admin discards the setup, the deployment is withdrawn; if they switch the setup to another version, it is cancelled as replaced, even though no newer deployment was sent. Both end `--wait` with `DEPLOY_FAILED`.
- When this version is installed already, it prints `installed` at once, and that answer leaves an upgrade still waiting for approval alone. So a CI job that re-runs `deploy` for the installed version does not cancel a waiting upgrade; withdraw the upgrade, or approve it.
- `deploy` again with the same file and the same answers returns the same deployment, so a retry after a dropped connection makes no second one. Other answers make a new one, which replaces the one still waiting (unless that answer is `installed` at once, above). After a deployment failed or was cancelled, `deploy` asks again: a new deployment that needs approval again, so read the state first with `pnpm exec agentflow-app status` (read only: this package's newest deployments, a failed one's code and reason, and the sandbox) and fix the cause. `deploy` itself says `the last deployment of <id> <version> failed: …; this is a new one` when it makes a new one after a failure; never run `deploy` to check state (`reference/after-deploy.md`).
- **After the install, the check as a person is the admin's.** A key has no user identity: it cannot start a record as staff or claim and decide a task (`USER_IDENTITY_REQUIRED`), and cannot tell whether a trigger is on (`reference/after-deploy.md`). Ask the admin, or a person they name; the sandbox is where the team tests the flow itself.
- A new release: raise `version`, build, seal, deploy. An upload of a version your organization already holds with other contents is refused with 409 `APP_PACKAGE_VERSION_EXISTS`: raise `version`. `APP_VERSION_NOT_NEWER` is the install-side refusal: a higher version, or the same version with other contents, is already installed.

### The parameters file

`--parameters parameters.json` is a JSON object by parameter key; a parameter you leave out is answered by the admin on the setup page, so `{}` is valid. The value each parameter `type` takes, and where a person finds an id, are in `reference/parameters-file.md`.

## Publishing to the catalog: `publish`, and `withdraw`

`agentflow-app publish [file]` sends the sealed file (found as `deploy` finds it) to the deployment's catalog; `agentflow-app withdraw <prefix>/<slug>@<version> --reason <text>` takes a version you published out of new setups. Everything about them, the outcomes and the `APP_CATALOG_*` refusals, is in `reference/publishing.md`; the key needs `app_catalog.publish`, and `publish` also `integration.admin` (the Admin role has both), and publishing is not installing: each organization's admin installs from Admin → Apps → Install app → From the catalog.

## Testing in a sandbox: `deploy --sandbox`

A sandbox is a disposable organization AgentFlow makes for you: its own people, groups and settings, nothing shared with your real organization, and no admin to approve the install, because the sandbox's owner does. It is deleted when its time to live ends (7 days; `sandbox create --ttl-days` sets 1 to 30). A test acts as the sandbox's people. A real person never signs in to it under their own account.

**`sandbox.json`**, at the project's root and committed, declares those people and the install's answers (every member and rule: `reference/sandbox-json.md`; `agentflow-app sandbox check` validates it offline and needs no key). One role, one group, two people and one parameter:

```json
{
  "roles": [{ "name": "Support", "permissions": ["entity.read", "entity.list", "entity.write"] }],
  "groups": [{ "key": "support", "name": "Support" }],
  "people": [
    { "handle": "admin", "name": "Sandbox Admin", "roles": ["admin"] },
    { "handle": "agent", "name": "Anna Agent", "roles": ["Support"], "groups": ["support"] }
  ],
  "install": { "parameters": { "app_users": "@group:support" }, "decisions": {} }
}
```

- **A person holds only the roles listed**: with none they can do nothing, and `requires.permissions` grants nothing, so give each person a role holding what the manifest asks of their group (the built-in roles' permissions: `reference/sandbox-json.md`).
- **A group needs a person in it**: setup counts only people as members, so an automation group (the one your run-as principal is in) needs a person in it as well as the principal (the example is in `reference/sandbox-json.md`).
- A `handle` and every `key` match `[a-z][a-z0-9_]{0,31}`; an `@group:<key>`, `@principal:<key>` and the like in `install.parameters` becomes that object's id. `--parameters` and `--decisions` are refused with `--sandbox` (`USAGE`): `install` holds them.

**Connecting** needs `AGENTFLOW_URL`, as for `deploy`, and `AGENTFLOW_SANDBOX_KEY`: a service principal's key of your real organization, set the way `read -rs` sets `AGENTFLOW_TOKEN`. The principal's role must hold `sandbox.create`. No built-in role has it, so an admin grants it to a role of their own; a sandbox cannot make a sandbox (`SANDBOX_NESTING_REFUSED`). The deployment's operator also turns sandboxes on, or its routes answer 404.

**The loop**:

1. `agentflow-app sandbox check`.
2. `agentflow-app deploy --sandbox` (`--file <afpkg>` uploads a package sealed elsewhere; `--no-arm` leaves the triggers off). It runs, one line each:
   - refuses a stale `package/` (`PACKAGE_STALE`) and seals it in memory with a key made for this deploy, so you need no sealing key;
   - deletes this folder's previous sandbox, if the state file names one;
   - creates the sandbox from `sandbox.json` and writes the state file;
   - uploads the package and requests the install with the sandbox's deploy key;
   - plans and approves as the owner, with the defaults above added, and prints each warning of the plan (`warning: <code>: …`, such as an agent's read limit a step does not cover; they never stop the install);
   - waits for the install, at most 300 s (`DEPLOY_STALLED`), printing nothing after `installing; this usually takes a minute or two` until `installed`, then arms every trigger and records the installation and its objects by key;
   - a refused plan or approve leaves the sandbox for inspection; any refusal from arming (`APP_ARM_REFUSED`) leaves the app installed and unarmed, and exits 1; Ctrl-C stops the wait (130) and the sandbox stays.
   - **After a change, `deploy --sandbox --upgrade`** installs the new version into the recorded sandbox instead: no delete, no new sandbox, no `secret_env` read, so its records and the organization settings you set there by hand (such as the business calendar) stay. It sends the app's parameters again from the answers recorded when the sandbox was made (a changed `sandbox.json` needs a deploy without `--upgrade`), a changed package needs a raised `version` (else `APP_PACKAGE_VERSION_EXISTS` or `APP_VERSION_NOT_NEWER`), and it refuses `SANDBOX_GONE` when the sandbox expired or was deleted.
3. `agentflow-app sandbox open --as <handle>` signs your browser in as that person. It never prints the link (good once, for 5 minutes) and is `SANDBOX_OPEN_FAILED` where no browser can start. Without a browser a script signs in the way `signInAs` does: `POST <AGENTFLOW_URL>/api/v1/auth/sandbox-session` with `{"token":"<the person's token in .agentflow/sandbox.json>"}` answers `204` and sets the session cookie, which the next calls send (`reference/sandbox-testing.md`). No command prints a cookie today.
4. Run the black-box tests.
5. `agentflow-app sandbox delete`. `sandbox list` shows your live sandboxes, and `sandbox delete --id <id>` deletes another.

**`.agentflow/sandbox.json`** is the state file: the sandbox's id, expiry and the address the CLI called, its deploy key, each person's user id and token, and after a deploy the installation's id, its armed triggers and its objects by key. It holds live secrets. The CLI writes it private, adds `/.agentflow/` to `.gitignore` and refuses to run while git tracks anything there (`SANDBOX_STATE_TRACKED`). Never commit, paste or print it. Do not copy a folder that holds it: `deploy --sandbox` deletes the sandbox the file names, so a deploy from a `cp -R` or `tar` copy deletes the original's live sandbox; leave `.agentflow/` out of copies, or run `sandbox delete` first.

**The test kit**, `@reflexify/agentflow-sdk/testing`, reads that file (where the tests live so `pnpm test` stays offline, and following a run a trigger starts: `reference/sandbox-testing.md`): `readSandbox()` parses it; `as(handle)` is an API client acting as that person; `signInAs(page, handle)` signs a Playwright page in; `idsByKey()` gives the installed objects' ids by key (`idsByKey<LogicalKey>()`, with `LogicalKey` from `src/generated/app.ts`, types the keys; a test cannot use `getAppObjects`, which answers only an installed app's own code); `waitForRun(client, runId)` polls a run you started until it settles (a failed run carries `error_code` and `error_meaning`, and `withheld` names what an installed app's run hides: `reference/sandbox-testing.md`, "When a run fails"). `waitForTask(client, stepKey, recordId)` waits for the task a run (a trigger's included) opens at a step on a record, and `completeTask(client, task, action)` claims it when nobody holds it and submits the action. Assert only over what the test created and over structure (a status, a field, a count), never a model's wording.

**CI**, on each release tag and nightly: `deploy --sandbox` with `AGENTFLOW_SANDBOX_KEY` and each `secret_env` variable as repository secrets; then the tests; then `agentflow-app sandbox delete`, always, even after a failure. Send test mail only to Resend's test recipients (`delivered@resend.dev`), never to a real person. Give a sandbox its own Resend account: one already connected elsewhere is `SANDBOX_CONNECTION_SHARED`, and a sender on an unverified domain is `EMAIL_FROM_DOMAIN_UNVERIFIED`. The guide page is `<AGENTFLOW_URL>/guides/en/xay-dung-ung-dung/thu-trong-sandbox`.

**Not testable in a sandbox yet:** inbound email (nothing can inject it), a scripted model's exact branches (a sandbox's agents call real models), a workflow a schedule starts (a test cannot fire the schedule), and Resend's delivery events on a local stack. List them in the app's README as known gaps.

## `--json` and exit codes

Every command takes `--json` and then prints exactly one JSON value on stdout:

| Command | Result |
|---|---|
| `init` | `{"dir":"/abs/my-app","id":"acme/my-app"}` |
| `build` | `{"files":12,"ui":"none"}` (plus `"warnings":[…]` when a launcher icon is not one of AgentFlow's names; the build still succeeds) |
| `build --check` | `{"stale":[],"missing":[],"extra":[]}` |
| `keygen` | `{"file":"…","key_id":"acme-2026"}` |
| `seal` | `{"file":"…","package_id":"acme/my-app","version":"0.1.0","digest":"…","signer":"acme-2026","unchanged":false}` |
| `types`, `types --check` | `{"file":"src/generated/app.ts","changed":true}` (`changed` is `false` when the file already matched, and for `--check`) |
| `lint` | AgentFlow's answer: `{"platform_version":"2026.10","problems":[…]}` |
| `deploy` | `{"package":{"package_id":"acme/my-app","version":"0.1.0","digest":"…","signer":"acme-2026","uploaded":true},"deployment":{"deployment_id":"…","status":"awaiting_approval","kind":"install","approve_url":"…"}}`, plus `"previous":{"deployment_id":"…","problem":{…}}` when the newest deployment of this version had failed |
| `status` | `{"package_id":"acme/my-app","version":"0.1.0","deployments":[{"deployment_id":"…","version":"0.1.0","status":"failed","problem":{"type":"APP_SETUP_INCOMPLETE","detail":"…"},"approve_url":"…","installation_id":null,"created_at":"…"}],"sandbox":{"id":"…","state":"live","expires_at":"…"}}` (`sandbox` is `null` without `.agentflow/sandbox.json`, which is also what `sandbox delete` leaves, since it removes the file; `state` is `live`, `gone` (expired, or deleted from another folder), `elsewhere` or `unknown`) |
| `publish`, `withdraw` | AgentFlow's answer: `{"submission":{"id":"…","status":"approved","gate_result":"skipped","review_policy":"auto"},"entry":{"id":"…","package_id":"acme/my-app","version":"0.1.0","state":"published"}}` (`entry` is `null` while in review or rejected); `{"entry":{…,"state":"withdrawn"}}` |
| `deploy --sandbox` | `{"sandbox":{"id":"…","name":"…","expires_at":"…"},"package":{…},"deployment":{…},"installation":{"id":"…","armed":[…],"objects":{…}},"plan_warnings":["warning: …"]}` |
| a refusal | `{"error":{"code":"PACKAGE_STALE","message":"…","files":["package/objects/entity/case.json"]}}` |

Exit codes: `0` done, `1` refused (and `lint` with problems, `status` when the newest deployment failed, `publish` rejected or a withdrawn version resubmitted, `deploy --wait` failed, cancelled or not approvable, `deploy --sandbox` stalled, not armed or its sandbox gone), `2` usage error, `130` when you stop `deploy --wait` or `deploy --sandbox`. Without `--json`, a refusal prints `<CODE>: <message>` on stderr.

## Every refusal

- `reference/refusals.md` has every code the CLI prints and every refusal AgentFlow sends back to `lint` and `deploy`, with what to do.
- `reference/lint-problems.md` has every problem `lint` reports (`bare_key`, `run_as_not_initiator` and the rest), with the fix.
