import { useEffect, useMemo, useState } from 'react';
import { supabase, type Tag, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, Edit2, Tag as TagIcon, Search, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';

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

  if (loading) {
    return (
      <div className="container-wide space-y-8">
        <div className="mb-8 space-y-2">
          <Skeleton height={32} width={120} />
          <Skeleton height={16} width={320} />
        </div>
        <Skeleton height={40} width={320} rounded="lg" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <Skeleton height={20} width={140} />
            <Skeleton height={40} />
            <Skeleton height={40} width={100} />
          </div>
          <div className="card p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide space-y-8">
      <PageHeader
        title="Tags"
        subtitle="Manage reusable tags and their category associations"
      />

      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="input-primary pl-9"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={submit} className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{editing ? 'Edit Tag' : 'Create Tag'}</h2>
          <div className="form-group">
            <label className="form-label">Name</label>
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                required
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="input-primary flex-1"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <input
              type="color"
              value={form.color}
              onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
              aria-label="Tag color"
              className="h-10 w-16 p-1 bg-card border border-input rounded-lg cursor-pointer"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Link to Categories</label>
            <div className="max-h-36 overflow-auto space-y-2 border border-border rounded-lg p-3 bg-muted/30">
              {categories.map(cat => (
                <label key={cat.id} className="flex items-center gap-2 py-1 cursor-pointer">
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
                    className="rounded border-input text-primary focus:ring-ring/60"
                  />
                  <span className="text-foreground">{cat.name}</span>
                </label>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">No categories yet</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">
              {editing ? 'Update' : 'Create'}
            </button>
            {editing && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="card p-4">
          <div className="space-y-1">
            {filtered.map(tag => (
              <div key={tag.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors duration-150">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full truncate" style={{ backgroundColor: tag.color || 'hsl(var(--muted-foreground))', color: '#fff' }}>
                    <TagIcon className="w-3 h-3 mr-1 shrink-0" />
                    <span className="truncate">{tag.name}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(tag)}
                    aria-label={`Edit tag ${tag.name}`}
                    className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(tag.id)}
                    aria-label={`Delete tag ${tag.name}`}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <div className="text-center text-muted-foreground py-8">No tags</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

