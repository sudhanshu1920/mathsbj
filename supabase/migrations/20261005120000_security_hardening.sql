-- Security hardening for account-owned data.
-- The application always accesses rows using auth.uid(); enforce that at the database layer
-- as the authoritative boundary because client-side user IDs are not trustworthy.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles viewable by owner" ON public.profiles;
CREATE POLICY "Profiles viewable by owner"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles insertable by owner" ON public.profiles;
CREATE POLICY "Profiles insertable by owner"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles updatable by owner" ON public.profiles;
CREATE POLICY "Profiles updatable by owner"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "User data viewable by owner" ON public.user_data;
CREATE POLICY "User data viewable by owner"
  ON public.user_data
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User data insertable by owner" ON public.user_data;
CREATE POLICY "User data insertable by owner"
  ON public.user_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User data updatable by owner" ON public.user_data;
CREATE POLICY "User data updatable by owner"
  ON public.user_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- These trigger-only functions are not part of the browser API surface.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
