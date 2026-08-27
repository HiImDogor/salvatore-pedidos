-- ===========================================================================
-- SALVATORE — PEDIDOS SEGUROS
-- Ejecuta este archivo una vez en Supabase: SQL Editor > New query > Run.
-- La Edge Function create-order será la única vía pública para crear pedidos.
-- ===========================================================================

-- Nunca expongas datos de clientes a visitantes anónimos.
drop policy if exists "Public can read orders" on public.orders;
drop policy if exists "Public can read order items" on public.order_items;
drop policy if exists "Anyone can insert orders" on public.orders;
drop policy if exists "Anyone can insert order items" on public.order_items;
drop policy if exists "Administrators can view all orders" on public.orders;
drop policy if exists "Administrators can view all order items" on public.order_items;

revoke select, insert on public.orders from anon, authenticated;
revoke select, insert on public.order_items from anon, authenticated;
revoke usage, select on sequence public.orders_id_seq from anon, authenticated;
revoke usage, select on sequence public.order_items_id_seq from anon, authenticated;

-- La Edge Function consulta la disponibilidad usando service_role.
grant select on public.store_availability to service_role;

-- Las inserciones de pedidos se transmiten al panel de cocina conectado.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- El panel ya valida admin_users; RLS aplica la misma regla en la base de datos.
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "Administrators can view all orders" on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ));

create policy "Administrators can view all order items" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ));

-- Crea una orden y sus ítems en una única transacción. No se concede ejecución
-- a clientes: solamente la Edge Function (service_role) puede invocarla.
create or replace function public.create_secure_order(
  p_client_name text,
  p_client_phone text,
  p_delivery_type text,
  p_delivery_address text,
  p_payment_method text,
  p_notes text,
  p_subtotal numeric,
  p_delivery_cost numeric,
  p_total numeric,
  p_world text,
  p_items jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_item jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden debe incluir al menos un producto';
  end if;

  insert into public.orders (
    client_name, client_phone, delivery_type, delivery_address, payment_method,
    notes, subtotal, delivery_cost, total, world, status
  ) values (
    p_client_name, p_client_phone, p_delivery_type, p_delivery_address, p_payment_method,
    coalesce(p_notes, ''), p_subtotal, p_delivery_cost, p_total, p_world, 'pending'
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_name, quantity, unit_price, total_price, extras, notes
    ) values (
      v_order_id,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric,
      array(select jsonb_array_elements_text(coalesce(v_item->'extras', '[]'::jsonb))),
      coalesce(v_item->>'notes', '')
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_secure_order(text, text, text, text, text, text, numeric, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_secure_order(text, text, text, text, text, text, numeric, numeric, numeric, text, jsonb) to service_role;

-- Límite de 5 intentos por IP cada 5 minutos para reducir spam automatizado.
create table if not exists public.order_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.order_rate_limits enable row level security;
revoke all on public.order_rate_limits from public, anon, authenticated;

create or replace function public.claim_order_rate_limit(p_rate_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
begin
  insert into public.order_rate_limits (rate_key, request_count)
  values (p_rate_key, 1)
  on conflict (rate_key) do update
    set request_count = case
          when public.order_rate_limits.window_started_at < now() - interval '5 minutes' then 1
          else public.order_rate_limits.request_count + 1
        end,
        window_started_at = case
          when public.order_rate_limits.window_started_at < now() - interval '5 minutes' then now()
          else public.order_rate_limits.window_started_at
        end,
        updated_at = now()
  returning request_count <= 5 into v_allowed;

  return v_allowed;
end;
$$;

revoke all on function public.claim_order_rate_limit(text) from public, anon, authenticated;
grant execute on function public.claim_order_rate_limit(text) to service_role;
