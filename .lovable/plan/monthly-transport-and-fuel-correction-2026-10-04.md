# Monthly transport and fuel correction

## Goal
Replace daily transport KM entry with one admin-managed monthly total per session and vehicle, preserve the aggregated history, clear only confirmed fuel expenses and their exact Accounts entries for manual re-entry, simplify driver balances, and fix the mobile More drawer conflict.

## Safety sequence
1. Create and checksum-verify a fresh full database backup.
2. Record a read-only dry run: daily rows, monthly groups, ambiguous driver groups, fuel rows, exact Accounts links, and protected record counts.
3. Add the monthly KM structure and backfill one rounded total per vehicle, session, and month.
4. Verify every source daily row is represented and every monthly total matches before removing daily rows.
5. Remove only unambiguous Fuel-type transport expenses and their exact linked Accounts entries; leave ambiguous rows unchanged and report them.
6. Re-run integrity and protected-record counts after the migration.

## Database changes
- Add a session-scoped monthly KM table with month, vehicle, driver, whole non-negative total KM, audit fields, and a unique session + month + vehicle rule.
- Grant only authenticated roles permitted by existing transport policies; preserve RLS and admin-only writes.
- Add validation/audit behavior for monthly edits and mark legacy daily structures deprecated rather than dropping tables or columns.
- Backfill monthly totals from daily rows using rounded monthly sums. Resolve driver only from an unambiguous daily driver or the same session vehicle assignment; otherwise leave that group for explicit review rather than guess.

## Application changes
- Replace Daily KM navigation/module/tab/profile sections with Monthly KM.
- Make duplicate monthly entries open/update the existing record rather than create another row.
- Use whole-number fuel math: floor average, floor litres, floor rate, integer estimated cost; show missing or ambiguous rates rather than guessing.
- Fuel Summary shows month, vehicle, driver, KM, effective average/rate, estimate, actual paid, non-negative balance, and credit.
- Simplify Driver Profile to Salary Balance, Fuel Balance, Total Balance, optional credits, and one monthly salary/fuel table.
- Render Monthly KM and Fuel Summary as compact cards on phones and tables on larger screens.
- Hide the existing mobile bottom bar and its reserved content space while More is open; lock page scroll and let the full-height drawer scroll independently.

## Verification
- Test the required 1,085 KM / 10.8 KM/L / ₹91.70 case and balance/credit cases.
- Verify daily rows become zero only after matching monthly totals exist.
- Verify fuel expenses and their exact ledger rows become zero while students, staff, salary, payroll, fees, attendance, and unrelated Accounts counts remain unchanged.
- Check duplicate monthly keys, session isolation, missing-rate behavior, mobile drawer open/close, phone overflow, desktop navigation, tests, typecheck, and production build.
