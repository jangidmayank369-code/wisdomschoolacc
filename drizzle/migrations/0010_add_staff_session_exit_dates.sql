ALTER TABLE public.staff_sessions
ADD COLUMN IF NOT EXISTS exit_date date;

CREATE OR REPLACE FUNCTION public.validate_staff_employment_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess public.academic_sessions%ROWTYPE;
BEGIN
  SELECT * INTO sess FROM public.academic_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Academic session not found';
  END IF;

  IF NEW.joining_date IS NOT NULL AND (NEW.joining_date < sess.start_date OR NEW.joining_date > sess.end_date) THEN
    RAISE EXCEPTION 'Joining date must be inside session %', sess.name;
  END IF;

  IF NEW.exit_date IS NOT NULL AND (NEW.exit_date < sess.start_date OR NEW.exit_date > sess.end_date) THEN
    RAISE EXCEPTION 'Exit date must be inside session %', sess.name;
  END IF;

  IF NEW.exit_date IS NOT NULL AND NEW.joining_date IS NOT NULL AND NEW.exit_date < NEW.joining_date THEN
    RAISE EXCEPTION 'Exit date cannot be before joining date';
  END IF;

  IF lower(NEW.status) = 'active' AND NEW.exit_date IS NOT NULL THEN
    RAISE EXCEPTION 'Active employment cannot have an exit date';
  END IF;

  IF lower(NEW.status) = 'left' AND NEW.exit_date IS NULL THEN
    RAISE EXCEPTION 'Left employment requires an exit date';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER trg_validate_staff_employment_dates
BEFORE INSERT OR UPDATE ON public.staff_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_staff_employment_dates();

CREATE OR REPLACE FUNCTION public.check_new_payroll_employment_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employment public.staff_sessions%ROWTYPE;
  sess public.academic_sessions%ROWTYPE;
  payroll_month date;
  payroll_month_end date;
  eligible_start date;
  eligible_end date;
BEGIN
  SELECT * INTO employment
  FROM public.staff_sessions
  WHERE staff_id = NEW.staff_id AND session_id = NEW.session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member has no employment record in the selected session';
  END IF;

  SELECT * INTO sess FROM public.academic_sessions WHERE id = NEW.session_id;
  payroll_month := COALESCE((to_jsonb(NEW)->>'payroll_month')::date, (to_jsonb(NEW)->>'month')::date);
  payroll_month_end := (date_trunc('month', payroll_month) + interval '1 month - 1 day')::date;
  eligible_start := GREATEST(COALESCE(employment.joining_date, sess.start_date), sess.start_date, payroll_month);
  eligible_end := LEAST(COALESCE(employment.exit_date, sess.end_date), sess.end_date, payroll_month_end);

  IF lower(employment.status) = 'inactive' OR eligible_start > eligible_end THEN
    RAISE EXCEPTION 'Staff member is not eligible for payroll in this month';
  END IF;

  IF lower(employment.status) = 'left' AND employment.exit_date IS NULL THEN
    RAISE EXCEPTION 'Left employment requires an exit date';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER trg_new_payroll_period_employment
BEFORE INSERT ON public.payroll_periods
FOR EACH ROW EXECUTE FUNCTION public.check_new_payroll_employment_period();

CREATE TRIGGER trg_new_staff_payment_employment
BEFORE INSERT ON public.staff_payments
FOR EACH ROW EXECUTE FUNCTION public.check_new_payroll_employment_period();

COMMENT ON COLUMN public.staff_sessions.exit_date IS 'Session-specific inclusive final employment date; required when status is left and null when active.';