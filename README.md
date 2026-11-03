# TeraBox · Hiệu quả đơn hàng (P&L)

`inno/pl` is an AgentFlow app, built with the AgentFlow SDK: Sales enter a sales order, the app computes its P&L (revenue, cost, sales and financial costs, provisions, net profit against the contract type's threshold), routes the 15 approval and fulfilment tasks between departments with SLAs and AI assistance, and tracks KPIs. The design is `docs/superpowers/specs/2026-11-02-pl-agentflow-design.md`; the build plans are in `docs/superpowers/plans/`. Until plan 02 replaces it, the starter's case desk (the `case` entity, "Open a case", the Cases screen) is still in the package. It holds:

- **An app package** that AgentFlow installs, described by `config/`. `agentflow-app build` turns `config/` into `package/`, which is committed, so a reviewer reads what ships.
  It holds the `case` entity, its create form, a view, its access, a rule and a stage model (`config/entities/case.json`), and the workflow "Open a case" (`config/build/open-case.mjs`).
- **A UI module** that ships inside the package, and that AgentFlow opens in its own pages, at `/apps/<installation key>/`.
  It is the Cases screen (`src/module/`): a list of cases with a "New case" dialog, on the AgentFlow UI kit.

## Commands

These commands run in the project's folder, after `pnpm install`:

| Command | What it does |
|---|---|
| `pnpm build` | Writes `package/` from `config/`. |
| `pnpm check` | Checks that the committed `package/` is what `config/` builds, and changes nothing. |
| `pnpm test` | The Vitest tests, if the project has any, then `pnpm check`. |
| `pnpm exec agentflow-app keygen --key-id <id>` | Once per publisher: writes the signing key `keys/<id>.pem` and prints where it is and its key id. Never commit `keys/`. |
| `pnpm seal` | Signs `package/` with the ed25519 key in `keys/` into `dist-app/inno-pl-<version>.afpkg`. Raise `version` in `config/package-manifest.json` for every release. |
| `pnpm exec agentflow-app lint` | Sends `package/` to the AgentFlow at `AGENTFLOW_URL` and prints the problems it finds; it stores nothing. |
| `pnpm exec agentflow-app deploy --wait` | Uploads the sealed package and asks for it to be installed; an admin approves it at the link it prints. |

`pnpm build` also puts the module into `package/ui/` (git ignores that folder), and `pnpm test` ends with `agentflow-app types --check`, which fails when `src/generated/app.ts` is behind `package/`.

`pnpm demo` serves the Cases screen on in-memory sample data at `http://localhost:5174/module.html`: nothing is sent anywhere, and `?empty` shows no cases, `?fail` a refused create.

`node_modules/@reflexify/agentflow-app-builder/README.md` documents `config/`. [Install the package](#install-the-package) puts it in an organization.

## The module

The module's files, in `src/module/`:

- `module.tsx` is the entry: `mount(root, host)`, which AgentFlow imports and calls;
- `mount.tsx` puts the stylesheet in the shadow root and renders the screen, following the host's language and theme;
- `CasesScreen.tsx` and `NewCaseDialog.tsx` are the screen and its dialog;
- `cases-api.ts` is what the screen needs from AgentFlow, `http-cases-api.ts` does it over the published record operations, and `memory-cases-api.ts` is the fake the demo and the tests use;
- `kit.tsx` wraps the kit's elements for React, and `icons.tsx` holds the icons;
- `text.ts` holds the English and Vietnamese text, and `styles.css` the module's one stylesheet;
- `demo.tsx` mounts the module on the fake, for `module.html`.

## Install the package

1. **Seal it.** In this folder:
   ```bash
   pnpm build && pnpm exec agentflow-app keygen --key-id dev-inno && pnpm seal
   ```
   - `pnpm build` writes `package/` from `config/`.
   - With the module, it also writes the module into `package/ui/`: it builds it with Vite or, when `ui` in `agentflow.app.mjs` names a `prebuilt` folder, copies that folder as it is.
   - `keygen` writes the signing key `keys/dev-inno.pem`, readable only by you, and prints where it is. It never overwrites a key, so leave it out when you seal again. Git ignores `keys/`: never commit it.
   - `pnpm seal` signs `package/` with the one ed25519 key in `keys/`, into `dist-app/inno-pl-<version>.afpkg`. Sealing the same package again changes nothing. A changed package under the same version is refused: raise `version` in `config/package-manifest.json`.
2. **Connect to AgentFlow.** Ask an admin of your organization for a service principal key (`afk_…`), made under **Admin → Service principals** for a principal whose role holds `integration.admin`. Then, in this shell:
   ```bash
   export AGENTFLOW_URL=https://agentflow.example.com
   read -rs AGENTFLOW_TOKEN && export AGENTFLOW_TOKEN
   ```
   `AGENTFLOW_URL` is the address you open AgentFlow at. `read -rs` takes the key without showing it or keeping it in your shell history. Never write the key into a file.
3. **Check it.** `pnpm exec agentflow-app lint` sends `package/` to AgentFlow, which runs its own checks and stores nothing. It prints each problem as `<code>  <object>  <path>: <message>`, or `no problems`.
4. **Deploy it.**
   ```bash
   pnpm exec agentflow-app deploy --parameters parameters.json --wait
   ```
   - It uploads `dist-app/inno-pl-<version>.afpkg`, asks for it to be installed, and prints `awaiting approval: <link>`. An admin opens the link, which leads to the app's setup page, completes the setup (any setting `parameters.json` left out), reviews what the app asks for, and presses **Approve and activate** (or approves it and activates it later). `--wait` waits until it is installed; Ctrl-C stops the waiting, not the deployment.
   - `parameters.json` holds the setup answers: `{ "app_users": "<the group's id>" }`, the group of the app's users. Leave `--parameters` out to fill everything in on the setup page.

Installing asks for nine groups (`group_ref` parameters, all required): `app_users` ("Người dùng PL", everyone who uses the app, the audience), one group per role — `am_group` (AM · Nhân viên Sale), `sa_group` (Sales Admin), `tm_group` (Technical Manager), `sd_group` (Sales Director), `proc_group` (Mua hàng), `acc_group` (Kế toán bán hàng), `admin_group` (Quản trị viên PL) — and `automation_group` ("Tự động hóa PL"), which holds the service principal the automatic workflows run as and nothing else. Each must be a different group (a group may not receive two sets of grants on the same entity); people may be in several, and everyone in a role group must also be in `app_users`.

A role does not come from a group, so give the members of every group except `automation_group` a role with `entity.read`, `entity.list` and `entity.write`; give the service principal the same. The case desk part of the package has no trigger, so there is nothing to turn on after the install yet.

