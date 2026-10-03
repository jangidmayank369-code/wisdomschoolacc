
-- ============ CORE ============
create type public.app_role as enum ('admin','accountant','staff');

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin')
$$;
create or replace function public.is_finance() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'accountant')
$$;

create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);
create unique index one_current_session on public.academic_sessions(is_current) where is_current;

create table public.school_settings (
  id int primary key default 1 check (id = 1),
  school_name text not null default 'Wisdom Public School – Doomra',
  address text default '',
  phone text default '',
  email text default '',
  logo_url text default '',
  receipt_footer text default 'This is a computer generated receipt.',
  updated_at timestamptz not null default now()
);
insert into public.school_settings (id) values (1);

-- ============ STUDENTS ============
create table public.students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  name text not null,
  gender text,
  dob date,
  father_name text,
  mother_name text,
  phone text,
  address text,
  admission_date date,
  status text not null default 'active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.students(name);

create table public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  class text not null,
  section text,
  roll_no text,
  status text not null default 'active',
  transport_route text,
  remarks text,
  created_at timestamptz not null default now(),
  unique (student_id, session_id)
);
create index on public.student_sessions(session_id, class, section);

create table public.fee_categories (id uuid primary key default gen_random_uuid(), name text not null unique);
insert into public.fee_categories(name) values ('Tuition'),('Admission'),('Exam'),('Annual'),('Transport'),('Books'),('Stationery'),('Other');

create table public.student_charges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  category_id uuid not null references public.fee_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  due_date date,
  remarks text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.student_charges(student_id, session_id);

create sequence public.receipt_seq;
create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique default ('WPS-' || lpad(nextval('public.receipt_seq')::text, 6, '0')),
  student_id uuid not null references public.students(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  category_id uuid references public.fee_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  mode text not null default 'Cash',
  reference text,
  received_by text,
  remarks text,
  is_reversed boolean not null default false,
  reversal_reason text,
  change_reason text,
  client_token uuid unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.fee_payments(student_id, session_id);
create index on public.fee_payments(session_id, payment_date);

-- ============ STAFF ============
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique,
  name text not null,
  mobile text,
  email text,
  address text,
  gender text,
  user_id uuid unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.my_staff_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.staff where user_id = auth.uid() limit 1
$$;

create table public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  joining_date date,
  designation text not null default 'Teacher',
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  status text not null default 'active',
  remarks text,
  created_at timestamptz not null default now(),
  unique (staff_id, session_id)
);
create index on public.staff_sessions(session_id, designation);

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  date date not null,
  status text not null check (status in ('present','absent','half_day','leave')),
  remarks text,
  marked_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);
create index on public.staff_attendance(session_id, date);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  from_date date not null,
  to_date date not null,
  reason text not null,
  remarks text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  month date not null check (extract(day from month) = 1),
  salary_due numeric(12,2) not null check (salary_due >= 0),
  remarks text,
  created_at timestamptz not null default now(),
  unique (staff_id, session_id, month)
);

create table public.staff_payments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  payroll_month date not null check (extract(day from payroll_month) = 1),
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  mode text not null default 'Cash',
  reference text,
  paid_by text,
  remarks text,
  is_reversed boolean not null default false,
  reversal_reason text,
  change_reason text,
  client_token uuid unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.staff_payments(staff_id, session_id, payroll_month);

