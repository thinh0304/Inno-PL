import type { ReactNode } from 'react';
import type { CaseStatus } from './cases-api.js';

// Lucide's shapes, drawn in currentColor. Every icon is decoration: the words beside it carry the meaning.
function Icon({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const PlusIcon = () => <Icon size={16}><path d="M5 12h14" /><path d="M12 5v14" /></Icon>;

export const FlagIcon = () => (
  <Icon size={12}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></Icon>
);

export const InboxIcon = () => (
  <Icon size={32}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </Icon>
);

export const AlertIcon = () => (
  <Icon size={32}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </Icon>
);

export function StatusIcon({ status }: { status: CaseStatus }) {
  return (
    <Icon size={12}>
      <circle cx="12" cy="12" r="10" />
      {status === 'approved' && <path d="m9 12 2 2 4-4" />}
      {status === 'rejected' && <><path d="m15 9-6 6" /><path d="m9 9 6 6" /></>}
    </Icon>
  );
}
