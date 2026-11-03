import { describe, expect, it } from 'vitest';
import type { ContractRec } from '../../src/contract/types';
import { createHttpOrdersApi } from '../../src/module/http-orders-api.js';
import { createMemoryOrdersApi } from '../../src/module/memory-orders-api.js';
import { OrdersError } from '../../src/module/orders-api.js';
import { fakeBackend, type Refuse } from './fake-backend.js';

const pdf = (name = 'hop-dong.pdf') => new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' });
const customerDraft = { party: 'customer' as const, supplier: null, step: 'draft' as const, value: 25_000_000, advance_percent: null };

function seeded(refuse?: Refuse) {
  const b = fakeBackend(refuse);
  b.seedFile('att-1', 'du-thao-v1.pdf');
  b.seed('contract', { order: 'o1', party: 'customer', step: 'draft', file: ['att-1'], version: 1, uploaded_by: 'u-sa',
    uploaded_at: '2026-11-03T09:00:00.123456789+07:00', source: 'upload' }, 'c1');
  b.seed('contract', { order: 'o1', party: 'customer', step: 'draft', file: [], version: 2, uploaded_by: 'u-sa',
    uploaded_at: '2026-11-03T10:00:00+07:00', source: 'upload' }, 'c2');
  b.seed('contract', { order: 'o2', party: 'customer', step: 'draft', file: [], version: 1 }, 'c-other');
  return b;
}

describe('contracts through the HTTP API', () => {
  it('contracts_are_read_newest_first_and_unreadable_is_empty', async () => {
    const list = await createHttpOrdersApi(seeded().host).contracts('o1');
    expect(list.map((c) => [c.id, c.version, c.file, c.file_name])).toEqual([['c2', 2, null, null], ['c1', 1, 'att-1', 'du-thao-v1.pdf']]);
    const refused = seeded((method, entity) => (method === 'QUERY' && entity === 'contract' ? { status: 403, type: 'ENTITY_ACCESS_DENIED' } : null));
    expect(await createHttpOrdersApi(refused.host).contracts('o1')).toEqual([]);
  });

  it('upload_sends_the_file_then_creates_the_record_with_the_next_version', async () => {
    const b = seeded();
    const made = await createHttpOrdersApi(b.host).uploadContract('o1', { ...customerDraft, file: pdf('du-thao-v3.pdf') });
    const upload = b.POST.mock.calls.find(([path]) => path === '/attachments')!;
    expect((upload[1] as unknown as { body: FormData }).body.get('file')).toBeInstanceOf(File);
    expect(made).toMatchObject({ order: 'o1', party: 'customer', supplier: null, step: 'draft', version: 3, uploaded_by: 'u-am', source: 'upload',
      value: 25_000_000, file_name: 'du-thao-v3.pdf' });
    const row = b.all('contract').find((r) => r.id === made.id)!;
    expect(row.body).toMatchObject({ file: [made.file], version: 3, uploaded_by: 'u-am' });
    expect(row.body).not.toHaveProperty('supplier');
  });

  it('versions_count_per_party_supplier_and_step', async () => {
    const b = seeded();
    const api = createHttpOrdersApi(b.host);
    expect((await api.uploadContract('o1', { ...customerDraft, step: 'final', file: pdf() })).version).toBe(1);
    expect((await api.uploadContract('o1', { ...customerDraft, party: 'supplier', supplier: 's1', advance_percent: 0.3, file: pdf() })).version).toBe(1);
    expect(b.all('contract').at(-1)!.body).toMatchObject({ party: 'supplier', supplier: 's1', advance_percent: 0.3 });
  });

  it('failed_upload_leaves_no_contract', async () => {
    const b = seeded((method) => (method === 'UPLOAD' ? { status: 413, type: 'PAYLOAD_TOO_LARGE', detail: 'PAYLOAD_TOO_LARGE: the file is too large' } : null));
    const before = b.all('contract').length;
    const error = await createHttpOrdersApi(b.host).uploadContract('o1', { ...customerDraft, file: pdf() }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OrdersError);
    expect(error).toMatchObject({ code: 'UPLOAD_FAILED', status: 413 });
    expect(b.all('contract')).toHaveLength(before);
  });

  it('the_app_not_being_allowed_to_upload_is_its_own_error', async () => {
    const b = seeded((method) => (method === 'UPLOAD' ? { status: 403, type: 'APP_CEILING_DENIED' } : null));
    await expect(createHttpOrdersApi(b.host).uploadContract('o1', { ...customerDraft, file: pdf() })).rejects.toMatchObject({ code: 'UPLOAD_NOT_ALLOWED' });
  });

  it('contract_creation_failure_after_the_upload_is_reported_not_swallowed', async () => {
    const b = seeded((method, entity) => (method === 'POST' && entity === 'contract'
      ? { status: 422, type: 'ENTITY_VALIDATION_RULE_FAILED', detail: 'Đơn đã đóng — không tải thêm hợp đồng' } : null));
    await expect(createHttpOrdersApi(b.host).uploadContract('o1', { ...customerDraft, file: pdf() }))
      .rejects.toMatchObject({ code: 'ENTITY_VALIDATION_RULE_FAILED', reason: 'Đơn đã đóng — không tải thêm hợp đồng' });
  });

  it('file_url_uses_apiUrl_and_is_null_without_a_file', async () => {
    const api = createHttpOrdersApi(seeded().host);
    const [c2, c1] = await api.contracts('o1');
    expect(api.contractFileUrl(c1)).toBe('https://af.test/api/attachments/att-1/download');
    expect(api.contractFileUrl(c2)).toBeNull();
  });
});

