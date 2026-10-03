
create view public.v_student_balances with (security_invoker = true) as
select ss.id as student_session_id, ss.session_id, ss.student_id, s.admission_no, s.name, s.father_name, s.phone,
  ss.class, ss.section, ss.roll_no, ss.status,
  coalesce((select sum(amount) from public.student_charges c where c.student_id = ss.student_id and c.session_id = ss.session_id),0)::numeric as total_charges,
  coalesce((select sum(amount) from public.fee_payments p where p.student_id = ss.student_id and p.session_id = ss.session_id and not p.is_reversed),0)::numeric as total_paid
from public.student_sessions ss join public.students s on s.id = ss.student_id;
grant select on public.v_student_balances to authenticated;
