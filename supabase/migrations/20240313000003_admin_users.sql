-- Admin users: users with elevated privileges (can see all evaluations, delete any)
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can only check if they themselves are admin
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own admin status" ON admin_users;
CREATE POLICY "Users can read own admin status"
  ON admin_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for authenticated - admins added via Supabase dashboard or migration
-- To add first admin after sign-up, run:
-- INSERT INTO admin_users (user_id) SELECT id FROM auth.users WHERE email = 'your-admin@example.com' LIMIT 1;