describe('the signing fields (BR-45)', () => {
  it('save_signing_patches_only_the_signing_fields', async () => {
    const b = fakeBackend();
    b.seed('order', { status: 'in_progress', receiver_name: '', content: 'Thiết bị' }, 'o1');
    await createHttpOrdersApi(b.host).saveSigning('o1', { receiver_name: 'Nguyễn An', signed_on: '2026-11-05' });
    const patch = b.PATCH.mock.calls.at(-1)![1] as { body: { changes: Record<string, unknown> } };
    expect(patch.body.changes).toEqual({ receiver_name: 'Nguyễn An', signed_on: '2026-11-05' });
    expect(b.all('order')[0].body).toMatchObject({ receiver_name: 'Nguyễn An', content: 'Thiết bị' });
  });

  it('save_signing_refuses_other_fields', async () => {
    const b = fakeBackend();
    b.seed('order', { status: 'in_progress' }, 'o1');
    await expect(createHttpOrdersApi(b.host).saveSigning('o1', { content: 'x' } as never)).rejects.toMatchObject({ code: 'NOT_SIGNING_FIELD' });
    await expect(createMemoryOrdersApi().saveSigning('o1', { am: 'x' } as never)).rejects.toMatchObject({ code: 'NOT_SIGNING_FIELD' });
  });
});

describe('contracts in the memory API', () => {
  it('upload_keeps_the_file_name_and_versions', async () => {
    const api = createMemoryOrdersApi({ me: { id: 'u-sa', name: 'Trần Sa' } });
    const v1 = await api.uploadContract('o1', { ...customerDraft, file: pdf('a.pdf') });
    const v2 = await api.uploadContract('o1', { ...customerDraft, file: pdf('b.pdf') });
    expect([v1.version, v2.version]).toEqual([1, 2]);
    const list: ContractRec[] = await api.contracts('o1');
    expect(list.map((c) => [c.version, c.file_name, c.uploaded_by])).toEqual([[2, 'b.pdf', 'u-sa'], [1, 'a.pdf', 'u-sa']]);
    expect(await api.contracts('o2')).toEqual([]);
  });

  it('memory_can_refuse_uploads_like_the_platform', async () => {
    const api = createMemoryOrdersApi({ refuseUploads: true });
    await expect(api.uploadContract('o1', { ...customerDraft, file: pdf() })).rejects.toMatchObject({ code: 'UPLOAD_NOT_ALLOWED' });
    expect(await api.contracts('o1')).toEqual([]);
  });
});
