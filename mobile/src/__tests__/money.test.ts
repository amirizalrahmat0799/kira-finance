import { formatCompact, formatMoney, parseAmount, toInput } from '@/lib/money';

describe('parseAmount', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.01', 1],
    ['1,234.56', 123456],
    [' RM 8 ', 800],
  ])('parses %p as %p sen', (input, sen) => {
    expect(parseAmount(input)).toBe(sen);
  });

  it.each(['', '0', '0.00', '-5', '1.234', 'abc', '1.2.3', '12.'.repeat(2)])('rejects %p', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it('never goes through floating point (0.29 * 100 = 28.999999999999996)', () => {
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('19.99')).toBe(1999);
  });
});

describe('formatting', () => {
  it('formats ringgit with thousands separators', () => {
    expect(formatMoney(123456)).toBe('RM 1,234.56');
    expect(formatMoney(5)).toBe('RM 0.05');
    expect(formatMoney(-50000)).toBe('-RM 500.00');
  });

  it('shortens large values for chart labels', () => {
    expect(formatCompact(1250000)).toBe('RM 12.5k');
    expect(formatCompact(300000000)).toBe('RM 3m');
    expect(formatCompact(4500)).toBe('RM 45');
  });

  it('round-trips through the edit field', () => {
    expect(parseAmount(toInput(1999))).toBe(1999);
  });
});
