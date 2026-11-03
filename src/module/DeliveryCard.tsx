import { useId } from 'react';
import { Field } from './Field.js';
import { TEXT, type Lang } from './text.js';
import type { OrderDraftHook } from './useOrderDraft.js';

/** Who receives the goods and where (mockup renderDelivery); required only at the customer contract step (plan 03). */
export function DeliveryCard({ hook, lang }: { hook: OrderDraftHook; lang: Lang }) {
  const t = TEXT[lang];
  const id = useId();
  const { order } = hook.draft;
  return (
    <section className="card" aria-labelledby={id}>
      <header className="card-head">
        <h2 id={id}>{t.deliveryCard}</h2>
        <span className="grow" />
        {hook.editor && (
          <>
            <button type="button" className="af-button ghost sm" onClick={() => {
              hook.set('order.receiver_name', order.contact_name);
              hook.set('order.receiver_phone', order.contact_phone);
            }}>{t.receiverIsContact}</button>
            <button type="button" className="af-button ghost sm" onClick={() => hook.set('order.delivery_address', order.address)}>
              {t.addressIsCustomer}</button>
          </>
        )}
      </header>
      <div className="grid">
        <Field hook={hook} path="order.receiver_name" label={t.labels.receiver_name} />
        <Field hook={hook} path="order.receiver_phone" label={t.labels.receiver_phone} />
        <Field hook={hook} path="order.delivery_address" label={t.labels.delivery_address} wide />
        <Field hook={hook} path="order.delivery_note" label={t.labels.delivery_note} wide />
      </div>
    </section>
  );
}
