# Kế hoạch 03b · Màn hình quy trình: thanh giai đoạn, bảng task, thao tác, lịch sử, Việc của tôi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng thấy đơn đang ở giai đoạn nào, task nào chờ ai, làm đúng việc của vai trò mình (Gửi duyệt, Duyệt / Trả lại, Đồng ý / Yêu cầu sửa, Hoàn thành, Không áp dụng, Close-lost) với lý do và cảnh báo được ghi vào lịch sử, xem lịch sử xử lý, và có trang "Việc của tôi" với huy hiệu việc chờ — trên `OrdersApi` của kế hoạch 03.

**Architecture:** Phần tính (trạng thái thanh giai đoạn, "chờ ai", cảnh báo hệ thống) là hàm thuần trong `src/flow/` có test; `useFlow(api, orderId)` giữ task / nhật ký / việc được phép làm của một đơn và đọc lại sau mỗi thao tác tới khi `advance_order` chạy xong; `OrderPage` sở hữu một `useFlow` và đưa cho `StageBar` (đầu mọi tab) và các tab `flow`, `history`. Màn hình không bao giờ ghi trạng thái đơn hay mở task: chỉ `api.act` / `api.closeLost`, phần còn lại do trigger.

**Tech Stack:** React 18 + `@reflexify/agentflow-elements/kit`, Vitest + jsdom + Testing Library, `OrdersApi` (`http-orders-api.ts`, `memory-orders-api.ts`).

**Spec:** `docs/superpowers/specs/2026-11-02-pl-agentflow-design.md` (Thiết kế) mục 8, 11 (Màn hình), 12; Đặc tả `docs/source/spec.md` FR-6.1–6.6, 6.8 (phần cảnh báo hệ thống), 6.9, 6.10, FR-1.1 (huy hiệu), FR-1.6a (Bỏ qua gợi ý). Bố cục theo `docs/source/mockup.html` (`renderWorkflow`, `renderBoard`, `taskCard`, `ovBox`). Kit: `node_modules/@reflexify/agentflow-elements/DESIGN.md`. Kế hoạch 03 (`2026-11-03-03-quy-trinh.md`) và mục "Lưu ý cho 03b" của lộ trình.

**Làm ở kế hoạch sau (không thuộc 03b):** gợi ý AI trên thẻ task và AI nhập cảnh báo (FR-6.7, kế hoạch 05); khung Hợp đồng, số tiền tạm ứng NCC theo HĐ (FR-6.8 phần số tiền, kế hoạch 04); dashboard "Đơn có cảnh báo bị bỏ qua" (kế hoạch 07).

## Global Constraints

- Tiếng Việt là chính, có bản tiếng Anh cho mọi chuỗi (`text.ts`: `vi` và `en` cùng khóa); số tiền dấu chấm hàng nghìn; ngày `dd/mm/yyyy`; sáng / tối theo host; dùng tốt từ 360 px; điều khiển hoàn toàn bằng bàn phím (NFR-10, NFR-11); trạng thái không chỉ báo bằng màu (luôn có chữ).
- Quy tắc module (đã có test `styles.test.ts`, `ui-build.test.ts`): một stylesheet trong shadow root, không selector `:root` / `html` / `body`, kích thước bằng `@container`, không listener trên `document` / `window`, nút bị khóa dùng `aria-disabled` (không `disabled`), mọi id đọc từ `GET /app/objects`.
- Nút thao tác chỉ hiện cho người **được phép làm đúng task đó**: task đang `open`, id của nó nằm trong `api.myWork()` (giữ hoặc được giao), và không bị người khác giữ (`actionsFor`, kế hoạch 03). Máy chủ vẫn kiểm bằng rule và `work` scope.
- Trả lại (t22, t31) và Yêu cầu sửa dự thảo (t42) bắt buộc có lý do (BR-43, `needsReason`); Close-lost bắt buộc lý do. Cảnh báo mức `critical` bắt buộc lý do khi vẫn tiếp tục (FR-6.10); `warning` chỉ khuyến khích.
- Thao tác chọn kết quả luôn đi qua `api.act`; màn hình không ghi `status` của đơn, không tạo / mở task (đó là việc của workflow).
- Chuỗi nhật ký ghi bởi màn hình: `action` = outcome (`submitted`, `approved`, `returned`, `agreed`, `revise`, `completed`, `not_applicable`), `ignored_warnings`, `ignored_suggestion`, `close_lost`; nhật ký của hệ thống (`returned_processed`, `auto_approved`, `approved`, …) do workflow ghi và chỉ được hiển thị.

