import { useState, useEffect } from 'react';
import { supabase, type Resource, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, ExternalLink, Menu, X } from 'lucide-react';
import { Modal } from '../components/Modal';

export function ResourceIndex() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const allTags = Array.from(new Set(resources.flatMap(item => item.tags || [])));
  const [selectedItem, setSelectedItem] = useState<Resource | null>(null);

  useEffect(() => {
    fetchResources();
    fetchCategories();
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
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const filteredResources = resources.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || 
                          item.categories?.some(cat => selectedCategories.includes(cat.id));
    const matchesTags = selectedTags.length === 0 ||
                       selectedTags.some(tag => item.tags?.includes(tag));

    return matchesSearch && matchesCategory && matchesTags;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-20 left-4 z-50 p-2 rounded-md bg-white shadow-lg border border-gray-200"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <div className={`${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-gray-800 border-r border-gray-700 p-4 space-y-6 transform transition-transform duration-200 ease-in-out`}>
        <div>
          <h2 className="text-lg font-semibold text-gray-100 mb-3">Categories</h2>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setSelectedCategories([])}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                selectedCategories.length === 0
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategories(prev =>
                    prev.includes(category.id)
                      ? prev.filter(id => id !== category.id)
                      : [...prev, category.id]
                  );
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                  selectedCategories.includes(category.id)
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tags Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-100 mb-3">Tags</h2>
          <div className="grid grid-cols-2 gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTags(prev =>
                    prev.includes(tag)
                      ? prev.filter(t => t !== tag)
                      : [...prev, tag]
                  );
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                  selectedTags.includes(tag)
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}
            {allTags.length === 0 && (
              <p className="text-sm text-gray-400 px-3">No tags available</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-100">Resources</h1>
            <p className="mt-2 text-gray-400">Browse resources by category</p>
          </div>

          {/* Search */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-gray-800 text-gray-100"
              />
            </div>
          </div>

          {/* Resource Items */}
          <div className="space-y-4">
            {filteredResources.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-100">{item.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      {item.categories?.map(cat => cat.name).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {filteredResources.length === 0 && (
              <div className="text-center py-12">
                <Search className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-100">No resources found</h3>
                <p className="mt-2 text-gray-400">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Item Detail Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title=""
        size="xl"
      >
        {selectedItem && (
          <div className="space-y-4 bg-gray-800 p-6 rounded-lg">
            <h1 className="text-4xl font-bold text-gray-100 mb-6">{selectedItem.title}</h1>

            <div className="flex items-center gap-4 mb-6">
              {selectedItem.categories?.map(cat => (
                <span
                  key={cat.id}
                  className="inline-block px-3 py-1 text-sm font-medium text-white rounded-full"
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.name}
                </span>
              ))}
            </div>

            <div className="prose prose-lg max-w-none text-gray-300">
              <div dangerouslySetInnerHTML={{ __html: selectedItem.description }} />
            </div>

            {selectedItem.url && (
              <div className="mt-6">
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Resource
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}