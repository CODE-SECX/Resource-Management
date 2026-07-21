import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pin, PinOff, Check, X, Edit3 } from 'lucide-react';
import { 
  StickyNote, 
  StickyNoteStats, 
  getStickyNotes, 
  createStickyNote, 
  updateStickyNote, 
  deleteStickyNote, 
  toggleStickyNoteComplete, 
  toggleStickyNotePin,
  getStickyNotesStats 
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';

const StickyNotes: React.FC = () => {
  const { user } = useAuth();
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [stats, setStats] = useState<StickyNoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null);
  const [completingNote, setCompletingNote] = useState<StickyNote | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    content: string;
    color: 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';
    position_x: number;
    position_y: number;
    is_completed: boolean;
    is_pinned: boolean;
  }>({
    title: '',
    content: '',
    color: 'yellow',
    position_x: 0,
    position_y: 0,
    is_completed: false,
    is_pinned: false
  });

  const colors = [
    {
      name: 'yellow' as const,
      bg: 'bg-yellow-50 dark:bg-yellow-500/10',
      border: 'border-yellow-300/80 dark:border-yellow-500/30',
      text: 'text-yellow-900 dark:text-yellow-100',
      swatch: 'bg-yellow-200 dark:bg-yellow-500/30 border-yellow-400 dark:border-yellow-500/50',
      ring: 'ring-yellow-400'
    },
    {
      name: 'pink' as const,
      bg: 'bg-pink-50 dark:bg-pink-500/10',
      border: 'border-pink-300/80 dark:border-pink-500/30',
      text: 'text-pink-900 dark:text-pink-100',
      swatch: 'bg-pink-200 dark:bg-pink-500/30 border-pink-400 dark:border-pink-500/50',
      ring: 'ring-pink-400'
    },
    {
      name: 'blue' as const,
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      border: 'border-blue-300/80 dark:border-blue-500/30',
      text: 'text-blue-900 dark:text-blue-100',
      swatch: 'bg-blue-200 dark:bg-blue-500/30 border-blue-400 dark:border-blue-500/50',
      ring: 'ring-blue-400'
    },
    {
      name: 'green' as const,
      bg: 'bg-green-50 dark:bg-green-500/10',
      border: 'border-green-300/80 dark:border-green-500/30',
      text: 'text-green-900 dark:text-green-100',
      swatch: 'bg-green-200 dark:bg-green-500/30 border-green-400 dark:border-green-500/50',
      ring: 'ring-green-400'
    },
    {
      name: 'purple' as const,
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      border: 'border-purple-300/80 dark:border-purple-500/30',
      text: 'text-purple-900 dark:text-purple-100',
      swatch: 'bg-purple-200 dark:bg-purple-500/30 border-purple-400 dark:border-purple-500/50',
      ring: 'ring-purple-400'
    },
    {
      name: 'orange' as const,
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      border: 'border-orange-300/80 dark:border-orange-500/30',
      text: 'text-orange-900 dark:text-orange-100',
      swatch: 'bg-orange-200 dark:bg-orange-500/30 border-orange-400 dark:border-orange-500/50',
      ring: 'ring-orange-400'
    }
  ];

  useEffect(() => {
    if (user) {
      loadStickyNotes();
      loadStats();
    }
  }, [user]);

  const loadStickyNotes = async () => {
    try {
      const notes = await getStickyNotes();
      setStickyNotes(notes);
    } catch (error) {
      console.error('Error loading sticky notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await getStickyNotesStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    try {
      if (editingNote) {
        await updateStickyNote(editingNote.id, formData);
        setEditingNote(null);
      } else {
        await createStickyNote(formData);
      }
      
      setFormData({ title: '', content: '', color: 'yellow', position_x: 0, position_y: 0, is_completed: false, is_pinned: false });
      setShowForm(false);
      loadStickyNotes();
      loadStats();
    } catch (error) {
      console.error('Error saving sticky note:', error);
    }
  };

  const handleEdit = (note: StickyNote) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      color: note.color,
      position_x: note.position_x,
      position_y: note.position_y,
      is_completed: note.is_completed,
      is_pinned: note.is_pinned
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStickyNote(id);
      loadStickyNotes();
      loadStats();
    } catch (error) {
      console.error('Error deleting sticky note:', error);
    }
  };

  const handleToggleComplete = async (note: StickyNote) => {
    setCompletingNote(note);
    setTimeout(async () => {
      try {
        await toggleStickyNoteComplete(note.id);
        loadStickyNotes();
        loadStats();
      } catch (error) {
        console.error('Error toggling complete:', error);
      } finally {
        setCompletingNote(null);
      }
    }, 500);
  };

  const handleTogglePin = async (id: string) => {
    try {
      await toggleStickyNotePin(id);
      loadStickyNotes();
      loadStats();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const getColorClass = (colorName: string) => {
    return colors.find(c => c.name === colorName) || colors[0];
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingNote(null);
    setFormData({ title: '', content: '', color: 'yellow', position_x: 0, position_y: 0, is_completed: false, is_pinned: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card shadow-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-2">
                <Skeleton height={32} width={200} />
                <Skeleton height={16} width={280} />
              </div>
              <Skeleton height={40} width={140} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={72} rounded="lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={220} rounded="xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Sticky Notes</h1>
              <p className="mt-1 text-sm sm:text-base text-muted-foreground">Capture your thoughts and tasks with colorful sticky notes</p>
            </div>
            <button
              onClick={() => {
                setEditingNote(null);
                setFormData({ title: '', content: '', color: 'yellow', position_x: 0, position_y: 0, is_completed: false, is_pinned: false });
                setShowForm(true);
              }}
              className="btn-primary self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Add Note
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              <div className="card p-4">
                <div className="text-2xl font-bold text-foreground">{stats.total_notes}</div>
                <div className="text-sm text-muted-foreground">Total Notes</div>
              </div>
              <div className="rounded-xl p-4 border bg-success/10 border-success/30">
                <div className="text-2xl font-bold text-success">{stats.completed_notes}</div>
                <div className="text-sm text-success/90">Completed</div>
              </div>
              <div className="rounded-xl p-4 border bg-primary/10 border-primary/30">
                <div className="text-2xl font-bold text-primary">{stats.pending_notes}</div>
                <div className="text-sm text-primary/90">Pending</div>
              </div>
              <div className="rounded-xl p-4 border bg-purple-500/10 border-purple-500/30">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">{stats.pinned_notes}</div>
                <div className="text-sm text-purple-600/90 dark:text-purple-300/90">Pinned</div>
              </div>
              <div className="rounded-xl p-4 border bg-accent border-border">
                <div className="text-2xl font-bold text-accent-foreground">
                  {Math.round((stats.completed_notes / stats.total_notes) * 100) || 0}%
                </div>
                <div className="text-sm text-accent-foreground/80">Completion</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="sticky-note-form-title">
          <div className="bg-card rounded-xl shadow-modal w-full max-w-md border border-border animate-scale-in">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 id="sticky-note-form-title" className="text-xl font-bold text-foreground">
                  {editingNote ? 'Edit Note' : 'New Note'}
                </h2>
                <button
                  onClick={closeForm}
                  className="p-2 hover:bg-accent rounded-lg transition-colors duration-150"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-group">
                  <label className="form-label">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input-primary"
                    placeholder="Note title..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="input-primary resize-none"
                    rows={4}
                    placeholder="Note content..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Color
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {colors.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.name })}
                        className={`w-10 h-10 rounded-lg border-2 transition-all duration-150 ${color.swatch} ${
                          formData.color === color.name
                            ? `ring-2 ring-offset-2 ring-offset-card ${color.ring}`
                            : 'hover:opacity-80'
                        }`}
                        aria-label={`${color.name} color`}
                        aria-pressed={formData.color === color.name}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {editingNote ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Notes Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {stickyNotes.length === 0 ? (
          <div className="text-center py-12 card">
            <div className="w-16 h-16 bg-accent rounded-lg mx-auto mb-4 flex items-center justify-center">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No sticky notes yet</h3>
            <p className="text-muted-foreground mb-4">Create your first sticky note to get started</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary inline-flex"
            >
              <Plus className="w-4 h-4" />
              Create Note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
            {stickyNotes.map((note) => {
              const colorClass = getColorClass(note.color);
              const isCompleting = completingNote?.id === note.id;
              
              return (
                <div
                  key={note.id}
                  className={`relative group ${isCompleting ? 'scale-95 opacity-50' : 'transition-all duration-300 hover:-translate-y-0.5'}`}
                >
                  <div
                    className={`${colorClass.bg} ${colorClass.border} border rounded-xl p-4 shadow-card hover:shadow-card-hover transition-all duration-300 min-h-[220px] max-h-[300px] overflow-hidden flex flex-col ${
                      note.is_completed ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Pin Button */}
                    <button
                      onClick={() => handleTogglePin(note.id)}
                      className={`absolute -bottom-2 -right-2 p-1.5 rounded-full border border-border shadow-xs transition-colors duration-150 ${
                        note.is_completed
                          ? 'bg-success text-success-foreground'
                          : 'bg-card text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label={note.is_pinned ? 'Unpin note' : 'Pin note'}
                      title={note.is_pinned ? 'Pinned' : 'Not pinned'}
                    >
                      {note.is_pinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
                    </button>

                    {/* Title */}
                    <div className="flex-1 min-h-0">
                      <h3 className={`font-semibold text-base mb-2 ${colorClass.text} ${note.is_completed ? 'line-through' : ''} line-clamp-2`}>
                        {note.title}
                      </h3>

                      {/* Content */}
                      <p className={`text-sm ${colorClass.text} opacity-90 leading-relaxed whitespace-pre-wrap mb-4 flex-1 overflow-y-auto max-h-[120px] ${
                        note.is_completed ? 'line-through' : ''
                      }`}>
                        {note.content}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 mt-auto border-t border-current border-opacity-20">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleComplete(note)}
                          className={`p-1.5 rounded transition-colors duration-150 ${
                            note.is_completed
                              ? 'bg-success text-success-foreground hover:bg-success/90'
                              : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                          }`}
                          aria-label={note.is_completed ? 'Mark as pending' : 'Mark as completed'}
                          title={note.is_completed ? 'Mark as pending' : 'Mark as completed'}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        
                        <button
                          onClick={() => handleEdit(note)}
                          className="p-1.5 rounded bg-card text-muted-foreground hover:text-foreground border border-border transition-colors duration-150"
                          aria-label="Edit note"
                          title="Edit note"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-150"
                        aria-label="Delete note"
                        title="Delete note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Date */}
                    <div className={`text-xs ${colorClass.text} opacity-50 mt-1`}>
                      {new Date(note.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Completion Animation */}
                  {isCompleting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-success/90 rounded-xl">
                      <div className="text-success-foreground text-center">
                        <Check className="w-8 h-8 mx-auto mb-2" />
                        <div className="text-sm font-medium">Completed!</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickyNotes;
