-- Feature: Asistente de Maletas
-- Tablas: viajes, destinos, viaje_eventos, viaje_preferencias_prendas,
--         viaje_preferencias_estilos, viaje_looks, viaje_look_prendas,
--         viaje_basicos_sugeridos

create table public.viajes (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  nombre            text        not null,
  fecha_inicio      date        not null,
  fecha_fin         date        not null,
  modo_optimizacion text        not null default 'maleta_liviana'
                      check (modo_optimizacion in ('maleta_liviana', 'estilo_completo')),
  estado            text        not null default 'borrador'
                      check (estado in ('borrador', 'listo', 'en_viaje', 'completado')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.destinos (
  id        uuid     primary key default gen_random_uuid(),
  viaje_id  uuid     not null references public.viajes(id) on delete cascade,
  ciudad    text     not null,
  pais      text     not null,
  orden     smallint not null default 0
);

create table public.viaje_eventos (
  id             uuid     primary key default gen_random_uuid(),
  viaje_id       uuid     not null references public.viajes(id) on delete cascade,
  tipo           text     not null
                   check (tipo in ('trabajo','playa','outdoor','noche','paseos','deporte','formal')),
  cantidad_looks smallint not null default 1 check (cantidad_looks > 0)
);

create table public.viaje_preferencias_prendas (
  id        uuid primary key default gen_random_uuid(),
  viaje_id  uuid not null references public.viajes(id) on delete cascade,
  prenda_id uuid not null references public.prendas(id) on delete cascade,
  tipo      text not null check (tipo in ('incluir', 'excluir'))
);

create table public.viaje_preferencias_estilos (
  id        uuid primary key default gen_random_uuid(),
  viaje_id  uuid not null references public.viajes(id) on delete cascade,
  estilo    text not null
);

create table public.viaje_looks (
  id               uuid        primary key default gen_random_uuid(),
  viaje_id         uuid        not null references public.viajes(id) on delete cascade,
  viaje_evento_id  uuid        not null references public.viaje_eventos(id) on delete cascade,
  nombre           text        not null,
  descripcion_ia   text,
  numero_en_evento smallint    not null default 1,
  created_at       timestamptz not null default now()
);

create table public.viaje_look_prendas (
  id             uuid primary key default gen_random_uuid(),
  viaje_look_id  uuid not null references public.viaje_looks(id) on delete cascade,
  prenda_id      uuid not null references public.prendas(id) on delete cascade
);

create table public.viaje_basicos_sugeridos (
  id          uuid     primary key default gen_random_uuid(),
  viaje_id    uuid     not null references public.viajes(id) on delete cascade,
  tipo_prenda text     not null,
  cantidad    smallint not null default 1
);

-- ── RLS ────────────────────────────────────────────────────────────────────────

alter table public.viajes                     enable row level security;
alter table public.destinos                   enable row level security;
alter table public.viaje_eventos              enable row level security;
alter table public.viaje_preferencias_prendas enable row level security;
alter table public.viaje_preferencias_estilos enable row level security;
alter table public.viaje_looks                enable row level security;
alter table public.viaje_look_prendas         enable row level security;
alter table public.viaje_basicos_sugeridos    enable row level security;

create policy "owner" on public.viajes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owner_via_viaje" on public.destinos
  for all using (
    exists (select 1 from public.viajes where id = destinos.viaje_id and user_id = auth.uid())
  );

create policy "owner_via_viaje" on public.viaje_eventos
  for all using (
    exists (select 1 from public.viajes where id = viaje_eventos.viaje_id and user_id = auth.uid())
  );

create policy "owner_via_viaje" on public.viaje_preferencias_prendas
  for all using (
    exists (select 1 from public.viajes where id = viaje_preferencias_prendas.viaje_id and user_id = auth.uid())
  );

create policy "owner_via_viaje" on public.viaje_preferencias_estilos
  for all using (
    exists (select 1 from public.viajes where id = viaje_preferencias_estilos.viaje_id and user_id = auth.uid())
  );

create policy "owner_via_viaje" on public.viaje_looks
  for all using (
    exists (select 1 from public.viajes where id = viaje_looks.viaje_id and user_id = auth.uid())
  );

create policy "owner_via_look" on public.viaje_look_prendas
  for all using (
    exists (
      select 1 from public.viaje_looks vl
      join  public.viajes v on v.id = vl.viaje_id
      where vl.id = viaje_look_prendas.viaje_look_id
        and v.user_id = auth.uid()
    )
  );

create policy "owner_via_viaje" on public.viaje_basicos_sugeridos
  for all using (
    exists (select 1 from public.viajes where id = viaje_basicos_sugeridos.viaje_id and user_id = auth.uid())
  );