-- ============ TRANSPORT ============
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_no text not null unique,
  type text,
  model text,
  capacity int,
  registration text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create table public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  route text,
  fuel_rate_per_km numeric(10,2) not null default 0 check (fuel_rate_per_km >= 0),
  remarks text,
  created_at timestamptz not null default now(),
  unique (vehicle_id, session_id),
  unique (staff_id, session_id)
);
create table public.driver_km_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  date date not null,
  km numeric(10,1) not null check (km >= 0),
  remarks text,
  recorded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (vehicle_id, date)
);
create index on public.driver_km_logs(staff_id, session_id, date);
create table public.transport_expenses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  staff_id uuid references public.staff(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete restrict,
  expense_type text not null default 'Fuel',
  date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  mode text not null default 'Cash',
  paid_by text,
  reference text,
  remarks text,
  is_reversed boolean not null default false,
  reversal_reason text,
  change_reason text,
  client_token uuid unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.transport_expenses(session_id, date);

-- ============ FINANCE ============
create table public.income_categories (id uuid primary key default gen_random_uuid(), name text not null unique);
insert into public.income_categories(name) values ('Student Fees'),('Other Income');
create table public.expense_categories (id uuid primary key default gen_random_uuid(), name text not null unique);
insert into public.expense_categories(name) values ('Staff Salary'),('Driver Salary'),('Fuel'),('Transport'),('Maintenance'),('Other');

create table public.maintenance_expenses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  date date not null default current_date,
  location text,
  work text not null,
  category text,
  vendor text,
  bill_no text,
  amount numeric(12,2) not null check (amount > 0),
  mode text not null default 'Cash',
  paid_by text,
  remarks text,
  is_reversed boolean not null default false,
  reversal_reason text,
  change_reason text,
  client_token uuid unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academic_sessions(id) on delete restrict,
  date date not null default current_date,
  type text not null check (type in ('income','expense')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  mode text default 'Cash',
  reference text,
  source_module text not null default 'manual',
  source_id uuid,
  party text,
  remarks text,
  is_reversed boolean not null default false,
  reversal_reason text,
  change_reason text,
  client_token uuid unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (source_module, source_id)
);
create index on public.transactions(session_id, date);

create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  file_name text,
  total_rows int not null default 0,
  successful int not null default 0,
  failed int not null default 0,
  duplicates int not null default 0,
  status text not null default 'completed',
  errors jsonb,
  user_id uuid default auth.uid(),
  user_email text,
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  reason text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index on public.audit_logs(table_name, record_id);

-- ============ INTEGRITY TRIGGERS ============
create or replace function public.check_enrolled() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from student_sessions where student_id = NEW.student_id and session_id = NEW.session_id) then
    raise exception 'Student is not enrolled in the selected session';
  end if;
  return NEW;
end $$;
create trigger trg_charge_enrolled before insert or update on public.student_charges for each row execute function public.check_enrolled();

create or replace function public.check_fee_payment() returns trigger language plpgsql security definer set search_path = public as $$
declare charges numeric; paid numeric;
begin
  if not exists (select 1 from student_sessions where student_id = NEW.student_id and session_id = NEW.session_id) then
    raise exception 'Student is not enrolled in the selected session';
  end if;
  if NEW.is_reversed then return NEW; end if;
  select coalesce(sum(amount),0) into charges from student_charges where student_id = NEW.student_id and session_id = NEW.session_id;
  select coalesce(sum(amount),0) into paid from fee_payments where student_id = NEW.student_id and session_id = NEW.session_id and not is_reversed and id <> NEW.id;
  if paid + NEW.amount > charges then
    raise exception 'Overpayment: balance is only %', (charges - paid);
  end if;
  return NEW;
end $$;
create trigger trg_fee_payment before insert or update on public.fee_payments for each row execute function public.check_fee_payment();

create or replace function public.check_staff_session() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; d date;
begin
  if not exists (select 1 from staff_sessions where staff_id = NEW.staff_id and session_id = NEW.session_id) then
    raise exception 'Staff member has no employment record in the selected session';
  end if;
  select * into s from academic_sessions where id = NEW.session_id;
  d := coalesce((to_jsonb(NEW)->>'date')::date, (to_jsonb(NEW)->>'payroll_month')::date, (to_jsonb(NEW)->>'month')::date, (to_jsonb(NEW)->>'from_date')::date);
  if d is not null and (d < date_trunc('month', s.start_date)::date or d > s.end_date) then
    raise exception 'Date % is outside session %', d, s.name;
  end if;
  return NEW;
end $$;
create trigger trg_att_session before insert or update on public.staff_attendance for each row execute function public.check_staff_session();
create trigger trg_leave_session before insert or update on public.leave_requests for each row execute function public.check_staff_session();
create trigger trg_pp_session before insert or update on public.payroll_periods for each row execute function public.check_staff_session();
create trigger trg_va_session before insert or update on public.vehicle_assignments for each row execute function public.check_staff_session();
create trigger trg_km_session before insert or update on public.driver_km_logs for each row execute function public.check_staff_session();

