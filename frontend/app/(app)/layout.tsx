import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';

// The server-rendered title only. In the browser the shell keeps document.title as
// “{screen} · {group name}” (lib/title.ts): screens name themselves with useDocumentTitle, not metadata.
export const metadata: Metadata = {
  title: { default: 'Fruitfull Footprints', template: '%s · Fruitfull Footprints' },
};

/** Every app screen sits behind the gate and inside the header / tab bar chrome. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
