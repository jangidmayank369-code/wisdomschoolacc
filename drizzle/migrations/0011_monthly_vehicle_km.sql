CREATE TABLE public.monthly_vehicle_km (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
  month date NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  total_km integer NOT NULL CHECK (total_km >= 0),
  remarks text,
  change_reason text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz,
  CONSTRAINT monthly_vehicle_km_month_start CHECK (month = date_trunc('month', month)::date),
  CONSTRAINT monthly_vehicle_km_session_month_vehicle_key UNIQUE (session_id, month, vehicle_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_vehicle_km TO authenticated;
GRANT ALL ON public.monthly_vehicle_km TO service_role;

ALTER TABLE public.monthly_vehicle_km ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin read monthly_vehicle_km"
ON public.monthly_vehicle_km FOR SELECT TO authenticated
USING (public.is_finance());

CREATE POLICY "driver own monthly_vehicle_km"
ON public.monthly_vehicle_km FOR SELECT TO authenticated
USING (staff_id = public.my_staff_id());

CREATE POLICY "admin write monthly_vehicle_km"
ON public.monthly_vehicle_km FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.check_monthly_vehicle_km()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicle_assignments
    WHERE vehicle_id = NEW.vehicle_id
      AND staff_id = NEW.staff_id
      AND session_id = NEW.session_id
  ) THEN
    RAISE EXCEPTION 'This driver is not assigned to this vehicle in the selected session';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    IF NEW.total_km IS DISTINCT FROM OLD.total_km AND nullif(trim(NEW.change_reason), '') IS NULL THEN
      RAISE EXCEPTION 'A reason is required when changing saved monthly KM';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_check_monthly_vehicle_km
BEFORE INSERT OR UPDATE ON public.monthly_vehicle_km
FOR EACH ROW EXECUTE FUNCTION public.check_monthly_vehicle_km();

CREATE TRIGGER trg_audit_monthly_vehicle_km
AFTER UPDATE OR DELETE ON public.monthly_vehicle_km
FOR EACH ROW EXECUTE FUNCTION public.audit_row();

INSERT INTO public.monthly_vehicle_km (session_id, month, vehicle_id, staff_id, total_km, remarks)
SELECT session_id,
       date_trunc('month', date)::date,
       vehicle_id,
       min(staff_id::text)::uuid,
       round(sum(km))::integer,
       'Migrated from verified daily KM totals'
FROM public.driver_km_logs
GROUP BY session_id, date_trunc('month', date)::date, vehicle_id
HAVING count(DISTINCT staff_id) = 1
ON CONFLICT (session_id, month, vehicle_id) DO NOTHING;

COMMENT ON TABLE public.driver_km_logs IS 'DEPRECATED: historical daily KM migrated to public.monthly_vehicle_km; no longer used by the application.';
COMMENT ON TABLE public.vehicle_km_defaults IS 'DEPRECATED: monthly KM is entered manually in public.monthly_vehicle_km.';