## Review Focus

1. **Bấm đúp / Enter hai lần vào một nút thao tác:** `api.act` chỉ chạy một lần. → test `double_press_acts_once` ở Task 4.
2. **Thẻ cũ sau khi thao tác** (workflow chưa kịp mở task kế tiếp, hoặc chậm hàng chục giây): thẻ vừa làm báo "Đang xử lý", không còn nút nào cho tới khi bảng đọc lại; quá hạn chờ thì báo "Chưa cập nhật" kèm nút Tải lại, không treo mãi. → tests `card_is_locked_until_the_run_settles`, `settling_gives_up_with_a_reload` ở Task 3 và 4.
3. **Lý do:** lý do toàn dấu cách bị từ chối với Trả lại / Yêu cầu sửa / Close-lost / cảnh báo `critical`, thông báo gắn vào ô lý do bằng `aria-describedby`; lý do đã nhập được lưu vào nhật ký. → test `reason_rules` ở Task 4.
4. **Người không có việc:** vai trò khác, task do người khác giữ, task chưa tới lượt: không nút, và câu nói rõ "Đang chờ SD" / "Do Trần Kỳ giữ". → test `no_buttons_without_the_role_or_when_held_by_someone_else` ở Task 4.
5. **Đơn đã đóng (Close-lost, hoàn tất) hoặc người xem không đọc được task:** banner đúng, không thao tác, thanh giai đoạn thể hiện Close-lost, lịch sử vẫn đọc được; 403 / 404 khi đọc task không thành lỗi mà là thông báo "không có quyền xem quy trình". → tests `closed_order_has_no_actions` ở Task 4, `forbidden_tasks_show_a_notice` ở Task 3.

---

### Task 1: Trạng thái thanh giai đoạn, "chờ ai", cảnh báo hệ thống (thuần)

**Files:**
- Create: `src/flow/board.ts`, `src/flow/warnings.ts`
- Test: `test/flow/board.test.ts`, `test/flow/warnings.test.ts`

**Interfaces:**
- Consumes: `TASKS`, `FINISHED`, `predecessors`, `TaskCode`, `TaskRole`, `TaskStatus`, `FlowOrder` (`src/flow/tasks.ts`); `dueState` (`src/flow/calendar.ts`); `OrderTask`, `IgnoredWarning` (`src/module/orders-api.ts`).
- Produces:

```ts
export type StageState = 'done' | 'current' | 'parallel' | 'waiting' | 'returned' | 'lost';
export interface StageInfo { stage: 1|2|3|4|5|6|7; state: StageState; finished: number; total: number; waitingRoles: TaskRole[] }
export type BoardTask = Pick<OrderTask, 'task_code' | 'status' | 'role' | 'stage'>;
export function stageBar(tasks: BoardTask[], order: { status: FlowOrder['status']; returned: boolean }): StageInfo[];   // 7 entries
export function waitingOn(code: TaskCode, tasks: BoardTask[], customerPrepays: boolean): TaskRole[];  // roles of the nearest open tasks before `code`
export type WarningCode = 'late' | 'prepay_before_customer' | 'below_threshold';
export interface FlowWarning { code: WarningCode; level: 'warning' | 'critical'; days?: number }
export function taskWarnings(task: OrderTask, ctx: { tasks: OrderTask[]; now: string; passed: boolean | null; customerPrepays: boolean }): FlowWarning[];
export const needsWhy: (warnings: FlowWarning[]) => boolean;     // some critical
export const warningsApply: (outcome: TaskOutcome) => boolean;    // false for returned and revise: acting on a warning is not ignoring it
```

