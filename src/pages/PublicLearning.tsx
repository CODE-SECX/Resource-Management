import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPublicLearning } from '../lib/supabase';
import { ExternalLink, Calendar, Tag, GraduationCap, AlertCircle } from 'lucide-react';

export default function PublicLearning() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [learning, setLearning] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLearning = async () => {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const data = await getPublicLearning(token);
        if (data) {
          setLearning(data);
        } else {
          setError('Learning resource not found or link has expired');
        }
      } catch (err) {
        setError('Failed to load learning resource');
        console.error('Error fetching public learning:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLearning();
  }, [token]);

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner':
        return 'bg-success/10 text-success border-success/30 dark:bg-success/15';
      case 'Intermediate':
        return 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/15';
      case 'Advanced':
        return 'bg-warning/10 text-warning border-warning/30 dark:bg-warning/15';
      case 'Expert':
        return 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/15';
      default:
        return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner h-8 w-8" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (error || !learning) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Link Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {error || 'This learning resource is not available or the link has expired.'}
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-reading mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <GraduationCap className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">Shared Learning</h1>
          </div>
          <span className="text-xs sm:text-sm font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">Public Link</span>
        </div>

        {/* Main Content */}
        <article>
          {/* Article Header */}
          <header className="pt-2 sm:pt-4 pb-6 sm:pb-8 border-b border-border/50">
            <div className="max-w-reading mx-auto">
              <h1 className="font-sans text-3xl sm:text-4xl font-bold text-foreground mb-5 leading-tight tracking-tight">
                {learning.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Added {new Date(learning.created_at).toLocaleDateString()}
                </div>

                {/* Difficulty Badge */}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(learning.difficulty_level)}`}>
                  <GraduationCap className="w-3.5 h-3.5 mr-1" />
                  {learning.difficulty_level}
                </span>
              </div>

              {/* Categories */}
              {learning.categories && learning.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {learning.categories.map((category: any) => (
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
              {learning.tags && learning.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {learning.tags.map((tag: string, index: number) => (
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
              dangerouslySetInnerHTML={{ __html: learning.description || '' }}
            />

            {/* Action Button */}
            {learning.url && (
              <div className="max-w-reading mx-auto mt-10 pt-8 border-t border-border/50">
                <a
                  href={learning.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Learning Resource
                </a>
              </div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
