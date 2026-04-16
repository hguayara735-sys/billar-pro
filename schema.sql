-- ================================================================
-- BILLAR PRO — Esquema base de datos
-- Supabase / PostgreSQL
-- RLS desactivado (habilitar por tabla cuando se implemente auth)
-- ================================================================

-- ── Extensiones ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ================================================================
-- TABLAS
-- ================================================================

-- ── salones ──────────────────────────────────────────────────────
create table salones (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  direccion   text,
  nit         text,
  logo_url    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── mesas ────────────────────────────────────────────────────────
create table mesas (
  id          uuid primary key default uuid_generate_v4(),
  salon_id    uuid not null references salones(id) on delete cascade,
  numero      smallint not null,
  nombre      text not null,
  estado      text not null default 'cerrada'
                check (estado in ('cerrada', 'activa', 'reservada')),
  created_at  timestamptz not null default now(),
  unique (salon_id, numero)
);

-- ── tarifas ──────────────────────────────────────────────────────
create table tarifas (
  id           uuid primary key default uuid_generate_v4(),
  salon_id     uuid not null references salones(id) on delete cascade,
  nombre       text not null,
  precio_hora  numeric(10,2) not null default 0,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── productos ────────────────────────────────────────────────────
create table productos (
  id          uuid primary key default uuid_generate_v4(),
  salon_id    uuid not null references salones(id) on delete cascade,
  codigo      text not null,
  nombre      text not null,
  precio      numeric(10,2) not null default 0,
  tax_rate    numeric(5,4) not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (salon_id, codigo)
);

-- ── sesiones ─────────────────────────────────────────────────────
create table sesiones (
  id          uuid primary key default uuid_generate_v4(),
  mesa_id     uuid not null references mesas(id) on delete restrict,
  inicio      timestamptz not null default now(),
  fin         timestamptz,
  estado      text not null default 'abierta'
                check (estado in ('abierta', 'cerrada', 'facturada')),
  created_at  timestamptz not null default now()
);

-- ── jugadores_sesion ─────────────────────────────────────────────
-- color: 'blanco' | 'amarillo' | 'rojo' | 'azul'
create table jugadores_sesion (
  id          uuid primary key default uuid_generate_v4(),
  sesion_id   uuid not null references sesiones(id) on delete cascade,
  nombre      text not null,
  score       integer not null default 0,
  color       text not null,
  created_at  timestamptz not null default now()
);

-- ── consumos ─────────────────────────────────────────────────────
create table consumos (
  id           uuid primary key default uuid_generate_v4(),
  sesion_id    uuid not null references sesiones(id) on delete cascade,
  producto_id  uuid not null references productos(id) on delete restrict,
  cantidad     integer not null default 1 check (cantidad > 0),
  precio_unit  numeric(10,2) not null,
  subtotal     numeric(10,2) not null,
  created_at   timestamptz not null default now()
);

-- ── facturas ─────────────────────────────────────────────────────
create table facturas (
  id               uuid primary key default uuid_generate_v4(),
  sesion_id        uuid not null references sesiones(id) on delete restrict,
  tiempo_total     integer not null default 0,
  valor_tiempo     numeric(10,2) not null default 0,
  valor_consumo    numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  pagado           boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (sesion_id)
);

-- ── usuarios ─────────────────────────────────────────────────────
create table usuarios (
  id          uuid primary key default uuid_generate_v4(),
  salon_id    uuid references salones(id) on delete set null,
  nombre      text not null,
  email       text not null unique,
  rol         text not null default 'operador'
                check (rol in ('superadmin', 'admin', 'operador')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ================================================================
-- ÍNDICES
-- ================================================================

create index on mesas           (salon_id);
create index on tarifas         (salon_id);
create index on productos       (salon_id);
create index on sesiones        (mesa_id);
create index on sesiones        (estado);
create index on jugadores_sesion(sesion_id);
create index on consumos        (sesion_id);
create index on consumos        (producto_id);
create index on facturas        (sesion_id);
create index on usuarios        (salon_id);
create index on usuarios        (email);

-- ================================================================
-- RLS — desactivado por ahora
-- ================================================================

alter table salones          disable row level security;
alter table mesas            disable row level security;
alter table tarifas          disable row level security;
alter table productos        disable row level security;
alter table sesiones         disable row level security;
alter table jugadores_sesion disable row level security;
alter table consumos         disable row level security;
alter table facturas         disable row level security;
alter table usuarios         disable row level security;
