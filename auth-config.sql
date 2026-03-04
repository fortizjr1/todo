-- ============================================
-- AUTHENTICATION CONFIGURATION
-- ============================================

-- Enable email signups in auth.config
INSERT INTO auth.config (enable_signup, enable_confirmations)
VALUES (true, false)
ON CONFLICT (id) DO UPDATE SET 
  enable_signup = true,
  enable_confirmations = false;

-- Alternative: Update if already exists
UPDATE auth.config 
SET enable_signup = true, 
    enable_confirmations = false
WHERE id = (SELECT id FROM auth.config LIMIT 1);

-- If the above doesn't work, try this to create the config
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM auth.config) THEN
    INSERT INTO auth.config (id, enable_signup, enable_confirmations)
    VALUES (1, true, false);
  END IF;
END
$$;