- [ ] **Step 1: Write the failing tests.** `board.test.ts`: `done_stage_when_all_its_tasks_are_finished` (task `not_applicable` and `skipped` count); `current_is_the_lowest_stage_with_unfinished_work`; `a_later_stage_with_an_open_task_is_parallel` (t40 open while t51... ví dụ t22 done, t23 open, t31 blocked → GĐ2 current; stage 4 task open với GĐ3 chưa xong là parallel); `waiting_roles_are_the_roles_of_open_tasks` (GĐ2 mở cả t22, t23 → `['tm','proc']`); `returned_marks_stage_1_when_the_draft_was_returned`; `lost_marks_the_current_stage_and_stops_the_rest` (close_lost: stage hiện tại `lost`, các stage sau `waiting`, không `parallel`); `waiting_on_follows_blocked_predecessors` (t42 blocked, t40 done, t44 open → `['proc']`; t61 với `customerPrepays` chờ cả t51 đang open → gồm `acc`); `waiting_on_a_task_that_is_not_blocked_is_empty`. `warnings.test.ts`: `late_warning_when_overdue_with_working_days` (task open, hạn thứ Sáu, now thứ Ba → `{code:'late', level:'warning', days:2}`); `prepay_warning_only_at_t53_before_t51` (t53, `customerPrepays`, t51 chưa xong → warning; t51 đã xong hoặc không prepay → không); `below_threshold_is_critical_at_t31_and_a_warning_at_t11` (`passed === false`; `null` không cảnh báo); `no_warnings_on_a_task_that_is_not_open`; `warnings_do_not_apply_to_returned_or_revise`; `needs_why_only_for_critical`.
- [ ] **Step 2:** `pnpm vitest run test/flow/board.test.ts test/flow/warnings.test.ts` → FAIL (module không tồn tại).
- [ ] **Step 3: Implement** `stageBar`, `waitingOn` (đi ngược `predecessors` qua các task `blocked` tới task `open` gần nhất), `taskWarnings`, `needsWhy`, `warningsApply` đúng chữ ký trên. `stageBar`: `done` khi mọi task của giai đoạn ∈ `FINISHED`; `current` là giai đoạn nhỏ nhất chưa `done`; `parallel` là giai đoạn sau đó có task `open`; còn lại `waiting`; `returned` thay `current` khi `order.returned` (đơn nháp bị trả lại); `lost` thay `current` khi `order.status === 'close_lost'` và không có `parallel` nào.
- [ ] **Step 4:** chạy lại hai file test → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `feat(flow): trạng thái thanh giai đoạn, chờ ai và cảnh báo hệ thống`

---

### Task 2: `OrdersApi`: `task`, `logEvent`, và `act` khi ghi nhật ký hỏng

**Files:**
- Modify: `src/module/orders-api.ts`, `src/module/http-orders-api.ts`, `src/module/memory-orders-api.ts`
- Test: mở rộng `test/module/flow-api.test.ts`

**Interfaces:**
- Produces (thêm vào `OrdersApi`):

```ts
task(id: string): Promise<OrderTask | null>;   // null when the person may not read it
logEvent(orderId: string, event: { action: string; note?: string; reason?: string; warnings?: IgnoredWarning[] }): Promise<void>;
```
  `act` khi task đã ghi xong mà tạo `order_event` bị từ chối ném `OrdersError('EVENT_NOT_LOGGED', <lý do của AgentFlow>, {}, status)` (task đã xong — màn hình đọc lại và báo, không báo thất bại).

- [ ] **Step 1: Write the failing tests** — `task_reads_one_task_or_null` (HTTP: có / 403 → null; memory: có / không có → null); `log_event_writes_an_order_event` (HTTP: bản ghi `order_event` có `order`, `action`, `note`, `actor = me.id`, `at`; memory tương tự và `events()` trả lại); `act_reports_event_not_logged_after_finishing_the_task` (fake backend từ chối `POST` entity `order_event` bằng 403: `act` ném `code: 'EVENT_NOT_LOGGED'` và task đã `done` trong store).
- [ ] **Step 2:** `pnpm vitest run test/module/flow-api.test.ts` → FAIL.
- [ ] **Step 3: Implement** `task` và `logEvent` ở cả hai bản; bọc hai lệnh tạo `order_event` trong `http-orders-api.ts` `act` bằng try/catch → `EVENT_NOT_LOGGED`. `logEvent` HTTP ghi `{ order, action, note, reason, warnings, actor: me.id, at }`.
- [ ] **Step 4:** `pnpm vitest run test/module` → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `feat(flow): OrdersApi.task, logEvent và act báo khi chưa ghi được nhật ký`

