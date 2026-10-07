<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## ERP architecture
- All CRUD/import/export modules are declared once in `src/lib/modules.tsx` and rendered by `ResourcePage`; add modules there, not new pages. Why: one engine, no duplication.
- Session data always carries `session_id`; people (students, staff) are master rows linked via `student_sessions` / `staff_sessions`. Why: history must never mix across sessions.
- Financial rules (overpayment, cross-session, ledger sync into `transactions`, audit) live in DB triggers; financial rows are reversed/corrected, never edited or deleted by non-admins. Why: data safety independent of UI.
- Salary math and employment-period eligibility live only in `src/lib/finance.ts` (30-day month, inclusive session/join/exit clipping, tiered absence deduction). Why: single source for payroll numbers.
- Configurable dropdowns come from `master_items` (by kind) or `fee_categories`; records store the chosen name (fee rows snapshot `category_name`), and masters are deactivated, never deleted. Why: renames never rewrite history.
- Transport KM lives in `monthly_vehicle_km`, uniquely keyed by vehicle + session + month and manually maintained by admins with audited edit reasons. Why: monthly totals are the source for fuel estimates; legacy daily rows/defaults are retired.
- Historical payroll corrections are stored on `payroll_periods` (attendance counts + salary_due); user edits/passwords go through admin server functions in `users.functions.ts`. Why: no recreated attendance, no stored passwords.
- Master lists (students, vehicles) are shown per session via `sessionJoin` (DB inner join on student_sessions / vehicle_assignments); monthly KM is keyed by vehicle+session+month and never copied across sessions. Why: a person/vehicle existing never implies membership in a session.
- Cross-session reuse of people creates only a new student_sessions/staff_sessions row (SessionImportDialog); driver eligibility = designation OR optional_role is Driver in the session. Why: one master profile, no copied financial history.
- Mobile layout reserves space from the shared `--mobile-bottom-nav-height` token, and dialogs layer above the fixed navigation. Why: safe-area changes must never hide page content or form actions.
- Fuel estimates use whole monthly KM with floored vehicle KM/L and exact saved session-month fuel rates via `fuelEstimate()`; fuel payments group by nullable `transport_expenses.for_month` (legacy rows fall back to date) while Accounts stay dated by payment date; estimates never write to Accounts (actual `transport_expenses` only). Why: estimate vs actual stays separate and decimal fuel inputs never enter calculations.
