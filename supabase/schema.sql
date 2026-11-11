-- ============================================================
-- Velora database (Supabase / Postgres). Applied to the project "velora" on 11 Nov 2026.
-- ============================================================
-- Built for many creators from day one: every artist and every song belongs to an account,
-- so other creators' accounts can be opened later without a rebuild (see docs/UPLOAD-STUDIO.md).
--
-- Rules of the house
--  1. Visitors (no account) read only what is published, through public_catalogue().
--  2. Nobody writes to a table directly. Every change goes through a function in this file,
--     which checks who is asking and what they send.
--  3. Money and rights (premium, licenses) are written only by the server.
--  4. Ownership records are append-only. They can't be changed or deleted, and each one carries the
--     fingerprint of the one before it, so an edit or a gap would show.
--  5. Uploaded files live in the storage bucket "media", each account in its own folder; files can be
--     added but not deleted through the site.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------- Accounts ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  role text not null default 'listener' check (role in ('listener', 'creator', 'owner')),
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
  song_id text not null check (song_id ~ '^(rm|vs)-[0-9]{4,}$'),
  type text not null check (type in ('rent', 'buy', 'exclusive', 'premium')),
  buyer_name text not null check (char_length(buyer_name) between 1 and 120),
  allowed_use text not null check (char_length(allowed_use) <= 400),
  issued_at timestamptz not null default now(),
  valid_until timestamptz,
  payment_ref text
);
create index licenses_user_idx on public.licenses (user_id, issued_at desc);

-- ---------- Artists and songs ----------
create table public.artists (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  tagline text check (tagline is null or char_length(tagline) <= 120),
  bio text check (bio is null or char_length(bio) <= 1500),
  image_path text,
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index artists_owner_idx on public.artists (owner_id);

create sequence public.song_number start 1001;

create table public.songs (
  id text primary key check (id ~ '^vs-[0-9]{4,}$'),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'published', 'unlisted')),
  artist_id text references public.artists (id) on delete restrict,
  title text check (title is null or char_length(title) between 1 and 120),
  version text check (version is null or char_length(version) <= 40),
  featured jsonb not null default '[]',
  credits jsonb not null default '[]',
  genre text, subgenre text, moods text[] not null default '{}', language text,
  explicit boolean not null default false,
  adult boolean not null default false,
  lyrics jsonb, lyrics_synced boolean not null default true,
  sections jsonb not null default '[]',
  best_part numeric not null default 0,
  duration numeric, bpm integer, key text,
  audio_path text, cover_path text, color text,
  release_date date, created_on date,
  ai jsonb not null default '{}',
  mastered boolean not null default false, loudness jsonb,
  holder text,
  priority integer not null default 0,           -- later: paid priority placement
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index songs_owner_idx on public.songs (owner_id, created_at desc);
create index songs_published_idx on public.songs (status, priority desc, published_at desc);
create index songs_artist_idx on public.songs (artist_id);

-- ---------- Ownership records (append-only, chained) ----------
create table public.ownership_records (
  id bigint generated always as identity primary key,
  song_id text not null references public.songs (id) on delete restrict,
  owner_id uuid not null,
  kind text not null check (kind in ('published', 'unlisted', 'relisted')),
  recorded_at timestamptz not null,
  title text not null,
  artist_name text,
  holder text,
  details jsonb not null default '{}',
  prev_hash text,
  record_hash text not null
);
create index ownership_records_song_idx on public.ownership_records (song_id, id);

create function private.no_change() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Ownership records cannot be changed or deleted.';
end $$;
create trigger ownership_records_keep before update or delete on public.ownership_records
  for each row execute function private.no_change();
create trigger ownership_records_keep_all before truncate on public.ownership_records
  for each statement execute function private.no_change();

-- The one-time setup code for the owner's account (only its fingerprint is stored).
create table private.owner_setup (
  id integer primary key default 1 check (id = 1),
  code_hash text not null,
  attempts integer not null default 0,
  used_at timestamptz,
  owner_id uuid
);

