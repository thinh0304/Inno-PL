# After `deploy`: reading a deployment, and which checks are yours

`deploy` ends at `awaiting approval`, and the admin does the rest. This page is for the time after: what became of
the deployment, and which checks of the installed app a key can make.

## Reading a deployment's state

`pnpm exec agentflow-app status` reads it, and changes nothing. It reads the package id and version from
`package/manifest.json` and prints this package's newest deployments (up to 10), newest first:

```
acme/my-app (package/ is 0.1.1)
2026-10-24T09:12:00Z  0.1.1  awaiting approval  approve: https://…/admin/apps/deployments/…
2026-10-23T16:40:00Z  0.1.0  failed: APP_SETUP_INCOMPLETE — the install run … failed: …  setup page: https://…/admin/apps/deployments/…
2026-10-22T11:05:00Z  0.1.0  installed (installation 3c2f…)
sandbox …: live, expires 2026-10-30T16:00:00Z
```

- It uses `AGENTFLOW_URL` and `AGENTFLOW_TOKEN` as `deploy` does, and the key needs `integration.admin`; a key
  without it is refused with AgentFlow's code (`FORBIDDEN`) and the line about checking `AGENTFLOW_TOKEN`.
- It exits `1` when the newest deployment failed, `0` otherwise, including when there is none yet
  (`no deployments of <id>`).
- The status is `awaiting approval`, `installing`, `installed`, `failed` or `cancelled`. A failed one shows its
  problem: `type` is the code the install run was recorded with (`APP_RELEASE_UNAVAILABLE`, `APP_SETUP_INCOMPLETE`,
  `APP_ARM_REFUSED`, `APP_INSTALLATION_EXISTS`, `APP_PLAN_CHANGED`, `APP_PRECONDITION_CHANGED`,
  `APP_CATALOG_VERSION_WITHDRAWN`, a refusal's own code, or `INTERNAL_ERROR`), and `detail` reads
  `the install run <run id> failed: <reason>`. Look the `type` up in `refusals.md`.
- Until an admin chooses **Approve and activate**, an `awaiting approval` deployment changes nothing: the version
  installed before keeps running, and a run started meanwhile uses it. A run's `workflow_version_number` says which
  version it ran (`sandbox-testing.md`, "When a run fails").
- A deployment waiting for approval whose setup a person has planned, on the setup page or through the API, and
  whose plan found what stops the approval, shows each finding on its own line under it:

  ```
  2026-10-24T09:12:00Z  0.1.1  awaiting approval  approve: https://…/admin/apps/deployments/…
    when a person last planned its setup, this stopped its approval (some findings depend on what that person may grant):
      APP_STEP_FAILED on entity:leave_request at VALIDATION_ERROR: create form must bind every required field: employee; …
  ```

  The pointer and the message are the ones the setup page shows (`refusals.md`, `APP_STEP_FAILED`). Nothing shows
  before a person has planned it, since a key cannot plan; `deploy --wait` prints the same lines while it waits.
- An `installed` deployment shows its installation id and no link (its approval page is long past); a deployment
  waiting for approval shows `approve:` and its link, and a failed, cancelled or installing one `setup page:`.
  A sandbox's own deployment is not in the list: the sandbox is its own deployment, which this key cannot see.
- The last line is the sandbox. With `.agentflow/sandbox.json` it shows the sandbox, with the expiry the file records:
  `live` while its deploy key still works; `gone` when the key is refused, which means it expired or was deleted from
  another folder or with `sandbox delete --id` (this folder's file stays, stale; `deploy --sandbox` makes a new one);
  `elsewhere` when the file names another deployment than `AGENTFLOW_URL`, which is not checked; `unknown` when the
  check got neither answer (unreachable, or another refusal). `agentflow-app sandbox delete` for this folder's sandbox
  removes the file, so afterwards `status` says `no sandbox here` (`--json`: `"sandbox": null`), not `gone`.
- `--json` gives `{ package_id, version, deployments: [{ deployment_id, version, status, problem, approve_url,
  installation_id, created_at, plan_findings? }], sandbox }`, where `plan_findings`, present only while a deployment
  waits and its last plan found something, is AgentFlow's `[{ code, package_id, logical_key, pointer, message }]`.
  The admin's setup page is each `approve_url`.

## `deploy` after a failure makes a new deployment

After a deployment is `failed` or `cancelled`, `deploy` is not a status check: it requests the install again, which
makes a new deployment that awaits approval again, and an admin can approve it before anyone has fixed the cause. So:

1. Read the deployment's state with `agentflow-app status` (above), and the admin's report if they approved it.
2. If it is `failed`, look its `type` up in `refusals.md` and fix the cause first. The plan findings
   (`APP_STEP_FAILED`, `APP_DEPENDS_ON_FAILED`) are never a deployment's `type`: they block approval, show on the
   setup page, and show under a waiting deployment in `status` once a person has planned it.
3. Only then `deploy` again. It prints `the last deployment of <id> <version> failed: <code> — <detail>; this is a new
   one` before the new link, so the admin knows the earlier one is not the one to approve. A release that is already
   `installed` answers `installed` and changes nothing.

## Which checks after the install are yours

- **Acting as a person is not yours.** A key is a service principal, with no user identity. Claiming work, listing
  `GET /work`, releasing, and submitting a step all answer `USER_IDENTITY_REQUIRED` to a key, so a key cannot start a
  record as a staff member, claim its task as a manager, or decide it. In the real organization that check is the
  admin's, or a person's with their own sign-in: ask them to start one record, decide its task, and say what the
  record shows. The place to test the flow itself, as people, is a sandbox (`sandbox-testing.md`: `as(handle)`).
- **A key can create records**, with `POST /entities/{entity_id}/records`. That tests that a trigger starts a run,
  and nothing about who sees what: such a record has no creator, so a `creator` default stays empty (`entities.md` in
  the authoring skill, `default`).
- **A key cannot tell whether a trigger is on.** The trigger ships off and an admin turns it on (`admin-message.md`).
  No published route reports it: arming and an installation's object listing are person-only
  (`USER_IDENTITY_REQUIRED`), and the listing's `state` is `live`, `deprecated` or `off` for an optional feature, not
  whether a trigger is armed. `GET /instances` shows only the runs that already started, so "no run yet" is the same
  whether the trigger is off or the record came too soon.
- **A trigger starts runs only for changes made after it is on.** The dispatcher applies the trigger's activation
  time and settles an earlier event as matching nothing: for a `created` trigger, a record made before the admin
  turned it on is never picked up later; for an `updated` trigger, an older record that changes after that does start
  a run. Ask the admin to tell you when it is on, make the first records after that, and look in
  `GET /instances` for the runs they start.
- **An offered skill is checked in the browser.** To check a skill the manifest lists in `assistant.skills`,
  sign in as a person in the audience (`sandbox open --as <handle>`), open the assistant and ask the skill's
  question. The skill is also listed on the organization's default agent (Admin, then Agents). Nothing checks it
  offline, and the test kit has no helper for the assistant.
