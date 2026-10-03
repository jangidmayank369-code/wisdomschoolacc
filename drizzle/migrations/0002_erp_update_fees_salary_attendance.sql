ALTER TABLE public.student_charges ADD COLUMN IF NOT EXISTS installment text;
ALTER TABLE public.staff_sessions ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.staff_payments ADD COLUMN IF NOT EXISTS calculated_amount numeric;
ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS change_reason text;
ALTER TABLE public.student_charges ADD CONSTRAINT student_charges_amount_pos CHECK (amount > 0) NOT VALID;
ALTER TABLE public.maintenance_expenses ADD CONSTRAINT maintenance_amount_pos CHECK (amount > 0) NOT VALID;
ALTER TABLE public.staff_payments ADD CONSTRAINT staff_payments_amount_pos CHECK (amount > 0) NOT VALID;

CREATE OR REPLACE FUNCTION public.check_attendance_correction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Attendance is locked. Only admin can correct it.' USING ERRCODE = '42501'; END IF;
  IF NEW.staff_id <> OLD.staff_id OR NEW.date <> OLD.date OR NEW.session_id <> OLD.session_id THEN
    RAISE EXCEPTION 'Only attendance status can be corrected';
  END IF;
  IF coalesce(trim(NEW.change_reason), '') = '' OR NEW.change_reason IS NOT DISTINCT FROM OLD.change_reason THEN
    RAISE EXCEPTION 'A reason is required to correct attendance';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_attendance_correction BEFORE UPDATE ON public.staff_attendance FOR EACH ROW EXECUTE FUNCTION public.check_attendance_correction();
CREATE TRIGGER trg_audit_staff_attendance AFTER UPDATE OR DELETE ON public.staff_attendance FOR EACH ROW EXECUTE FUNCTION public.audit_row();