---

### Task 3: `useFlow`: task, nhật ký, việc được phép làm, đọc lại sau thao tác

**Files:**
- Create: `src/module/useFlow.ts`
- Test: `test/module/use-flow.test.tsx`

**Interfaces:**
- Consumes: `OrdersApi.tasks / events / myWork / act / closeLost`, `OrdersError`, `actionsFor`, `statusFor`.
- Produces:

```ts
export interface FlowHook {
  state: 'loading' | 'ready' | 'failed' | 'forbidden';   // forbidden: reading the tasks was refused (403 / 404)
  tasks: OrderTask[]; events: OrderEvent[];
  actionable: ReadonlySet<string>;                        // ids of this order's tasks this person may act on (held or offered)
  busy: string | null;                                    // id of the task being acted on, until the board has caught up
  stale: boolean;                                         // the wait for the workflow ran out
  act(task: OrderTask, outcome: TaskOutcome, reason: string, warnings: IgnoredWarning[]): Promise<void>;
  closeLost(reason: string): Promise<void>;
  reload(): void;
}
export function useFlow(api: OrdersApi, orderId: string | null, onChanged: () => void): FlowHook;
```
  `orderId === null` (đơn mới chưa lưu): `state: 'ready'`, danh sách rỗng. Sau `act` / `closeLost` thành công: `busy = task.id`, đọc lại `tasks` + `events` + `myWork` ở 1, 2, 3, 5, 8, 13, 20 giây tới khi chữ ký của danh sách task (`id:status:outcome`) khác trước lúc thao tác, rồi `busy = null` và gọi `onChanged()` (OrderPage đọc lại đơn: trạng thái, khóa sửa). Hết lịch mà chưa đổi: `busy = null`, `stale = true`. `EVENT_NOT_LOGGED` coi như thao tác thành công (vẫn đợi) nhưng ném lại cho màn hình báo. Hủy mọi timer khi unmount.

- [ ] **Step 1: Write the failing tests** (memory API, jsdom): `loads_tasks_events_and_what_i_may_act_on`; `card_is_locked_until_the_run_settles` (`computeDelayMs`/`delayMs` để workflow "chậm": ngay sau `act`, `busy` = id task, `tasks` cũ; sau khi đổi, `busy` null và `onChanged` đã gọi một lần); `settling_gives_up_with_a_reload` (api giả không bao giờ đổi task → `stale` true, `busy` null; `reload()` xóa `stale`; dùng fake timers); `forbidden_tasks_show_a_notice` (`tasks` ném 403 → `state: 'forbidden'`, không ném); `act_failure_clears_busy_and_rethrows` (ENTITY_VALIDATION_RULE_FAILED → ném lại, `busy` null); `a_new_order_has_no_tasks`.
- [ ] **Step 2:** `pnpm vitest run test/module/use-flow.test.tsx` → FAIL.
- [ ] **Step 3: Implement** `useFlow` đúng chữ ký; polling bằng chuỗi `setTimeout` lưu trong ref, như `waitForOfficial` trong `useOrderDraft.ts`.
- [ ] **Step 4:** chạy test → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `feat(ui): useFlow đọc quy trình của đơn và đợi workflow sau mỗi thao tác`

---

### Task 4: Thanh giai đoạn, tab Quy trình (bảng task + Việc của bạn), Close-lost

**Files:**
- Create: `src/module/StageBar.tsx`, `src/module/tabs/FlowTab.tsx`, `src/module/TaskCard.tsx`, `src/module/ActionPanel.tsx`
- Modify: `src/module/routes.ts` (`TabKey` thêm `'flow' | 'history'`), `src/module/access.ts` (`tabsFor`), `src/module/OrderPage.tsx` (`useFlow`, `StageBar` dưới đầu trang, `TabProps.flow`, banner đơn đóng), `src/module/App.tsx` (`TABS`), `src/module/text.ts` (nhóm `flow`, `stageNames`, `taskStatus`, `dueStates`, `outcomes`, `warnings`), `src/module/styles.css`
- Test: `test/module/flow-tab.test.tsx`, mở rộng `test/module/access.test.ts`, `test/module/routes.test.ts`

