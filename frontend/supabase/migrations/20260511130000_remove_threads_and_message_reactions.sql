-- Remove thread-related schema objects to match application state without threads

-- 1) Drop thread tables (and dependent objects)
DROP TABLE IF EXISTS public.thread_messages CASCADE;
DROP TABLE IF EXISTS public.annotation_threads CASCADE;

-- 2) Remove message-reaction artifacts
DROP INDEX IF EXISTS public.idx_reactions_message;
DROP INDEX IF EXISTS public.uq_message_reaction_per_user;

-- 3) Make reactions annotation-only
ALTER TABLE IF EXISTS public.reactions
  DROP CONSTRAINT IF EXISTS reactions_exactly_one_target;

ALTER TABLE IF EXISTS public.reactions
  ADD CONSTRAINT reactions_annotation_target_required
  CHECK (annotation_id IS NOT NULL AND message_id IS NULL);

ALTER TABLE IF EXISTS public.reactions
  DROP COLUMN IF EXISTS message_id;