-- ---------- Who may read what ----------
alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.licenses enable row level security;
alter table public.artists enable row level security;
alter table public.songs enable row level security;
alter table public.ownership_records enable row level security;
alter table private.owner_setup enable row level security;

revoke all on public.profiles, public.entitlements, public.licenses, public.artists, public.songs, public.ownership_records from anon, authenticated;
revoke all on sequence public.song_number from anon, authenticated;
grant select on public.profiles, public.entitlements, public.licenses, public.artists, public.songs, public.ownership_records to authenticated;

-- A signed-in person reads only their own rows. There is no insert, update or delete policy anywhere:
-- writing happens only inside the functions below.
create policy "own profile: read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own entitlement: read" on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);
create policy "own licenses: read" on public.licenses for select to authenticated using ((select auth.uid()) = user_id);
create policy "own artists: read" on public.artists for select to authenticated using ((select auth.uid()) = owner_id);
create policy "own songs: read" on public.songs for select to authenticated using ((select auth.uid()) = owner_id);
create policy "own records: read" on public.ownership_records for select to authenticated using ((select auth.uid()) = owner_id);

-- ---------- Helpers (private: not reachable through the API) ----------
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.can_upload(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role in ('creator', 'owner'));
$$;
revoke all on function private.can_upload(uuid) from public;
grant execute on function private.can_upload(uuid) to authenticated, service_role;

-- A song as the site reads it. File fields are storage paths; the site turns them into addresses.
create function private.song_json(s public.songs) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', s.id,
    'title', s.title || case when coalesce(s.version, '') <> '' then ' (' || s.version || ')' else '' end,
    'genre', s.genre, 'subgenre', s.subgenre, 'tags', to_json(s.moods), 'mood', coalesce(s.moods[1], ''),
    'language', s.language, 'explicit', s.explicit, 'adult', s.adult,
    'duration', s.duration, 'bpm', s.bpm, 'key', s.key,
    'audio', s.audio_path, 'art', s.cover_path, 'color', s.color,
    'sections', s.sections, 'bestPart', s.best_part,
    'lyrics', s.lyrics, 'lyricsSynced', s.lyrics_synced,
    'lyricsNote', case when s.lyrics is null then null when s.lyrics_synced then 'Lyrics from the artist.' else 'Lyrics from the artist; not timed to the music yet.' end,
    'created', s.created_on, 'published', (s.published_at at time zone 'UTC')::date,
    'artist', s.artist_id, 'credits', s.credits, 'ai', s.ai, 'holder', s.holder,
    'record', (select json_build_object('id', r.id, 'at', r.recorded_at, 'hash', r.record_hash)
               from public.ownership_records r where r.song_id = s.id and r.kind = 'published' order by r.id limit 1)
  );
$$;
revoke all on function private.song_json(public.songs) from public;

-- Add one ownership record. The fingerprint covers the record and the fingerprint before it.
create function private.add_record(p_song text, p_owner uuid, p_kind text, p_title text, p_artist text, p_holder text, p_details jsonb)
returns public.ownership_records
language plpgsql security definer set search_path = '' as $$
declare
  prev text;
  ts timestamptz := date_trunc('milliseconds', clock_timestamp());
  d jsonb := coalesce(p_details, '{}'::jsonb);
  rec public.ownership_records;
begin
  perform pg_advisory_xact_lock(727274);          -- one writer at a time keeps the chain in order
  select record_hash into prev from public.ownership_records order by id desc limit 1;
  insert into public.ownership_records (song_id, owner_id, kind, recorded_at, title, artist_name, holder, details, prev_hash, record_hash)
  values (p_song, p_owner, p_kind, ts, p_title, p_artist, p_holder, d, prev,
    encode(sha256(convert_to(
      coalesce(prev, '') || '|' || p_song || '|' || p_owner::text || '|' || p_kind || '|' ||
      to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' || p_title || '|' ||
      coalesce(p_artist, '') || '|' || coalesce(p_holder, '') || '|' || d::text, 'UTF8')), 'hex'))
  returning * into rec;
  return rec;
