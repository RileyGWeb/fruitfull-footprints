// What the signed-in person may do, for hiding the controls that would only be refused. The server
// decides for real (backend/app/Policies, the `leader` route gate): keep these rules the same as
// those, and never rely on them for safety.
import type { Prayer, Viewer } from './types.ts';

export type Access = {
  /** super (the hidden admin), leader or member; null when nobody is signed in. */
  role: Viewer['role'] | null;
  /** The signed-in person's profile; null for the super admin or nobody. */
  memberId: number | null;
  /** Leaders, and the super admin. */
  isLeader: boolean;
  isSuper: boolean;
  /** Whether this profile is the signed-in person's own. */
  isMe: (memberId: number) => boolean;
  /** Add and remove people, hand out logins, change the group's details, write studies. */
  canEditPerson: (memberId: number) => boolean;
  /** Edit, answer, reopen or delete a request, or remove an update: leaders, and the person it's about. */
  canManagePrayer: (prayer: Pick<Prayer, 'member_id'>) => boolean;
};

export function accessFor(viewer: Viewer | null | undefined): Access {
  const role = viewer?.role ?? null;
  const memberId = viewer?.member_id ?? null;
  const isLeader = role === 'leader' || role === 'super';
  const isMe = (id: number) => memberId !== null && memberId === id;
  return {
    role,
    memberId,
    isLeader,
    isSuper: role === 'super',
    isMe,
    canEditPerson: id => isLeader || isMe(id),
    canManagePrayer: prayer => isLeader || isMe(prayer.member_id),
  };
}

/** “Leader”, “Member” or “Site admin”, for saying who is signed in. */
export function roleLabel(role: Viewer['role']): string {
  return role === 'super' ? 'Site admin' : role === 'leader' ? 'Leader' : 'Member';
}
