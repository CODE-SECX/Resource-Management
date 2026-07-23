import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPublicResource } from '../lib/supabase';
import { ExternalLink, Calendar, Tag, AlertCircle, FileText } from 'lucide-react';
import { getContentTarget, openContentTarget } from '../utils/openContent';

export default function PublicResource() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [resource, setResource] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResource = async () => {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const data = await getPublicResource(token);
        if (data) {
          setResource(data);
          if (!data.html_content && data.url) {
            window.location.replace(data.url);
          }
        } else {
          setError('Resource not found or link has expired');
        }
      } catch (err) {
        setError('Failed to load resource');
        console.error('Error fetching public resource:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResource();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner h-8 w-8" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Link Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {error || 'This resource is not available or the link has expired.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (resource.html_content?.trim()) {
    return (
      <div className="min-h-screen bg-background">
        <iframe
          title="Shared HTML content"
          srcDoc={resource.html_content}
          className="w-full h-screen border-0"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-reading mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5 text-success-foreground" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">Shared Resource</h1>
          </div>
          <span className="text-xs sm:text-sm font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">Public Link</span>
        </div>

        {/* Main Content - Exact same structure as ResourceDetail */}
        <article>
          {/* Article Header */}
          <header className="pt-2 sm:pt-4 pb-6 sm:pb-8 border-b border-border/50">
            <div className="max-w-reading mx-auto">
              <h1 className="font-sans text-3xl sm:text-4xl font-bold text-foreground mb-5 leading-tight tracking-tight">
                {resource.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Added {new Date(resource.created_at).toLocaleDateString()}
                </div>

                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Resource
                </div>
              </div>

              {/* Categories */}
              {resource.categories && resource.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {resource.categories.map((category: any) => (
                    <span
                      key={category.id}
                      className="inline-block px-3 py-1 text-xs font-semibold text-white rounded-full shadow-xs"
                      style={{ backgroundColor: category.color }}
                    >
                      {category.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Tags */}
              {resource.tags && resource.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {resource.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </header>

          {/* Article Content — Medium-style reading experience */}
          <div className="py-8 sm:py-12">
            <div
              className="article-content max-w-reading mx-auto"
              dangerouslySetInnerHTML={{ __html: resource.description || '' }}
            />

            {/* Action Buttons */}
            {(() => {
              const target = getContentTarget(resource);
              if (target.type === 'none') return null;

              const hasHtml = Boolean(resource.html_content?.trim());
              const hasUrl = Boolean(resource.url?.trim());

              return (
                <div className="max-w-reading mx-auto mt-10 pt-8 border-t border-border/50 flex flex-wrap gap-3">
                  {hasHtml && (
                    <button
                      type="button"
                      onClick={() => openContentTarget(resource)}
                      className="btn-primary"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open HTML Content
                    </button>
                  )}
                  {hasUrl && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Visit Resource
                    </a>
                  )}
                </div>
              );
            })()}
          </div>
        </article>
      </div>
    </div>
  );
}
