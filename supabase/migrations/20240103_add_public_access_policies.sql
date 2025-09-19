-- Add public access policies for learning and resources tables
-- These policies allow public access when accessed through valid share tokens

-- Enable RLS on learning table if not already enabled
ALTER TABLE learning ENABLE ROW LEVEL SECURITY;

-- Drop existing public policies if they exist
DROP POLICY IF EXISTS "Public access via share tokens" ON learning;

-- Create policy for public access to learning via share tokens
CREATE POLICY "Public access via share tokens"
  ON learning
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM share_tokens st
      WHERE st.item_id = learning.id
      AND st.item_type = 'learning'
      AND st.is_active = true
      AND (st.expires_at IS NULL OR st.expires_at > NOW())
      AND st.token = current_setting('app.current_share_token', true)
    )
  );

-- Enable RLS on resources table if not already enabled
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Drop existing public policies if they exist
DROP POLICY IF EXISTS "Public access via share tokens" ON resources;

-- Create policy for public access to resources via share tokens
CREATE POLICY "Public access via share tokens"
  ON resources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM share_tokens st
      WHERE st.item_id = resources.id
      AND st.item_type = 'resource'
      AND st.is_active = true
      AND (st.expires_at IS NULL OR st.expires_at > NOW())
      AND st.token = current_setting('app.current_share_token', true)
    )
  );

-- Create function to set share token context
CREATE OR REPLACE FUNCTION set_share_token_context(share_token TEXT)
RETURNS VOID AS $$
BEGIN
  SET LOCAL app.current_share_token TO share_token;
END;
$$ LANGUAGE plpgsql;
