-- Automatically start a 7-day trial when a new user signs up.
-- Replaces the existing handle_new_user() trigger function from
-- migrations/001_initial_schema.sql so new rows are created with
-- subscription_status='trialing' and a trial_ends_at 7 days out.
-- plan='base' is the column default but we set it explicitly for clarity.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    plan,
    subscription_status,
    trial_ends_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'base',
    'trialing',
    NOW() + INTERVAL '7 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists from 001_initial_schema.sql; CREATE OR REPLACE on
-- the function is sufficient — the trigger picks up the new definition
-- automatically on the next auth.users insert.