**Interfaces:**
- Consumes: `FlowHook` (Task 3), `stageBar`, `waitingOn`, `taskWarnings`, `needsWhy`, `warningsApply` (Task 1), `actionsFor`, `needsReason`, `OrderDraftHook` (`useOrderDraft.ts`: `draft`, `config.taskSlas` cho tên task, `staff`, `me`, `issues`, `dirty`).
- Produces: `TabProps` thêm `flow: FlowHook`; `tabsFor(access, editor)` thêm `'flow'` và `'history'` vào cuối mọi danh sách (đơn mới chưa lưu không có hai tab này); `routes.ts` nhận `?tab=flow|history`.

Hành vi (theo mockup, mỗi dòng một test bên dưới):
- `StageBar`: 7 chip `✓ / ! / số · tên ngắn` theo `stageBar()`, chip hiện tại ghi "— Chờ: TM, PROC" hoặc "Song song · …"; có `role="list"`, mỗi chip một `aria-label` đầy đủ.
- Bảng: cột theo giai đoạn, thẻ theo task: mã + tên (từ `taskSlas`), vai trò, trạng thái bằng chữ, hạn (`dd/mm/yyyy`) và tình trạng hạn (`due_state` + số ngày trễ), "Chờ SD" (`waitingOn`) cho task `blocked`, người giữ (tên theo `staff`) cho task đã bị nhận.
- Khung "Việc của bạn": các task `open` mà `actionable` có và `actionsFor` cho nút; mỗi thẻ có các nút theo outcome (nhãn: Gửi duyệt, Duyệt, Trả lại, Đồng ý trình ký, Yêu cầu sửa, Hoàn thành, Không áp dụng); ô "Ý kiến / ghi chú" chung; khung "⚠ N cảnh báo sẽ được ghi vào lịch sử" liệt kê `taskWarnings` (nguồn "Hệ thống", mức); nút bị khóa dùng `aria-disabled` kèm lý do (`aria-describedby`).
- t11 "Gửi duyệt": khóa khi `hook.dirty` ("Lưu trước khi gửi duyệt") hoặc `hook.issues` còn lỗi (liệt kê số trường thiếu, dùng lại banner của `useOrderDraft`).
- Sau khi bấm: nếu `warningsApply(outcome)` và còn cảnh báo, `api.act(..., warnings)` kèm danh sách `IgnoredWarning` (`source: 'system'`, `text` từ `t.flow.warnings[code]`); thẻ vừa làm hiện "Đang xử lý…" (`aria-busy`) và không nút nào; `stale` hiện "Chưa cập nhật" + nút Tải lại.
- Close-lost: nút ở khung dưới cho SA của đơn (`order.sa === me.id`), khi đơn `draft` / `in_progress` và t41 chưa xong; mở `Dialog` có ô lý do bắt buộc; gọi `flow.closeLost(reason)`.
- Đơn nháp bị trả lại (FR-6.3): `returned` = đơn `draft` có dòng nhật ký `returned_processed` mới hơn dòng `submitted` gần nhất (tính trong `OrderPage` từ `flow.events`, đưa vào `stageBar`); khung "Việc của bạn" của AM / SA hiện "↩ <người> trả lại lúc <giờ> (<task>): <lý do>" lấy từ dòng `returned` mới nhất.
- Đơn `close_lost` / `done`: banner ("Đã đóng · Close-lost — lý do: …" / "Đơn đã đi hết 7 giai đoạn"), không khung "Việc của bạn".

