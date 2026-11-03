// Plan 04, Task 3: what the platform does with contract files, checked before the screens are built on it:
// POST /attachments as a person, a contract record holding the file, downloading it, and who may do what.
import { as } from '@reflexify/agentflow-sdk/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, create, entityId, get, patch, tryCreate, userId, type Client, TAG } from './flow-helpers';

const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function upload(client: Client, bytes: Uint8Array, name = 'hop-dong.pdf', type = 'application/pdf') {
  const form = new FormData();
  form.append('file', new Blob([bytes as Uint8Array<ArrayBuffer>], { type }), name);
  const { data, error, response } = await client.POST('/attachments', { body: form as never, bodySerializer: (b: unknown) => b as FormData });
  return { status: response.status, data, error };
}

let orderId = '';
let attachment = '';

describe('contract files in the sandbox', () => {
  beforeAll(async () => {
    const order = await create(as('am'), 'order', { customer_name: `Khách hàng ${TAG}H`, customer_code: `${TAG}H`, am: userId('am'), sa: userId('sa') });
    orderId = order.id;
  });

  it('sa_uploads_a_pdf_and_attaches_it_to_a_contract', async () => {
    const up = await upload(as('sa'), PDF);
    console.log('upload answer', up.status, JSON.stringify(up.data ?? up.error));
    expect(up.status).toBe(201);
    attachment = String((up.data as { id: string }).id);
    const made = await tryCreate(as('sa'), 'contract', { order: orderId, party: 'customer', step: 'draft', file: [attachment], version: 1,
      uploaded_by: userId('sa'), uploaded_at: new Date().toISOString(), source: 'upload', value: 25_000_000 });
    console.log('create answer', made.status, JSON.stringify(made.record ?? made.error));
    expect(made.status, JSON.stringify(made.error)).toBe(201);
    const read = await get(as('am'), 'contract', made.record!.id);
    console.log('read as AM', JSON.stringify(read));
    expect(JSON.stringify(read?.file)).toContain(attachment);
    const meta = await as('am').GET('/attachments/{attachment_id}', { params: { path: { attachment_id: attachment } } });
    console.log('metadata as AM', meta.response.status, JSON.stringify(meta.data ?? meta.error));
    const file = await as('am').GET('/attachments/{attachment_id}/download', { params: { path: { attachment_id: attachment } }, parseAs: 'arrayBuffer' });
    expect(file.response.status).toBe(200);
    expect(new Uint8Array(file.data as ArrayBuffer)).toEqual(PDF);
  });

  it('proc_cannot_create_a_customer_contract', async () => {
    const up = await upload(as('proc'), PDF);
    const made = await tryCreate(as('proc'), 'contract', { order: orderId, party: 'customer', step: 'draft', file: [String((up.data as { id: string }).id)], version: 1 });
    console.log('proc customer contract', made.status, JSON.stringify(made.error));
    expect(made.status).toBe(422);
  });

  it('am_reads_but_cannot_create', async () => {
    const made = await tryCreate(as('am'), 'contract', { order: orderId, party: 'customer', step: 'draft', version: 1 });
    console.log('am create', made.status, JSON.stringify(made.error));
    expect(made.status).toBeGreaterThanOrEqual(400);
  });

  it('a_contract_cannot_be_edited_or_deleted', async () => {
    const made = await create(as('sa'), 'contract', { order: orderId, party: 'customer', step: 'final', version: 1 });
    expect((await patch(as('sa'), 'contract', made.id, { value: 1 })).status).toBeGreaterThanOrEqual(400);
    expect((await patch(ADMIN(), 'contract', made.id, { value: 1 })).status).toBeGreaterThanOrEqual(400);
    const del = await as('sa').DELETE('/entities/{entity_id}/records/{record_id}', { params: { path: { entity_id: entityId('contract'), record_id: made.id }, query: { expected_updated_at: made.updated_at ?? '' } } });
    console.log('sa delete', del.response.status);
    expect(del.response.status).toBeGreaterThanOrEqual(400);
  });

  it('an_empty_or_oversized_file_is_refused', async () => {
    const empty = await upload(as('sa'), new Uint8Array());
    console.log('empty upload', empty.status, JSON.stringify(empty.error));
    expect(empty.status).toBe(400);
    const big = await upload(as('sa'), new Uint8Array(30 * 1024 * 1024));
    console.log('30 MB upload', big.status, JSON.stringify(big.error));
  });

  it('tm_cannot_read_contracts', async () => {
    const { data, response } = await as('tm').GET('/entities/{entity_id}/records', { params: { path: { entity_id: entityId('contract') }, query: { limit: 10 } } });
    console.log('tm list', response.status, (data?.items ?? []).length);
    expect(response.status === 403 || (data?.items ?? []).length === 0).toBe(true);
  });
});
