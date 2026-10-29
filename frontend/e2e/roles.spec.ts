// Roles: a leader runs the group; a member reads it, adds prayer, and looks after their own profile and
// the requests about them. Different passwords, different experiences — and the server says no as well
// as the screen. (Rachel, a leader, is every other test's session; Sarah is the member signed in here.)
import type { Member, Snapshot } from '@/lib/types';
import { AUTH_FILE, MEMBER_AUTH_FILE } from './env';
import { ApiError, dialog, expect, expectToast, h1, open, re, test } from './fixtures';

const SARAH = 2;
const MIKE = 3;

/** A browser with nobody signed in (every context here would otherwise start as the project's leader). */
const signedOut = { storageState: { cookies: [], origins: [] } };

// Both projects run at once against one database, so each edits its own field of Sarah's profile.
const FIELD: Record<string, [label: string, key: 'interests' | 'good_to_know']> = {
  mobile: ['Interests', 'interests'],
  desktop: ['Good to know', 'good_to_know'],
};

test.describe('a member', () => {
  test.use({ storageState: MEMBER_AUTH_FILE });

  test('sees the whole group, and only the controls that are theirs', async ({ page }) => {
    await test.step('Our group: no way to add people, and who’s who is marked', async () => {
      await open(page, '/people', 'Our group');
      await expect(page.getByRole('button', { name: 'Add person' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Rachel/ })).toContainText('Leader');
      await expect(page.getByRole('link', { name: /Sarah/ })).toContainText('You');
      await expect(page.getByRole('link', { name: /Mike/ })).toContainText('Leader');
      await expect(page.getByRole('link', { name: /Ben/ })).not.toContainText('Leader');
    });

    await test.step('someone else’s profile: to read, with a way to add a prayer request', async () => {
      await open(page, `/people/${MIKE}`, 'Mike Brennan');
      await expect(page.getByRole('button', { name: 'Add prayer request' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit Mike' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Edit gifts' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Add a date for Mike' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Signing in' })).toHaveCount(0);
      // The dates are still there to read, just not to open.
      await expect(page.getByText('Mike & Lauren’s anniversary')).toBeVisible();
      await expect(page.getByRole('button', { name: /anniversary/ })).toHaveCount(0);
    });

    await test.step('their own profile: theirs to change', async () => {
      await open(page, `/people/${SARAH}`, 'Sarah Lindqvist');
      await expect(page.getByRole('button', { name: 'Edit your profile' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit gifts' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add a date for Sarah' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Signing in' })).toHaveCount(0); // that card is for leaders
    });
  });

  test('edits their own profile, with no say over how anyone signs in', async ({ page, qa }, testInfo) => {
    const [label, key] = FIELD[testInfo.project.name];
    await open(page, `/people/${SARAH}`, 'Sarah Lindqvist');
    const before = (await qa.api.get<Snapshot>('/api/snapshot')).members.find(m => m.id === SARAH)![key];
    const written = qa.name('walks');
    try {
      await page.getByRole('button', { name: 'Edit your profile' }).click();
      const edit = dialog(page, 'Edit Sarah');
      await expect(edit.getByLabel('Name')).toHaveValue('Sarah Lindqvist');
      await expect(edit.getByRole('heading', { name: 'Signing in' })).toHaveCount(0);
      await expect(edit.getByRole('radiogroup', { name: 'Role' })).toHaveCount(0);
      await expect(edit.getByLabel('Password')).toHaveCount(0);
      await expect(edit.getByRole('button', { name: 'Remove from group' })).toHaveCount(0);

      await edit.getByLabel(label, { exact: true }).fill(written);
      const patch = page.waitForRequest(r => r.url().endsWith(`/api/members/${SARAH}`) && r.method() === 'PATCH');
      await edit.getByRole('button', { name: 'Save' }).click();
      const body = (await patch).postDataJSON();
      expect(body).toMatchObject({ [key]: written });
      expect(body).not.toHaveProperty('role');
      expect(body).not.toHaveProperty('password');
      await expectToast(page, 'Saved');
      await expect(page.getByText(written, { exact: true })).toBeVisible();
    } finally {
      await qa.api.patch(`/api/members/${SARAH}`, { [key]: before });
    }
  });

  test('prayer: anyone can add an update, only the person it’s about (or a leader) can answer or edit', async ({ page }) => {
    await open(page, '/prayer', 'Prayer');
    const card = (first: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { level: 2, name: first, exact: true }) });

    await test.step('a request about them', async () => {
      const mine = card('Sarah').first();
      await expect(mine.getByRole('button', { name: 'Add update' })).toBeVisible();
      await expect(mine.getByRole('button', { name: 'Mark answered' })).toBeVisible();
      await expect(mine.getByRole('button', { name: 'Edit Sarah’s request' })).toBeVisible();
    });

    await test.step('a request about someone else', async () => {
      const theirs = card('Mike').first();
      await expect(theirs.getByRole('button', { name: 'Add update' })).toBeVisible();
      await expect(theirs.getByRole('button', { name: 'Mark answered' })).toHaveCount(0);
      await expect(theirs.getByRole('button', { name: 'Edit Mike’s request' })).toHaveCount(0);
    });

    await test.step('anyone can still add a request', async () => {
      await expect(page.getByRole('button', { name: 'Add request' })).toBeVisible();
    });
  });

  test('studies are for reading: no new ones, no drafts, no editor', async ({ page, playwright, baseURL }) => {
    // What a member can't see — a draft study's id — comes from a leader's view of the data.
    const leader = await playwright.request.newContext({ baseURL, storageState: AUTH_FILE, extraHTTPHeaders: { Accept: 'application/json' } });
    const draft = ((await (await leader.get('/api/snapshot')).json()) as Snapshot).studies.find(s => s.status === 'draft')!;
    await leader.dispose();

    await test.step('Studies has the published ones and no way to start another', async () => {
      await open(page, '/studies', 'Studies');
      await expect(page.getByRole('link', { name: 'New study' })).toHaveCount(0);
      await expect(page.getByText('Draft · only visible here')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: draft.ref! })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Romans 8' })).toBeVisible();
    });

    await test.step('the editor says it’s for leaders, for a new study and for an old one', async () => {
      await open(page, '/studies/new', 'That one’s for leaders');
      await open(page, '/studies/1/edit', 'That one’s for leaders');
      await expect(page.getByRole('link', { name: 'Back to Studies' })).toBeVisible();
    });

    await test.step('a published study reads as ever, with no Edit', async () => {
      await open(page, '/studies/1', 'Romans 8');
      await expect(page.getByRole('link', { name: 'Edit study' })).toHaveCount(0);
    });

    await test.step('a draft isn’t there at all', async () => {
      await open(page, `/studies/${draft.id}`, 'This study isn’t here anymore');
    });
  });

  test('settings: who they are and this device, without the group’s details', async ({ page }) => {
    await open(page, '/settings', 'Settings');
    await expect(page.getByRole('form', { name: 'About the group' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Change password' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'On this device' })).toBeVisible();

    const you = page.getByRole('region', { name: 'You’re signed in' });
    await expect(you).toContainText('Sarah Lindqvist');
    await expect(you).toContainText('Member');
    await you.getByRole('link', { name: 'View my profile' }).click();
    await expect(h1(page, 'Sarah Lindqvist')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/people/${SARAH}$`));
  });

  test('the server refuses what the screen leaves out', async ({ qa }) => {
    const refused = async (call: Promise<unknown>) => {
      const e = await call.then(() => null, (x: unknown) => x);
      expect(e, 'the call should have been refused').toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(403);
    };

    await refused(qa.api.patch('/api/settings', { group_name: 'Hijacked' }));
    await refused(qa.api.post('/api/members', { name: qa.name('nope') }));
    await refused(qa.api.patch(`/api/members/${MIKE}`, { name: 'Hijacked' }));
    await refused(qa.api.patch(`/api/members/${SARAH}`, { role: 'leader' }));
    await refused(qa.api.patch(`/api/members/${SARAH}`, { password: 'a-password-of-my-own' }));
    await refused(qa.api.post('/api/studies', { meeting_date: '2030-01-02', status: 'draft', sections: [] }));
    await refused(qa.api.del(`/api/members/${MIKE}`));
    await refused(qa.api.del(`/api/members/${SARAH}`));
    await refused(qa.api.del(`/api/members/${MIKE}/login`));

    // And what they were is unchanged.
    const people = (await qa.api.get<Snapshot>('/api/snapshot')).members;
    expect(people.find(m => m.id === SARAH)).toMatchObject({ role: 'member', name: 'Sarah Lindqvist' });
    expect(people.find(m => m.id === MIKE)).toMatchObject({ role: 'leader', name: 'Mike Brennan' });
    expect(people.every(m => !('has_login' in m)), 'a member is not told who can sign in').toBe(true);
    expect(await qa.api.get<{ viewer: { role: string } }>('/api/group')).toMatchObject({ viewer: { role: 'member' } });
  });
});

test.describe('a leader', () => {
  test('sees the group’s controls, the drafts, and the details of the group', async ({ page }) => {
    await test.step('people', async () => {
      await open(page, '/people', 'Our group');
      await expect(page.getByRole('button', { name: 'Add person' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Rachel/ })).toContainText('You');
      await open(page, `/people/${MIKE}`, 'Mike Brennan');
      await expect(page.getByRole('button', { name: 'Edit Mike' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Signing in' })).toBeVisible();
      await expect(page.getByText('Mike opens the app with a password of their own.')).toBeVisible();
    });

    await test.step('who has no password yet is said, and offered one', async () => {
      await open(page, '/people/4', 'Michael Ortiz');
      await expect(page.getByText('Michael has no password yet, so they can’t open the app.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Give a password' })).toBeVisible();
    });

    await test.step('studies, drafts included', async () => {
      await open(page, '/studies', 'Studies');
      await expect(page.getByRole('link', { name: 'New study' })).toBeVisible();
      await expect(page.getByText('Draft · only visible here').first()).toBeVisible();
    });

    await test.step('settings', async () => {
      await open(page, '/settings', 'Settings');
      await expect(page.getByRole('form', { name: 'About the group' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'You’re signed in' })).toContainText('Leader');
    });
  });

  test('can’t step down, sign themselves out or remove themselves from their own profile', async ({ page }) => {
    await open(page, '/people/1', 'Rachel Owens');
    await page.getByRole('button', { name: 'Edit your profile' }).click();
    const edit = dialog(page, 'Edit Rachel');
    await expect(edit.getByRole('heading', { name: 'Signing in' })).toBeVisible();
    await expect(edit.getByLabel('New password')).toBeVisible(); // she can change her own password
    await expect(edit.getByRole('radiogroup', { name: 'Role' })).toHaveCount(0);
    await expect(edit.getByRole('button', { name: 'Remove sign-in' })).toHaveCount(0);
    await expect(edit.getByRole('button', { name: 'Remove from group' })).toHaveCount(0);
  });

  test('a password someone has, or one that’s too short, is turned down under the field', async ({ page, qa }) => {
    await open(page, '/people', 'Our group');
    await page.getByRole('button', { name: 'Add person' }).click();
    const add = dialog(page, 'Add a person');
    await add.getByLabel('Name').fill(qa.name('Robin'));
    const password = add.getByLabel('Password');

    await password.fill('short');
    await add.getByRole('button', { name: 'Add person' }).click();
    await expect(password).toHaveAttribute('aria-invalid', 'true');
    await expect(password).toHaveAccessibleDescription('Use at least 8 characters.');

    await password.fill('sarah-member'); // Sarah's
    await add.getByRole('button', { name: 'Add person' }).click();
    await expect(password).toHaveAccessibleDescription('Someone else already uses that password. Try another.');
    await expect(password).toBeFocused();
    await expect(add).toBeVisible(); // nobody was added
  });

  test('gives someone a password and a role, and takes their sign-in away again', async ({ page, qa, browser }) => {
    const name = qa.name('Robin');
    const secret = `porch-${qa.uid}-light`;
    await open(page, '/people', 'Our group');

    await test.step('add them, with a password', async () => {
      await page.getByRole('button', { name: 'Add person' }).click();
      const add = dialog(page, 'Add a person');
      await add.getByLabel('Name').fill(name);
      await expect(add.getByRole('radio', { name: 'Member' })).toHaveAttribute('aria-checked', 'true');
      await add.getByLabel('Password').fill(secret);
      const created = qa.created<Member>(page, '/api/members');
      await add.getByRole('button', { name: 'Add person' }).click();
      expect(await created).toMatchObject({ name, role: 'member', has_login: true });
      await expect(h1(page, name)).toBeVisible();
      await expect(page.getByText('QA opens the app with a password of their own.')).toBeVisible();
    });

    // A different device, a different person: the password alone says who it is.
    const them = await browser.newContext({ ...signedOut, extraHTTPHeaders: { 'X-Forwarded-For': `198.51.100.${1 + Math.floor(Math.random() * 254)}` } });
    const theirs = await them.newPage();
    try {
      await test.step('they sign in with it, and see the app as a member', async () => {
        await theirs.goto('/people');
        await theirs.getByLabel('Your password').fill(secret);
        await theirs.getByRole('button', { name: 'Open', exact: true }).click();
        await expect(h1(theirs, 'Our group')).toBeVisible();
        await expect(theirs.getByRole('link', { name: new RegExp(re(qa.uid)) })).toContainText('You');
        await expect(theirs.getByRole('button', { name: 'Add person' })).toHaveCount(0);
      });

      await test.step('made a leader, they get the leaders’ controls without signing in again', async () => {
        await page.getByRole('button', { name: 'Edit QA' }).click();
        const edit = dialog(page, 'Edit QA');
        await edit.getByRole('radio', { name: 'Leader' }).click();
        const patch = page.waitForRequest(r => /\/api\/members\/\d+$/.test(r.url()) && r.method() === 'PATCH');
        await edit.getByRole('button', { name: 'Save' }).click();
        expect((await patch).postDataJSON()).toMatchObject({ role: 'leader' });
        expect((await patch).postDataJSON()).not.toHaveProperty('password'); // left blank: kept as it was
        await expectToast(page, 'Saved');

        await theirs.reload();
        await expect(h1(theirs, 'Our group')).toBeVisible();
        await expect(theirs.getByRole('button', { name: 'Add person' })).toBeVisible();
      });

      await test.step('their sign-in taken away, they’re back at the door', async () => {
        await page.getByRole('button', { name: 'Edit QA' }).click();
        const edit = dialog(page, 'Edit QA');
        await edit.getByRole('button', { name: 'Remove sign-in' }).click();
        await dialog(page, 'Remove QA’s sign-in?').getByRole('button', { name: 'Remove sign-in' }).click();
        await expectToast(page, 'QA can’t sign in anymore');
        await expect(page.getByText('QA has no password yet, so they can’t open the app.')).toBeVisible();

        await theirs.reload();
        await expect(theirs.getByLabel('Your password')).toBeVisible();
      });
    } finally {
      await them.close();
    }
  });
});
