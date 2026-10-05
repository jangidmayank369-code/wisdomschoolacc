import { describe, expect, it } from "vitest";
import { employmentMonthEligibility, fuelEstimate, payrollRow } from "@/lib/finance";
import { salaryInr } from "@/lib/format";

describe("fuel estimates", () => {
  it("floors mileage and litres but keeps the exact monthly fuel rate", () => {
    expect(fuelEstimate(1085, 10.8, 91.7)).toEqual({ km: 1085, average: 10, litres: 108, rate: 91.7, cost: 9903.6 });
    expect(fuelEstimate(1099, 10.99, 95.99)).toEqual({ km: 1099, average: 10, litres: 109, rate: 95.99, cost: 10462.91 });
    expect(fuelEstimate(80, 8, 94.5)).toEqual({ km: 80, average: 8, litres: 10, rate: 94.5, cost: 945 });
  });

  it("does not guess missing mileage or rates", () => {
    expect(fuelEstimate(100, null, 90)).toEqual({ km: 100, average: null, litres: null, rate: 90, cost: null });
    expect(fuelEstimate(100, 10, null)).toEqual({ km: 100, average: 10, litres: 10, rate: null, cost: null });
  });
});

describe("employment-clipped payroll", () => {
  it("pays 30 days for full February while preserving partial employment and absence rules", () => {
    const opts = { joiningDate: "2025-04-01", exitDate: null, employmentStatus: "active", sessionStart: "2025-04-01", sessionEnd: "2026-03-31", monthStart: "2026-02-01" };
    const full = employmentMonthEligibility(opts);
    expect(full.eligibleDays).toBe(30);
    expect(payrollRow({ monthlySalary: 14000, attendance: [], paid: 0, eligibleDays: full.eligibleDays })).toMatchObject({ paidDays: 30, due: 14000 });
    expect(employmentMonthEligibility({ ...opts, joiningDate: "2026-02-01" }).eligibleDays).toBe(30);
    expect(employmentMonthEligibility({ ...opts, joiningDate: "2026-02-10" }).eligibleDays).toBe(19);
    expect(employmentMonthEligibility({ ...opts, exitDate: "2026-02-15" }).eligibleDays).toBe(15);
    expect(payrollRow({ monthlySalary: 14000, attendance: [{ date: "2026-02-02", status: "absent" }, { date: "2026-02-03", status: "absent" }], paid: 0, eligibleDays: 30 }).paidDays).toBe(29);
    expect(salaryInr(14000.27)).toBe("₹14,000");
    expect(salaryInr(0.21)).toBe("₹0");
    expect(salaryInr(35317.5)).toBe("₹35,318");
  });
  it("includes joining and exit dates and caps at 30 days", () => {
    const partial = employmentMonthEligibility({ joiningDate: "2026-08-10", exitDate: "2026-08-20", employmentStatus: "left", sessionStart: "2026-04-01", sessionEnd: "2027-03-31", monthStart: "2026-08-01" });
    expect(partial).toMatchObject({ eligible: true, eligibleDays: 11, start: "2026-08-10", end: "2026-08-20" });
    expect(payrollRow({ monthlySalary: 15000, attendance: [], paid: 0, eligibleDays: partial.eligibleDays }).calculated).toBe(5500);
  });

  it("excludes future months after exit", () => {
    expect(employmentMonthEligibility({ joiningDate: "2026-04-01", exitDate: "2026-09-15", employmentStatus: "left", sessionStart: "2026-04-01", sessionEnd: "2027-03-31", monthStart: "2026-10-01" }).eligibleDays).toBe(0);
  });
});