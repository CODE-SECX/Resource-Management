
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, type Learning, createShareToken } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ExternalLink, Edit2, Trash2, GraduationCap, Tag, Calendar, Share2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export function LearningDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [learning, setLearning] = useState<Learning | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    fetchLearning();
  }, [id, user]);

  const fetchLearning = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from('learning')
        .select(`
          *,
          learning_categories(
            category_id,
            categories(*)
          )
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const learningWithCategories = {
        ...data,
        categories: data.learning_categories.map((lc: any) => lc.categories),
      };

      setLearning(learningWithCategories);
    } catch (error) {
      console.error('Error fetching learning item:', error);
      toast.error('Failed to fetch learning item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!learning || !confirm('Are you sure you want to delete this learning item?')) return;

    try {
      // Clean up junction table first
      await supabase
        .from('learning_categories')
        .delete()
        .eq('learning_id', learning.id);

      const { error } = await supabase
        .from('learning')
        .delete()
        .eq('id', learning.id)
        .eq('user_id', user!.id);

      if (error) throw error;
      toast.success('Learning item deleted successfully!');
      window.history.back();
    } catch (error) {
      console.error('Error deleting learning item:', error);
      toast.error('Failed to delete learning item');
    }
  };

  const handleShare = async () => {
    if (!learning || !user) return;

    try {
      const shareToken = await createShareToken('learning', learning.id, user.id);
      const shareUrl = `${window.location.origin}/share/learning/${shareToken.token}`;
      setShareLink(shareUrl);
      toast.success('Share link created successfully!');
    } catch (error) {
      console.error('Error creating share link:', error);
      toast.error('Failed to create share link');
    }
  };

  const copyToClipboard = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Failed to copy link');
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-success/10 text-success border-success/30 dark:bg-success/15';
      case 'Intermediate': return 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/15';
      case 'Advanced': return 'bg-warning/10 text-warning border-warning/30 dark:bg-warning/15';
      case 'Expert': return 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/15';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner h-8 w-8" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!learning) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Learning item not found</h2>
          <p className="text-muted-foreground mb-6">The learning item you're looking for doesn't exist.</p>
          <Link
            to="/learning"
            className="btn-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Learning
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-reading mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <Link
            to="/learning"
            className="inline-flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors duration-150 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Back to Learning</span>
            <span className="xs:hidden">Back</span>
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={() => window.open(`/learning/${learning.id}/edit`, '_blank')}
              className="p-2.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent transition-colors duration-150"
              title="Edit"
              aria-label="Edit learning item"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleShare}
              className="p-2.5 text-muted-foreground hover:text-success rounded-lg hover:bg-accent transition-colors duration-150"
              title="Share this learning item"
              aria-label="Share learning item"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-accent transition-colors duration-150"
              title="Delete"
              aria-label="Delete learning item"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Share Link Modal */}
        {shareLink && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-card rounded-xl shadow-modal border border-border max-w-md w-full p-6 animate-scale-in">
              <h3 className="text-lg font-semibold text-foreground mb-3">Share Learning Item</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Anyone with this link can view this learning item without logging in.
              </p>
              <div className="flex items-center gap-2 mb-6">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 min-w-0 px-3 py-2 bg-secondary/60 border border-input rounded-lg text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <button
                  onClick={copyToClipboard}
                  className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors duration-150 shrink-0"
                  title={isCopied ? 'Copied!' : 'Copy link'}
                  aria-label="Copy link"
                >
                  {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShareLink('')}
                  className="btn-ghost"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <article>
          {/* Article Header */}
          <header className="pt-2 sm:pt-4 pb-6 sm:pb-8 border-b border-border/50">
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
                  {learning.categories.map((category) => (
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
                  {learning.tags.map((tag, index) => (
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
          </header>

          {/* Article Content — Medium-style reading experience */}
          <div className="py-8 sm:py-12">
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: learning.description || '' }}
            />

            {/* Action Button */}
            {learning.url && (
              <div className="mt-10 pt-8 border-t border-border/50">
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
