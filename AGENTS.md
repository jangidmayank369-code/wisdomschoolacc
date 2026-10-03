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
- Salary math lives only in `src/lib/finance.ts` (30-day month, no auto-deduction). Why: single source for payroll numbers.
