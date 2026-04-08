create extension if not exists "uuid-ossp";

create table if not exists businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('restaurant', 'retail')),
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null check (name in ('admin', 'cashier', 'supervisor')),
  unique (business_id, name)
);

create table if not exists permissions (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role_id uuid not null references roles(id),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  parent_id uuid references categories(id) on delete set null
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  category_id uuid not null references categories(id),
  name text not null,
  sku text not null,
  price numeric(10,2) not null,
  is_favorite boolean not null default false
);

create table if not exists dining_tables (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  label text not null,
  seats int not null default 2,
  is_active boolean not null default true
);

create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  channel text not null check (channel in ('counter', 'table')),
  table_id uuid references dining_tables(id),
  subtotal numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  line_total numeric(10,2) not null
);

create table if not exists sale_payments (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales(id) on delete cascade,
  method text not null check (method in ('cash', 'card')),
  amount numeric(10,2) not null
);

create table if not exists register_movements (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  type text not null check (type in ('open', 'in', 'out', 'close')),
  amount numeric(10,2) not null,
  note text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table register_movements enable row level security;
alter table customers enable row level security;
