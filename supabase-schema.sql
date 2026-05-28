-- Run this in the Supabase SQL Editor

create table if not exists flights (
  id bigint generated always as identity primary key,
  datum date not null,
  startplatz text not null,
  landeplatz text not null,
  gleitschirm text not null,
  gurtzeug text,
  flugzeit integer,
  bemerkungen text,
  created_at timestamptz default now()
);

create table if not exists startplaetze (
  id bigint generated always as identity primary key,
  name text unique not null
);

create table if not exists landplaetze (
  id bigint generated always as identity primary key,
  name text unique not null
);

create table if not exists gleitschirme (
  id bigint generated always as identity primary key,
  name text unique not null
);

create table if not exists gurtzeugs (
  id bigint generated always as identity primary key,
  name text unique not null
);

alter table flights enable row level security;
alter table startplaetze enable row level security;
alter table landplaetze enable row level security;
alter table gleitschirme enable row level security;
alter table gurtzeugs enable row level security;

create policy "allow_all_flights" on flights for all using (true) with check (true);
create policy "allow_all_start" on startplaetze for all using (true) with check (true);
create policy "allow_all_land" on landplaetze for all using (true) with check (true);
create policy "allow_all_schirm" on gleitschirme for all using (true) with check (true);
create policy "allow_all_gurtz" on gurtzeugs for all using (true) with check (true);
