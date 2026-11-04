// Dữ liệu một đơn trên màn hình là `OrderForm` / `LineForm` của domain (dùng chung với Code step).
export { emptyLine, emptyOrder, type LineForm, type OrderForm, type StageForm } from '../domain/form.js';
export { plInputFromForm } from '../domain/plinput.js';

/** Giữ lại các task nằm trong My Work của người xem (nút thao tác chỉ hiện cho task của họ). */
export const onlyMine = <T extends { id: string }>(tasks: T[], workIds: ReadonlySet<string>): T[] => tasks.filter((t) => workIds.has(t.id));
