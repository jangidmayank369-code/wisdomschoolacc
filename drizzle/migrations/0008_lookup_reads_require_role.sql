CREATE OR REPLACE FUNCTION public.has_any_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select exists (select 1 from public.user_roles where user_id = auth.uid()) $$;

ALTER POLICY "read academic_sessions" ON public.academic_sessions USING (public.has_any_role());
ALTER POLICY "read school_settings" ON public.school_settings USING (public.has_any_role());
ALTER POLICY "read fee_categories" ON public.fee_categories USING (public.has_any_role());
ALTER POLICY "read income_categories" ON public.income_categories USING (public.has_any_role());
ALTER POLICY "read expense_categories" ON public.expense_categories USING (public.has_any_role());
ALTER POLICY "read masters" ON public.master_items USING (public.has_any_role());