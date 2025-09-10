-- Create payloads table for bug bounty payload management
CREATE TABLE IF NOT EXISTS payloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    payload TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    subcategories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')) DEFAULT 'medium',
    target_type TEXT CHECK (target_type IN ('web', 'api', 'mobile', 'network', 'other')) DEFAULT 'web',
    is_favorite BOOLEAN DEFAULT false,
    is_private BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE payloads ENABLE ROW LEVEL SECURITY;

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_payloads_user_id ON payloads(user_id);
CREATE INDEX IF NOT EXISTS idx_payloads_category ON payloads(category);
CREATE INDEX IF NOT EXISTS idx_payloads_subcategories ON payloads USING GIN(subcategories);
CREATE INDEX IF NOT EXISTS idx_payloads_tags ON payloads USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_payloads_severity ON payloads(severity);
CREATE INDEX IF NOT EXISTS idx_payloads_target_type ON payloads(target_type);
CREATE INDEX IF NOT EXISTS idx_payloads_is_favorite ON payloads(is_favorite);
CREATE INDEX IF NOT EXISTS idx_payloads_created_at ON payloads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payloads_usage_count ON payloads(usage_count DESC);

-- Create simple text search indexes for payload content
CREATE INDEX IF NOT EXISTS idx_payloads_title_search ON payloads USING gin(to_tsvector('simple', COALESCE(title, '')));
CREATE INDEX IF NOT EXISTS idx_payloads_payload_search ON payloads USING gin(to_tsvector('simple', COALESCE(payload, '')));
CREATE INDEX IF NOT EXISTS idx_payloads_description_search ON payloads USING gin(to_tsvector('simple', COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_payloads_category_search ON payloads USING gin(to_tsvector('simple', COALESCE(category, '')));

-- Create RLS policies for payloads
CREATE POLICY "Users can view their own payloads" ON payloads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payloads" ON payloads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payloads" ON payloads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payloads" ON payloads
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_payloads_updated_at 
    BEFORE UPDATE ON payloads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to increment usage count
CREATE OR REPLACE FUNCTION increment_payload_usage()
RETURNS TRIGGER AS $$
BEGIN
    NEW.usage_count = COALESCE(OLD.usage_count, 0) + 1;
    NEW.last_used_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for usage count (this will be called when payload is accessed)
-- Note: This trigger should be called manually when payload is used, not on every select

-- Create view for payload statistics
CREATE OR REPLACE VIEW payload_stats AS
SELECT 
    p.user_id,
    COUNT(*) as total_payloads,
    COUNT(CASE WHEN p.is_favorite THEN 1 END) as favorite_payloads,
    COUNT(CASE WHEN p.severity = 'critical' THEN 1 END) as critical_payloads,
    COUNT(CASE WHEN p.severity = 'high' THEN 1 END) as high_payloads,
    COUNT(CASE WHEN p.severity = 'medium' THEN 1 END) as medium_payloads,
    COUNT(CASE WHEN p.severity = 'low' THEN 1 END) as low_payloads,
    COUNT(CASE WHEN p.severity = 'info' THEN 1 END) as info_payloads,
    COUNT(DISTINCT p.category) as unique_categories,
    COUNT(DISTINCT subcat.subcategory) as unique_subcategories,
    COUNT(DISTINCT tag.tag) as unique_tags,
    MAX(p.usage_count) as max_usage_count,
    AVG(p.usage_count) as avg_usage_count,
    MAX(p.created_at) as last_created
FROM payloads p
LEFT JOIN LATERAL unnest(p.subcategories) AS subcat(subcategory) ON true
LEFT JOIN LATERAL unnest(p.tags) AS tag(tag) ON true
GROUP BY p.user_id;

-- Grant permissions
GRANT ALL ON payloads TO authenticated;
GRANT SELECT ON payload_stats TO authenticated;
