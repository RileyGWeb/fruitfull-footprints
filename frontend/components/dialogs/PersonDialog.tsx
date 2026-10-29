'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useId, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import ui from '@/components/ui/Dialog.module.css';
import { radioGroup } from '@/components/ui/radioGroup';
import { useActions } from '@/lib/actions';
import { fieldErrors } from '@/lib/api';
import { leaveTo } from '@/lib/historyGuard';
import { useAccess, useSnapshot } from '@/lib/hooks';
import { TONE_ORDER, firstName, nextTone } from '@/lib/members';
import type { Member, MemberInput, Role, Tone } from '@/lib/types';
import { useDialogs } from './context';
import { FieldError, describedBy, focusFirstError, otherErrors, without, type Errors } from './FieldError';
import d from './dialogs.module.css';

const TONE_LABEL: Record<Tone, string> = { sage: 'Sage', accent: 'Peach', sand: 'Sand' };
const ABOUT = [
  ['family', 'Family', 'e.g. Married to Tom · two boys, Eli and Sam'],
  ['interests', 'Interests', 'e.g. Gardening, long walks'],
  ['good_to_know', 'Good to know', 'e.g. Prefers texts over calls'],
] as const;
const SHOWN = ['name', 'tone', 'line', 'family', 'interests', 'good_to_know', 'role', 'password'] as const;
const ROLES: Role[] = ['member', 'leader'];
const ROLE_LABEL: Record<Role, string> = { member: 'Member', leader: 'Leader' };

type Props = { member?: Member; layer?: number; onDone: (m: Member | null) => void };

/**
 * Gap-fill: add a person (then open their profile) or edit one, with “Remove from group”.
 *
 * Leaders also set how someone signs in: their role and a password of their own (only that password
 * is typed to open the app, so it can't be anyone else's). A member editing their own profile sees
 * the profile fields only; a leader can't step down, remove or sign out themselves from here.
 */
