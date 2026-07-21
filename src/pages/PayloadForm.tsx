import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  createPayload, 
  updatePayload, 
  getPayload,
  getPayloadSubcategories,
  getPayloadTags
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  Save, 
  Target, 
  Shield, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Tag,
  Folder,
  Plus,
  X,
  Code
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/ui/Skeleton';

const severityOptions = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500', icon: AlertTriangle },
  { value: 'high', label: 'High', color: 'bg-orange-500', icon: Shield },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500', icon: Target },
  { value: 'low', label: 'Low', color: 'bg-blue-500', icon: CheckCircle },
  { value: 'info', label: 'Info', color: 'bg-gray-500', icon: Clock }
];

const targetTypeOptions = [
  { value: 'web', label: 'Web Application', icon: Target },
  { value: 'api', label: 'API', icon: Zap },
  { value: 'mobile', label: 'Mobile', icon: Shield },
  { value: 'network', label: 'Network', icon: AlertTriangle },
  { value: 'other', label: 'Other', icon: Folder }
];

const commonCategories = [
  'SQL Injection',
  'XSS',
  'CSRF',
  'SSRF',
  'RCE',
  'LFI',
  'RFI',
  'Command Injection',
  'XXE',
  'Deserialization',
  'Authentication',
  'Authorization',
  'Cryptography',
  'Information Disclosure',
  'Business Logic',
  'Misconfiguration',
  'DoS'
];

const commonSubcategories = {
  'SQL Injection': ['Union-based', 'Error-based', 'Blind', 'Time-based', 'Out-of-band'],
  'XSS': ['Reflected', 'Stored', 'DOM-based', 'Self-XSS', 'Mutation XSS'],
  'CSRF': ['Token-based', 'Same-origin', 'Cross-origin'],
  'SSRF': ['Internal', 'External', 'Cloud metadata', 'GCP', 'AWS', 'Azure'],
  'RCE': ['Code execution', 'Command injection', 'Eval injection'],
  'LFI': ['Directory traversal', 'File inclusion', 'Log poisoning'],
  'RFI': ['Remote file inclusion', 'URL inclusion'],
  'Command Injection': ['OS command', 'Shell injection', 'Argument injection'],
  'XXE': ['External entity', 'Parameter entity', 'DTD'],
  'Deserialization': ['Java', 'Python', 'PHP', '.NET', 'Ruby'],
  'Authentication': ['Brute force', 'Password reset', 'Session fixation', 'JWT'],
  'Authorization': ['IDOR', 'Privilege escalation', 'Horizontal', 'Vertical'],
  'Cryptography': ['Weak encryption', 'Hash cracking', 'Key management'],
  'Information Disclosure': ['Error messages', 'Debug info', 'Comments'],
  'Business Logic': ['Race conditions', 'Financial', 'Workflow bypass'],
  'Misconfiguration': ['Default credentials', 'Exposed services', 'CORS'],
  'DoS': ['Resource exhaustion', 'Amplification', 'Application layer']
};

const commonTags = [
  'bugbounty', 'pentest', 'cve', 'owasp', 'critical', 'high-impact', 'bypass',
  'authentication', 'authorization', 'injection', 'xss', 'sqli', 'csrf',
  'ssrf', 'rce', 'lfi', 'rfi', 'xxe', 'deserialization', 'jwt', 'oauth',
  'saml', 'cors', 'csp', 'hsts', 'https', 'waf', 'bypass', 'privilege-escalation',
  'information-disclosure', 'business-logic', 'race-condition', 'dos',
  'brute-force', 'password-reset', 'session-management', 'clickjacking',
  'tabnabbing', 'prototype-pollution', 'template-injection', 'ssti'
];

