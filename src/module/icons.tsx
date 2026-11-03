import type { ReactNode } from 'react';

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

export const ChevronIcon = ({ open }: { open: boolean }) => (
  <Icon size={14}>{open ? <path d="m6 9 6 6 6-6" /> : <path d="m9 18 6-6-6-6" />}</Icon>
);

export const TrashIcon = () => (
  <Icon size={14}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Icon>
);

export const CheckIcon = () => <Icon size={14}><path d="M20 6 9 17l-5-5" /></Icon>;

export const XIcon = () => <Icon size={14}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>;
