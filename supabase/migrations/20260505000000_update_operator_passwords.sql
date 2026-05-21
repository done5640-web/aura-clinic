-- Update passwords for operator1 and operator2 to "password01"
UPDATE auth.users
SET
  encrypted_password = crypt('password01', gen_salt('bf')),
  updated_at = now()
WHERE email IN ('operator1@medique.com', 'operator2@medique.com');
