import { describe, it, expect } from 'vitest';
import { calculateWeightedAverageCost, roundMoney } from '@/lib/utils';

describe('Weighted Average Costing (WAC) Logic', () => {
  it('correctly calculates new average cost when adding stock at a higher unit cost', () => {
    // Current: 10 units @ Rs. 100 = Rs. 1,000
    // Incoming: 10 units @ Rs. 150 = Rs. 1,500
    // Total: 20 units @ (1000 + 1500) / 20 = Rs. 125.00
    const result = calculateWeightedAverageCost(10, 100, 10, 150);
    expect(result.newStock).toBe(20);
    expect(result.newAvgCost).toBe(125);
    expect(result.newStockValue).toBe(2500);
  });

  it('correctly calculates new average cost when adding stock at a lower unit cost', () => {
    // Current: 50 units @ Rs. 200 = Rs. 10,000
    // Incoming: 50 units @ Rs. 100 = Rs. 5,000
    // Total: 100 units @ (10000 + 5000) / 100 = Rs. 150.00
    const result = calculateWeightedAverageCost(50, 200, 50, 100);
    expect(result.newStock).toBe(100);
    expect(result.newAvgCost).toBe(150);
    expect(result.newStockValue).toBe(15000);
  });

  it('handles initial purchase when current stock is zero', () => {
    // Current: 0 units @ Rs. 0
    // Incoming: 25 units @ Rs. 85.50
    const result = calculateWeightedAverageCost(0, 0, 25, 85.5);
    expect(result.newStock).toBe(25);
    expect(result.newAvgCost).toBe(85.5);
    expect(result.newStockValue).toBe(2137.5);
  });

  it('handles fractional quantities without floating point precision issues', () => {
    // Current: 3.5 units @ Rs. 10.25 = Rs. 35.875 -> rounded Rs. 35.88
    // Incoming: 2.5 units @ Rs. 12.75 = Rs. 31.875 -> rounded Rs. 31.88
    // Total: 6.0 units
    const result = calculateWeightedAverageCost(3.5, 10.25, 2.5, 12.75);
    expect(result.newStock).toBe(6);
    expect(result.newAvgCost).toBe(11.29);
    expect(result.newStockValue).toBe(67.74);
  });

  it('handles negative or zero incoming quantities gracefully', () => {
    const result = calculateWeightedAverageCost(10, 50, 0, 0);
    expect(result.newStock).toBe(10);
    expect(result.newAvgCost).toBe(50);
    expect(result.newStockValue).toBe(500);
  });

  it('correctly rounds money values using roundMoney', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1234.567)).toBe(1234.57);
    expect(roundMoney(1234.564)).toBe(1234.56);
    expect(roundMoney(0)).toBe(0);
    expect(roundMoney(NaN)).toBe(0);
  });
});
