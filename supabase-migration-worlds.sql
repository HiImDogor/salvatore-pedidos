-- Ejecuta este archivo una sola vez en Supabase: SQL Editor > New query > Run.
-- Conserva el estado actual como estado inicial de Pizzas y habilita uno independiente para Waffles.
alter table public.store_availability add column if not exists pizza_status text check (pizza_status in ('available', 'busy', 'closed')) default 'available';
alter table public.store_availability add column if not exists pizza_wait text default '25–35 min';
alter table public.store_availability add column if not exists pizza_note text default '';
alter table public.store_availability add column if not exists waffle_status text check (waffle_status in ('available', 'busy', 'closed')) default 'available';
alter table public.store_availability add column if not exists waffle_wait text default '25–35 min';
alter table public.store_availability add column if not exists waffle_note text default '';
update public.store_availability set pizza_status=coalesce(pizza_status,status),pizza_wait=coalesce(pizza_wait,wait),pizza_note=coalesce(pizza_note,note),waffle_status=coalesce(waffle_status,'available'),waffle_wait=coalesce(waffle_wait,'25–35 min'),waffle_note=coalesce(waffle_note,'') where id=1;