create or replace function public.check_staff_payment() returns trigger language plpgsql security definer set search_path = public as $$
declare due numeric; paid numeric;
begin
  if NEW.is_reversed then return NEW; end if;
  select coalesce(
    (select salary_due from payroll_periods where staff_id = NEW.staff_id and session_id = NEW.session_id and month = NEW.payroll_month),
    (select monthly_salary from staff_sessions where staff_id = NEW.staff_id and session_id = NEW.session_id), 0) into due;
  select coalesce(sum(amount),0) into paid from staff_payments
    where staff_id = NEW.staff_id and session_id = NEW.session_id and payroll_month = NEW.payroll_month and not is_reversed and id <> NEW.id;
  if paid + NEW.amount > due then
    raise exception 'Overpayment: salary balance for this month is only %', (due - paid);
  end if;
  return NEW;
end $$;
create trigger trg_sp_session before insert or update on public.staff_payments for each row execute function public.check_staff_session();
create trigger trg_sp_check before insert or update on public.staff_payments for each row execute function public.check_staff_payment();

create or replace function public.check_km_vehicle() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from vehicle_assignments where vehicle_id = NEW.vehicle_id and staff_id = NEW.staff_id and session_id = NEW.session_id) then
    raise exception 'This driver is not assigned to this vehicle in the selected session';
  end if;
  return NEW;
end $$;
create trigger trg_km_vehicle before insert or update on public.driver_km_logs for each row execute function public.check_km_vehicle();

create or replace function public.check_leave_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if NEW.staff_id is distinct from public.my_staff_id() then raise exception 'You can only request leave for yourself'; end if;
    NEW.status := 'pending'; NEW.reviewed_by := null; NEW.reviewed_at := null;
  elsif TG_OP = 'UPDATE' and NEW.status <> OLD.status then
    NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
  end if;
  return NEW;
end $$;
create trigger trg_leave_owner before insert or update on public.leave_requests for each row execute function public.check_leave_owner();

-- ============ LEDGER SYNC ============
create or replace function public.sync_ledger() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb; ttype text; cat text; d date; party text; ref text;
begin
  if TG_OP = 'DELETE' then
    delete from transactions where source_module = TG_TABLE_NAME and source_id = OLD.id;
    return OLD;
  end if;
  j := to_jsonb(NEW);
  d := coalesce(j->>'payment_date', j->>'date')::date;
  party := coalesce(j->>'received_by', j->>'paid_by');
  ref := coalesce(j->>'receipt_no', j->>'reference', j->>'bill_no');
  if TG_TABLE_NAME = 'fee_payments' then ttype := 'income'; cat := 'Student Fees';
  elsif TG_TABLE_NAME = 'staff_payments' then
    ttype := 'expense';
    select case when lower(designation) = 'driver' then 'Driver Salary' else 'Staff Salary' end into cat
      from staff_sessions where staff_id = NEW.staff_id and session_id = NEW.session_id;
    cat := coalesce(cat, 'Staff Salary');
  elsif TG_TABLE_NAME = 'transport_expenses' then ttype := 'expense'; cat := case when lower(j->>'expense_type') = 'fuel' then 'Fuel' else 'Transport' end;
  elsif TG_TABLE_NAME = 'maintenance_expenses' then ttype := 'expense'; cat := 'Maintenance';
  end if;
  insert into transactions(session_id, date, type, category, amount, mode, reference, source_module, source_id, party, remarks, is_reversed, created_by)
  values (NEW.session_id, d, ttype, cat, (j->>'amount')::numeric, j->>'mode', ref, TG_TABLE_NAME, NEW.id, party, j->>'remarks', (j->>'is_reversed')::boolean, auth.uid())
  on conflict (source_module, source_id) do update set
    session_id = excluded.session_id, date = excluded.date, category = excluded.category, amount = excluded.amount,
    mode = excluded.mode, reference = excluded.reference, party = excluded.party, remarks = excluded.remarks, is_reversed = excluded.is_reversed;
  return NEW;
end $$;
create trigger trg_ledger_fee after insert or update or delete on public.fee_payments for each row execute function public.sync_ledger();
create trigger trg_ledger_salary after insert or update or delete on public.staff_payments for each row execute function public.sync_ledger();
create trigger trg_ledger_transport after insert or update or delete on public.transport_expenses for each row execute function public.sync_ledger();
create trigger trg_ledger_maint after insert or update or delete on public.maintenance_expenses for each row execute function public.sync_ledger();

