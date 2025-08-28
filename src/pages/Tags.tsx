import { useEffect, useMemo, useState } from 'react';
import { supabase, type Tag, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, Tag as TagIcon, Search, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TagsPage() {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', color: '#6366F1', categoryIds: [] as string[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [{ data: tagRows, error: tagErr }, { data: catRows, error: catErr }] = await Promise.all([
        supabase.from('tags').select('*').eq('user_id', user.id).order('name'),
        supabase.from('categories').select('*').eq('user_id', user.id).order('name')
      ]);
      if (tagErr) throw tagErr;
      if (catErr) throw catErr;
      setTags(tagRows || []);
      setCategories(catRows || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(t => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', color: '#6366F1', categoryIds: [] });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editing) {
        const { error } = await supabase
          .from('tags')
          .update({ name: form.name, color: form.color })
          .eq('id', editing.id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success('Tag updated');
      } else {
        const { error } = await supabase
          .from('tags')
          .insert([{ name: form.name, color: form.color, user_id: user.id }]);
        if (error) throw error;
        toast.success('Tag created');
      }

      // Update tag-category links
      const tagId = editing ? editing.id : (await supabase
        .from('tags')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', form.name)
        .single()).data?.id;

      if (tagId) {
        await supabase.from('tag_categories').delete().eq('tag_id', tagId);
        if (form.categoryIds.length) {
          const rows = form.categoryIds.map(cid => ({ tag_id: tagId, category_id: cid }));
          await supabase.from('tag_categories').insert(rows);
        }
      }

      resetForm();
      fetchAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save tag');
    }
  };

  const startEdit = async (tag: Tag) => {
    setEditing(tag);
    try {
      const { data } = await supabase
        .from('tag_categories')
        .select('category_id')
        .eq('tag_id', tag.id);
      setForm({ name: tag.name, color: tag.color || '#6366F1', categoryIds: (data || []).map(r => r.category_id) });
    } catch {
      setForm({ name: tag.name, color: tag.color || '#6366F1', categoryIds: [] });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    try {
      await supabase.from('tag_categories').delete().eq('tag_id', id);
      const { error } = await supabase.from('tags').delete().eq('id', id).eq('user_id', (user as any).id);
      if (error) throw error;
      toast.success('Tag deleted');
      fetchAll();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete tag');
    }
  };

  return (
    <div className="container-wide space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-50">Tags</h1>
          <p className="text-gray-400">Manage reusable tags and their category associations</p>
        </div>
      </div>

      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="pl-9 pr-3 py-2 w-full border border-gray-600 rounded-lg bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={submit} className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-100">{editing ? 'Edit Tag' : 'Create Tag'}</h2>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Name</label>
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-400" />
              <input
                required
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Color</label>
            <input
              type="color"
              value={form.color}
              onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
              className="h-10 w-16 p-1 bg-gray-700 border border-gray-600 rounded"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Link to Categories</label>
            <div className="max-h-36 overflow-auto space-y-2 border border-gray-700 rounded p-3 bg-gray-900/30">
              {categories.map(cat => (
                <label key={cat.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(cat.id)}
                    onChange={e => {
                      setForm(prev => ({
                        ...prev,
                        categoryIds: e.target.checked
                          ? [...prev.categoryIds, cat.id]
                          : prev.categoryIds.filter(id => id !== cat.id),
                      }));
                    }}
                  />
                  <span className="text-gray-200">{cat.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              {editing ? 'Update' : 'Create'}
            </button>
            {editing && (
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-700">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="space-y-2">
            {filtered.map(tag => (
              <div key={tag.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/40">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2 py-1 text-xs rounded-full" style={{ backgroundColor: tag.color || '#475569', color: '#fff' }}>
                    <TagIcon className="w-3 h-3 mr-1" />
                    {tag.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(tag)} className="p-2 text-gray-400 hover:text-indigo-400">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(tag.id)} className="p-2 text-gray-400 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <div className="text-center text-gray-400 py-8">No tags</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

