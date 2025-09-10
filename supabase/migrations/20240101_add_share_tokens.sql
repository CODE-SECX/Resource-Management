-- Create share_tokens table
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_item_type_item_id ON share_tokens(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_user_id ON share_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires_at ON share_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_share_tokens_is_active ON share_tokens(is_active);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS handle_share_tokens_updated_at
  BEFORE UPDATE ON share_tokens
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Add RLS policies
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own share tokens" ON share_tokens;
DROP POLICY IF EXISTS "Users can create share tokens" ON share_tokens;
DROP POLICY IF EXISTS "Users can update own share tokens" ON share_tokens;
DROP POLICY IF EXISTS "Users can delete own share tokens" ON share_tokens;
DROP POLICY IF EXISTS "Public can read active share tokens" ON share_tokens;

-- Policy: Users can view their own share tokens
CREATE POLICY "Users can view own share tokens"
  ON share_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create share tokens
CREATE POLICY "Users can create share tokens"
  ON share_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own share tokens
CREATE POLICY "Users can update own share tokens"
  ON share_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own share tokens
CREATE POLICY "Users can delete own share tokens"
  ON share_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public access policy for reading share tokens (for public sharing)
CREATE POLICY "Public can read active share tokens"
  ON share_tokens
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));
