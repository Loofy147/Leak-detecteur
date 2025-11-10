
-- Seed data for a sample user and subscriptions

-- 1. Create a sample user
-- Replace with your own email and password
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_token, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_sent_at, confirmed_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 'authenticated', 'authenticated', 'user@example.com', crypt('password', gen_salt('bf')), NOW(), '', '2023-01-01 00:00:00+00', '2023-01-01 00:00:00+00', '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '2023-01-01 00:00:00+00', NOW());

INSERT INTO public.users (id, email)
VALUES ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'user@example.com');


-- 2. Add sample subscriptions for the user
INSERT INTO public.subscriptions (user_id, merchant_name, monthly_cost, status)
VALUES
  ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Netflix', 15.99, 'active'),
  ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Spotify', 9.99, 'active'),
  ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'Adobe Creative Cloud', 52.99, 'active');
