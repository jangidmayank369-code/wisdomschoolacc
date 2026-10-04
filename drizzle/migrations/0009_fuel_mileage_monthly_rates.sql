ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS fuel_average_kmpl numeric CHECK (fuel_average_kmpl IS NULL OR fuel_average_kmpl > 0);
COMMENT ON COLUMN public.vehicle_assignments.fuel_rate_per_km IS 'DEPRECATED: replaced by vehicles.fuel_average_kmpl + fuel_rates';

CREATE TABLE public.fuel_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.academic_sessions(id),
  month date NOT NULL,
  fuel_type text NOT NULL DEFAULT 'Diesel',
  rate_per_litre numeric NOT NULL CHECK (rate_per_litre > 0),
  effective_date date,
  status text NOT NULL DEFAULT 'active',
  change_reason text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, month, fuel_type)
);
GRANT SELECT, INSERT, UPDATE ON public.fuel_rates TO authenticated;
GRANT ALL ON public.fuel_rates TO service_role;
ALTER TABLE public.fuel_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_rates read" ON public.fuel_rates FOR SELECT TO authenticated USING (public.has_any_role());
CREATE POLICY "fuel_rates admin insert" ON public.fuel_rates FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fuel_rates admin update" ON public.fuel_rates FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.check_fuel_rate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.month := date_trunc('month', NEW.month)::date;
  IF NOT EXISTS (SELECT 1 FROM academic_sessions s WHERE s.id = NEW.session_id AND NEW.month BETWEEN date_trunc('month', s.start_date)::date AND s.end_date) THEN
    RAISE EXCEPTION 'Month is outside the selected session';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.rate_per_litre IS DISTINCT FROM OLD.rate_per_litre OR NEW.month IS DISTINCT FROM OLD.month OR NEW.fuel_type IS DISTINCT FROM OLD.fuel_type)
     AND (NEW.change_reason IS NULL OR btrim(NEW.change_reason) = '' OR NEW.change_reason IS NOT DISTINCT FROM OLD.change_reason) THEN
    RAISE EXCEPTION 'A reason is required to change a saved fuel rate';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_check_fuel_rate BEFORE INSERT OR UPDATE ON public.fuel_rates FOR EACH ROW EXECUTE FUNCTION public.check_fuel_rate();
CREATE TRIGGER trg_audit_fuel_rates AFTER INSERT OR UPDATE ON public.fuel_rates FOR EACH ROW EXECUTE FUNCTION public.audit_row();