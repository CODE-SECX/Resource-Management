import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  type Payload, 
  getPayload, 
  updatePayload, 
  deletePayload, 
  incrementPayloadUsage 
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  Star, 
  Target, 
  Shield, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Tag,
  Folder,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/ui/Skeleton';

const severityColors = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-warning text-warning-foreground',
  medium: 'bg-warning/70 text-warning-foreground',
  low: 'bg-primary text-primary-foreground',
  info: 'bg-secondary text-secondary-foreground'
};

const severityIcons = {
  critical: AlertTriangle,
  high: Shield,
  medium: Target,
  low: CheckCircle,
  info: Clock
};

const targetTypeIcons = {
  web: Target,
  api: Zap,
  mobile: Shield,
  network: TrendingUp,
  other: Folder
};

export function PayloadDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id && user) {
      fetchPayload();
    }
  }, [id, user]);

  const fetchPayload = async () => {
    if (!id || !user) return;

    try {
      const data = await getPayload(id);
      if (data && data.user_id === user.id) {
        setPayload(data);
      } else {
        toast.error('Payload not found');
        navigate('/payloads');
      }
    } catch (error) {
      console.error('Error fetching payload:', error);
      toast.error('Failed to fetch payload');
      navigate('/payloads');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPayload = async () => {
    if (!payload) return;
    
    try {
      await navigator.clipboard.writeText(payload.payload);
      setIsCopied(true);
      toast.success('Payload copied to clipboard');
      
      // Increment usage count
      await incrementPayloadUsage(payload.id);
      
      // Update local state
      setPayload({
        ...payload,
        usage_count: payload.usage_count + 1,
        last_used_at: new Date().toISOString()
      });
      
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Error copying payload:', error);
      toast.error('Failed to copy payload');
    }
  };

  const handleToggleFavorite = async () => {
    if (!payload) return;
    
    try {
      const updated = await updatePayload(payload.id, {
        is_favorite: !payload.is_favorite
      });
      
      setPayload(updated);
      toast.success(payload.is_favorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const handleDelete = async () => {
    if (!payload) return;
    
    try {
      await deletePayload(payload.id);
      toast.success('Payload deleted successfully');
      navigate('/payloads');
    } catch (error) {
      console.error('Error deleting payload:', error);
      toast.error('Failed to delete payload');
    }
  };

  const getSeverityIcon = (severity: string) => {
    const Icon = severityIcons[severity as keyof typeof severityIcons] || AlertTriangle;
    return <Icon className="w-4 h-4" />;
  };

  const getTargetTypeIcon = (targetType: string) => {
    const Icon = targetTypeIcons[targetType as keyof typeof targetTypeIcons] || Target;
    return <Icon className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <Skeleton height={40} width={200} />
            <Skeleton height={40} width={120} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton height={140} rounded="xl" />
              <Skeleton height={160} rounded="xl" />
            </div>
            <div className="space-y-6">
              <Skeleton height={260} rounded="xl" />
              <Skeleton height={160} rounded="xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Payload Not Found</h2>
          <p className="text-muted-foreground mb-6">The payload you're looking for doesn't exist.</p>
          <Link
            to="/payloads"
            className="btn-primary inline-flex"
          >
            Back to Payloads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              to="/payloads"
              className="inline-flex items-center px-3 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors duration-150"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Payloads
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Payload Details</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Link
              to={`/payloads?action=edit&id=${payload.id}`}
              className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent transition-colors duration-150"
              aria-label="Edit payload"
            >
              <Edit3 className="w-5 h-5" />
            </Link>
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-lg transition-colors duration-150 ${
                payload.is_favorite ? 'text-warning' : 'text-muted-foreground hover:text-warning hover:bg-accent'
              }`}
              aria-label={payload.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-5 h-5 ${payload.is_favorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-accent transition-colors duration-150"
              aria-label="Delete payload"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-card rounded-xl shadow-modal border border-border max-w-md w-full p-6 animate-scale-in">
              <h3 className="text-lg font-semibold text-foreground mb-4">Delete Payload</h3>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete this payload? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors duration-150"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Payload Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title Section */}
            <div className="card p-5 sm:p-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 leading-tight break-words">
                {payload.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${severityColors[payload.severity]}`}>
                  {getSeverityIcon(payload.severity)}
                  <span className="ml-1 capitalize">{payload.severity}</span>
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
                  {getTargetTypeIcon(payload.target_type)}
                  <span className="ml-1 capitalize">{payload.target_type}</span>
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
                  <Folder className="w-4 h-4 mr-1" />
                  {payload.category}
                </span>
              </div>

              {payload.description && (
                <p className="text-foreground/90 leading-relaxed">{payload.description}</p>
              )}
            </div>

            {/* Payload Content */}
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Payload</h2>
                <button
                  onClick={handleCopyPayload}
                  className="btn-primary !px-3 !py-1.5 text-sm"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Payload
                    </>
                  )}
                </button>
              </div>
              <div className="card-body">
                <pre className="font-mono text-sm bg-muted border border-border rounded-lg p-3 sm:p-4 text-foreground overflow-x-auto">
                  <code>{payload.payload}</code>
                </pre>
              </div>
            </div>

            {/* Tags and Subcategories */}
            {(payload.tags.length > 0 || payload.subcategories.length > 0) && (
              <div className="card p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Classification</h2>
                
                {payload.subcategories.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Subcategories</h3>
                    <div className="flex flex-wrap gap-2">
                      {payload.subcategories.map((subcategory, index) => (
                        <span
                          key={index}
                          className="category-tag"
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          {subcategory}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {payload.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {payload.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="category-tag"
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Statistics</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-muted-foreground">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    <span className="text-sm">Usage Count</span>
                  </div>
                  <span className="text-foreground font-medium">{payload.usage_count}</span>
                </div>
                
                {payload.last_used_at && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">Last Used</span>
                    </div>
                    <span className="text-foreground text-sm">
                      {new Date(payload.last_used_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">Created</span>
                  </div>
                  <span className="text-foreground text-sm">
                    {new Date(payload.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">Updated</span>
                  </div>
                  <span className="text-foreground text-sm">
                    {new Date(payload.updated_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-muted-foreground">
                    <Star className="w-4 h-4 mr-2" />
                    <span className="text-sm">Favorite</span>
                  </div>
                  <span className={`text-sm font-medium ${payload.is_favorite ? 'text-warning' : 'text-muted-foreground'}`}>
                    {payload.is_favorite ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-muted-foreground">
                    <Shield className="w-4 h-4 mr-2" />
                    <span className="text-sm">Private</span>
                  </div>
                  <span className={`text-sm font-medium ${payload.is_private ? 'text-success' : 'text-muted-foreground'}`}>
                    {payload.is_private ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
              
              <div className="space-y-3">
                <button
                  onClick={handleCopyPayload}
                  className="btn-primary w-full"
                >
                  <Copy className="w-4 h-4" />
                  Copy Payload
                </button>
                
                <Link
                  to={`/payloads?action=edit&id=${payload.id}`}
                  className="btn-secondary w-full"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Payload
                </Link>
                
                <button
                  onClick={handleToggleFavorite}
                  className={`inline-flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                    payload.is_favorite 
                      ? 'bg-warning text-warning-foreground border-warning hover:bg-warning/90' 
                      : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/70'
                  }`}
                >
                  <Star className={`w-4 h-4 ${payload.is_favorite ? 'fill-current' : ''}`} />
                  {payload.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
