# TeraBox · Hiệu quả đơn hàng

`inno/pl` is an AgentFlow app, built with the AgentFlow SDK. It is being rebuilt from scratch on a new specification
(`docs/superpowers/specs/2026-11-04-pl-v2-design.md`), phase by phase (`docs/superpowers/plans/2026-11-04-pl-v2-roadmap.md`).
Phase 1 (the thin slice: an order goes through t11 → t22 ∥ t23 → t31 with tasks in My Work) and Phase 2 (the full order
form with format checks, customer and supplier address books, who sees which order and which figures) are in. It holds:

- **An app package** that AgentFlow installs, described by `config/`. `agentflow-app build` turns `config/` into
  `package/`, which is committed, so a reviewer reads what ships.
- **A UI module** that ships inside the package, and that AgentFlow opens in its own pages, at
  `/apps/<installation key>/` (`src/module/`, on the AgentFlow UI kit).

## Commands

These commands run in the project's folder, after `pnpm install`:

| Command | What it does |
|---|---|
| `pnpm build` | Bundles the Code steps' TypeScript into `config/code/` (`pnpm build:code`), then writes `package/` from `config/` and the module into `package/ui/`. |
| `pnpm check` | Checks that the committed `package/` is what `config/` builds, and changes nothing. |
| `pnpm test` | All the Vitest tests, then `pnpm check` and `agentflow-app types --check`. |
| `pnpm vitest run <files>` | Only the given tests: what a phase runs (see "Testing" in `AGENTS.md`). |
| `pnpm test:sandbox [e2e/<file>]` | The sandbox tests, all or the files named, against the sandbox `pnpm af deploy --sandbox` made. |
| `pnpm demo` | The module in a browser at `http://localhost:5174/module.html`. |
| `pnpm exec agentflow-app keygen --key-id <id>` | Once per publisher: writes the signing key `keys/<id>.pem`. Never commit `keys/`. |
| `pnpm seal` | Signs `package/` into `dist-app/inno-pl-<version>.afpkg`. Raise `version` in `config/package-manifest.json` for every release. |
| `pnpm lint` | Sends `package/` to the AgentFlow at `AGENTFLOW_URL` and prints the problems it finds; it stores nothing. |
| `pnpm deploy:app` | Uploads the sealed package and asks for it to be installed; an admin approves it at the link it prints. |

`AGENTFLOW_URL`, `AGENTFLOW_TOKEN` and `AGENTFLOW_SANDBOX_KEY` live in `.env` (git ignores it; `.env.example` is the
template). `node_modules/@reflexify/agentflow-app-builder/README.md` documents `config/`.

## Install the package

1. `pnpm build && pnpm exec agentflow-app keygen --key-id dev-inno && pnpm seal` (leave `keygen` out once the key exists).
2. `pnpm lint`, then `pnpm deploy:app`. An admin opens the link it prints, completes the setup and approves it.

Installing asks for one group for each role, `app_users` ("Người dùng ứng dụng", everyone who uses the app) and
`nhom_sales` (AM and Inside Sale), `nhom_tm`, `nhom_proc`, `nhom_sd`, `nhom_acc`, `nhom_admin`, each holding the people
who do that job (a job with one holder is a group with one member: when the person changes, change the member), and an
automation pair: `tu_dong_principal` (a service principal) and `nhom_tu_dong` (the group holding it and one account that
never signs in). Give every person a role with `entity.read`, `entity.list` and `entity.write`: a role does not come from a group.
The package has one workflow, `dieu_phoi` ("Điều phối quy trình đơn hàng"), started by a trigger on a task's status. **A
trigger ships off: an admin turns it on after installing**, or no task ever opens after the first.
