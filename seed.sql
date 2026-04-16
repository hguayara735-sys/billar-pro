-- ================================================================
-- BILLAR PRO — Seed de datos de prueba
-- Ejecutar UNA sola vez en Supabase SQL Editor
-- ================================================================

do $$
declare
  salon_id uuid;
begin

  -- ── 1. Salón ────────────────────────────────────────────────────
  insert into salones (nombre, direccion, activo)
  values ('Billar Tito', 'Dirección por configurar', true)
  returning id into salon_id;

  -- ── 2. Mesas (14) ───────────────────────────────────────────────
  insert into mesas (salon_id, numero, nombre, estado)
  select
    salon_id,
    n,
    'Mesa ' || n,
    'cerrada'
  from generate_series(1, 14) as n;

  -- ── 3. Productos ────────────────────────────────────────────────
  insert into productos (salon_id, codigo, nombre, precio, tax_rate, activo)
  values
    -- Tiempo de mesa
    (salon_id, 'T01', 'Tiempo x hora',       0,      0,    true),
    (salon_id, 'T02', 'Tiempo x media hora', 0,      0,    true),
    (salon_id, 'T03', 'Tiempo x 15 min',     0,      0,    true),
    -- Bebidas
    (salon_id, 'BEB-AG', 'Agua 600ml',       2500,   0,    true),
    (salon_id, 'BEB-GA', 'Gaseosa 350ml',    3000,   0,    true),
    (salon_id, 'BEB-CE', 'Cerveza',          5000,   0.19, true),
    (salon_id, 'BEB-PO', 'Pony Malta',       3500,   0,    true),
    (salon_id, 'BEB-JU', 'Jugo natural',     4000,   0,    true),
    (salon_id, 'BEB-CA', 'Café',             2000,   0,    true),
    -- Snacks
    (salon_id, 'SNK-CH', 'Chips',            2000,   0.19, true),
    (salon_id, 'SNK-MA', 'Maní',             1500,   0.19, true),
    (salon_id, 'SNK-GO', 'Gomas',            1000,   0.19, true),
    -- Accesorios
    (salon_id, 'ACC-TA', 'Taco extra',       3000,   0,    true),
    (salon_id, 'ACC-TI', 'Tiza',             500,    0,    true);

end $$;
