-- Seed admin users for hauntedutkarsh@gmail.com and mail.shubhamlal@gmail.com
-- If they haven't signed in yet, run this SQL again in Supabase SQL Editor after they do
INSERT INTO admin_users (user_id)
SELECT id FROM auth.users
WHERE email IN ('hauntedutkarsh@gmail.com', 'mail.shubhamlal@gmail.com')
ON CONFLICT (user_id) DO NOTHING;
