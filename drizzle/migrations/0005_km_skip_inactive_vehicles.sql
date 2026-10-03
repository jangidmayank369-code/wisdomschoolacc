CREATE OR REPLACE FUNCTION public.generate_km_logs(_upto date DEFAULT CURRENT_DATE)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare n integer := 0;
begin
  if not public.is_finance() then raise exception 'Permission denied'; end if;
  with days as (
    select d.vehicle_id, d.daily_km, g::date as day
    from vehicle_km_defaults d
    join vehicles v on v.id = d.vehicle_id and v.status = 'active',
         generate_series(d.effective_from, least(coalesce(d.effective_to, _upto), _upto), interval '1 day') g
  ), resolved as (
    select distinct on (x.vehicle_id, x.day) x.vehicle_id, x.day, x.daily_km, s.id session_id, va.staff_id
    from days x
    join academic_sessions s on x.day between s.start_date and s.end_date
    join vehicle_assignments va on va.vehicle_id = x.vehicle_id and va.session_id = s.id
    order by x.vehicle_id, x.day, va.created_at desc
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
end $function$;