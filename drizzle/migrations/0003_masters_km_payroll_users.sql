-- Fee categories: active flag + name snapshot on charges/payments
ALTER TABLE public.fee_categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.student_charges ADD COLUMN IF NOT EXISTS category_name text;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS category_name text;
UPDATE public.student_charges c SET category_name = f.name FROM public.fee_categories f WHERE f.id = c.category_id AND c.category_name IS NULL;
UPDATE public.fee_payments c SET category_name = f.name FROM public.fee_categories f WHERE f.id = c.category_id AND c.category_name IS NULL;

CREATE OR REPLACE FUNCTION public.snap_fee_category() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if NEW.category_id is not null and (TG_OP = 'INSERT' or NEW.category_id is distinct from OLD.category_id) then
    select name into NEW.category_name from fee_categories where id = NEW.category_id;
  end if;
  return NEW;
end $$;
CREATE TRIGGER trg_snap_charge_cat BEFORE INSERT OR UPDATE ON public.student_charges FOR EACH ROW EXECUTE FUNCTION public.snap_fee_category();
CREATE TRIGGER trg_snap_pay_cat BEFORE INSERT OR UPDATE ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION public.snap_fee_category();

CREATE OR REPLACE FUNCTION public.protect_fee_category() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if exists (select 1 from student_charges where category_id = OLD.id) or exists (select 1 from fee_payments where category_id = OLD.id) then
    raise exception 'Category is used in existing records. Deactivate it instead of deleting.';
  end if;
  return OLD;
end $$;
CREATE TRIGGER trg_protect_fee_cat BEFORE DELETE ON public.fee_categories FOR EACH ROW EXECUTE FUNCTION public.protect_fee_category();

-- Generic masters (text values copied into records, so renames never change history)
CREATE TABLE public.master_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('maintenance_category','staff_category','designation')),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX master_items_kind_name ON public.master_items (kind, lower(name));
GRANT SELECT, INSERT, UPDATE ON public.master_items TO authenticated;
GRANT ALL ON public.master_items TO service_role;
ALTER TABLE public.master_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read masters" ON public.master_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert masters" ON public.master_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin update masters" ON public.master_items FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.master_items (kind, name) SELECT 'maintenance_category', x FROM unnest(array['Building','Electrical','Plumbing','Furniture','Cleaning','Other']) x;
INSERT INTO public.master_items (kind, name) SELECT 'staff_category', x FROM unnest(array['Teacher','Accountant','Peon','Driver','Other']) x;
INSERT INTO public.master_items (kind, name) SELECT 'designation', x FROM unnest(array['Principal','Vice Principal','PGT','TGT','PRT','Accountant','Driver','Peon','Clerk','Librarian','Coordinator','Receptionist']) x;
INSERT INTO public.master_items (kind, name) SELECT DISTINCT 'designation', designation FROM public.staff_sessions WHERE trim(designation) <> '' ON CONFLICT DO NOTHING;
INSERT INTO public.master_items (kind, name) SELECT DISTINCT 'maintenance_category', category FROM public.maintenance_expenses WHERE category IS NOT NULL AND trim(category) <> '' ON CONFLICT DO NOTHING;
INSERT INTO public.master_items (kind, name) SELECT DISTINCT 'staff_category', category FROM public.staff_sessions WHERE category IS NOT NULL AND trim(category) <> '' ON CONFLICT DO NOTHING;

-- Vehicle daily KM defaults
CREATE TABLE public.vehicle_km_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  daily_km numeric NOT NULL CHECK (daily_km >= 0),
  effective_from date NOT NULL,
  effective_to date,
  start_odometer numeric CHECK (start_odometer IS NULL OR start_odometer >= 0),
  remarks text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_km_defaults TO authenticated;
GRANT ALL ON public.vehicle_km_defaults TO service_role;
ALTER TABLE public.vehicle_km_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin read km defaults" ON public.vehicle_km_defaults FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "admin write km defaults" ON public.vehicle_km_defaults FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.driver_km_logs ADD COLUMN IF NOT EXISTS is_override boolean NOT NULL DEFAULT false;
ALTER TABLE public.driver_km_logs ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false;
ALTER TABLE public.driver_km_logs ADD COLUMN IF NOT EXISTS change_reason text;
ALTER TABLE public.driver_km_logs ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.driver_km_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.driver_km_logs ADD CONSTRAINT km_non_negative CHECK (km >= 0) NOT VALID;
CREATE TRIGGER trg_audit_driver_km_logs AFTER UPDATE OR DELETE ON public.driver_km_logs FOR EACH ROW EXECUTE FUNCTION public.audit_row();

-- Fill missing days from defaults; refresh non-overridden auto rows. Never touches manual/override rows.
CREATE OR REPLACE FUNCTION public.generate_km_logs(_upto date DEFAULT current_date) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n integer := 0;
begin
  if not public.is_finance() then raise exception 'Permission denied'; end if;
  with days as (
    select d.vehicle_id, d.daily_km, g::date as day
    from vehicle_km_defaults d,
         generate_series(d.effective_from, least(coalesce(d.effective_to, _upto), _upto), interval '1 day') g
  ), resolved as (
    select distinct on (x.vehicle_id, x.day) x.vehicle_id, x.day, x.daily_km, s.id session_id, va.staff_id
    from days x
    join academic_sessions s on x.day between s.start_date and s.end_date
    join vehicle_assignments va on va.vehicle_id = x.vehicle_id and va.session_id = s.id
    order by x.vehicle_id, x.day
  ), ins as (
    insert into driver_km_logs (staff_id, vehicle_id, session_id, date, km, is_auto, remarks)
    select staff_id, vehicle_id, session_id, day, daily_km, true, 'Auto (daily default)' from resolved
    on conflict do nothing returning 1
  )
  select count(*) into n from ins;
  update driver_km_logs l set km = d.daily_km
  from vehicle_km_defaults d
  where l.is_auto and not l.is_override and l.vehicle_id = d.vehicle_id
    and l.date between d.effective_from and coalesce(d.effective_to, l.date) and l.km <> d.daily_km;
  return n;
end $$;
GRANT EXECUTE ON FUNCTION public.generate_km_logs(date) TO authenticated;

-- Payroll attendance/salary correction (historical months)
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS present_days numeric;
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS absent_days numeric;
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS half_days numeric;
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS leave_days numeric;
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS payable_days numeric;
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS change_reason text;
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS corrected_by uuid;
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS corrected_at timestamptz;

-- Salary payments: days paid + correction stamps
ALTER TABLE public.staff_payments ADD COLUMN IF NOT EXISTS salary_days numeric;
ALTER TABLE public.staff_payments ADD COLUMN IF NOT EXISTS corrected_by uuid;
ALTER TABLE public.staff_payments ADD COLUMN IF NOT EXISTS corrected_at timestamptz;
ALTER TABLE public.staff_payments ADD CONSTRAINT staff_pay_positive CHECK (amount > 0) NOT VALID;

-- User profile fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_uniq ON public.profiles (lower(username)) WHERE username IS NOT NULL;