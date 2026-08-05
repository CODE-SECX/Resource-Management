-- Migration: Add is_favorite column to learning and resources tables
-- Date: 2026-08-05

-- Add is_favorite to learning table
ALTER TABLE learning
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add is_favorite to resources table
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes for efficient querying of favourites
CREATE INDEX IF NOT EXISTS idx_learning_is_favorite
  ON learning (user_id, is_favorite)
  WHERE is_favorite = TRUE;

CREATE INDEX IF NOT EXISTS idx_resources_is_favorite
  ON resources (user_id, is_favorite)
  WHERE is_favorite = TRUE;

-- RLS policies: users can only update their own items' is_favorite column
-- (existing RLS on the tables already restricts row access to owner, so no extra policy needed)
-- The existing UPDATE policies on learning and resources will cover this column.
