-- Velora accounts: database plan for Supabase (Postgres). NOT applied anywhere yet.
-- Rule of the house: the website (public "anon" key) can only READ a signed-in person's own rows.
-- Everything that costs money or proves a right (premium, licenses) is written only by the server
-- (service role, from the payment provider's webhook), never by the browser.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  premium_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.licenses (
  id text primary key check (id ~ '^VL-[0-9]{4}-[A-Z0-9]{8,}$'),
  user_id uuid not null references auth.users (id) on delete restrict,
  song_id text not null check (song_id ~ '^rm-[0-9]{4,}$'),
  type text not null check (type in ('rent', 'buy', 'exclusive', 'premium')),
  buyer_name text not null check (char_length(buyer_name) between 1 and 120),
  allowed_use text not null check (char_length(allowed_use) <= 400),
  issued_at timestamptz not null default now(),
  valid_until timestamptz,
  payment_ref text
);
create index licenses_user_idx on public.licenses (user_id, issued_at desc);

alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.licenses enable row level security;

-- A signed-in person sees and edits only their own profile.
create policy "own profile: read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Premium status and licenses: read your own; no insert, update or delete policy exists,
-- so only the service role (server) can write them.
create policy "own entitlement: read" on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);
create policy "own licenses: read" on public.licenses for select to authenticated using ((select auth.uid()) = user_id);

-- A new account gets its profile row automatically.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Public "verify a license" check: anyone with a license number gets only what a certificate shows.
-- No email, no payment reference, no user id.
create function public.verify_license(license_id text)
returns table (id text, song_id text, type text, buyer_name text, issued_at timestamptz, valid_until timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.song_id, l.type, l.buyer_name, l.issued_at, l.valid_until
  from public.licenses l where l.id = upper(license_id)
$$;
revoke all on function public.verify_license(text) from public;
grant execute on function public.verify_license(text) to anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
