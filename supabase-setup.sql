-- Ejecuta todo este archivo en Supabase: SQL Editor > New query > Run.
create table if not exists public.store_availability (
  id integer primary key check (id = 1),
  status text not null check (status in ('available', 'busy', 'closed')) default 'available',
  wait text not null default '25–35 min',
  note text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.store_availability (id, status, wait, note)
values (1, 'available', '25–35 min', '') on conflict (id) do nothing;
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.store_availability enable row level security;
alter table public.admin_users enable row level security;
revoke all on public.store_availability from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;
grant select on public.store_availability to anon, authenticated;
grant update on public.store_availability to authenticated;
grant select on public.admin_users to authenticated;
create policy "Public can read availability" on public.store_availability for select to anon, authenticated using (true);
create policy "Only administrators update availability" on public.store_availability for update to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid())) with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "Administrators can check their role" on public.admin_users for select to authenticated using (user_id = auth.uid());
-- Después de crear tu usuario en Authentication > Users, reemplaza el correo y ejecuta:
-- insert into public.admin_users (user_id) select id from auth.users where email = 'tu-correo@ejemplo.com' on conflict do nothing;
