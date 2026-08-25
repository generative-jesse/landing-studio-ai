-- Trigger functions must never be callable through the API.
revoke all on function public.handle_new_user() from anon, authenticated, public;
revoke all on function public.touch_updated_at() from anon, authenticated, public;

-- Anonymous visitors get no access to user-owned tables at all.
revoke all on public.profiles from anon;
revoke all on public.user_preferences from anon;

-- Keep both tables out of the auto-generated GraphQL schema (app uses PostgREST only).
comment on table public.profiles is e'@graphql({"totalCount": {"enabled": false}})\nUser identity basics. RLS: owner-only.';
comment on table public.user_preferences is e'@graphql({"totalCount": {"enabled": false}})\nExplicit user settings only. Never stores market data.';