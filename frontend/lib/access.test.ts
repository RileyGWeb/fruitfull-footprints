import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accessFor, roleLabel } from './access.ts';
import type { Viewer } from './types.ts';

const leader: Viewer = { role: 'leader', member_id: 1, name: 'Rachel Owens' };
const member: Viewer = { role: 'member', member_id: 2, name: 'Sarah Lindqvist' };
const admin: Viewer = { role: 'super', member_id: null, name: null };

describe('accessFor', () => {
  it('lets a leader do everything', () => {
    const a = accessFor(leader);
    assert.equal(a.isLeader, true);
    assert.equal(a.isSuper, false);
    assert.equal(a.canEditPerson(1), true);
    assert.equal(a.canEditPerson(99), true);
    assert.equal(a.canManagePrayer({ member_id: 99 }), true);
  });

  it('lets the super admin do everything without being anyone', () => {
    const a = accessFor(admin);
    assert.equal(a.isLeader, true);
    assert.equal(a.isSuper, true);
    assert.equal(a.memberId, null);
    assert.equal(a.isMe(1), false);
    assert.equal(a.canEditPerson(1), true);
    assert.equal(a.canManagePrayer({ member_id: 1 }), true);
  });

  it('keeps a member to their own profile and the requests about them', () => {
    const a = accessFor(member);
    assert.equal(a.isLeader, false);
    assert.equal(a.isMe(2), true);
    assert.equal(a.isMe(1), false);
    assert.equal(a.canEditPerson(2), true);
    assert.equal(a.canEditPerson(1), false);
    assert.equal(a.canManagePrayer({ member_id: 2 }), true);
    assert.equal(a.canManagePrayer({ member_id: 1 }), false);
  });

  it('gives nobody signed in no powers', () => {
    for (const a of [accessFor(null), accessFor(undefined)]) {
      assert.equal(a.role, null);
      assert.equal(a.isLeader, false);
      assert.equal(a.isMe(0), false);
      assert.equal(a.canEditPerson(1), false);
      assert.equal(a.canManagePrayer({ member_id: 1 }), false);
    }
  });
});

describe('roleLabel', () => {
  it('names each role', () => {
    assert.equal(roleLabel('member'), 'Member');
    assert.equal(roleLabel('leader'), 'Leader');
    assert.equal(roleLabel('super'), 'Site admin');
  });
});