end $$;
revoke all on function private.add_record(text, uuid, text, text, text, text, jsonb) from public;

create function private.hex64(v text) returns text language sql immutable set search_path = '' as $$
  select case when v ~ '^[0-9a-f]{64}$' then v else null end;
$$;

-- ============================================================
-- The API: functions the site calls
-- ============================================================

-- Everyone: the published songs and their artists.
create function public.public_catalogue() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'complete', true,
    'songs', coalesce((select json_agg(private.song_json(s) order by s.priority desc, s.published_at desc)
                       from public.songs s where s.status = 'published'), '[]'::json),
    'artists', coalesce((select json_agg(json_build_object('id', a.id, 'name', a.name, 'tagline', a.tagline, 'bio', a.bio, 'color', a.color, 'image', a.image_path) order by a.name)
                         from public.artists a
                         where exists (select 1 from public.songs s where s.artist_id = a.id and s.status = 'published')), '[]'::json)
  );
$$;

-- Everyone: the ownership records of a published song (what a certificate shows; no account data).
create function public.song_record(p_song text) returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', r.id, 'kind', r.kind, 'at', r.recorded_at, 'title', r.title, 'artist', r.artist_name,
           'holder', r.holder, 'details', r.details - 'audio_path' - 'cover_path', 'prev', r.prev_hash, 'hash', r.record_hash) order by r.id), '[]'::json)
  from public.ownership_records r
  join public.songs s on s.id = r.song_id
  where r.song_id = p_song and s.status = 'published';
$$;

-- Everyone: check a license number (only what a certificate shows).
create function public.verify_license(license_id text)
returns table (id text, song_id text, type text, buyer_name text, issued_at timestamptz, valid_until timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.song_id, l.type, l.buyer_name, l.issued_at, l.valid_until
  from public.licenses l where l.id = upper(license_id);
$$;

-- Signed in: who am I. (The four "my ..." read functions run with the caller's own rights:
-- the row rules above already let a person read their own rows.)
create function public.my_profile() returns json
language sql stable security invoker set search_path = '' as $$
  select json_build_object(
    'role', coalesce((select p.role from public.profiles p where p.id = (select auth.uid())), 'listener'),
    'display_name', (select p.display_name from public.profiles p where p.id = (select auth.uid())),
    'premium', exists (select 1 from public.entitlements e where e.user_id = (select auth.uid()) and e.premium_until > now())
  );
$$;

create function public.my_licenses() returns json
language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', l.id, 'song_id', l.song_id, 'type', l.type, 'issued_at', l.issued_at, 'valid_until', l.valid_until) order by l.issued_at desc), '[]'::json)
  from public.licenses l where l.user_id = (select auth.uid());
$$;

-- Uploader: my artist names.
create function public.my_artists() returns json
language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', a.id, 'name', a.name, 'tagline', a.tagline, 'bio', a.bio, 'color', a.color, 'image', a.image_path,
           'songs', (select count(*) from public.songs s where s.artist_id = a.id and s.status = 'published')) order by a.name), '[]'::json)
  from public.artists a where a.owner_id = (select auth.uid());
$$;

-- Uploader: add or change one of my artist names.
create function public.save_artist(p jsonb) returns json
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_id text := lower(btrim(coalesce(p->>'id', '')));
  v_name text := btrim(coalesce(p->>'name', ''));
  v_tag text := nullif(btrim(coalesce(p->>'tagline', '')), '');
  v_bio text := nullif(btrim(coalesce(p->>'bio', '')), '');
  v_img text := nullif(coalesce(p->>'image_path', ''), '');
  v_color text := nullif(coalesce(p->>'color', ''), '');
  a public.artists;
