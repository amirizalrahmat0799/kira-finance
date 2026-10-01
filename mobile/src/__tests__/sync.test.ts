import { fromRow, fromWire, toParams, toWire, upsertSql } from '@/db/tables';
import type { Transaction } from '@/db/types';
import { recurringOccurrenceKey, uuidFromSha1Hex, UUID_RE } from '@/lib/ids';
import { shouldApplyRemote } from '@/sync/merge';

const tx: Transaction = {
  id: '3f1c2a7e-8b8a-4c5e-9d7f-1a2b3c4d5e6f',
  accountId: 'acc',
  categoryId: 'cat',
  kind: 'expense',
  amount: 1250,
  note: 'Laksa',
  occurredOn: '2026-10-02',
  recurringId: null,
  updatedAt: 1_790_000_000_000,
  deleted: false,
};

describe('conflict resolution', () => {
  it('takes the server row when there is no local copy or no unsent edit', () => {
    expect(shouldApplyRemote(null, { updatedAt: 1 })).toBe(true);
    expect(shouldApplyRemote({ updatedAt: 999, dirty: false }, { updatedAt: 1 })).toBe(true);
  });

  it('keeps a newer unsent local edit', () => {
    expect(shouldApplyRemote({ updatedAt: 200, dirty: true }, { updatedAt: 100 })).toBe(false);
  });

  it('lets a newer server edit win, and ties go to the server', () => {
    expect(shouldApplyRemote({ updatedAt: 100, dirty: true }, { updatedAt: 200 })).toBe(true);
    expect(shouldApplyRemote({ updatedAt: 100, dirty: true }, { updatedAt: 100 })).toBe(true);
  });
});

describe('table mapping', () => {
  it('round-trips an entity through SQLite parameters and rows', () => {
    const params = toParams('transactions', tx);
    expect(params).toMatchObject({ $id: tx.id, $amount: 1250, $deleted: 0, $occurred_on: '2026-10-02', $recurring_id: null });
    const row = Object.fromEntries(Object.entries(params).map(([k, v]) => [k.slice(1), v]));
    expect(fromRow('transactions', row)).toEqual(tx);
  });

  it('round-trips through the sync wire format', () => {
    const wire = toWire('transactions', tx);
    expect(wire).toMatchObject({ accountId: 'acc', occurredOn: '2026-10-02', deleted: false, recurringId: null });
    expect(fromWire('transactions', JSON.parse(JSON.stringify(wire)))).toEqual(tx);
  });

  it('builds an upsert that also sets the dirty flag', () => {
    expect(upsertSql('budgets')).toBe(
      'INSERT OR REPLACE INTO budgets (id, updated_at, deleted, category_id, amount, dirty) VALUES ($id, $updated_at, $deleted, $category_id, $amount, $dirty)',
    );
  });
});

describe('deterministic ids for recurring bills', () => {
  it('formats a SHA-1 digest as a version 5 UUID', () => {
    const id = uuidFromSha1Hex('2ed6657de927468b55e12665a8aea6a22dee3e35');
    expect(id).toMatch(UUID_RE);
    expect(id[14]).toBe('5');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
    expect(uuidFromSha1Hex('2ed6657de927468b55e12665a8aea6a22dee3e35')).toBe(id);
  });

  it('uses the rule and due date as the key', () => {
    expect(recurringOccurrenceKey('r1', '2026-10-01')).toBe('kira:recurring:r1:2026-10-01');
  });

  it('rejects anything that is not a SHA-1 digest', () => {
    expect(() => uuidFromSha1Hex('abc')).toThrow();
  });
});
