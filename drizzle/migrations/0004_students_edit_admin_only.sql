DROP POLICY IF EXISTS "fin update students" ON public.students;
CREATE POLICY "admin update students" ON public.students FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "fin update student_sessions" ON public.student_sessions;
CREATE POLICY "admin update student_sessions" ON public.student_sessions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());