import { describe, expect, it } from "vitest";
import { employmentMonthEligibility, fuelEstimate, payrollRow } from "@/lib/finance";

describe("fuel estimates", () => {
  it("uses whole KM and floors mileage, litres, and fuel rate", () => {
    expect(fuelEstimate(1084.6, 10.8, 91.7)).toEqual({ km: 1085, average: 10, litres: 108, rate: 91, cost: 9828 });
    expect(fuelEstimate(1099, 10.99, 95.99)).toEqual({ km: 1099, average: 10, litres: 109, rate: 95, cost: 10355 });
  });

  it("does not guess missing mileage or rates", () => {
    expect(fuelEstimate(100, null, 90)).toEqual({ km: 100, average: null, litres: null, rate: 90, cost: null });
    expect(fuelEstimate(100, 10, null)).toEqual({ km: 100, average: 10, litres: 10, rate: null, cost: null });
  });
});

describe("employment-clipped payroll", () => {
  it("includes joining and exit dates and caps at 30 days", () => {
    const partial = employmentMonthEligibility({ joiningDate: "2026-08-10", exitDate: "2026-08-20", employmentStatus: "left", sessionStart: "2026-04-01", sessionEnd: "2027-03-31", monthStart: "2026-08-01" });
    expect(partial).toMatchObject({ eligible: true, eligibleDays: 11, start: "2026-08-10", end: "2026-08-20" });
    expect(payrollRow({ monthlySalary: 15000, attendance: [], paid: 0, eligibleDays: partial.eligibleDays }).calculated).toBe(5500);
  });

  it("excludes future months after exit", () => {
    expect(employmentMonthEligibility({ joiningDate: "2026-04-01", exitDate: "2026-09-15", employmentStatus: "left", sessionStart: "2026-04-01", sessionEnd: "2027-03-31", monthStart: "2026-10-01" }).eligibleDays).toBe(0);
  });
});