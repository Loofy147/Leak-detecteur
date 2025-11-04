// lib/recurring_charges.test.js
import { detectRecurringCharges } from './recurring_charges';

describe('detectRecurringCharges', () => {

  it('should return an empty array if no transactions are provided', () => {
    expect(detectRecurringCharges([])).toEqual([]);
  });

  it('should not identify recurring charges if there are less than 3 transactions for a merchant', () => {
    const transactions = [
      { merchant_name: 'Netflix', date: '2023-01-15', amount: 15.99 },
      { merchant_name: 'Netflix', date: '2023-02-15', amount: 15.99 },
    ];
    expect(detectRecurringCharges(transactions)).toEqual([]);
  });

  it('should identify monthly recurring charges', () => {
    const transactions = [
      { merchant_name: 'Spotify', date: '2023-01-10', amount: 9.99 },
      { merchant_name: 'Spotify', date: '2023-02-11', amount: 9.99 },
      { merchant_name: 'Spotify', date: '2023-03-10', amount: 9.99 },
    ];
    const result = detectRecurringCharges(transactions);
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('spotify');
    expect(result[0].frequency).toBe('monthly');
    expect(result[0].chargeCount).toBe(3);
  });

  it('should identify annual recurring charges', () => {
    const transactions = [
      { merchant_name: 'Amazon Prime', date: '2021-01-15', amount: 119.00 },
      { merchant_name: 'Amazon Prime', date: '2022-01-14', amount: 119.00 },
      { merchant_name: 'Amazon Prime', date: '2023-01-15', amount: 119.00 },
    ];
    const result = detectRecurringCharges(transactions);
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('amazon prime');
    expect(result[0].frequency).toBe('annual');
    expect(result[0].chargeCount).toBe(3);
  });

  it('should not identify recurring charges if the interval is inconsistent', () => {
    const transactions = [
      { merchant_name: 'Gym', date: '2023-01-01', amount: 50.00 },
      { merchant_name: 'Gym', date: '2023-02-01', amount: 50.00 },
      { merchant_name: 'Gym', date: '2023-04-01', amount: 50.00 },
    ];
    expect(detectRecurringCharges(transactions)).toEqual([]);
  });

  it('should handle multiple merchants correctly', () => {
    const transactions = [
      // Netflix (monthly)
      { merchant_name: 'Netflix', date: '2023-01-15', amount: 15.99 },
      { merchant_name: 'Netflix', date: '2023-02-15', amount: 15.99 },
      { merchant_name: 'Netflix', date: '2023-03-15', amount: 15.99 },
      // Adobe (annual)
      { merchant_name: 'Adobe', date: '2021-06-01', amount: 599.88 },
      { merchant_name: 'Adobe', date: '2022-06-01', amount: 599.88 },
      { merchant_name: 'Adobe', date: '2023-06-01', amount: 599.88 },
      // Uber (not recurring)
      { merchant_name: 'Uber', date: '2023-03-01', amount: 25.11 },
      { merchant_name: 'Uber', date: '2023-03-05', amount: 12.54 },
    ];
    const result = detectRecurringCharges(transactions);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.merchant === 'netflix').frequency).toBe('monthly');
    expect(result.find(r => r.merchant === 'adobe').frequency).toBe('annual');
  });

  it('should identify weekly recurring charges', () => {
    const transactions = [
      { merchant_name: 'Meal Prep Service', date: '2023-01-07', amount: 75.00 },
      { merchant_name: 'Meal Prep Service', date: '2023-01-14', amount: 75.00 },
      { merchant_name: 'Meal Prep Service', date: '2023-01-21', amount: 75.00 },
    ];
    const result = detectRecurringCharges(transactions);
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('meal prep service');
    expect(result[0].frequency).toBe('weekly');
    expect(result[0].chargeCount).toBe(3);
  });
});