begin
  if uid is null or not private.can_upload(uid) then raise exception 'Only an uploader account can do this.' using errcode = '42501'; end if;
  if v_id !~ '^[a-z0-9][a-z0-9-]{1,48}$' then raise exception 'The artist name needs letters or numbers.'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'The artist name must have 1 to 80 characters.'; end if;
  if char_length(coalesce(v_tag, '')) > 120 then raise exception 'The tagline is too long (120 characters at most).'; end if;
  if char_length(coalesce(v_bio, '')) > 1500 then raise exception 'The text about the artist is too long (1,500 characters at most).'; end if;
  if v_color is not null and v_color !~ '^#[0-9a-fA-F]{6}$' then v_color := null; end if;
  if v_img is not null then
    if v_img !~ ('^' || uid::text || '/artists/[a-z0-9-]{2,49}-[0-9a-f]{8,64}\.jpg$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = v_img) then
      raise exception 'The artist photo was not found.';
    end if;
  end if;
  select * into a from public.artists where id = v_id;
  if found and a.owner_id <> uid then raise exception 'This artist name is already taken.'; end if;
  if found then
    update public.artists set name = v_name, tagline = v_tag, bio = v_bio, color = coalesce(v_color, color),
      image_path = coalesce(v_img, image_path), updated_at = now() where id = v_id returning * into a;
  else
    if (select count(*) from public.artists where owner_id = uid) >= 200 then raise exception 'Too many artist names on this account.'; end if;
    insert into public.artists (id, owner_id, name, tagline, bio, image_path, color) values (v_id, uid, v_name, v_tag, v_bio, v_img, v_color) returning * into a;
  end if;
  return json_build_object('id', a.id, 'name', a.name, 'tagline', a.tagline, 'bio', a.bio, 'color', a.color, 'image', a.image_path);
end $$;

-- Uploader: get the number for a new song (a draft nobody else sees). An unused draft is handed out again.
create function public.reserve_song() returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); v_id text;
begin
  if uid is null or not private.can_upload(uid) then raise exception 'Only an uploader account can upload.' using errcode = '42501'; end if;
  select id into v_id from public.songs where owner_id = uid and status = 'draft' order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  v_id := 'vs-' || lpad(nextval('public.song_number')::text, 4, '0');
  insert into public.songs (id, owner_id) values (v_id, uid);
  return v_id;
end $$;

-- Uploader: publish a draft. Checks every field, makes the song public and writes the ownership record.
create function public.publish_song(p jsonb) returns json
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.songs;
  a public.artists;
  rec public.ownership_records;
  v_title text := btrim(coalesce(p->>'title', ''));
  v_version text := nullif(btrim(coalesce(p->>'version', '')), '');
  v_genre text := btrim(coalesce(p->>'genre', ''));
  v_sub text := nullif(btrim(coalesce(p->>'subgenre', '')), '');
  v_lang text := btrim(coalesce(p->>'language', ''));
  v_audio text := coalesce(p->>'audio_path', '');
  v_cover text := coalesce(p->>'cover_path', '');
  v_dur numeric := coalesce((p->>'duration')::numeric, 0);
  v_explicit boolean := coalesce((p->>'explicit')::boolean, false);
  v_adult boolean := coalesce((p->>'adult')::boolean, false);
  v_moods text[];
  v_lyrics jsonb := null;
  v_sections jsonb := '[]';
  v_credits jsonb := '[]';
  v_featured jsonb := '[]';
  v_ai jsonb := '{}';
  v_loud jsonb := null;
  v_color text := nullif(coalesce(p->>'color', ''), '');
  v_release date := coalesce(nullif(p->>'release_date', '')::date, current_date);
  v_created date := nullif(p->>'created_on', '')::date;
  v_holder text;
