ALTER TABLE public.vehicle_assignments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.vehicle_assignments ADD COLUMN IF NOT EXISTS effective_from date;
ALTER TABLE public.vehicle_km_defaults ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.academic_sessions(id);
CREATE UNIQUE INDEX IF NOT EXISTS driver_km_logs_vehicle_session_date_key ON public.driver_km_logs (vehicle_id, session_id, date);
ALTER TABLE public.driver_km_logs DROP CONSTRAINT IF EXISTS driver_km_logs_vehicle_id_date_key;
DROP INDEX IF EXISTS public.driver_km_logs_vehicle_id_date_key;

CREATE OR REPLACE FUNCTION public.generate_km_logs(_upto date DEFAULT CURRENT_DATE)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n integer := 0;
begin
  if not public.is_finance() then raise exception 'Permission denied'; end if;
  -- Only session-specific defaults generate KM; a session without its own default gets nothing.
  with days as (
    select d.vehicle_id, d.session_id, d.daily_km, g::date as day
    from vehicle_km_defaults d
    join vehicles v on v.id = d.vehicle_id and v.status = 'active'
    join academic_sessions s on s.id = d.session_id,
         generate_series(greatest(d.effective_from, s.start_date), least(coalesce(d.effective_to, _upto), _upto, s.end_date), interval '1 day') g
  ), resolved as (
    select x.vehicle_id, x.day, x.daily_km, x.session_id, va.staff_id
    from days x
    join vehicle_assignments va on va.vehicle_id = x.vehicle_id and va.session_id = x.session_id and va.status = 'active'
  ), ins as (
    insert into driver_km_logs (staff_id, vehicle_id, session_id, date, km, is_auto, remarks)
    select staff_id, vehicle_id, session_id, day, daily_km, true, 'Auto (daily default)' from resolved
    on conflict do nothing returning 1
  )
  select count(*) into n from ins;
  update driver_km_logs l set km = d.daily_km
  from vehicle_km_defaults d
  where l.is_auto and not l.is_override and l.vehicle_id = d.vehicle_id and l.session_id = d.session_id
    and l.date between d.effective_from and coalesce(d.effective_to, l.date) and l.km <> d.daily_km;
  return n;
end $$;