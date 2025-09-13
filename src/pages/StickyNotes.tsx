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
    { name: 'yellow' as const, bg: 'bg-yellow-600/20', border: 'border-yellow-500/50', text: 'text-yellow-200' },
    { name: 'pink' as const, bg: 'bg-pink-600/20', border: 'border-pink-500/50', text: 'text-pink-200' },
    { name: 'blue' as const, bg: 'bg-blue-600/20', border: 'border-blue-500/50', text: 'text-blue-200' },
    { name: 'green' as const, bg: 'bg-green-600/20', border: 'border-green-500/50', text: 'text-green-200' },
    { name: 'purple' as const, bg: 'bg-purple-600/20', border: 'border-purple-500/50', text: 'text-purple-200' },
    { name: 'orange' as const, bg: 'bg-orange-600/20', border: 'border-orange-500/50', text: 'text-orange-200' }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-800 shadow-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Sticky Notes</h1>
              <p className="text-slate-300">Capture your thoughts and tasks with colorful sticky notes</p>
            </div>
            <button
              onClick={() => {
                setEditingNote(null);
                setFormData({ title: '', content: '', color: 'yellow', position_x: 0, position_y: 0, is_completed: false, is_pinned: false });
                setShowForm(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Note
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                <div className="text-2xl font-bold text-white">{stats.total_notes}</div>
                <div className="text-sm text-slate-300">Total Notes</div>
              </div>
              <div className="bg-green-900/30 rounded-lg p-4 border border-green-700">
                <div className="text-2xl font-bold text-green-400">{stats.completed_notes}</div>
                <div className="text-sm text-green-300">Completed</div>
              </div>
              <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
                <div className="text-2xl font-bold text-blue-400">{stats.pending_notes}</div>
                <div className="text-sm text-blue-300">Pending</div>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-700">
                <div className="text-2xl font-bold text-purple-400">{stats.pinned_notes}</div>
                <div className="text-sm text-purple-300">Pinned</div>
              </div>
              <div className="bg-indigo-900/30 rounded-lg p-4 border border-indigo-700">
                <div className="text-2xl font-bold text-indigo-400">
                  {Math.round((stats.completed_notes / stats.total_notes) * 100) || 0}%
                </div>
                <div className="text-sm text-indigo-300">Completion</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  {editingNote ? 'Edit Note' : 'New Note'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingNote(null);
                    setFormData({ title: '', content: '', color: 'yellow', position_x: 0, position_y: 0, is_completed: false, is_pinned: false });
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Note title..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    placeholder="Note content..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Color
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {colors.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.name })}
                        className={`w-10 h-10 rounded-lg border-2 transition-all ${
                          formData.color === color.name
                            ? `${color.border} ring-2 ring-offset-2 ring-${color.name}-400`
                            : `${color.border} hover:ring-1 hover:ring-offset-1 hover:ring-${color.name}-300`
                        } ${color.bg}`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingNote(null);
                      setFormData({ title: '', content: '', color: 'yellow', position_x: 0, position_y: 0, is_completed: false, is_pinned: false });
                    }}
                    className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-700 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <Plus className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No sticky notes yet</h3>
            <p className="text-slate-400 mb-4">Create your first sticky note to get started</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
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
                  className={`relative group ${isCompleting ? 'scale-95 opacity-50' : 'transition-all duration-300 hover:scale-105'}`}
                >
                  <div
                    className={`${colorClass.bg} ${colorClass.border} border-2 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 min-h-[220px] max-h-[300px] overflow-hidden flex flex-col ${
                      note.is_completed ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Pin Button */}
                    <button
                      onClick={() => handleTogglePin(note.id)}
                      className={`absolute -bottom-2 -right-2 p-1.5 rounded-full transition-all ${
                        note.is_completed
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
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
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleComplete(note)}
                          className={`p-1.5 rounded transition-all ${
                            note.is_completed
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                          }`}
                          title={note.is_completed ? 'Mark as pending' : 'Mark as completed'}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        
                        <button
                          onClick={() => handleEdit(note)}
                          className="p-1.5 rounded bg-slate-600 text-slate-300 hover:bg-slate-500 transition-all"
                          title="Edit note"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-all"
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
                    <div className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-90 rounded-lg">
                      <div className="text-white text-center">
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