-- ============ AUDIT ============
create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs(table_name, record_id, action, old_data, new_data, reason, changed_by)
  values (TG_TABLE_NAME,
    coalesce((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid),
    TG_OP,
    case when TG_OP <> 'INSERT' then to_jsonb(OLD) end,
    case when TG_OP <> 'DELETE' then to_jsonb(NEW) end,
    coalesce(to_jsonb(NEW)->>'change_reason', to_jsonb(NEW)->>'reversal_reason'),
    auth.uid());
  return coalesce(NEW, OLD);
end $$;
do $$ declare t text; begin
  foreach t in array array['fee_payments','staff_payments','transport_expenses','maintenance_expenses','transactions','student_charges','staff_sessions','payroll_periods'] loop
    execute format('create trigger trg_audit_%s after update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- updated_at
create or replace function public.touch_updated() returns trigger language plpgsql as $$ begin NEW.updated_at := now(); return NEW; end $$;
create trigger trg_students_upd before update on public.students for each row execute function public.touch_updated();
create trigger trg_staff_upd before update on public.staff for each row execute function public.touch_updated();

-- ============ GRANTS + RLS ============
do $$ declare t text; begin
  foreach t in array array['profiles','user_roles','academic_sessions','school_settings','students','student_sessions','fee_categories','student_charges','fee_payments','staff','staff_sessions','staff_attendance','leave_requests','payroll_periods','staff_payments','vehicles','vehicle_assignments','driver_km_logs','transport_expenses','income_categories','expense_categories','maintenance_expenses','transactions','import_logs','audit_logs'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
grant usage on sequence public.receipt_seq to authenticated, service_role;

create policy "own or admin profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_finance());
create policy "admin profiles write" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admin roles" on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- reference tables: read all signed-in, admin writes
do $$ declare t text; begin
  foreach t in array array['academic_sessions','school_settings','fee_categories','income_categories','expense_categories'] loop
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "admin write %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- finance: admin + accountant read/insert/update; admin delete
do $$ declare t text; begin
  foreach t in array array['students','student_sessions'] loop
    execute format('create policy "fin read %1$s" on public.%1$I for select to authenticated using (public.is_finance())', t);
    execute format('create policy "fin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_finance())', t);
    execute format('create policy "fin update %1$s" on public.%1$I for update to authenticated using (public.is_finance()) with check (public.is_finance())', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- financial records: finance read/insert; only admin update/delete (corrections)
do $$ declare t text; begin
  foreach t in array array['student_charges','fee_payments','transactions','import_logs'] loop
    execute format('create policy "fin read %1$s" on public.%1$I for select to authenticated using (public.is_finance())', t);
    execute format('create policy "fin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_finance())', t);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- admin-managed, accountant can read
do $$ declare t text; begin
  foreach t in array array['vehicles','vehicle_assignments','driver_km_logs','transport_expenses','maintenance_expenses'] loop
    execute format('create policy "fin read %1$s" on public.%1$I for select to authenticated using (public.is_finance())', t);
    execute format('create policy "admin write %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- staff-owned: admin all, accountant read, staff read own
do $$ declare t text; begin
  foreach t in array array['staff_sessions','staff_attendance','payroll_periods','staff_payments'] loop
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (public.is_finance() or staff_id = public.my_staff_id())', t);
    execute format('create policy "admin write %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
create policy "read staff" on public.staff for select to authenticated using (public.is_finance() or id = public.my_staff_id());
create policy "admin write staff" on public.staff for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- vehicle/km visible to driver himself
create policy "driver own km" on public.driver_km_logs for select to authenticated using (staff_id = public.my_staff_id());
create policy "driver own assignment" on public.vehicle_assignments for select to authenticated using (staff_id = public.my_staff_id());

create policy "read leave" on public.leave_requests for select to authenticated using (public.is_admin() or staff_id = public.my_staff_id());
create policy "insert leave" on public.leave_requests for insert to authenticated with check (public.is_admin() or staff_id = public.my_staff_id());
create policy "admin update leave" on public.leave_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "delete leave" on public.leave_requests for delete to authenticated using (public.is_admin() or (staff_id = public.my_staff_id() and status = 'pending'));

create policy "admin audit" on public.audit_logs for select to authenticated using (public.is_admin());
