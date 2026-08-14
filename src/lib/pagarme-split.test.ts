import { describe, expect, it } from "vitest";
import { calculateSplit, getInstallmentTable } from "./pagarme-split";

describe("pagarme split", () => {
  it("keeps the base amount unchanged when surcharge is disabled", () => {
    const result = calculateSplit(10000, 1, false);
    expect(result.totalAmount).toBe(10000);
    expect(result.baseFeeAmount).toBe(0);
    expect(result.installmentSurcharge).toBe(0);
    expect(result.platformAmount + result.sellerAmount).toBe(result.totalAmount);
  });

  it("applies the configured 3% base surcharge in 1x", () => {
    const result = calculateSplit(10000, 1, true);
    expect(result.baseFeeAmount).toBe(300);
    expect(result.installmentSurcharge).toBe(0);
    expect(result.totalAmount).toBe(10300);
    expect(result.platformAmount + result.sellerAmount).toBe(result.totalAmount);
  });

  it("adds 1.10 percentage point per additional installment", () => {
    const one = calculateSplit(10000, 1, true);
    const two = calculateSplit(10000, 2, true);
    const three = calculateSplit(10000, 3, true);
    expect(two.installmentSurcharge).toBe(110);
    expect(three.installmentSurcharge).toBe(220);
    expect(two.totalAmount).toBeGreaterThan(one.totalAmount);
    expect(three.totalAmount).toBeGreaterThan(two.totalAmount);
  });

  it("generates exactly 12 installment options with consistent totals", () => {
    const table = getInstallmentTable(10000, 12);
    expect(table).toHaveLength(12);
    expect(table[0].installments).toBe(1);
    expect(table[11].installments).toBe(12);
    for (const row of table) {
      expect(row.totalAmount).toBeGreaterThanOrEqual(10000);
      expect(row.perInstallment).toBe(Math.round(row.totalAmount / row.installments));
    }
  });
});
