-- Migration: Intent Classifier Shadow Mode
-- Adds the 5 tables powering the shadow-mode comment intent classifier.
-- All writes happen via the service-role key in server routes; end-user RLS
-- policies below are scoped with `auth.uid() = creator_id` to match the rest
-- of the codebase (creator_id references public.users(id), which is keyed to
-- auth.users(id)).

-- ── creator_offers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  offer_name TEXT,
  offer_price_cents INT,
  offer_url TEXT,
  ideal_customer TEXT,
  objections TEXT[],
  qualification_questions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creator_offers_creator_id
  ON public.creator_offers(creator_id);

-- ── posts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ig_media_id TEXT UNIQUE,
  media_type TEXT,
  caption TEXT,
  permalink TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_creator_id
  ON public.posts(creator_id, posted_at DESC);

-- ── post_context_bundles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_context_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  bundle_hash TEXT NOT NULL,
  caption TEXT,
  creator_offer_snapshot JSONB,
  token_count INT,
  built_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, version)
);
CREATE INDEX IF NOT EXISTS idx_post_context_bundles_post_id
  ON public.post_context_bundles(post_id, version DESC);

-- ── comment_classifications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  bundle_id UUID NOT NULL REFERENCES public.post_context_bundles(id) ON DELETE CASCADE,
  ig_comment_id TEXT,
  ig_commenter_username TEXT,
  comment_text TEXT NOT NULL,
  class TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL,
  language TEXT,
  reasoning TEXT,
  signals TEXT[],
  model TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  classifier_version TEXT NOT NULL DEFAULT 'v1.0-shadow',
  input_tokens INT,
  output_tokens INT,
  cache_read_tokens INT,
  cache_creation_tokens INT,
  latency_ms INT,
  classified_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classifications_creator_time
  ON public.comment_classifications(creator_id, classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_classifications_post
  ON public.comment_classifications(post_id);

-- ── classifier_feedback ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classifier_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id UUID NOT NULL REFERENCES public.comment_classifications(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  correct_class TEXT,
  feedback TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classifier_feedback_classification
  ON public.classifier_feedback(classification_id);

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.creator_offers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_context_bundles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_classifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classifier_feedback      ENABLE ROW LEVEL SECURITY;

-- creator_offers policies
CREATE POLICY "creator_offers_select_own"
  ON public.creator_offers FOR SELECT
  USING (auth.uid() = creator_id);
CREATE POLICY "creator_offers_insert_own"
  ON public.creator_offers FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "creator_offers_update_own"
  ON public.creator_offers FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "creator_offers_delete_own"
  ON public.creator_offers FOR DELETE
  USING (auth.uid() = creator_id);

-- posts policies
CREATE POLICY "posts_select_own"
  ON public.posts FOR SELECT
  USING (auth.uid() = creator_id);
CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  USING (auth.uid() = creator_id);

-- post_context_bundles policies (join through posts.creator_id)
CREATE POLICY "bundles_select_own"
  ON public.post_context_bundles FOR SELECT
  USING (post_id IN (SELECT id FROM public.posts WHERE creator_id = auth.uid()));
CREATE POLICY "bundles_insert_own"
  ON public.post_context_bundles FOR INSERT
  WITH CHECK (post_id IN (SELECT id FROM public.posts WHERE creator_id = auth.uid()));
CREATE POLICY "bundles_update_own"
  ON public.post_context_bundles FOR UPDATE
  USING (post_id IN (SELECT id FROM public.posts WHERE creator_id = auth.uid()));
CREATE POLICY "bundles_delete_own"
  ON public.post_context_bundles FOR DELETE
  USING (post_id IN (SELECT id FROM public.posts WHERE creator_id = auth.uid()));

-- comment_classifications policies
CREATE POLICY "classifications_select_own"
  ON public.comment_classifications FOR SELECT
  USING (auth.uid() = creator_id);
CREATE POLICY "classifications_insert_own"
  ON public.comment_classifications FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "classifications_update_own"
  ON public.comment_classifications FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "classifications_delete_own"
  ON public.comment_classifications FOR DELETE
  USING (auth.uid() = creator_id);

-- classifier_feedback policies
CREATE POLICY "feedback_select_own"
  ON public.classifier_feedback FOR SELECT
  USING (auth.uid() = creator_id);
CREATE POLICY "feedback_insert_own"
  ON public.classifier_feedback FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "feedback_update_own"
  ON public.classifier_feedback FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "feedback_delete_own"
  ON public.classifier_feedback FOR DELETE
  USING (auth.uid() = creator_id);