- [ ] **Step 1: Write the failing tests** (`flow-tab.test.tsx`, jsdom, `createMemoryOrdersApi`, đơn `o1` của dữ liệu demo):
  - `stage_bar_shows_seven_stages_with_who_is_awaited` (đơn vừa gửi duyệt: GĐ2 current, "Chờ: PROC"; tên tab và `role="list"`).
  - `board_cards_show_status_due_and_who_they_wait_for` (t31 blocked ghi "Chờ"; t23 open có hạn `dd/mm/yyyy`).
  - `your_work_lists_open_tasks_with_buttons_by_role` (`roles: ['proc']`: t23 có nút "Hoàn thành", không có nút nào của t31).
  - `no_buttons_without_the_role_or_when_held_by_someone_else` (Review Focus 4: `roles: ['am']` ở t23; task giữ bởi `u-other` hiện "Do … giữ" và không nút).
  - `submit_is_locked_while_unsaved_or_incomplete` (sửa một ô → nút Gửi duyệt `aria-disabled="true"` và lý do; lưu xong mới bật; thiếu trường thì khóa kèm số trường).
  - `submit_moves_the_order_on` (bấm Gửi duyệt → `api.act` một lần, thẻ t11 "Đang xử lý…", sau đó t23 mở và đầu trang chuyển "Đang xử lý").
  - `double_press_acts_once` (Review Focus 1: `fireEvent.click` hai lần liên tiếp, `userEvent` Enter hai lần → `act` spy gọi một lần).
  - `reason_rules` (Review Focus 3: Trả lại với ô trống / toàn dấu cách bị từ chối, thông báo gắn ô lý do; có lý do thì `act` nhận đúng lý do; t31 Duyệt khi P&L không đạt ngưỡng cần lý do vì `critical`, t11 Gửi duyệt thì không).
  - `warnings_are_logged_with_the_action` (t53 với `customer_prepays` khi t51 chưa xong: khung "⚠ 1 cảnh báo…"; sau Hoàn thành, `events()` có dòng `ignored_warnings` với `source: 'system'`).
  - `card_is_locked_until_the_run_settles` (Review Focus 2: `delayMs` > 0, sau bấm không còn nút, "Đang xử lý…"; khi đổi mới có nút của task kế).
  - `settling_gives_up_with_a_reload` (api không đổi task, fake timers: "Chưa cập nhật" + Tải lại).
  - `close_lost_needs_a_reason_and_closes_the_order` (`me: u-sa`, đơn có `sa`; hộp thoại, lý do trống bị từ chối; sau đó banner "Đã đóng · Close-lost" và thanh giai đoạn ghi Close-lost).
  - `returned_order_shows_who_sent_it_back_and_why` (SD Trả lại có lý do: đơn về nháp, chip GĐ1 "!" ghi "Bị trả lại", khung của AM hiện tên người trả lại, giờ và lý do; sau khi AM Gửi duyệt lại thì chip và khung biến mất).
  - `closed_order_has_no_actions` (Review Focus 5: đơn close_lost: không khung "Việc của bạn", tab Lịch sử vẫn mở được).
  - `event_not_logged_is_reported_but_the_task_is_done` (api `act` ném `EVENT_NOT_LOGGED`: thông báo, thẻ vẫn cập nhật).
  - `access`: `tabsFor` thêm `flow`, `history` ở cuối cho editor và cho từng vai trò; `routes`: `?tab=flow`, `?tab=history` parse và `routePath`.
- [ ] **Step 2:** `pnpm build && pnpm vitest run test/module/flow-tab.test.tsx test/module/access.test.ts test/module/routes.test.ts` → FAIL.
- [ ] **Step 3: Implement** các file trên: `StageBar` thuần theo `stageBar()`; `FlowTab` ghép `TaskCard` (một thẻ) và `ActionPanel` (khung Việc của bạn + ghi chú + cảnh báo + Close-lost); `ActionPanel` giữ `pressed` ref chống bấm đúp (như `OrderPage.save`) và tự khóa khi `flow.busy`; mọi chuỗi qua `text.ts` (cả `vi` và `en`); style bằng `@container`, `aria-*`, không màu nào là tín hiệu duy nhất.
- [ ] **Step 4:** `pnpm build && pnpm test` → PASS (kể cả `styles.test.ts`, `ui-build.test.ts`); `pnpm typecheck`.
- [ ] **Step 5: Commit** — `feat(ui): thanh giai đoạn, tab Quy trình và thao tác task`

---

### Task 5: Tab Lịch sử và ghi "Bỏ qua gợi ý" của khách hàng

**Files:**
- Create: `src/module/tabs/HistoryTab.tsx`
- Modify: `src/module/CustomerCard.tsx` (nút Giữ nguyên báo lên `hook.noteIgnoredSuggestion`), `src/module/useOrderDraft.ts` (`noteIgnoredSuggestion(fields)`, đẩy `logEvent` sau khi đơn đã có id), `src/module/App.tsx` (`TABS.history`), `src/module/text.ts`, `src/module/styles.css`
- Test: `test/module/history-tab.test.tsx`, mở rộng `test/module/customer-card.test.tsx`