begin
  if uid is null or not private.can_upload(uid) then raise exception 'Only an uploader account can publish.' using errcode = '42501'; end if;
  if pg_column_size(p) > 400000 then raise exception 'Too much data in one song.'; end if;
  select * into s from public.songs where id = coalesce(p->>'id', '') and owner_id = uid for update;
  if not found then raise exception 'This draft was not found.'; end if;
  if s.status <> 'draft' then raise exception 'This song is already published.'; end if;

  if char_length(v_title) not between 1 and 120 then raise exception 'The title must have 1 to 120 characters.'; end if;
  if char_length(coalesce(v_version, '')) > 40 then raise exception 'The version is too long (40 characters at most).'; end if;
  select * into a from public.artists where id = coalesce(p->>'artist_id', '') and owner_id = uid;
  if not found then raise exception 'Choose an artist name.'; end if;
  if char_length(v_genre) not between 1 and 60 then raise exception 'Choose a genre.'; end if;
  if char_length(coalesce(v_sub, '')) > 60 then raise exception 'The sub-genre is too long.'; end if;
  if char_length(v_lang) not between 1 and 40 then raise exception 'Choose the language.'; end if;
  if v_dur < 20 or v_dur > 3600 then raise exception 'The song length is not valid.'; end if;
  if coalesce((p->>'rights_confirmed')::boolean, false) is not true then raise exception 'Confirm that you own the rights.'; end if;

  if v_audio !~ ('^' || uid::text || '/' || s.id || '/audio-[0-9a-f]{8,64}\.mp3$')
     or not exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = v_audio) then
    raise exception 'The song file was not found on the server.';
  end if;
  if v_cover !~ ('^' || uid::text || '/' || s.id || '/cover-[0-9a-f]{8,64}\.jpg$')
     or not exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = v_cover) then
    raise exception 'The cover was not found on the server.';
  end if;

  select coalesce(array_agg(x), '{}') into v_moods
  from (select btrim(value) as x from jsonb_array_elements_text(case when jsonb_typeof(p->'moods') = 'array' then p->'moods' else '[]'::jsonb end) limit 3) t
  where x <> '' and char_length(x) <= 40;
  if coalesce(array_length(v_moods, 1), 0) = 0 then raise exception 'Choose at least one mood.'; end if;

  if jsonb_typeof(p->'lyrics') = 'array' and jsonb_array_length(p->'lyrics') > 0 then
    if jsonb_array_length(p->'lyrics') > 400 or exists (
         select 1 from jsonb_array_elements(p->'lyrics') e
         where jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2 or jsonb_typeof(e->0) <> 'number'
            or jsonb_typeof(e->1) <> 'string' or char_length(e->>1) > 300) then
      raise exception 'The lyrics are not in the right form.';
    end if;
    v_lyrics := p->'lyrics';
  end if;
  if jsonb_typeof(p->'sections') = 'array' then
    if jsonb_array_length(p->'sections') > 40 or exists (
         select 1 from jsonb_array_elements(p->'sections') e
         where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'name') <> 'string' or char_length(e->>'name') > 40 or jsonb_typeof(e->'start') <> 'number') then
      raise exception 'The song parts are not in the right form.';
    end if;
    v_sections := p->'sections';
  end if;
  if jsonb_typeof(p->'credits') = 'array' then
    if jsonb_array_length(p->'credits') > 30 or exists (
         select 1 from jsonb_array_elements(p->'credits') e
         where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'name') <> 'string' or char_length(e->>'name') not between 1 and 80
            or jsonb_typeof(e->'roles') <> 'array' or jsonb_array_length(e->'roles') > 6 or char_length(e::text) > 700) then
      raise exception 'The credits are not in the right form.';
    end if;
    v_credits := p->'credits';
  end if;
  if jsonb_typeof(p->'featured') = 'array' and jsonb_array_length(p->'featured') <= 10 and char_length((p->'featured')::text) <= 1200 then v_featured := p->'featured'; end if;
  if jsonb_typeof(p->'ai') = 'object' and char_length((p->'ai')::text) <= 600 then v_ai := p->'ai'; end if;
  if jsonb_typeof(p->'loudness') = 'object' and char_length((p->'loudness')::text) <= 400 then v_loud := p->'loudness'; end if;
  if v_color is not null and v_color !~ '^#[0-9a-fA-F]{6}$' then v_color := null; end if;
  if v_created is not null and v_created > current_date then v_created := null; end if;
  select coalesce(nullif(btrim(pr.display_name), ''), 'The uploader') into v_holder from public.profiles pr where pr.id = uid;

  update public.songs set
    status = 'published', artist_id = a.id, title = v_title, version = v_version, featured = v_featured, credits = v_credits,
    genre = v_genre, subgenre = v_sub, moods = v_moods, language = v_lang, explicit = v_explicit, adult = (v_adult or v_explicit),
    lyrics = v_lyrics, lyrics_synced = coalesce((p->>'lyrics_synced')::boolean, true), sections = v_sections,
    best_part = greatest(0, least(coalesce((p->>'best_part')::numeric, 0), v_dur)),
    duration = v_dur, bpm = nullif(p->>'bpm', '')::integer, key = nullif(left(coalesce(p->>'key', ''), 20), ''),
    audio_path = v_audio, cover_path = v_cover, color = v_color, release_date = v_release, created_on = v_created,
    ai = v_ai, mastered = coalesce((p->>'mastered')::boolean, false), loudness = v_loud, holder = v_holder,
    published_at = now(), updated_at = now()
  where id = s.id returning * into s;

  rec := private.add_record(s.id, uid, 'published',
    s.title || case when coalesce(s.version, '') <> '' then ' (' || s.version || ')' else '' end, a.name, v_holder,
    jsonb_strip_nulls(jsonb_build_object(
      'original_name', nullif(left(coalesce(p->>'original_name', ''), 200), ''),
      'original_bytes', nullif(p->>'original_bytes', '')::bigint,
      'original_sha256', private.hex64(p->>'original_sha256'),
      'audio_sha256', private.hex64(p->>'audio_sha256'),
      'cover_sha256', private.hex64(p->>'cover_sha256'),
      'lyrics_sha256', private.hex64(p->>'lyrics_sha256'),
      'duration', v_dur, 'audio_path', v_audio, 'cover_path', v_cover, 'ai', v_ai,
      'statement', nullif(left(coalesce(p->>'rights_statement', ''), 600), ''))));
  return private.song_json(s);
