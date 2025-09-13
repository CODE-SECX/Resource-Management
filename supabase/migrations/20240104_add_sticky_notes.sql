-- Create sticky_notes table
CREATE TABLE IF NOT EXISTS sticky_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    color VARCHAR(20) DEFAULT 'yellow' CHECK (color IN ('yellow', 'pink', 'blue', 'green', 'purple', 'orange')),
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_sticky_notes_user_id ON sticky_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_sticky_notes_created_at ON sticky_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_sticky_notes_is_completed ON sticky_notes(is_completed);

-- Enable Row Level Security
ALTER TABLE sticky_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own sticky notes" ON sticky_notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sticky notes" ON sticky_notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sticky notes" ON sticky_notes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sticky notes" ON sticky_notes
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_sticky_notes_updated_at
    BEFORE UPDATE ON sticky_notes
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Create function to get sticky notes statistics
CREATE OR REPLACE FUNCTION get_sticky_notes_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
    total_notes BIGINT,
    completed_notes BIGINT,
    pending_notes BIGINT,
    pinned_notes BIGINT,
    notes_by_color JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_notes,
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END)::BIGINT as completed_notes,
        COUNT(CASE WHEN is_completed = FALSE THEN 1 END)::BIGINT as pending_notes,
        COUNT(CASE WHEN is_pinned = TRUE THEN 1 END)::BIGINT as pinned_notes,
        jsonb_build_object(
            'yellow', COUNT(CASE WHEN color = 'yellow' THEN 1 END),
            'pink', COUNT(CASE WHEN color = 'pink' THEN 1 END),
            'blue', COUNT(CASE WHEN color = 'blue' THEN 1 END),
            'green', COUNT(CASE WHEN color = 'green' THEN 1 END),
            'purple', COUNT(CASE WHEN color = 'purple' THEN 1 END),
            'orange', COUNT(CASE WHEN color = 'orange' THEN 1 END)
        ) as notes_by_color
    FROM sticky_notes 
    WHERE (p_user_id IS NULL AND auth.uid() = user_id) OR (p_user_id IS NOT NULL AND user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
