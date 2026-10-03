ALTER TABLE public.staff_sessions ADD COLUMN IF NOT EXISTS optional_role text;
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS enrollment_date date;
ALTER TABLE public.student_sessions ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.staff_sessions ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();