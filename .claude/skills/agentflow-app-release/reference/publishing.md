# Publishing to the catalog

```bash
pnpm exec agentflow-app publish            # or: publish dist-app/acme-desk-1.2.0.afpkg, or --file <path>
pnpm exec agentflow-app withdraw acme/desk@1.2.0 --reason "a broken migration"
```

The catalog is the deployment's own: any organization on it publishes a version under a prefix it holds, and an admin
of every organization on the deployment browses the published versions at Admin → Apps → App catalog and installs one
through the same setup page an upload opens. There is no shared registry outside the deployment.

## What `publish` does

- It reads the same two variables as `deploy`. The key needs `app_catalog.publish` **and** `integration.admin` for
  `publish` (the Admin role has both) and `app_catalog.publish` alone for `withdraw`. A key without one is
  `FORBIDDEN`. A sandbox cannot publish (`APP_CATALOG_SANDBOX_REFUSED`).
- It finds the sealed file as `deploy` does (`dist-app/<prefix>-<key>-<version>.afpkg`, a path argument or `--file`)
  and sends it. AgentFlow runs what `deploy`'s upload runs: that the archive is intact and sealed, the platform
  version, and **every lint rule**, so a package with lint problems is refused as it would be on upload, and nothing is
  published. Run `agentflow-app lint` first. Publishing does not need a deploy first: it takes the sealed file, and no
  installation of yours has to exist.
- It prints `published <id> <version>`, or `in review <id> <version>`, or `rejected <id> <version>` (exit `1`).
  Resubmitting the identical bytes of a withdrawn version prints `withdrawn <id> <version>` (or `revoked <id> <version>`
  for a version the operator revoked) and a hint to publish a new version (exit `1`). Resubmitting the identical bytes of a published version prints `published` again and changes
  nothing, so a CI retry is safe.
- **Publishing also uploads the package to your organization**, as `deploy`'s upload does (a published version is
  your organization's own upload). A `deploy` of the same file afterwards prints `already uploaded`
  (`"uploaded": false` in `--json`), which is right, not a sign that `publish` failed.

## Reading a version's state

The CLI has no command that lists or shows catalog entries. Two ways to read one version's state, `published` or
`withdrawn`:

- Run `publish --json` again on the same sealed file. Identical bytes change nothing and answer with the entry as it
  stands now: `entry.state` is `published` (exit `0`) or `withdrawn` (exit `1`, the text says so). The submission's
  `id` is in the same answer. It runs the upload's checks again, so a file that no longer passes lint is refused instead.
- `GET /app-catalog/submissions/{submission_id}` answers `{ "submission", "entry" }` with the entry's current `state`,
  for a key holding `app_catalog.publish`; the `id` comes from `publish --json`. The SDK's typed client has the route:

```ts
import { bearerAdapter, createAgentFlowClient, ok } from '@reflexify/agentflow-sdk';

const client = createAgentFlowClient({ baseUrl: `${process.env.AGENTFLOW_URL}/api/v1`, auth: bearerAdapter(async () => key) });
const { entry } = await ok(client.GET('/app-catalog/submissions/{submission_id}', { params: { path: { submission_id } } }));
console.log(entry?.state); // 'published' or 'withdrawn'
```

An admin sees only the published versions, at Admin → Apps → App catalog.

## Review: nobody decides, today

Every submission records a review policy, and today it is always `auto` (`review_policy` in the `--json` answer): the
gate that would check a package further is skipped (`gate_result: "skipped"`), and the review approves at once, inside
the request. So `publish` ends `published` on the same call; there is no person who reviews it, and no step to wait for.
`in review` and `rejected` are in the answer's vocabulary for a later gate or a manual review, which this deployment
does not run: if you see one, ask the AgentFlow team.

## What the catalog shows

Everything it shows comes from the package's manifest, so it is written in `config/package-manifest.json`:

- on a card: `name`, `summary`, the publisher's `name`, the version and its date, and a **Verified** badge that the
  deployment's operator gives to one organization, not something you can set;
- on the package's page: the `changelog`, `license`, `dataHandling`, what the package `requires` (the permissions it
  asks of its groups and the packages it depends on), the publisher's contact, the parameters it asks the admin
  for, the access it asks, what it creates, and the published versions, newest first.

The manifest has no icon, screenshot, category or README link for the catalog, so there is nowhere to put one.
The changelog, summary and contact are shown to other organizations as plain text, never as Markdown or HTML: write
them for that. So write a `summary` that says what the app is for, and a `changelog` for each release.

## The prefix, versions and withdrawing

- The first publish under a prefix claims it for your organization; a prefix another organization holds is
  `APP_CATALOG_PREFIX_HELD`. Nothing in the API or the CLI gives a prefix back or moves it to another organization,
  and withdrawing every version leaves it held. Choose the prefix you will keep. `af`, `agentflow`, `rfx` and
  `reflexify` are reserved: only the organization the operator names may claim them (`APP_CATALOG_PREFIX_RESERVED`).
- Versions only go up: one at or below the catalog's newest is `APP_CATALOG_BACKPORT_REFUSED`, and the same version
  already there with other contents is refused by the upload `publish` makes first, with `APP_PACKAGE_VERSION_EXISTS`
  (your organization already holds that version). Raise `version`, build, seal, publish.
- A published version cannot be replaced, and a withdrawn one cannot come back: sending the same bytes again answers
  `withdrawn <id> <version>` and exits `1`. Publish a new version. **Test the exact file first**: install it in a sandbox (`deploy --sandbox --file <afpkg>`), then
  publish that same file.
- `withdraw` needs `--reason`, and only the organization that holds the prefix may withdraw
  (`APP_CATALOG_NOT_PUBLISHER`). Installations keep running; the catalog no longer lists that version, on a card or in
  a detail page's version list, so new setups cannot choose it. That is about other organizations' setups and the
  catalog: your own organization can still `deploy` the withdrawn version's file, because an install admits an
  organization's own upload (and a release it already holds) whatever its catalog state, and a withdrawn version that
  is installed stays installed, where it is, until an admin changes it.
- Publishing is not installing. An admin of each organization installs from Admin → Apps → Install app → From the catalog, and a setup opened
  on a version that is withdrawn meanwhile asks the admin to switch to the latest published one
  (`APP_CATALOG_VERSION_WITHDRAWN`, which an install or activation raises, never `publish`).
- Each refusal and what to do is in `refusals.md`.
