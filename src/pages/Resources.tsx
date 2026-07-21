import { useState, useEffect } from 'react';
import {
  supabase,
  type Resource,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Edit2, Trash2, Tag, Grid, LayoutList, BookOpen, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/Skeleton';

export function Resources() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="space-y-2">
            <Skeleton height={32} width={220} />
            <Skeleton height={16} width={320} />
          </div>
          <Skeleton height={40} width={160} />
        </div>
        <Skeleton height={44} className="w-full" />
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton height={20} width="70%" />
              <div className="flex gap-2">
                <Skeleton height={20} width={60} rounded="full" />
                <Skeleton height={20} width={60} rounded="full" />
              </div>
              <Skeleton height={14} width="90%" />
              <Skeleton height={14} width="40%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Resource Library"
        subtitle="Organize and access your comprehensive resource collection"
        actions={
          <>
            <button
              onClick={() => setIsGridLayout(!isGridLayout)}
              className="p-2.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent transition-colors duration-150"
              title={isGridLayout ? 'Switch to list view' : 'Switch to grid view'}
              aria-label={isGridLayout ? 'Switch to list view' : 'Switch to grid view'}
            >
              {isGridLayout ? <LayoutList className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
            </button>
            <Link to="/taxonomy" className="btn-secondary">
              Manage Taxonomy
            </Link>
            <Button onClick={() => navigate('/resources/new')}>
              <Plus className="w-4 h-4" />
              Add Resource
            </Button>
          </>
        }
      />

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <input
          type="text"
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-primary pl-10 py-3"
        />
      </div>

      {/* Resources Grid/List View */}
      <div className={isGridLayout ? "grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
        {filteredResources.map((resource) => {
          const isExpanded = expandedItemId === resource.id;
          return (
            <div
              key={resource.id}
              className={`group relative bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-300 overflow-hidden ${!isGridLayout ? 'cursor-pointer' : ''}`}
              onClick={() => !isGridLayout && setExpandedItemId(isExpanded ? null : resource.id)}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full bg-primary/20" />

              <div className="p-5" onClick={(e) => e.stopPropagation()}>
                {/* Actions (visible on hover) */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`/resources/${resource.id}/edit`, '_blank'); }}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors duration-150"
                      title="Edit"
                      aria-label="Edit resource"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(resource.id); }}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors duration-150"
                      title="Delete"
                      aria-label="Delete resource"
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
                  <h2 className="text-base font-semibold text-foreground leading-snug group-hover/title:text-primary transition-colors duration-200 line-clamp-2">
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
                        className="category-tag"
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
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground border border-border rounded-md"
                      >
                        <Tag className="w-2.5 h-2.5 mr-1 text-muted-foreground" />
                        {tag}
                      </span>
                    ))}
                    {resource.tags.length > 4 && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded-md">
                        +{resource.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(resource.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors duration-150 group/link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Open
                    <ArrowUpRight className="w-3 h-3 opacity-60 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform duration-150" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredResources.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {resources.length === 0 ? 'No resources yet' : 'No matching resources'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {resources.length === 0
              ? 'Create your first resource to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
          {resources.length === 0 && (
            <Button onClick={() => navigate('/resources/new')}>
              <Plus className="w-4 h-4" />
              Add Your First Resource
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
