# Safe Transport, Payroll, and Exit-Date Fix

## Scope
- Preserve every existing staff, vehicle, KM, expense, salary payment, payroll, and Accounts record.
- Extend the already-installed mileage and monthly fuel-rate system; keep the deprecated fuel-per-KM field stored but unused.
- Add session-specific employment exit dates and apply them only to payroll eligibility and new calculations.

## Before changes
1. Export a fresh full business-data snapshot using the ERP’s established backup format.
2. Record baseline counts, duplicates, Accounts links, fuel/KM totals, and payroll rows.
3. Produce a dry-run report identifying:
   - historical payroll rows after a known exit date,
   - fuel months missing a vehicle average or monthly rate,
   - derived fuel summaries that will display differently.
4. Do not modify actual payments, expenses, Accounts, KM logs, or existing payroll rows during this analysis.

## Database safety
- Add nullable `exit_date` to each session-specific employment record.
- Add database validation so exit date cannot precede joining date, must lie in the employment session, active requires no exit date, and left requires an exit date.
- Keep inactive records nullable; never infer an exit date.
- Preserve unique staff/session, vehicle/session, vehicle/session/date, and payroll-month protections.
- Audit employment changes, including exit-date updates.

## Payroll
- Centralize eligible date-range and eligible-day calculations in the existing finance module.
- Determine each month’s overlap with joining date, exit date, academic-session dates, and payroll month.
- Exclude staff from months with no overlap; joining and exit dates are inclusive.
- Cap payable days and manual salary days at the eligible days for that month while retaining the existing 30-day salary and absence-deduction rules.
- Keep existing payroll/payment history unchanged; visibly flag any historical payroll or payment after an entered exit date for Admin review.
- Add Exit Date to Employment, employment history, staff profile, and cross-session import/reactivation. Require confirmation when marking a person Left.

## Transport and fuel
- Round summed monthly and session KM once to whole KM; never alter daily KM rows.
- Calculate litres to two decimals from rounded monthly KM and vehicle KM/L.
- Calculate estimated cost from litres and that month’s session-specific active fuel rate; round final money only.
- Show explicit missing-rate and missing-average states; never guess.
- Keep actual transport expenses and Accounts as the source of paid amounts; do not create or persist derived balances.
- Show Fuel Cost Difference = Actual Expense − Estimated Cost, plus salary, transport, and combined operating-cost summaries on driver profiles.
- Restrict driver availability to active selected-session employment with Driver as primary/optional role and a valid current employment period.

## Verification
- Add focused calculation tests for 10,182.8 → 10,183 KM; 1,085 KM ÷ 10 = 108.50 L; × ₹91.70 = ₹9,949.45.
- Test joining/exit overlap, including 10–20 August and exclusion after 15 September.
- Verify missing rates/averages, monthly rate isolation, optional Driver eligibility, session isolation, and unchanged actual expenses/Accounts.
- Compare final counts and hashes against the baseline; report created, modified, deleted, financial, payment, Accounts, payroll, fuel-derived, review, and duplicate totals.
- Confirm the latest preview build is healthy and test the affected Payroll, Fuel Summary, Employment, Import, and Driver Profile screens.

## Technical details
- Schema changes use one additive migration; no destructive statements and no data backfill requiring guessed dates.
- Derived fuel values remain query-time calculations, so “recalculation” changes displays only and writes no historical financial rows.
- Existing module definitions and shared components remain the single source for forms and lists.
