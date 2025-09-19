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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Advanced':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Expert':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !learning) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Link Not Found</h2>
          <p className="text-gray-400 mb-6">
            {error || 'This learning resource is not available or the link has expired.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-full sm:max-w-full md:max-w-full lg:max-w-7xl xl:max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-100">Shared Learning</h1>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>Public Link</span>
          </div>
        </div>

        {/* Main Content */}
        <article className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          {/* Article Header */}
          <header className="p-8 lg:p-10 border-b border-gray-700">
            <h1 className="text-4xl font-bold text-gray-50 mb-6 leading-tight">
              {learning.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Added: {new Date(learning.created_at).toLocaleDateString()}
              </div>
              
              {/* Difficulty Badge */}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getDifficultyColor(learning.difficulty_level)}`}>
                <GraduationCap className="w-4 h-4 mr-1" />
                {learning.difficulty_level}
              </span>
            </div>

            {/* Categories */}
            {learning.categories && learning.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {learning.categories.map((category: any) => (
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
            {learning.tags && learning.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {learning.tags.map((tag: string, index: number) => (
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
                dangerouslySetInnerHTML={{ __html: learning.description || '' }}
              />
            </div>

            {/* Action Button */}
            {learning.url && (
              <div className="mt-8 pt-6 border-t border-gray-700">
                <a
                  href={learning.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
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