export function PersonDialog({ member, layer = 0, onDone }: Props) {
  const count = useSnapshot().data?.members.length ?? 0;
  const actions = useActions();
  const access = useAccess();
  const { confirm } = useDialogs();
  const router = useRouter();
  const id = useId();
  const ids = Object.fromEntries(SHOWN.map(k => [k, `${id}-${k}`]));
  const [form, setForm] = useState<Required<Omit<MemberInput, 'gifts' | 'role' | 'password'>>>(() => ({
    name: member?.name ?? '',
    tone: member?.tone ?? nextTone(count),
    line: member?.line ?? '',
    family: member?.family ?? '',
    interests: member?.interests ?? '',
    good_to_know: member?.good_to_know ?? '',
  }));
  const [role, setRole] = useState<Role>(member?.role ?? 'member');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const editingSelf = !!member && access.isMe(member.id);
  const hasLogin = !!member?.has_login;
  const canChangeRole = access.isLeader && !editingSelf;
  const first = member ? firstName(member) : 'they';
  const set = (patch: Partial<typeof form>) => {
    setForm(f => ({ ...f, ...patch }));
    setErrors(e => Object.keys(patch).reduce(without, e));
  };
  const blank = (v: string | null) => v?.trim() || null;
  const tone = radioGroup(TONE_ORDER, form.tone, t => set({ tone: t }));
  const pickRole = radioGroup(ROLES, role, r => { setRole(r); setErrors(e => without(e, 'role')); });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name || busy) return;
    const input: MemberInput = {
      name, tone: form.tone, line: blank(form.line), family: blank(form.family), interests: blank(form.interests), good_to_know: blank(form.good_to_know),
      // Only what a leader chose to change goes up: a role that moved, a password that was typed.
      ...(canChangeRole && role !== (member?.role ?? 'member') ? { role } : {}),
      ...(access.isLeader && password.trim() ? { password: password.trim() } : {}),
    };
    setBusy(true);
    try {
      if (member) {
        onDone(await actions.updateMember(member.id, input));
      } else {
        const created = await actions.addMember(input);
        leaveTo(router, `/people/${created.id}`); // takes over the dialog's history entry
        onDone(created);
      }
    } catch (ex) {
      setBusy(false);
      const fe = fieldErrors(ex);
      if (fe) {
        setErrors(fe);
        focusFirstError(fe, ids);
      }
    }
  };

  const remove = async () => {
    if (!member || busy) return;
    const ok = await confirm({ title: `Remove ${firstName(member)}?`, body: 'Their prayer requests and dates will be removed too.', confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await actions.deleteMember(member);
      leaveTo(router, '/people');
      onDone(null);
    } catch {
      setBusy(false);
    }
  };

  const removeSignIn = async () => {
    if (!member || busy) return;
    const ok = await confirm({
      title: `Remove ${first}’s sign-in?`,
      body: 'They stay in the group, but can’t open the app until you give them a new password.',
      confirmLabel: 'Remove sign-in',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await actions.removeLogin(member);
      onDone(null);
    } catch {
      setBusy(false);
    }
  };

  const preview = { id: member?.id ?? 0, name: form.name.trim() || '?' };
  const err = (k: string) => <FieldError id={`${ids[k]}-err`} text={errors[k]} />;

  return (
    <Dialog open layer={layer} onClose={() => onDone(null)} title={member ? `Edit ${firstName(member)}` : 'Add a person'}>
      <form className={d.form} onSubmit={submit}>
        <div className="field">
          <label htmlFor={ids.name}>Name</label>
          <input id={ids.name} className={`input ${d.control}`} placeholder="First and last name" value={form.name} onChange={e => set({ name: e.target.value })}
            maxLength={120} required autoComplete="off" {...describedBy(`${ids.name}-err`, errors.name)} />
        </div>
        {err('name')}
        <div className="field">
          <label id={ids.tone}>Color</label>
          <div className={d.tones} role="radiogroup" aria-labelledby={ids.tone}>
            {TONE_ORDER.map((t, i) => (
              <button key={t} type="button" {...tone(t)} aria-label={TONE_LABEL[t]} title={TONE_LABEL[t]}
                className={`unstyled ${d.tone} ${form.tone === t ? d.toneOn : ''}`}>
                <Avatar member={{ ...preview, id: member ? preview.id : i, tone: t }} size={50} />
              </button>
            ))}
          </div>
        </div>
        {err('tone')}
        <div className="field">
          <label htmlFor={ids.line}>One line about them</label>
          <input id={ids.line} className={`input ${d.control}`} placeholder="Hosts most weeks. Grows far too many tomatoes." value={form.line ?? ''}
            onChange={e => set({ line: e.target.value })} maxLength={280} {...describedBy(`${ids.line}-err`, errors.line)} />
        </div>
        {err('line')}
        {ABOUT.map(([key, label, ph]) => (
          <Fragment key={key}>
            <div className="field">
              <label htmlFor={ids[key]}>{label}</label>
              <textarea id={ids[key]} className={`input ${d.note}`} placeholder={ph} value={form[key] ?? ''} onChange={e => set({ [key]: e.target.value })}
                maxLength={1000} rows={2} {...describedBy(`${ids[key]}-err`, errors[key])} />
            </div>
            {err(key)}
          </Fragment>
        ))}
        {access.isLeader && (
          <section className={d.signin} aria-labelledby={`${id}-signin`}>
            <h3 id={`${id}-signin`} className={d.signinTitle}>Signing in</h3>
            {canChangeRole && (
              <>
                <div className="field">
                  <label id={ids.role}>Role</label>
                  <div className={d.kinds} role="radiogroup" aria-labelledby={ids.role} aria-describedby={`${ids.role}-note`}>
                    {ROLES.map(r => (
                      <button key={r} type="button" {...pickRole(r)} className={`unstyled ${d.kind} ${role === r ? d.kindOn : ''}`}>{ROLE_LABEL[r]}</button>
                    ))}
                  </div>
                </div>
                {errors.role
                  ? <FieldError id={`${ids.role}-note`} text={errors.role} />
                  : <p id={`${ids.role}-note`} className={d.hint}>Leaders add and remove people, write the studies and give out passwords.</p>}
              </>
            )}
            <div className="field">
              <label htmlFor={ids.password}>{hasLogin ? 'New password' : 'Password'}</label>
              <input id={ids.password} className={`input ${d.control}`} type="text" value={password} maxLength={64}
                placeholder={hasLogin ? 'Leave blank to keep it' : 'At least 8 characters'}
                autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={e => { setPassword(e.target.value); setErrors(x => without(x, 'password')); }}
                aria-describedby={`${ids.password}-note`} aria-invalid={errors.password ? true : undefined} />
            </div>
            {errors.password
              ? <FieldError id={`${ids.password}-note`} text={errors.password} />
              : <p id={`${ids.password}-note`} className={d.hint}>{passwordHint(member, editingSelf, hasLogin)}</p>}
            {member && hasLogin && !editingSelf && (
              <button type="button" className={`btn btn-ghost ${ui.quiet}`} onClick={removeSignIn} aria-disabled={busy || undefined}>Remove sign-in</button>
            )}
          </section>
        )}
        <FieldError text={otherErrors(errors, SHOWN)} />
        {member && access.isLeader && !editingSelf && <button type="button" className={`btn btn-ghost ${ui.quiet}`} onClick={remove} aria-disabled={busy || undefined}>Remove from group</button>}
        <div className="dialog-actions">
          <button type="button" className={`btn btn-ghost ${ui.cancel}`} onClick={() => onDone(null)}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${ui.submit}`} disabled={!form.name.trim()} aria-disabled={busy || undefined}>{member ? 'Save' : 'Add person'}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** The quiet line under the password: what it does, said for this person. */
function passwordHint(member: Member | undefined, editingSelf: boolean, hasLogin: boolean): string {
  if (!member) return 'Optional, and you can add it later. It’s all they’ll type to open the app, so it has to be one nobody else uses.';
  if (editingSelf) return 'Leave it blank to keep yours. A new one signs your other devices out.';
  const first = firstName(member);
  return hasLogin
    ? `Leave it blank to keep ${first}’s. A new one signs them out everywhere else.`
    : `${first} can’t open the app yet. It’s all they’ll type to sign in, so it has to be one nobody else uses.`;
}
