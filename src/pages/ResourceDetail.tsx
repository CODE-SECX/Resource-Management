
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, type Resource, createShareToken } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ExternalLink, Edit2, Trash2, Tag, Calendar, FileText, Share2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Resource not found</h2>
          <p className="text-gray-400 mb-4">The resource you're looking for doesn't exist.</p>
          <Link
            to="/resources"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resources
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-full sm:max-w-full md:max-w-full lg:max-w-7xl xl:max-w-7xl">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/resources"
            className="inline-flex items-center px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resources
          </Link>
          
          <div className="flex items-center space-x-2">
            <Link
              to={`/resources?action=edit&id=${resource.id}`}
              className="p-2 text-gray-400 hover:text-indigo-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </Link>
            <button
              onClick={handleShare}
              className="p-2 text-gray-400 hover:text-green-400 rounded-lg hover:bg-gray-800 transition-colors"
              title="Share this resource"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Share Link Modal */}
        {shareLink && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Share Resource</h3>
              <p className="text-gray-400 text-sm mb-4">
                Anyone with this link can view this resource without logging in.
              </p>
              <div className="flex items-center space-x-2 mb-6">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={copyToClipboard}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  title={isCopied ? 'Copied!' : 'Copy link'}
                >
                  {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShareLink('')}
                  className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <article className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          {/* Article Header */}
          <header className="p-8 lg:p-10 border-b border-gray-700">
            <h1 className="text-4xl font-bold text-gray-50 mb-6 leading-tight">
              {resource.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Added: {new Date(resource.created_at).toLocaleDateString()}
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
                    className="inline-block px-3 py-1 text-sm font-medium text-white rounded-full"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            )}

            {/* Tags */}
            {resource.tags && resource.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {resource.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-700 text-gray-200 rounded-full"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Article Content */}
          <div className="p-8 lg:p-10">
            <div className="prose prose-invert prose-slate prose-lg max-w-full prose-p:my-3 prose-p:leading-7 prose-li:my-1 prose-headings:mt-8 prose-headings:mb-3 prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic prose-img:rounded-lg break-words">
              <div 
                className="text-gray-100"
                dangerouslySetInnerHTML={{ __html: resource.description || '' }}
              />
            </div>

            {/* Action Button */}
            {resource.url && (
              <div className="mt-8 pt-6 border-t border-gray-700">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Visit Resource
                </a>
              </div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