end $$;

-- Uploader: my songs, newest first.
create function public.my_songs() returns json
language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', s.id, 'status', s.status,
           'title', s.title || case when coalesce(s.version, '') <> '' then ' (' || s.version || ')' else '' end,
           'artist', (select a.name from public.artists a where a.id = s.artist_id), 'art', s.cover_path, 'duration', s.duration,
           'published_at', s.published_at, 'explicit', s.explicit, 'adult', s.adult,
           'record', (select r.id from public.ownership_records r where r.song_id = s.id order by r.id limit 1)) order by s.published_at desc), '[]'::json)
  from public.songs s where s.owner_id = (select auth.uid()) and s.status <> 'draft';
$$;

-- Uploader: the ownership records of one of my songs (also when the song is off the list).
create function public.my_records(p_song text) returns json
language sql stable security invoker set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', r.id, 'kind', r.kind, 'at', r.recorded_at, 'title', r.title, 'artist', r.artist_name,
           'holder', r.holder, 'details', r.details - 'audio_path' - 'cover_path', 'prev', r.prev_hash, 'hash', r.record_hash) order by r.id), '[]'::json)
  from public.ownership_records r
  where r.song_id = p_song and r.owner_id = (select auth.uid());
$$;

-- Uploader: take a song off the public list, or put it back. The song and its record stay.
create function public.set_song_listed(p_song text, p_listed boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); s public.songs; v_title text; v_artist text;
begin
  if uid is null or not private.can_upload(uid) then raise exception 'Only an uploader account can do this.' using errcode = '42501'; end if;
  select * into s from public.songs where id = p_song and owner_id = uid for update;
  if not found or s.status = 'draft' then raise exception 'This song was not found.'; end if;
  v_title := s.title || case when coalesce(s.version, '') <> '' then ' (' || s.version || ')' else '' end;
  select a.name into v_artist from public.artists a where a.id = s.artist_id;
  if p_listed and s.status = 'unlisted' then
    update public.songs set status = 'published', updated_at = now() where id = s.id;
    perform private.add_record(s.id, uid, 'relisted', v_title, v_artist, s.holder, '{}'::jsonb);
  elsif not p_listed and s.status = 'published' then
    update public.songs set status = 'unlisted', updated_at = now() where id = s.id;
    perform private.add_record(s.id, uid, 'unlisted', v_title, v_artist, s.holder, '{}'::jsonb);
  end if;
  return (select status from public.songs where id = s.id);
