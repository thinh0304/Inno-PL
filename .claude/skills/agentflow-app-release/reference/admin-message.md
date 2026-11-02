# The message to your org admin

Send it once, before the first `deploy`, and again with the link when `deploy` prints `awaiting approval:`. Fill in the
angle brackets from your `config/package-manifest.json` (`parameters`, `changelog`) and from what `seal` printed.
Leave out the paragraph for the keys when your organization already has them.

```
Subject: <app name> <version>: please approve its install

Hi <name>,

I am about to deploy <package id> <version> (<one line of what the app is for>) to <organization>. You approve the
install; nothing installs until you do. The page for it is <AGENTFLOW_URL>/guides/en/quan-tri/cai-dat-ung-dung.

1. Keys (only if we have none yet): a service principal whose role holds integration.admin (the Admin role does) and a key for our CI
   deploys, and a second key that can only lint, for pull requests.

2. Setup answers. On the setup page the form asks for these; the ones I know are filled in already.
   - <parameter label> (<parameter key>): <what to choose>. Its members need a role with <permissions>.
   - <the run-as service principal parameter>: give its role <permissions>, put it in <automation group label>, and
     issue it no key.
   - <automation group label>: only the service principal and one dedicated account that never signs in.
   - <two group parameters that carry grants on the same entity> must be different groups (people may be in both).
   - Names: the app creates the workflows <workflow names> and the agents <agent names>. An organization holds one
     workflow and one agent per name, whatever the case and even archived ones. If one of those names is taken, the
     setup page lists "APP_STEP_FAILED ... DUPLICATE" and cannot be approved: rename the old one if it is live; if it is archived, tell me and I will rename mine.
   - <If the manifest requires `user`:> The setup page lists a row "Entity user". It is the built-in Users entity,
     already chosen: leave it as it is.

3. After you approve, turn on the app's triggers: Admin -> Apps, the app's receipt, "Turn on triggers"
   (<the trigger keys, from config/build/>). They install off, and the app's workflows do nothing until they are on.
   A trigger only reacts to changes made after it is on (for a created-record trigger, records created after it), so please turn
   them on before anyone creates a record, and tell me when you have: I cannot see from my side whether they are on.
   <Also: share the dashboards <names> with <audience group label>.>

4. The release: <package id>, version <version>, digest <digest from `seal`>, signed by <signer>.

5. The check after the install, which is yours (my key is not a person and cannot do it): as a <role of the people
   who start it>, start one <record>; as a <role of the deciders>, decide its task; and tell me what the record shows.

The link: <approve link>. If it does not open for you, use <your AgentFlow address>/admin/apps/deployments/<deployment id>.
```

## Why each part is there

- **The triggers.** A trigger always ships off (`lint`'s `trigger_enabled`). `deploy --sandbox` arms every trigger
  itself, so a sandbox test that is green says nothing about this step: on a real install nothing starts until an admin
  turns them on. Say it every time, and again for a trigger an upgrade adds (an upgrade never changes what is armed).
- **The names.** A plan that finds a workflow or agent name already taken fails with `APP_STEP_FAILED` and
  `DUPLICATE` and cannot be approved; the setup page shows the package's object key and not the name that clashes,
  and neither a sandbox (it starts empty) nor `lint` can know the organization's names (`refusals.md`). Fill the
  names in from the `name` of each workflow and agent in `config/`, so the admin can look before approving.
- **The `Entity user` row.** A package that references the built-in Users entity requires `user`, and setup lists
  it as a row with an optional picker. The admin need not choose anything (`manifest.md` in the authoring
  skill); say so, because a row named after an entity the admin never made reads as a question.
- **The first records.** A trigger starts runs only for changes made after it is on (a `created` trigger, records made after it), and a key cannot read whether
  it is on (`after-deploy.md`). Asking the admin to say when they turned it on, and making your first records after
  that, is the only way to tell a trigger that is off from one that is slow.
- **The check after the install.** Starting a record as a person and deciding its task need a person's sign-in; a
  key is refused with `USER_IDENTITY_REQUIRED` (`after-deploy.md`). So the check in the real organization is the
  admin's, or someone's they name. The team tests the flow itself, as people, in a sandbox.
- **The parameters.** What each one is for is in its `help`; say it again here, because the admin may read your message
  and not the setup page first. The role a group's members need is not derived from the group (`manifest.md` in the
  authoring skill).
- **The release.** The admin reads the package id, version and digest on the setup page and can compare them with
  yours. The digest is what `seal` printed (and `deploy --json` prints in `package.digest`).

## When the link does not open

The link's origin may differ from your `AGENTFLOW_URL`. The API builds it from its own `HTTP_FRONTEND_BASE` setting
(`<HTTP_FRONTEND_BASE>/admin/apps/deployments/<id>`), which defaults to `http://localhost:4000`; the setup page's
link is built from the same setting. A deployment whose operator never set it prints a link that opens only on the
operator's own machine.

- Send the admin the path, `/admin/apps/deployments/<deployment id>`, and tell them to open it at the address they
  use for AgentFlow. The deployment id is in the printed link, and in `deploy --json` as `deployment.deployment_id`.
  That page forwards a person holding `integration.admin` to the app's setup page.
- Tell the deployment's operator, because every later link is wrong the same way: they set `HTTP_FRONTEND_BASE` for the
  API to the address people open AgentFlow at, and restart it. A key cannot change it.
