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
- Salary math lives only in `src/lib/finance.ts` (30-day month, tiered absence deduction in deductionDays). Why: single source for payroll numbers.
- Configurable dropdowns come from `master_items` (by kind) or `fee_categories`; records store the chosen name (fee rows snapshot `category_name`), and masters are deactivated, never deleted. Why: renames never rewrite history.
- Daily KM defaults live in `vehicle_km_defaults`; `generate_km_logs()` fills/refreshes auto rows and never touches `is_override` rows. Why: one real row per vehicle/day, corrections preserved.
- Historical payroll corrections are stored on `payroll_periods` (attendance counts + salary_due); user edits/passwords go through admin server functions in `users.functions.ts`. Why: no recreated attendance, no stored passwords.
- Master lists (students, vehicles) are shown per session via `sessionJoin` (DB inner join on student_sessions / vehicle_assignments); KM defaults and KM logs are keyed by vehicle+session(+date) and never copied across sessions. Why: a person/vehicle existing never implies membership in a session.
