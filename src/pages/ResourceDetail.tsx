
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, type Resource, createShareToken } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ExternalLink, Edit2, Trash2, Tag, Calendar, FileText, Share2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getContentTarget, openContentTarget } from '../utils/openContent';

export function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isPageLinkCopied, setIsPageLinkCopied] = useState(false);

  useEffect(() => {
    fetchResource();
  }, [id, user]);

  const fetchResource = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from('resources')
        .select(`
          *,
          resource_categories(
            category_id,
            categories(*)
          )
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const resourceWithCategories = {
        ...data,
        categories: data.resource_categories.map((rc: any) => rc.categories),
      };

      setResource(resourceWithCategories);
    } catch (error) {
      console.error('Error fetching resource:', error);
      toast.error('Failed to fetch resource');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!resource || !confirm('Are you sure you want to delete this resource?')) return;

    try {
      // Clean up junction table first
      await supabase
        .from('resource_categories')
        .delete()
        .eq('resource_id', resource.id);

      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', resource.id)
        .eq('user_id', user!.id);

      if (error) throw error;
      toast.success('Resource deleted successfully!');
      window.history.back();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource');
    }
  };

  const handleShare = async () => {
    if (!resource || !user) return;

    try {
      const shareToken = await createShareToken('resource', resource.id, user.id);
      const shareUrl = `${window.location.origin}/share/resource/${shareToken.token}`;
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

  const copyPageLink = async () => {
    const pageUrl = window.location.href;

    try {
      await navigator.clipboard.writeText(pageUrl);
      setIsPageLinkCopied(true);
      toast.success('Page link copied to clipboard!');
      setTimeout(() => setIsPageLinkCopied(false), 2000);
    } catch (error) {
      console.error('Error copying page link:', error);
      toast.error('Failed to copy page link');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner h-8 w-8" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Resource not found</h2>
          <p className="text-muted-foreground mb-6">The resource you're looking for doesn't exist.</p>
          <Link
            to="/resources"
            className="btn-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Resources
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-reading mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <Link
            to="/resources"
            className="inline-flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors duration-150 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Back to Resources</span>
            <span className="xs:hidden">Back</span>
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={() => window.open(`/resources/${resource.id}/edit`, '_blank')}
              className="p-2.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent transition-colors duration-150"
              title="Edit"
              aria-label="Edit resource"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={copyPageLink}
              className="p-2.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent transition-colors duration-150"
              title={isPageLinkCopied ? 'Copied!' : 'Copy page link'}
              aria-label="Copy page link"
            >
              {isPageLinkCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={handleShare}
              className="p-2.5 text-muted-foreground hover:text-success rounded-lg hover:bg-accent transition-colors duration-150"
              title="Share this resource"
              aria-label="Share resource"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-accent transition-colors duration-150"
              title="Delete"
              aria-label="Delete resource"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Share Link Modal */}
        {shareLink && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-card rounded-xl shadow-modal border border-border max-w-md w-full p-6 animate-scale-in">
              <h3 className="text-lg font-semibold text-foreground mb-3">Share Resource</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Anyone with this link can view this resource without logging in.
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
                  {resource.categories.map((category) => (
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
                  {resource.tags.map((tag, index) => (
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

            {/* Action Button */}
            {(() => {
              const target = getContentTarget(resource);
              if (target.type === 'none') return null;

              return (
                <div className="max-w-reading mx-auto mt-10 pt-8 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => openContentTarget(resource)}
                    className="btn-primary"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {target.type === 'html' ? 'Open HTML Content' : 'Visit Resource'}
                  </button>
                </div>
              );
            })()}
          </div>
        </article>
      </div>
    </div>
  );
}
