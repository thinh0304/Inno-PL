# TeraBox · Hiệu quả đơn hàng (P&L)

`inno/pl` is an AgentFlow app, built with the AgentFlow SDK: Sales enter a sales order, the app computes its P&L (revenue, cost, sales and financial costs, provisions, net profit against the contract type's threshold), routes the 15 approval and fulfilment tasks between departments with SLAs and AI assistance, and tracks KPIs. The design is `docs/superpowers/specs/2026-11-02-pl-agentflow-design.md`; the build plans are in `docs/superpowers/plans/`. It holds:

- **An app package** that AgentFlow installs, described by `config/`. `agentflow-app build` turns `config/` into `package/`, which is committed, so a reviewer reads what ships.
- **A UI module** that ships inside the package, and that AgentFlow opens in its own pages, at `/apps/<installation key>/`.
  It is the order screens (`src/module/`), on the AgentFlow UI kit.

## Commands

These commands run in the project's folder, after `pnpm install`:

| Command | What it does |
|---|---|
| `pnpm build` | Bundles the P&L engine into `config/code/compute_pl.js` (`pnpm build:code`), then writes `package/` from `config/`. |
| `pnpm check` | Checks that the committed `package/` is what `config/` builds, and changes nothing. |
| `pnpm test` | The Vitest tests, if the project has any, then `pnpm check`. |
| `pnpm exec agentflow-app keygen --key-id <id>` | Once per publisher: writes the signing key `keys/<id>.pem` and prints where it is and its key id. Never commit `keys/`. |
| `pnpm seal` | Signs `package/` with the ed25519 key in `keys/` into `dist-app/inno-pl-<version>.afpkg`. Raise `version` in `config/package-manifest.json` for every release. |
| `pnpm exec agentflow-app lint` | Sends `package/` to the AgentFlow at `AGENTFLOW_URL` and prints the problems it finds; it stores nothing. |
| `pnpm exec agentflow-app deploy --wait` | Uploads the sealed package and asks for it to be installed; an admin approves it at the link it prints. |

`pnpm build` also puts the module into `package/ui/` (git ignores that folder), and `pnpm test` ends with `agentflow-app types --check`, which fails when `src/generated/app.ts` is behind `package/`.

`pnpm demo` serves the order screens on in-memory sample data at `http://localhost:5174/module.html`: nothing is sent anywhere.

`node_modules/@reflexify/agentflow-app-builder/README.md` documents `config/`. [Install the package](#install-the-package) puts it in an organization.

## The P&L engine and the configuration

- `src/pl/` is the P&L engine, plain TypeScript with no React and no I/O: `types.ts` (configuration and order input), `defaults.ts` (the default configuration, Đặc tả 4.1–4.3), `line.ts` (one line's revenue, cost and VAT), `compute.ts` (`computePl()`: the order's P&L, threshold, verdict and provision fund draw), `kpi.ts` (the sales KPI split by deal stage), `config-records.ts` (the configuration entities' records into `PlConfig`) and `code-entry.ts` (what the Code step runs). `test/pl/` tests it; `golden-tm1040.test.ts` checks order TM-1040 against `docs/source/TM-1040.xlsx` cell by cell.
- `scripts/build-code.mjs` bundles `src/pl/code-entry.ts` with esbuild into `config/code/compute_pl.js`, the source of the `compute_pl` Code step. The file is generated and committed: never edit it by hand; `test/pl/code-bundle.test.ts` fails when it is behind the source.
- The configuration entities, which the admin edits and the install seeds with the defaults: `item_type`, `contract_type_rate`, `fin_cost_tier`, `vat_rate`, `pl_setting`, `task_sla`, `deal_stage_weight`, `business_plan` (seeded) and `kpi_target` (not seeded). `test/pl/config-records.test.ts` keeps their seeds equal to `src/pl/defaults.ts`.
- The shared records: `customer`, `supplier` and `staff` (`config/entities/`).
- The workflow "Tự kiểm bộ tính P&L" (`pl_selftest`, `config/build/pl-selftest.mjs`) runs the Code step on TM-1040 with the default configuration; an admin starts it to check a deployment's Code runner (it should end with net profit 46,272,444.44 and passed).

## Orders

- `src/order/` is the order library, pure TypeScript: `types.ts` (`OrderDraft`, the shape the screens edit), `records.ts` (records → `OrderDraft` → the engine's input), `formats.ts` (field formats and normalisation, Đặc tả 4.8), `validate.ts` (`validateOrder`: required fields and cross-field rules before saving a draft, sending for approval, or the customer contract step), `pl-records.ts` and `code-entry.ts` (the P&L result → the three P&L records and the order's TM-/DV- code). `test/order/` tests it.
- The order entities (`config/entities/`): `order` and `order_line` (no money), `goods_line_price` and `service_line_price` (a line's prices, by purchase group), `order_finance`, `purchase_proposal` (PROC's proposals), and `order_pl`, `order_pl_service`, `order_pl_goods` (the P&L, written by the workflow only). Who reads what follows the design's §7.2: TM reads service money only, PROC goods money only, an AM or SA the orders that name them.
- The workflow "Tính P&L đơn hàng" (`compute_pl`, `config/build/compute-pl.mjs`) reads an order's records and the configuration, runs `config/code/compute_order_pl.js` (generated by `scripts/build-code.mjs` from `src/order/code-entry.ts`), and writes the three P&L records and the order's code. It runs as the automation principal; its trigger `compute_pl_on_request` starts it when an order's `pl_requested_at` changes, which the screens set after each save. `request_pl_on_proposal` / `request_pl_on_proposal_update` (`config/build/request-pl.mjs`) set it when Purchasing records or changes a proposal.
- `e2e/` holds the sandbox tests (`pnpm test:sandbox`): TM-1040 entered as records matches the Excel, and each role reads and writes only what it should.

## The 15-task flow

- `src/flow/` is the flow, pure TypeScript: `tasks.ts` (the fifteen tasks with their stage, role, predecessors and when each applies, BR-40 / BR-41), `calendar.ts` (working days and due state), `advance.ts` (`advanceOrder()`: the tasks and the order as they are → what to create, change and log; idempotent, so a trigger that fires on its own writes ends there), `sla.ts` (the hourly sweep), `actions.ts` (the outcomes a person is offered), `code-entry.ts` (records in, flat lists out, for the Code steps). Tests are in `test/flow/`.
- `config/entities/order_task.json` (one task: role, status, outcome, due time; the `work` contract routes an open task to its role's group, t11 to the order's AM) and `order_event.json` (the log: created, never edited or deleted). People set only a task's outcome and reason; the stage model lets only the automation group move a task otherwise.
- `config/build/flow.mjs` holds four workflows, all run as `automation_principal` by a trigger: `init_order_tasks`, `advance_order`, `close_lost_order`, `sla_sweep`. `config/code/advance_order.js` and `sla_sweep.js` are generated by `scripts/build-code.mjs`.
- Once an order is sent for approval it is locked for the AM and SA (rules on `order` and on its lines, prices and finance); a return by TM (t22) or SD (t31) opens t11 again and unlocks it. Approval sets `order.approved` and asks for one last P&L; after that `compute_pl` skips the order. Close-lost needs a reason and is refused once the customer's contract is signed.
- `e2e/flow.sandbox.test.ts` walks the flow on a sandbox, including two roles finishing at the same moment.

## The module

The module's files, in `src/module/`:

- `module.tsx` is the entry: `mount(root, host)`, which AgentFlow imports and calls;
- `mount.tsx` puts the stylesheet in the shadow root and renders `App.tsx`, following the host's language and theme; `routes.ts` reads the path (`/`, `/orders/new`, `/orders/<id>?tab=<tab>`);
- `OrderListScreen.tsx` is the order list (period, status and AM filters; money or "your lines" by role; delete for the admin);
- `OrderPage.tsx` is one order: `CustomerCard.tsx` (with known customers suggested while typing), `DeliveryCard.tsx`, and the tabs in `tabs/` — `SurveyTab`, `LinesTab` (the lines, computed as typed), `SuppliersTab`, `PlTab` (live for the order's editor, official for everyone else), `PurchaseTab` (Purchasing's proposals and KPI, Technical's services and specs);
- `useOrderDraft.ts` holds the order being edited: the draft, what is typed but not valid yet, the live P&L (`computePl`), the issues (`validateOrder`) and saving; `Field.tsx` and `paths.ts` are its fields;
- `orders-api.ts` is what the screens need from AgentFlow; `http-orders-api.ts` does it over the published record operations (a 403 or 404 shows less, never an error; a stale write is read again and retried once); `memory-orders-api.ts` is the fake the demo and the tests use, on `demo-data.ts` (order TM-1040 and a Cloud Server order);
- `save-plan.ts` turns a draft into the writes that save it (an order before its lines, a line before its price, a price moved when its line changes group); after the writes the screen sets `pl_requested_at` and `compute_pl` runs;
- `access.ts` decides the tabs from what AgentFlow lets the person read;
- `format.ts` shows money, percentages and days the Vietnamese way; `kit.tsx` wraps the kit's elements, `icons.tsx` holds the icons;
- `text.ts` holds the Vietnamese and English text, and `styles.css` the module's one stylesheet;
- The flow screens (plan 03b): `StageBar.tsx` (the seven stages above every saved order), `tabs/FlowTab.tsx` (the board of `TaskCard.tsx`s and, for the person's own tasks, `ActionPanel.tsx`: outcome buttons, one note for the reason, the warnings that will be logged, Close-lost for the order's Sales Admin), `tabs/HistoryTab.tsx` (the log, with a filter for ignored warnings), `MyWorkScreen.tsx` (`/tasks`, and `/tasks/<id>` which AgentFlow's My Work opens) and the "Việc của tôi (N)" button of the order list. `useFlow.ts` holds one order's tasks, log and the tasks this person may act on, and after an action reads again until the workflow has dealt with it. `flow-view.ts` derives "returned" and the Close-lost reason from the log. The pure parts are in `src/flow/board.ts` (stage states, who a task waits for) and `src/flow/warnings.ts` (system warnings: late, advance paid before the customer's, P&L below its threshold).
- `demo.tsx` mounts the module on the fake, for `module.html`: `?lang=vi|en`, `?role=tm|proc|sd|admin`, `?empty`.

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

Installing asks for a service principal, `automation_principal` ("Tài khoản tự động hóa PL", the account the automatic workflows run as; put it in the `automation_group` and give it a role with `entity.read`, `entity.list` and `entity.write`), and nine groups (`group_ref` parameters, all required): `app_users` ("Người dùng PL", everyone who uses the app, the audience), one group per role — `am_group` (AM · Nhân viên Sale), `sa_group` (Sales Admin), `tm_group` (Technical Manager), `sd_group` (Sales Director), `proc_group` (Mua hàng), `acc_group` (Kế toán bán hàng), `admin_group` (Quản trị viên PL) — and `automation_group` ("Tự động hóa PL"), which holds the service principal the automatic workflows run as and nothing else. Each must be a different group (a group may not receive two sets of grants on the same entity); people may be in several, and everyone in a role group must also be in `app_users`.

A role does not come from a group, so give the members of every group except `automation_group` a role with `entity.read`, `entity.list` and `entity.write`; give the service principal the same. After the install, the admin must **turn on seven triggers** (triggers always ship off): `compute_pl_on_request` (without it no order's P&L is computed), `request_pl_on_proposal` and `request_pl_on_proposal_update` (Purchasing's proposals recompute the P&L and the purchasing KPI), and the four of the flow: `init_order_tasks_on_create` (an order's fifteen tasks), `advance_order_on_task` (opens what is next, handles returns, approval and the log), `close_lost_order_on_status` and `sla_sweep_hourly` (due soon / overdue on working days). The SLA counts Monday to Friday in Vietnam time and knows no public holidays.

