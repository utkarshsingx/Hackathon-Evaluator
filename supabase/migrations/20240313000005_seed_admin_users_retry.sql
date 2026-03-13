-- Retry: Add admin users (hauntedutkarsh@gmail.com, mail.shubhamlal@gmail.com)
INSERT INTO admin_users (user_id)
SELECT id FROM auth.users
WHERE email IN ('hauntedutkarsh@gmail.com', 'mail.shubhamlal@gmail.com')
ON CONFLICT (user_id) DO NOTHING;
