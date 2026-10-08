import type { IconName } from '@/components/ui/Icon';
import type { Member, StudySummary } from '@/lib/types';

export type NavKey = 'home' | 'people' | 'prayer' | 'studies';

export const NAV: { key: NavKey; label: string; href: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', href: '/', icon: 'home' },
  { key: 'people', label: 'People', href: '/people', icon: 'users' },
  { key: 'prayer', label: 'Prayer', href: '/prayer', icon: 'heart' },
  { key: 'studies', label: 'Studies', href: '/studies', icon: 'book' },
];

/** Which tab a path belongs to (/people/12 → people); null for /settings and friends. */
export function activeNav(path: string | null): NavKey | null {
  if (!path || path === '/') return 'home';
  return NAV.find(n => n.href !== '/' && (path === n.href || path.startsWith(`${n.href}/`)))?.key ?? null;
}

type Known = { members: Pick<Member, 'id' | 'name'>[]; studies: Pick<StudySummary, 'id' | 'ref' | 'status'>[] };

/**
 * The shell's default document-title label for a route (formatted “{label} · {group}” by lib/title):
 * null for Home (just the group name). A person's or study's name when the snapshot has it, else the
 * section. Screens can name themselves more precisely with useDocumentTitle.
 */
export function routeTitle(path: string | null, known?: Known | null): string | null {
  const [section, id, sub] = (path ?? '/').split('/').filter(Boolean);
  switch (section) {
    case undefined:
      return null;
    case 'people':
      if (!id) return 'People';
      if (id === 'dates') return 'Dates to remember';
      return known?.members.find(m => String(m.id) === id)?.name ?? 'People';
    case 'prayer':
      return id === 'answered' ? 'Answered prayers' : 'Prayer';
    case 'studies': {
      if (!id) return 'Studies';
      if (id === 'new') return 'New study';
      const study = known?.studies.find(s => String(s.id) === id);
      const ref = study?.ref?.trim();
      if (sub === 'edit') return ref ? `${study?.status === 'draft' ? 'Preparing' : 'Editing'} ${ref}` : 'Edit study';
      return ref || 'Study';
    }
    case 'settings':
      return 'Settings';
    default:
      return null;
  }
}
