import { describe, it, expect } from 'vitest';
import {
  rupeesToPaisa,
  paisaToRupees,
  formatPaisa,
  parseInputToPaisa,
  calculateNetProfitPaisa,
} from '../src/lib/money';

describe('Integer Paisa Money Engine', () => {
  it('accurately converts rupees to integer paisa without floating point flaws', () => {
    expect(rupeesToPaisa(300)).toBe(30000);
    expect(rupeesToPaisa(200000)).toBe(20000000);
    expect(rupeesToPaisa(12.50)).toBe(1250);
    expect(rupeesToPaisa(0.05)).toBe(5);
  });

  it('accurately converts integer paisa back to rupees', () => {
    expect(paisaToRupees(30000)).toBe(300);
    expect(paisaToRupees(20000000)).toBe(200000);
    expect(paisaToRupees(1250)).toBe(12.5);
  });

  it('formats paisa into Pakistani Rupee currency strings', () => {
    expect(formatPaisa(30000)).toBe('Rs 300');
    expect(formatPaisa(20000000)).toBe('Rs 200,000');
    expect(formatPaisa(1250, { showPaisaIfFraction: true })).toBe('Rs 12.50');
    expect(formatPaisa(1250)).toBe('Rs 13'); // rounded when showPaisaIfFraction is false
  });

  it('parses noisy text amount inputs into integer paisa', () => {
    expect(parseInputToPaisa('300')).toEqual({ paisa: 30000, isValid: true });
    expect(parseInputToPaisa('200,000')).toEqual({ paisa: 20000000, isValid: true });
    expect(parseInputToPaisa('Rs. 500/-')).toEqual({ paisa: 50000, isValid: true });
    expect(parseInputToPaisa('pkr 1250')).toEqual({ paisa: 125000, isValid: true });
    expect(parseInputToPaisa('0')).toEqual({ paisa: 0, isValid: false, error: 'Amount must be greater than zero' });
    expect(parseInputToPaisa('-500')).toEqual({ paisa: 0, isValid: false, error: 'Amount must be greater than zero' });
    expect(parseInputToPaisa('abc')).toEqual({ paisa: 0, isValid: false, error: 'Invalid number format: "abc"' });
  });

  it('enforces net profit invariant: Profit = Income - Expense', () => {
    const income = rupeesToPaisa(5500); // Rs 5,500
    const expense = rupeesToPaisa(2000); // Rs 2,000
    const netProfit = calculateNetProfitPaisa(income, expense);

    expect(netProfit).toBe(350000); // Rs 3,500
    expect(paisaToRupees(netProfit)).toBe(3500);

    // Verify capital and withdrawals have zero impact on profit calculation
    const capitalIn = rupeesToPaisa(50000);
    const withdrawal = rupeesToPaisa(10000);

    // Net profit remains strictly 3500
    expect(calculateNetProfitPaisa(income, expense)).toBe(350000);
  });
});
