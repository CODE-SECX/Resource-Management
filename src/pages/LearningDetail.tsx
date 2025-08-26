
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, type Learning } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ExternalLink, Edit2, Trash2, GraduationCap, Tag, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export function LearningDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [learning, setLearning] = useState<Learning | null>(null);
  const [loading, setLoading] = useState(true);

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
      const { error } = await supabase
        .from('learning')
        .delete()
        .eq('id', learning.id);

      if (error) throw error;
      toast.success('Learning item deleted successfully!');
      window.history.back();
    } catch (error) {
      console.error('Error deleting learning item:', error);
      toast.error('Failed to delete learning item');
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'Intermediate': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Advanced': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Expert': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!learning) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Learning item not found</h2>
          <p className="text-gray-400 mb-4">The learning item you're looking for doesn't exist.</p>
          <Link
            to="/learning"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Learning
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/learning"
            className="inline-flex items-center px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Learning
          </Link>
          
          <div className="flex items-center space-x-2">
            <Link
              to={`/learning/edit/${learning.id}`}
              className="p-2 text-gray-400 hover:text-indigo-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </Link>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <article className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 max-w-none">
          {/* Article Header */}
          <header className="p-8 lg:p-12 border-b border-gray-700">
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
                {learning.categories.map((category) => (
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
                {learning.tags.map((tag, index) => (
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
          <div className="p-8 lg:p-12">
            <div className="prose prose-invert prose-lg lg:prose-xl max-w-none">
              <div 
                className="text-gray-100 leading-relaxed"
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
