# Targeted payment-month and staff-finance correction

## Scope and safety
- Make no historical payment, payroll, fuel, Accounts, staff, vehicle, attendance, fee, or KM data changes.
- Before the additive schema change, verify the existing public-data snapshot; if a fresh backup cannot be created with the established safe method, stop before migration and report the blocker.
- Add only a nullable, backward-compatible `for_month` field to fuel/transport payments. Do not backfill it from payment dates or guess historical months.

## Changes
1. **Fuel/transport payment month**
   - Add nullable `for_month` to existing fuel/transport expenses.
   - Show separate **Payment Date** and **For Month** fields in the existing entry form and list.
   - Require **For Month** for new fuel payments while preserving old rows with no stored month.
   - Group fuel summaries by stored `for_month`; legacy rows without one continue using their payment date, clearly as a compatibility fallback.
   - Keep Accounts entries dated by actual Payment Date; do not recreate or alter ledger rows.

2. **Salary cycle and fixed 30-day month**
   - Keep the existing salary `payroll_month` as its **For Month** field and actual `payment_date` separately.
   - Default Payroll to the latest completed month, not the current month.
   - Prevent normal payment of the current/future salary month unless an explicit saved payroll correction exists; preserve all historical rows.
   - Keep February/full-month eligibility at 30 salary days, with existing join, exit, leave, and absence rules.

3. **Unified staff financial summary**
   - Keep the existing Staff Profile layout and aggregation.
   - Show top totals: Total Due, Total Paid, Net Balance; show Net Credit / Overpayment when paid exceeds due.
   - Show signed category balances and explicit credits for Salary and Fuel.
   - Include every matching salary payment and every matching vehicle/staff-linked fuel payment, grouped by its stored For Month.
   - For Other Payments, follow the selected safe rule: show only explicitly staff-linked amounts paid; keep Due and Balance as “Not recorded.”
   - Display all staff financial amounts as rounded whole rupees without changing stored values.

4. **Dashboard association**
   - Keep Total Collection, Total Expenses, Net Balance, and Accounts charts based on actual transaction dates.
   - Make salary overview use salary `payroll_month` and exclude unpaid/unrecorded current-month salary until payable.
   - Use fuel `for_month` only in fuel/staff monthly summaries, not to rewrite the actual Accounts date.

## Verification
- Run the existing focused finance checks for February and whole-rupee display, then run only typecheck and build.
- Verify: full February = 30 days; October is not a normal payable month on 6 October; 6 October payment for September appears under September; salary and fuel overpayments show credits; multiple linked payments are summed.
- Report files changed, schema changes, and exact counts of records created, modified, deleted, and duplicated (all expected zero).
