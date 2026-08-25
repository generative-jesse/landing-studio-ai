-- Persistent allowlist: auth identity + explicitly user-owned settings ONLY.
-- No market data, order books, ticks, quotes or chart points are ever stored.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Explicit user preferences: watchlist, selected asset/timeframe, chart display prefs.
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  watchlist text[] not null default '{}',
  default_asset text not null default 'bitcoin',
  default_timeframe text not null default '5m',
  chart_show_history boolean not null default true,
  chart_display_points integer not null default 320,
  updated_at timestamptz not null default now(),
  constraint user_preferences_asset_check
    check (default_asset in ('bitcoin','ethereum','solana','ripple')),
  constraint user_preferences_timeframe_check
    check (default_timeframe in ('5m','15m','1h')),
  constraint user_preferences_points_check
    check (chart_display_points between 50 and 2000),
  constraint user_preferences_watchlist_len
    check (array_length(watchlist, 1) is null or array_length(watchlist, 1) <= 40)
);

grant select, insert, update, delete on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;

alter table public.user_preferences enable row level security;

create policy "Users can view their own preferences"
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own preferences"
  on public.user_preferences for delete to authenticated
  using (auth.uid() = user_id);

-- Auto-create profile + default preferences on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger user_preferences_touch_updated_at
  before update on public.user_preferences
  for each row execute function public.touch_updated_at();