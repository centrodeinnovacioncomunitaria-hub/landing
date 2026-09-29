-- CIC · Acceso por cédula con tres perfiles: Secretaría Técnica, Dinamizadora y Emprendedora.
-- Pegar completo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

-- 1. Directorio del equipo (sale del Excel del proyecto). Nadie lo lee desde la página:
--    solo la función cic-acceso, con la llave de servidor, para activar la cuenta la primera vez.
create table if not exists public.directorio (
  cedula       text primary key check (cedula ~ '^[0-9]{5,12}$'),
  nombre       text not null,
  rol          text not null check (rol in ('secretaria', 'dinamizadora')),
  cargo        text,
  correo       text,
  celular      text,
  departamento text
);
alter table public.directorio enable row level security;
revoke all on public.directorio from anon, authenticated;

-- 2. Perfiles: una fila por cuenta activa (equipo que ya ingresó y emprendedoras registradas).
create table if not exists public.perfiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  cedula             text not null unique check (cedula ~ '^[0-9]{5,12}$'),
  nombre             text not null,
  rol                text not null check (rol in ('secretaria', 'dinamizadora', 'emprendedora')),
  cargo              text,
  correo             text,
  celular            text,
  departamento       text,
  municipio          text,
  negocio            text,
  debe_cambiar_clave boolean not null default false,
  acepto_datos_en    timestamptz,
  clave_cambiada_en  timestamptz,
  creado_en          timestamptz not null default now()
);
alter table public.perfiles enable row level security;

-- Funciones de apoyo para las reglas de acceso (evitan que la regla se consulte a sí misma).
create or replace function public.cic_mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;
create or replace function public.cic_mi_departamento() returns text
language sql stable security definer set search_path = public as $$
  select departamento from public.perfiles where id = auth.uid()
$$;
revoke execute on function public.cic_mi_rol() from public, anon;
revoke execute on function public.cic_mi_departamento() from public, anon;
grant execute on function public.cic_mi_rol() to authenticated;
grant execute on function public.cic_mi_departamento() to authenticated;

-- Quién ve qué:
--   · cada persona ve su propio perfil;
--   · la Secretaría Técnica ve todos;
--   · cada dinamizadora ve las emprendedoras de su departamento.
drop policy if exists "ver mi perfil" on public.perfiles;
create policy "ver mi perfil" on public.perfiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "secretaria ve todos" on public.perfiles;
create policy "secretaria ve todos" on public.perfiles
  for select to authenticated using (public.cic_mi_rol() = 'secretaria');

drop policy if exists "dinamizadora ve su departamento" on public.perfiles;
create policy "dinamizadora ve su departamento" on public.perfiles
  for select to authenticated using (
    public.cic_mi_rol() = 'dinamizadora'
    and rol = 'emprendedora'
    and departamento = public.cic_mi_departamento()
  );

-- Cada persona puede corregir sus datos de contacto; el rol, la cédula y el nombre no se tocan desde la página.
drop policy if exists "actualizar mi contacto" on public.perfiles;
create policy "actualizar mi contacto" on public.perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.perfiles from anon;
revoke insert, update, delete on public.perfiles from authenticated;
grant select on public.perfiles to authenticated;
grant update (correo, celular, municipio, negocio) on public.perfiles to authenticated;
