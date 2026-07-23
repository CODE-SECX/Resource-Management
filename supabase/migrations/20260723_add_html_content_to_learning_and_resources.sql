ALTER TABLE public.resources
ADD COLUMN IF NOT EXISTS html_content TEXT;

ALTER TABLE public.learning
ADD COLUMN IF NOT EXISTS html_content TEXT;

COMMENT ON COLUMN public.resources.html_content IS 'Raw HTML to render instead of opening a URL when present.';
COMMENT ON COLUMN public.learning.html_content IS 'Raw HTML to render instead of opening a URL when present.';
