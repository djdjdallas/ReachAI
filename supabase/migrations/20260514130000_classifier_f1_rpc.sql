-- Migration: Classifier confusion-matrix RPC
--
-- Aggregates (predicted_class, correct_class) pairs for the F1 panel at
-- /admin/classifier/history. Replaces a row-fetch + JS loop in the page
-- so the database does the GROUP BY work and the page only ships the
-- summarized matrix to JS.
--
-- SECURITY INVOKER: the function runs as the calling role, so RLS policies
-- on classifier_feedback and comment_classifications still apply. We also
-- restrict by p_creator_id explicitly so a buggy caller can't leak
-- another creator's matrix even if RLS were ever weakened.

CREATE OR REPLACE FUNCTION public.classifier_confusion_matrix(
  p_creator_id UUID
)
RETURNS TABLE (
  predicted TEXT,
  actual TEXT,
  n BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    cc.class AS predicted,
    cf.correct_class AS actual,
    COUNT(*)::BIGINT AS n
  FROM public.classifier_feedback cf
  JOIN public.comment_classifications cc
    ON cc.id = cf.classification_id
  WHERE cf.creator_id = p_creator_id
    AND cf.correct_class IS NOT NULL
  GROUP BY cc.class, cf.correct_class;
$$;

GRANT EXECUTE ON FUNCTION public.classifier_confusion_matrix(UUID) TO authenticated;
