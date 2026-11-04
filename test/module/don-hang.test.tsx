// @vitest-environment jsdom
import './shims';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinesTable } from '../../src/module/screens/LinesTable';
import { TaskActions } from '../../src/module/screens/ViecCuaBan';
import type { LineDraft } from '../../src/module/model';

const line = (loai: string): LineDraft => ({ mo_ta: 'Dòng', dvt: 'Gói', so_luong: 1, loai, so_thang: 12, gia_mua: 1, don_gia_ban: 2, chiet_khau: 0, sku: '', ncc: '' });

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