end $$;

-- Server only: the one-time owner setup (called by the "owner-setup" Edge Function with the secret key).
create function public.owner_setup_check(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare r private.owner_setup;
begin
  select * into r from private.owner_setup where id = 1 for update;
  if not found then return 'closed'; end if;
  if r.used_at is not null then return 'used'; end if;
  if r.attempts >= 10 then return 'locked'; end if;
  if r.code_hash = encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex') then return 'ok'; end if;
  update private.owner_setup set attempts = attempts + 1 where id = 1;
  return 'wrong';
end $$;

create function public.owner_setup_finish(p_code text, p_user uuid, p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare r private.owner_setup;
begin
  select * into r from private.owner_setup where id = 1 for update;
  if not found then return 'closed'; end if;
  if r.used_at is not null then return 'used'; end if;
  if r.attempts >= 10 then return 'locked'; end if;
  if r.code_hash <> encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex') then
    update private.owner_setup set attempts = attempts + 1 where id = 1;
    return 'wrong';
  end if;
  insert into public.profiles (id, display_name, role) values (p_user, nullif(left(btrim(coalesce(p_name, '')), 80), ''), 'owner')
  on conflict (id) do update set role = 'owner', display_name = excluded.display_name;
  update private.owner_setup set used_at = now(), owner_id = p_user where id = 1;
  return 'ok';
end $$;

-- ---------- Who may call what ----------
revoke all on function public.public_catalogue(), public.song_record(text), public.verify_license(text), public.my_profile(), public.my_licenses(),
  public.my_artists(), public.save_artist(jsonb), public.reserve_song(), public.publish_song(jsonb), public.my_songs(),
  public.my_records(text), public.set_song_listed(text, boolean), public.owner_setup_check(text), public.owner_setup_finish(text, uuid, text) from public, anon, authenticated;
grant execute on function public.public_catalogue(), public.song_record(text), public.verify_license(text) to anon, authenticated;
grant execute on function public.my_profile(), public.my_licenses(), public.my_artists(), public.save_artist(jsonb), public.reserve_song(),
  public.publish_song(jsonb), public.my_songs(), public.my_records(text), public.set_song_listed(text, boolean) to authenticated;
grant execute on function public.owner_setup_check(text), public.owner_setup_finish(text, uuid, text) to service_role;
revoke all on function private.handle_new_user(), private.no_change(), private.hex64(text) from public;

-- ---------- File storage ----------
-- One public bucket. Everyone can open a file whose address they have; listing is not possible.
-- An uploader can add files only inside their own folder (their account id), only MP3 and JPEG, 50 MB at most.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['audio/mpeg', 'image/jpeg'])
on conflict (id) do nothing;

create policy "media: uploaders add to their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text and private.can_upload((select auth.uid())));
create policy "media: uploaders replace their own files" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text and private.can_upload((select auth.uid())))
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text and private.can_upload((select auth.uid())));
create policy "media: uploaders see their own files" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
