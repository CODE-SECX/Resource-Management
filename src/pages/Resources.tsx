import { useState, useEffect } from 'react';
import {
  supabase,
  type Resource,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Edit2, Trash2, Tag, Grid, LayoutList, BookOpen, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';

export function Resources() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);



  useEffect(() => {
    fetchResources();
  }, [user]);



  const fetchResources = async () => {
    if (!user) return;
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
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const resourcesWithCategories = data?.map(resource => ({
        ...resource,
        categories: resource.resource_categories.map((rc: any) => rc.categories),
      })) || [];

      setResources(resourcesWithCategories);
    } catch (error) {
      console.error('Error fetching resources:', error);
      toast.error('Failed to fetch resources');
    } finally {
      setLoading(false);
    }
  };



  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await supabase.from('resource_categories').delete().eq('resource_id', id);
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
      toast.success('Resource deleted successfully!');
      fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource');
    }
  };

  const filteredResources = resources.filter(resource => {
    return resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           resource.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="container-wide space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-50 mb-2">Resource Library</h1>
          <p className="text-gray-300">Organize and access your comprehensive resource collection</p>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setIsGridLayout(!isGridLayout)}
            className="p-2 text-gray-600 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors"
            title={isGridLayout ? "Switch to list view" : "Switch to grid view"}
          >
            {isGridLayout ? <LayoutList className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
          </button>
          <Link
            to="/taxonomy"
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-700"
          >
            Manage Taxonomy
          </Link>
          <button
            onClick={() => navigate('/resources/new')}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Resource
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-3 w-full border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-700 text-gray-100"
          />
        </div>
      </div>

      {/* Resources Grid/List View */}
      <div className={isGridLayout ? "grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
        {filteredResources.map((resource) => {
          const isExpanded = expandedItemId === resource.id;
          return (
            <div
              key={resource.id}
              className={`group relative bg-gray-800/80 rounded-xl border border-gray-700/60 hover:border-gray-600/80 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 overflow-hidden ${!isGridLayout ? 'cursor-pointer' : ''}`}
              onClick={() => !isGridLayout && setExpandedItemId(isExpanded ? null : resource.id)}
            >
              {/* Top accent bar */}
              <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500/30 to-purple-500/10" />

              <div className="p-5" onClick={(e) => e.stopPropagation()}>
                {/* Actions (visible on hover) */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`/resources/${resource.id}/edit`, '_blank'); }}
                      className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(resource.id); }}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <Link
                  to={`/resources/${resource.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block mb-3 group/title"
                >
                  <h2 className="text-base font-semibold text-gray-100 leading-snug group-hover/title:text-indigo-300 transition-colors duration-200 line-clamp-2">
                    {resource.title}
                  </h2>
                </Link>

                {/* Category pills */}
                {resource.categories && resource.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {resource.categories.map((category) => (
                      <span
                        key={category.id}
                        className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded-md opacity-90"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Subcategories */}
                {resource.subcategories && resource.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {resource.subcategories.map((sc, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md"
                      >
                        {sc}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {resource.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {resource.tags.slice(0, 4).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-700/80 text-gray-300 border border-gray-600/50 rounded-md"
                      >
                        <Tag className="w-2.5 h-2.5 mr-1 text-gray-400" />
                        {tag}
                      </span>
                    ))}
                    {resource.tags.length > 4 && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500 bg-gray-700/50 rounded-md">
                        +{resource.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                  <span className="text-xs text-gray-500 tabular-nums">
                    {new Date(resource.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors group/link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Open
                    <ArrowUpRight className="w-3 h-3 opacity-60 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredResources.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-100 mb-2">
            {resources.length === 0 ? 'No resources yet' : 'No matching resources'}
          </h3>
          <p className="text-gray-500 mb-4">
            {resources.length === 0
              ? 'Create your first resource to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
          {resources.length === 0 && (
            <button
              onClick={() => navigate('/resources/new')}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Resource
            </button>
          )}
        </div>
      )}
    </div>
  );
}