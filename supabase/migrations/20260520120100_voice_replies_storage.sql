-- Voice Replies v1 — storage bucket and object-level RLS for coach-uploaded
-- audio. Uploads live under {user_id}/{uuid}.{ext}. Bucket is private; the
-- webhook signs short-lived URLs at send time and the dashboard signs
-- short-lived URLs for preview.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-snippets',
  'voice-snippets',
  false,
  5242880,
  ARRAY[
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'audio/x-m4a',
    'audio/aac'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Object-level policies. Path convention: {user_id}/{uuid}.{ext}, so the
-- first folder segment is the owning user. No UPDATE policy by design —
-- uploads are immutable; a new file replaces the old via a fresh upload
-- plus a delete-and-insert on voice_snippets.

DROP POLICY IF EXISTS "voice_snippets_insert_own" ON storage.objects;
CREATE POLICY "voice_snippets_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-snippets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "voice_snippets_select_own" ON storage.objects;
CREATE POLICY "voice_snippets_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-snippets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "voice_snippets_delete_own" ON storage.objects;
CREATE POLICY "voice_snippets_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-snippets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
