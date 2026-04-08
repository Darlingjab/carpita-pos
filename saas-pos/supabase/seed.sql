insert into permissions (key) values
('sales.create'),
('sales.refund'),
('register.open'),
('register.close'),
('reports.read'),
('products.manage'),
('users.manage')
on conflict do nothing;

insert into businesses (id, name, type, currency)
values ('00000000-0000-0000-0000-000000000001', 'Demo Bistro', 'restaurant', 'USD')
on conflict do nothing;

insert into roles (id, business_id, name) values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'cashier'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'supervisor')
on conflict do nothing;

insert into categories (id, business_id, name, parent_id) values
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Food', null),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Drinks', null),
('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Pasta', '20000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into products (id, business_id, category_id, name, sku, price, is_favorite) values
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Spaghetti Bolognese', 'PASTA-001', 14.50, true),
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Caesar Salad', 'SALAD-001', 10.00, false),
('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Iced Latte', 'DRINK-001', 5.50, true)
on conflict do nothing;

insert into dining_tables (id, business_id, label, seats, is_active) values
('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'T1', 2, true),
('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'T2', 4, true),
('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'T3', 4, true)
on conflict do nothing;

insert into customers (business_id, name, phone, email) values
('00000000-0000-0000-0000-000000000001', 'Consumidor final', null, null),
('00000000-0000-0000-0000-000000000001', 'María López', '0999999999', null),
('00000000-0000-0000-0000-000000000001', 'Carlos Pérez', null, 'carlos@example.com')
on conflict do nothing;
