import { sharesForTotal } from './autosplit.service';
import type { AutoSplitParticipant } from './auto-split-rule.entity';

const person = (name: string, share: number): AutoSplitParticipant => ({
  name,
  initials: name.charAt(0),
  phone: '+2348000000000',
  isGTUser: false,
  share,
});

const sum = (shares: number[]) => Math.round(shares.reduce((a, b) => a + b, 0) * 100) / 100;

describe('sharesForTotal', () => {
  // The narration is the trigger, so the new total rarely equals the remembered
  // one. These tests pin the two things that must never drift: every share is
  // money to the kobo, and the shares plus the host's remainder add up to the
  // amount that actually left the account.

  it('divides an equal split by the group plus the host, whatever the new total', () => {
    const shares = sharesForTotal([person('A', 50000), person('B', 50000)], 'equal', 4000, 100000);

    expect(shares).toEqual([1333.33, 1333.33]);
    // The host absorbs the rounding, exactly like createSplit does.
    expect(sum(shares)).toBe(2666.66);
  });

  it('keeps an equal split even when nobody was remembered with a share', () => {
    const shares = sharesForTotal([person('A', 0), person('B', 0)], 'equal', 900, 0);

    expect(shares).toEqual([300, 300]);
  });

  it('rescales a custom split to the new total, keeping the proportions', () => {
    // Remembered 7,000 of 10,000 across three people: 70/20/10.
    const shares = sharesForTotal(
      [person('A', 7000), person('B', 2000), person('C', 1000)],
      'custom',
      4000,
      10000,
    );

    expect(shares).toEqual([2800, 800, 400]);
    expect(sum(shares)).toBe(4000);
  });

  it('gives the rounding remainder to the biggest share so the split sums exactly', () => {
    // A third each of 3 scaled up to 10 is 3.33 per person: 9.99 assigned, so
    // the last kobo has to land on one of them or the group is short.
    const shares = sharesForTotal(
      [person('A', 1), person('B', 1), person('C', 1)],
      'custom',
      10,
      3,
    );

    expect(shares).toEqual([3.34, 3.33, 3.33]);
    expect(sum(shares)).toBe(10);
  });

  it('still sums exactly on a total that cannot be split cleanly', () => {
    const shares = sharesForTotal(
      [person('A', 333.33), person('B', 333.33), person('C', 333.34)],
      'custom',
      777.77,
      1000,
    );

    expect(shares).toEqual([259.25, 259.25, 259.27]);
    expect(sum(shares)).toBe(777.77);
  });

  it('survives a total that does not divide evenly at all', () => {
    const shares = sharesForTotal([person('A', 500), person('B', 500)], 'custom', 10, 1000);

    expect(sum(shares)).toBe(10);
    shares.forEach((share) => expect(Number.isFinite(share)).toBe(true));
  });

  it('falls back to an equal split when there is no remembered total to scale from', () => {
    const shares = sharesForTotal([person('A', 700), person('B', 200)], 'custom', 1000, 0);

    expect(shares).toEqual([333.33, 333.33]);
  });

  it('never proposes a split with nobody in it', () => {
    expect(sharesForTotal([], 'equal', 5000, 5000)).toEqual([]);
    expect(sharesForTotal([], 'custom', 5000, 5000)).toEqual([]);
  });
});