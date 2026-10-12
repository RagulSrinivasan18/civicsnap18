
create type public.app_role as enum ('admin', 'user');
create type public.report_status as enum ('submitted','under_review','forwarded','in_progress','resolved');
create type public.moderation_state as enum ('pending','approved','rejected','flagged');
create type public.report_category as enum ('pothole','garbage','streetlight','water','public_safety','other');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

-- First account ever created becomes the administrator
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created_first_admin after insert on auth.users
  for each row execute function public.handle_first_admin();

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  title text not null,
  description text not null,
  category report_category not null,
  locality text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  status report_status not null default 'submitted',
  moderation moderation_state not null default 'pending',
  authority text,
  ai_summary text,
  ai_category report_category,
  ai_authority text,
  ai_source text,
  possible_duplicate_of uuid references public.reports(id) on delete set null,
  support_count integer not null default 0,
  forwarded_to text,
  forwarding_channel text,
  forwarding_reference text,
  forwarded_at timestamptz,
  resolution_notes text,
  resolved_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.reports to anon, authenticated;
grant update, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "Public reads approved reports" on public.reports for select to anon, authenticated using (moderation = 'approved');
create policy "Admins read all reports" on public.reports for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update reports" on public.reports for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete reports" on public.reports for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Private reporter contact, admin-only
create table public.report_contacts (
  report_id uuid primary key references public.reports(id) on delete cascade,
  name text,
  email text,
  phone text
);
grant select on public.report_contacts to authenticated;
grant all on public.report_contacts to service_role;
alter table public.report_contacts enable row level security;
create policy "Admins read contacts" on public.report_contacts for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.report_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);
grant select on public.report_images to anon, authenticated;
grant all on public.report_images to service_role;
alter table public.report_images enable row level security;
create policy "Public reads images of approved reports" on public.report_images for select to anon, authenticated
  using (exists (select 1 from public.reports r where r.id = report_id and r.moderation = 'approved'));
create policy "Admins read all images" on public.report_images for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  status report_status not null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.status_history to anon, authenticated;
grant insert on public.status_history to authenticated;
grant all on public.status_history to service_role;
alter table public.status_history enable row level security;
create policy "Public reads history of approved reports" on public.status_history for select to anon, authenticated
  using (exists (select 1 from public.reports r where r.id = report_id and r.moderation = 'approved'));
create policy "Admins read all history" on public.status_history for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins add history" on public.status_history for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));

create table public.report_supports (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  supporter_key text not null,
  created_at timestamptz not null default now(),
  unique (report_id, supporter_key)
);
grant all on public.report_supports to service_role;
alter table public.report_supports enable row level security;

create or replace function public.bump_support_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.reports set support_count = support_count + 1 where id = new.report_id;
  return new;
end; $$;
create trigger on_support_insert after insert on public.report_supports for each row execute function public.bump_support_count();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger reports_touch before update on public.reports for each row execute function public.touch_updated_at();

-- Storage policies for report images bucket (public read, anon upload into uploads/)
insert into public.reports (reference,title,description,category,locality,address,latitude,longitude,status,moderation,authority,ai_summary,ai_source,support_count,is_demo,created_at) values
('DEMO-0001','[Demo] Deep pothole near market junction','Large pothole about 1 metre wide at the junction near the vegetable market. Two-wheelers are swerving to avoid it.','pothole','Anna Nagar','2nd Avenue junction, near Anna Nagar market',13.0850,80.2101,'in_progress','approved','Road Maintenance Authority','Wide pothole at a busy market junction causing unsafe swerving.','demo',0,true, now() - interval '6 days'),
('DEMO-0002','[Demo] Garbage piling up beside bus stop','Garbage has been accumulating next to the bus stop for three days and is attracting stray animals.','garbage','T. Nagar','Bus stop opposite Panagal Park',13.0418,80.2341,'under_review','approved','Municipal Corporation – Solid Waste Management','Uncollected garbage at a bus stop for three days.','demo',0,true, now() - interval '3 days'),
('DEMO-0003','[Demo] Streetlight not working on residential lane','The streetlight outside house no. 14 has been off for a week, making the lane dark at night.','streetlight','Adyar','4th Cross Street, Gandhi Nagar',13.0012,80.2565,'resolved','approved','Electricity Distribution Company','Non-functional streetlight on a residential lane for a week.','demo',0,true, now() - interval '12 days');

insert into public.status_history (report_id,status,note,created_at)
select id,'submitted','Report received (demo record).',created_at from public.reports where is_demo;
