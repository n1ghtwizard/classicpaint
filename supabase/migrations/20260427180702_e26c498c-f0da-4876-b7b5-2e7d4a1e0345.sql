
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Replace public listing policy with one that only allows fetching specific objects
DROP POLICY IF EXISTS "Public can view paintings" ON storage.objects;
-- (Public bucket already permits direct URL fetch via the storage CDN; we don't need a SELECT policy.)
