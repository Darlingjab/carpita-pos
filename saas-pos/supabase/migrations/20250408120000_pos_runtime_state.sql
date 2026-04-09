-- Estado operativo del POS (ventas, caja, cocina, clientes, usuarios demo).
-- La app Next.js escribe aquí con SUPABASE_SERVICE_ROLE_KEY (solo servidor).
-- RLS sin políticas públicas: anon/authenticated no ven filas; el service role ignora RLS.

create table if not exists pos_runtime_state (
  id text primary key default 'default',
  sales jsonb not null default '[]'::jsonb,
  register_movements jsonb not null default '[]'::jsonb,
  kitchen_tickets jsonb not null default '[]'::jsonb,
  customers jsonb not null default '[]'::jsonb,
  customer_points_movements jsonb not null default '[]'::jsonb,
  user_accounts jsonb not null default '[]'::jsonb,
  register_open boolean not null default false,
  register_opening_float numeric not null default 0,
  updated_at timestamptz not null default now()
);

insert into pos_runtime_state (id) values ('default') on conflict (id) do nothing;

alter table pos_runtime_state enable row level security;
