import type { Metadata } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { NotFound } from '@/components/ui/ScreenState';

export const metadata: Metadata = { title: 'Not found · Fruitfull Footprints' };

/** Any URL the app doesn't have: inside the usual chrome (behind the gate), with a way home. */
export default function NotFoundPage() {
  return (
    <AppShell>
      <NotFound />
    </AppShell>
  );
}