**Interfaces:**
- Consumes: `FlowHook.events`, `OrdersApi.logEvent` (Task 2), `OrderEvent`.
- Produces: `OrderDraftHook.noteIgnoredSuggestion(fields: string[]): void` — đơn đã lưu: `api.logEvent(id, { action: 'ignored_suggestion', note: 'Giữ nguyên: <nhãn các trường>' })` ngay; đơn mới: giữ trong hook rồi ghi ngay sau lần lưu đầu tiên.

Hành vi (FR-6.9, FR-6.10): danh sách mới nhất trước: thời gian `dd/mm/yyyy HH:mm`, người (tên theo `staff`, trống = "Hệ thống"), vai trò, nhãn hành động, task (mã + tên), ghi chú, lý do; dòng `ignored_warnings` liệt kê từng cảnh báo kèm nguồn (AI / Hệ thống) và mức; nút lọc "Chỉ cảnh báo bị bỏ qua" (`aria-pressed`) kèm số lần; trống thì "Chưa có thao tác nào".

- [ ] **Step 1: Write the failing tests** — `history_lists_newest_first_with_who_what_and_why`; `system_lines_show_as_system` (actor null → "Hệ thống"); `ignored_warnings_list_each_warning_with_source_and_level`; `filter_shows_only_ignored_warnings_and_counts_them`; `empty_history_says_so`; customer-card: `keeping_a_field_is_logged_as_ignored_suggestion` (đơn đã lưu: `events()` có `ignored_suggestion` ghi nhãn trường) và `keeping_a_field_on_a_new_order_is_logged_after_the_first_save`.
- [ ] **Step 2:** `pnpm build && pnpm vitest run test/module/history-tab.test.tsx test/module/customer-card.test.tsx` → FAIL.
- [ ] **Step 3: Implement** `HistoryTab` và `noteIgnoredSuggestion` đúng chữ ký; hàng đợi cho đơn mới trong `useOrderDraft` xả sau `save()` thành công (cùng chỗ `waitForOfficial`).
- [ ] **Step 4:** `pnpm build && pnpm test` → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `feat(ui): tab Lịch sử và ghi bỏ qua gợi ý khách hàng`

---

### Task 6: Việc của tôi, `/tasks/:id`, huy hiệu và demo

**Files:**
- Create: `src/module/MyWorkScreen.tsx`
- Modify: `src/module/routes.ts` (`Route` thêm `{ name: 'work' }` và `{ name: 'task'; id }`; `/tasks`, `/tasks/<id>`), `src/module/App.tsx`, `src/module/OrderListScreen.tsx` (nút "Việc của tôi (N)"), `src/module/demo.tsx` (`?role=` đặt cả `roles` và `me`: `am` mặc định `['am']`, `sa` `['sa']`, `tm`, `proc`, `sd`, `admin` `[]`), `src/module/text.ts`, `src/module/styles.css`
- Test: `test/module/my-work.test.tsx`, mở rộng `test/module/routes.test.ts`, `test/module/order-list.test.tsx`, `test/module/app.test.tsx`

**Interfaces:**
- Consumes: `OrdersApi.myWork()`, `OrdersApi.task(id)` (Task 2), `routePath`.
- Produces: `routePath({ name: 'work' })` = `/tasks`; `{ name: 'task'; id }` = `/tasks/<id>` (đích của `module_page: "/tasks/{{ record_id }}"`).

Hành vi: `MyWorkScreen`: hai nhóm "Của bạn" (đang giữ) và "Chờ bạn nhận" — mỗi dòng: mã đơn, khách hàng, task (mã + tên), giai đoạn, hạn và tình trạng hạn, nút/liên kết mở thẳng tab Quy trình của đơn; trống thì "Không có việc nào đang chờ"; lỗi mạng có Thử lại. `/tasks/<id>`: đọc `api.task(id)` rồi `navigate` (thay thế) tới `/orders/<order>?tab=flow`; không đọc được thì về `/tasks`. Danh sách đơn có nút "Việc của tôi (N)" (N = số dòng của `myWork`; ẩn số khi 0 hoặc khi không đọc được).

