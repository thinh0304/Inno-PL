import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { contractGate, contractSlots, prepayTotal, type SigningField } from '../contract/rules';
import type { ContractRec, ContractTask, GateIssue, Slot } from '../contract/types';
import type { OrderDraft, OrderFields, Rec } from '../order/types';
import type { PlConfig } from '../pl/types';
import type { ContractUpload, OrderTask, OrdersApi } from './orders-api.js';

export interface ContractsHook {
  state: 'loading' | 'ready' | 'failed';
  list: ContractRec[];
  /** The customer's contract, then one per supplier (contractSlots). */
  slots: Slot[];
  /** What still stops a contract task from being completed (BR-44, BR-45, BR-46); [] when it may be. */
  gate(task: ContractTask): GateIssue[];
  /** The advance owed to the suppliers by their contracts (FR-6.8). */
  prepay: number;
  supplierName(id: string | null): string;
  /** The slot and step being uploaded (`customer:draft`), until the list shows it. */
  uploading: string | null;
  upload(input: ContractUpload): Promise<void>;
  saveSigning(fields: Partial<Pick<OrderFields, SigningField>>): Promise<void>;
  fileUrl(contract: ContractRec): string | null;
  reload(): void;
}

/**
 * The order's contracts for the contracts tab and the flow tab's buttons. They are read again when the board changes (another
 * person may have uploaded meanwhile); a signing-field save lets the page read the order again (`onChanged`).
 */
export function useContracts(api: OrdersApi, orderId: string | null, draft: OrderDraft, revenue: number, config: PlConfig,
  tasks: OrderTask[], onChanged: () => void): ContractsHook {
  const [state, setState] = useState<ContractsHook['state']>(orderId ? 'loading' : 'ready');
  const [list, setList] = useState<ContractRec[]>([]);
  const [suppliers, setSuppliers] = useState<Rec[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const alive = useRef(true);
  const reads = useRef(0);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const read = useCallback(async () => {
    if (!orderId) return;
    const mine = ++reads.current;
    try {
      const found = await api.contracts(orderId);
      if (!alive.current || mine !== reads.current) return;
      setList(found);
      setState('ready');
    } catch {
      if (alive.current && mine === reads.current) setState('failed');
    }
  }, [api, orderId]);

  // Read again whenever a task moves (the board was read again).
  const board = tasks.map((t) => `${t.id}:${t.status}`).join(',');
  useEffect(() => { void read(); }, [read, board]);
  useEffect(() => {
    let live = true;
    api.suppliers().then((found) => live && setSuppliers(found), () => {});
    return () => { live = false; };
  }, [api]);

  const slots = useMemo(() => contractSlots(draft, revenue, list), [draft, revenue, list]);
  const t42 = tasks.find((t) => t.task_code === 't42');
  const gate = useCallback((task: ContractTask) => contractGate(task, { slots, draft, config,
    t42: { status: t42?.status ?? 'blocked', outcome: t42?.outcome ?? null } }), [slots, draft, config, t42?.status, t42?.outcome]);

  const upload = useCallback(async (input: ContractUpload) => {
    if (!orderId) return;
    setUploading(`${input.party === 'customer' ? 'customer' : `supplier:${input.supplier}`}:${input.step}`);
    try {
      await api.uploadContract(orderId, input);
      await read();
    } finally {
      if (alive.current) setUploading(null);
    }
  }, [api, orderId, read]);

  const saveSigning = useCallback(async (fields: Partial<Pick<OrderFields, SigningField>>) => {
    if (!orderId) return;
    await api.saveSigning(orderId, fields);
    changed.current();
  }, [api, orderId]);

  const supplierName = useCallback((id: string | null) => String(suppliers.find((s) => s.id === id)?.name ?? id ?? ''), [suppliers]);

  return { state, list, slots, gate, prepay: prepayTotal(slots), supplierName, uploading, upload, saveSigning,
    fileUrl: (c) => api.contractFileUrl(c), reload: () => void read() };
}
