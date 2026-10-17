-- ==============================================================================
-- LIL HELPER - SUPABASE DATABASE SCHEMA
-- ==============================================================================

-- 1. Table principale pour l'historique des matchs par compte Steam
create table if not exists public.match_histories (
  account_id bigint primary key,
  user_id uuid references auth.users(id) on delete set null,
  persona_name text,
  avatar_url text,
  version integer not null default 2,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  matches jsonb not null default '[]'::jsonb
);

-- Index pour accélérer les recherches et synchronisations
create index if not exists idx_match_histories_user_id on public.match_histories(user_id);
create index if not exists idx_match_histories_updated_at on public.match_histories(updated_at desc);

-- 2. Activation de la sécurité Row Level Security (RLS)
alter table public.match_histories enable row level security;

-- RÈGLE 1 : Consultation publique (Tout le monde peut lire l'historique d'un compte)
-- Permet de consulter les stats et l'historique de n'importe quel profil en Web ou Desktop
create policy "Allow public read access to match histories"
  on public.match_histories for select
  using (true);

-- RÈGLE 2 : Insertion réservée à l'utilisateur authentifié propriétaire ou service role
create policy "Allow insert for authenticated owner"
  on public.match_histories for insert
  with check (
    auth.uid() = user_id 
    or (auth.uid() is not null and user_id is null)
    or auth.role() = 'service_role'
  );

-- RÈGLE 3 : Modification réservée au propriétaire du compte ou service role
create policy "Allow update for authenticated owner"
  on public.match_histories for update
  using (
    auth.uid() = user_id 
    or auth.role() = 'service_role'
  )
  with check (
    auth.uid() = user_id 
    or auth.role() = 'service_role'
  );

-- RÈGLE 4 : Suppression réservée au propriétaire
create policy "Allow delete for authenticated owner"
  on public.match_histories for delete
  using (
    auth.uid() = user_id 
    or auth.role() = 'service_role'
  );

-- 3. Fonction & Trigger pour mettre à jour automatiquement updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_match_histories_updated_at on public.match_histories;
create trigger set_match_histories_updated_at
  before update on public.match_histories
  for each row execute function public.handle_updated_at();