- [ ] **Step 1: Write the failing tests** — `my_work_groups_held_and_offered_tasks`; `my_work_row_opens_the_orders_flow_tab`; `my_work_empty_and_error_states`; `task_route_resolves_to_its_orders_flow_tab` và `task_route_for_an_unreadable_task_falls_back_to_my_work`; `list_shows_the_my_work_button_with_a_count`; routes: `/tasks`, `/tasks/abc%20d` parse và `routePath` khứ hồi; `demo_roles_set_who_acts` (`createMemoryOrdersApi({ roles: ['proc'] })` + `myWork` chỉ có việc `proc`).
- [ ] **Step 2:** `pnpm build && pnpm vitest run test/module/my-work.test.tsx test/module/routes.test.ts test/module/order-list.test.tsx test/module/app.test.tsx` → FAIL.
- [ ] **Step 3: Implement** màn hình, route và nút; cập nhật `demo.tsx`. Mở `pnpm demo` kiểm: Gửi duyệt đơn `o1` rồi đổi `?role=proc` thấy t23.
- [ ] **Step 4:** `pnpm build && pnpm test` → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `feat(ui): Việc của tôi, trang task và huy hiệu việc chờ`

---

### Task 7: Kiểm module trên sandbox, rà soát bằng tay, tài liệu

**Files:**
- Modify: `e2e/module.sandbox.test.ts` (thêm), `README.md`, `AGENTS.md`, `docs/superpowers/plans/2026-11-03-00-roadmap.md`, `docs/sdk-feedback.md` (nếu có vướng mắc mới)

**Interfaces:**
- Consumes: `createHttpOrdersApi` trên host sandbox như `module.sandbox.test.ts` đã dùng; người `am`, `sd`, `proc`, `sa`.

- [ ] **Step 1: Viết e2e** (dùng cách dựng host của `module.sandbox.test.ts`, đơn như `newOrder()` của `e2e/flow.sandbox.test.ts`): `module_reads_tasks_events_and_my_work` (AM `tasks()` đủ 15; `myWork()` có t11 và `claimable`); `module_acts_through_the_flow` (AM `act` Gửi duyệt qua `OrdersApi.act`, đợi t23 mở; Mua hàng `myWork()` có t23 và `act` Hoàn thành; SD `act` Trả lại có lý do → t11 mở lại; `events()` có `returned`, `returned_processed`); `module_logs_ignored_warnings` (`act` với một cảnh báo → `events()` có `ignored_warnings` đúng cấu trúc); `module_close_lost` (SA `closeLost` có lý do → task bị hủy); `module_tasks_of_an_unreadable_order_are_empty_not_an_error` (người ngoài `outsider`: `tasks()` trả `[]`); `module_my_work_skips_orders_it_cannot_read` (SA khác). `/work` đã kiểm hình dạng ở kế hoạch 03; ở đây kiểm `myWork` đọc đúng.
- [ ] **Step 2:** `pnpm af deploy --sandbox`, đợi vài phút cho trigger chạy, rồi `pnpm test:sandbox` → mọi bộ PASS. Lệch hành vi nền tảng: sửa theo hành vi thật, ghi `F-xx` nếu là vướng mắc SDK.
- [ ] **Step 3: Rà soát bằng tay trên `pnpm demo`** (ghi kết quả vào lộ trình): 1280 px và 360 px không tràn ngang; chỉ dùng bàn phím (Tab, Enter, Esc ở hộp thoại Close-lost); sáng / tối; tiếng Việt / Anh; trình đọc màn hình đọc được chip giai đoạn, trạng thái "Đang xử lý", khung cảnh báo; chưa kiểm được: đăng nhập thật bằng người dùng sandbox qua `pnpm exec agentflow-app sandbox open --as am` (cần người dùng), nêu rõ trong báo cáo.
- [ ] **Step 4: Tài liệu:** README mục "The module" (thanh giai đoạn, tab Quy trình / Lịch sử, Việc của tôi, `useFlow`, nhóm text `flow`), AGENTS.md ("Where things are": các file mới), lộ trình (03b ✅, các mục làm ở 04 / 05 / 07, rủi ro đã thấy).
- [ ] **Step 5:** `pnpm typecheck && pnpm test` → PASS; **Commit** — `test(e2e): module quy trình trên sandbox; docs: cập nhật sau kế hoạch 03b`
