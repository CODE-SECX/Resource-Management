-- Add public access policies for share functionality
-- These policies allow public access when a valid share token exists

-- First, ensure share_tokens table exists with proper structure
CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  item_type TEXT NOT NULL CHECK (item_type IN ('learning', 'resource')),
  item_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for share_tokens table
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_item_type_item_id ON share_tokens(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_user_id ON share_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires_at ON share_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_share_tokens_is_active ON share_tokens(is_active);

-- Enable RLS on share_tokens table
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing share_tokens policies if they exist
DROP POLICY IF EXISTS "Users can view own share tokens" ON share_tokens;
DROP POLICY IF EXISTS "Users can create share tokens" ON share_tokens;
DROP POLICY IF EXISTS "Users can update own share tokens" ON share_tokens;
DROP POLICY IF EXISTS "Users can delete own share tokens" ON share_tokens;
DROP POLICY IF EXISTS "Public can read active share tokens" ON share_tokens;

-- Create policies for share_tokens table
CREATE POLICY "Users can view own share tokens"
  ON share_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create share tokens"
  ON share_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own share tokens"
  ON share_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own share tokens"
  ON share_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Public can read active share tokens"
  ON share_tokens
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Now add public access policies for learning and resources tables
-- These policies allow access when a valid share token exists

-- Drop existing public policies if they exist
DROP POLICY IF EXISTS "Public access via share tokens" ON learning;
DROP POLICY IF EXISTS "Public access via share tokens" ON resources;

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
    )
  );

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
    )
  );

-- Also ensure categories can be accessed publicly when referenced by shared items
DROP POLICY IF EXISTS "Public access via share tokens" ON categories;

CREATE POLICY "Public access via share tokens"
  ON categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM share_tokens st
      JOIN learning_categories lc ON st.item_id = lc.learning_id
      WHERE lc.category_id = categories.id
      AND st.item_type = 'learning'
      AND st.is_active = true
      AND (st.expires_at IS NULL OR st.expires_at > NOW())
    )
    OR
    EXISTS (
      SELECT 1 
      FROM share_tokens st
      JOIN resource_categories rc ON st.item_id = rc.resource_id
      WHERE rc.category_id = categories.id
      AND st.item_type = 'resource'
      AND st.is_active = true
      AND (st.expires_at IS NULL OR st.expires_at > NOW())
    )
  );