export function PayloadForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const action = searchParams.get('action');
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!editId);
  const [formData, setFormData] = useState({
    title: '',
    payload: '',
    description: '',
    category: '',
    subcategories: [] as string[],
    tags: [] as string[],
    severity: 'medium' as const,
    target_type: 'web' as const,
    is_favorite: false,
    is_private: true
  });

  const [newSubcategory, setNewSubcategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    if (editId && user) {
      fetchPayload();
    }
    if (user) {
      fetchAvailableOptions();
    }
  }, [editId, user]);

  useEffect(() => {
    // Update available subcategories based on selected category
    if (formData.category && commonSubcategories[formData.category as keyof typeof commonSubcategories]) {
      setAvailableSubcategories(commonSubcategories[formData.category as keyof typeof commonSubcategories]);
    } else {
      setAvailableSubcategories([]);
    }
  }, [formData.category]);

  const fetchPayload = async () => {
    if (!editId || !user) return;

    try {
      setFetching(true);
      const data = await getPayload(editId);
      if (data && data.user_id === user.id) {
        setFormData({
          title: data.title,
          payload: data.payload,
          description: data.description || '',
          category: data.category,
          subcategories: data.subcategories,
          tags: data.tags,
          severity: data.severity,
          target_type: data.target_type,
          is_favorite: data.is_favorite,
          is_private: data.is_private
        });
      } else {
        toast.error('Payload not found');
        navigate('/payloads');
      }
    } catch (error) {
      console.error('Error fetching payload:', error);
      toast.error('Failed to fetch payload');
      navigate('/payloads');
    } finally {
      setFetching(false);
    }
  };

  const fetchAvailableOptions = async () => {
    if (!user) return;

    try {
      const [subs, tags] = await Promise.all([
        getPayloadSubcategories(user.id),
        getPayloadTags(user.id)
      ]);
      
      setAvailableSubcategories(prev => [...new Set([...prev, ...subs])]);
      setAvailableTags(_prev => [...new Set([...commonTags, ...tags])]);
    } catch (error) {
      console.error('Error fetching available options:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    if (!formData.payload.trim()) {
      toast.error('Payload is required');
      return;
    }
    
    if (!formData.category) {
      toast.error('Category is required');
      return;
    }

    setLoading(true);
    try {
      if (action === 'edit' && editId) {
        await updatePayload(editId, formData);
        toast.success('Payload updated successfully');
      } else {
        await createPayload(formData, user!.id);
        toast.success('Payload created successfully');
      }
      navigate('/payloads');
    } catch (error) {
      console.error('Error saving payload:', error);
      toast.error('Failed to save payload');
    } finally {
      setLoading(false);
    }
  };

  const addSubcategory = () => {
    if (newSubcategory.trim() && !formData.subcategories.includes(newSubcategory.trim())) {
      setFormData(prev => ({
        ...prev,
        subcategories: [...prev.subcategories, newSubcategory.trim()]
      }));
      setNewSubcategory('');
    }
  };

  const removeSubcategory = (subcategory: string) => {
    setFormData(prev => ({
      ...prev,
      subcategories: prev.subcategories.filter(s => s !== subcategory)
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({
      ...prev,
      category,
      subcategories: [] // Reset subcategories when category changes
    }));
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton height={40} width={240} className="mb-8" />
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={140} rounded="xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <Link
            to="/payloads"
            className="inline-flex items-center px-3 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors duration-150 w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Payloads
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Code className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {action === 'edit' ? 'Edit Payload' : 'Create New Payload'}
            </h1>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 gap-5">
              <div className="form-group">
                <label className="form-label">
                  Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="input-primary"
                  placeholder="e.g., SQL Injection Union-based Payload"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input-primary"
                  rows={3}
                  placeholder="Describe what this payload does, when to use it, and any special considerations..."
                />
                <p className="form-hint">Optional context to help you remember when and how to use this payload.</p>
              </div>
            </div>
          </div>

          {/* Payload Content */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Payload Content</h2>
            
            <div className="form-group">
              <label className="form-label">
                Payload <span className="text-destructive">*</span>
              </label>
              <textarea
                value={formData.payload}
                onChange={(e) => setFormData(prev => ({ ...prev, payload: e.target.value }))}
                className="input-primary font-mono text-sm"
                rows={8}
                placeholder="Enter your payload here..."
                required
              />
            </div>
          </div>

          {/* Classification */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Classification</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group">
                <label className="form-label">
                  Category <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="input-primary"
                  required
                >
                  <option value="">Select a category</option>
                  {commonCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as any }))}
                  className="input-primary"
                >
                  {severityOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Target Type
                </label>
                <select
                  value={formData.target_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_type: e.target.value as any }))}
                  className="input-primary"
                >
                  {targetTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_favorite}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_favorite: e.target.checked }))}
                    className="rounded border-border text-primary focus:ring-ring/60"
                  />
                  <span className="text-foreground text-sm">Favorite</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_private}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_private: e.target.checked }))}
                    className="rounded border-border text-primary focus:ring-ring/60"
                  />
                  <span className="text-foreground text-sm">Private</span>
                </label>
              </div>
            </div>
          </div>

          {/* Subcategories */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Subcategories</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubcategory}
                  onChange={(e) => setNewSubcategory(e.target.value)}
                  className="input-primary flex-1"
                  placeholder="Add a subcategory..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubcategory())}
                />
                <button
                  type="button"
                  onClick={addSubcategory}
                  className="btn-primary !px-3"
                  aria-label="Add subcategory"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Available subcategories suggestions */}
              {availableSubcategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availableSubcategories
                    .filter(sub => !formData.subcategories.includes(sub))
                    .slice(0, 8)
                    .map(sub => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          subcategories: [...prev.subcategories, sub]
                        }))}
                        className="inline-flex items-center px-3 py-1 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/70 transition-colors duration-150 text-sm border border-border"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {sub}
                      </button>
                    ))}
                </div>
              )}
              
              {/* Selected subcategories */}
              {formData.subcategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.subcategories.map(sub => (
                    <span
                      key={sub}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary text-primary-foreground"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {sub}
                      <button
                        type="button"
                        onClick={() => removeSubcategory(sub)}
                        className="ml-2 hover:text-primary-foreground/70"
                        aria-label={`Remove ${sub}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Tags</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="input-primary flex-1"
                  placeholder="Add a tag..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="btn-primary !px-3"
                  aria-label="Add tag"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Available tags suggestions */}
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter(tag => !formData.tags.includes(tag))
                  .slice(0, 12)
                  .map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        tags: [...prev.tags, tag]
                      }))}
                      className="inline-flex items-center px-3 py-1 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/70 transition-colors duration-150 text-sm border border-border"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {tag}
                    </button>
                  ))}
              </div>
              
              {/* Selected tags */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="category-tag"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 hover:text-primary/70"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4">
            <Link
              to="/payloads"
              className="px-6 py-2 text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : (action === 'edit' ? 'Update Payload' : 'Create Payload')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
