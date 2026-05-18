-- Ensure books can store cover preview URL extracted on upload
ALTER TABLE IF EXISTS public.books
  ADD COLUMN IF NOT EXISTS cover_url text;
