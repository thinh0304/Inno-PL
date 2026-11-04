// @vitest-environment jsdom
import './shims';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinesTable } from '../../src/module/screens/LinesTable';
import { TaskActions, TaskList } from '../../src/module/screens/ViecCuaBan';
import { emptyLine, onlyMine, type LineForm } from '../../src/module/model';

afterEach(cleanup);

const line = (loai: string): LineForm => ({ ...emptyLine(), mo_ta: 'Dòng', dvt: 'Gói', so_luong: 1, loai, so_thang: 12, gia_mua: 1, don_gia_ban: 2 });

describe('LinesTable', () => {
  it('ô số tháng đổi tên theo loại dòng: dịch vụ định kỳ → số tháng dịch vụ, TB → tháng bảo hành', () => {
    let lines = [line('dvdk_i')];
    const { rerender } = render(<LinesTable lines={lines} editable lang="vi" onChange={(next) => { lines = next; }} />);
    expect(screen.getByLabelText('Số tháng dịch vụ (dòng 1)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Loại (dòng 1)'), { target: { value: 'tb' } });
    rerender(<LinesTable lines={lines} editable lang="vi" onChange={(next) => { lines = next; }} />);
    expect(screen.getByLabelText('Tháng bảo hành (dòng 1)')).toBeTruthy();
  });
});

describe('TaskActions', () => {
  it('Trả lại bị khóa khi chưa ghi lý do', () => {
    const onAct = vi.fn();
    render(<TaskActions kind="approve" lang="vi" onAct={onAct} busy={false} />);
    const back = screen.getByRole('button', { name: 'Trả lại' }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Thiếu giá NCC' } });
    expect(back.disabled).toBe(false);
    fireEvent.click(back);
    expect(onAct).toHaveBeenCalledWith('tra_lai', 'Thiếu giá NCC');
  });

  it('Gửi duyệt ở t11 hoàn thành task', () => {
    const onAct = vi.fn();
    render(<TaskActions kind="submit" lang="vi" onAct={onAct} busy={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi duyệt' }));
    expect(onAct).toHaveBeenCalledWith('xong', '');
  });
});

describe('LinesTable cho người không đọc được giá bán (TM, PROC)', () => {
  it('vẫn hiện dòng hàng nhưng không có cột giá bán và chiết khấu', () => {
    render(<LinesTable lines={[line('tb')]} editable={false} showPrices={false} lang="vi" onChange={() => {}} />);
    expect(screen.getByLabelText('Hàng hóa / dịch vụ (dòng 1)')).toBeTruthy();
    expect(screen.queryByLabelText('Đơn giá bán (dòng 1)')).toBeNull();
    expect(screen.queryByLabelText('CK % (dòng 1)')).toBeNull();
  });
});

describe('TaskList', () => {
  it('t11 không gửi duyệt được từ danh sách việc: phải mở đơn để kiểm tra trước', () => {
    const onOpen = vi.fn();
    render(<TaskList lang="vi" busy={false} onAct={() => {}} onOpen={onOpen}
      tasks={[{ id: 'k1', ma: 't11', orderId: 'd1', orderCode: 'DH-0001', kind: 'submit', han: null }]} />);
    expect(screen.queryByRole('button', { name: 'Gửi duyệt' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'DH-0001' }));
    expect(onOpen).toHaveBeenCalledWith('d1');
  });
});

describe('onlyMine', () => {
  it('chỉ giữ task nằm trong My Work của người xem', () => {
    const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(onlyMine(tasks, new Set(['b']))).toEqual([{ id: 'b' }]);
  });
});

describe('TaskActions (Phase 3)', () => {
  it('t42: Yêu cầu sửa chỉ bấm được khi có lý do; Đồng ý trình ký thì không cần', () => {
    const onAct = vi.fn();
    render(<TaskActions kind="review" lang="vi" busy={false} onAct={onAct} />);
    expect((screen.getByRole('button', { name: 'Yêu cầu sửa' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Lý do' }), { target: { value: 'Sai điều khoản thanh toán' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu sửa' }));
    expect(onAct).toHaveBeenCalledWith('yeu_cau_sua', 'Sai điều khoản thanh toán');
  });
  it('cảnh báo nghiêm trọng: không đi tiếp được khi chưa ghi lý do', () => {
    const onAct = vi.fn();
    render(<TaskActions kind="approve" lang="vi" busy={false} warning="P&L không đạt" onAct={onAct} />);
    expect((screen.getByRole('button', { name: 'Duyệt' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Lý do' }), { target: { value: 'Khách chiến lược' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    expect(onAct).toHaveBeenCalledWith('xong', 'Khách chiến lược');
  });
  it('t51: có nút Không áp dụng', () => {
    const onAct = vi.fn();
    render(<TaskActions kind="optional" lang="vi" busy={false} onAct={onAct} />);
    fireEvent.click(screen.getByRole('button', { name: 'Không áp dụng' }));
    expect(onAct).toHaveBeenCalledWith('khong_ap_dung', '');
  });
});
