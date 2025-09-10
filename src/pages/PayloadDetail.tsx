import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  supabase, 
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
  Calendar,
  ExternalLink,
  Share2
} from 'lucide-react';
import toast from 'react-hot-toast';

const severityColors = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
  info: 'bg-gray-500 text-white'
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Payload Not Found</h2>
          <p className="text-gray-400 mb-6">The payload you're looking for doesn't exist.</p>
          <Link
            to="/payloads"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to Payloads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-full sm:max-w-full md:max-w-full lg:max-w-7xl xl:max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/payloads"
              className="inline-flex items-center px-3 py-2 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Payloads
            </Link>
            
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-100">Payload Details</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Link
              to={`/payloads?action=edit&id=${payload.id}`}
              className="p-2 text-gray-400 hover:text-indigo-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Edit3 className="w-5 h-5" />
            </Link>
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-lg transition-colors ${
                payload.is_favorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
              }`}
            >
              <Star className={`w-5 h-5 ${payload.is_favorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Delete Payload</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete this payload? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Payload Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title Section */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-100 mb-4 leading-tight">
                    {payload.title}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${severityColors[payload.severity]}`}>
                      {getSeverityIcon(payload.severity)}
                      <span className="ml-1 capitalize">{payload.severity}</span>
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-300">
                      {getTargetTypeIcon(payload.target_type)}
                      <span className="ml-1 capitalize">{payload.target_type}</span>
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-300">
                      <Folder className="w-4 h-4 mr-1" />
                      {payload.category}
                    </span>
                  </div>
                  
                  {payload.description && (
                    <p className="text-gray-300 leading-relaxed">{payload.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payload Content */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-100">Payload</h2>
                <button
                  onClick={handleCopyPayload}
                  className="inline-flex items-center px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy Payload
                    </>
                  )}
                </button>
              </div>
              <div className="p-6">
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-sm text-gray-300 font-mono">{payload.payload}</code>
                </pre>
              </div>
            </div>

            {/* Tags and Subcategories */}
            {(payload.tags.length > 0 || payload.subcategories.length > 0) && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4">Classification</h2>
                
                {payload.subcategories.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Subcategories</h3>
                    <div className="flex flex-wrap gap-2">
                      {payload.subcategories.map((subcategory, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-300"
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
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {payload.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-300"
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
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Statistics</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-400">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    <span className="text-sm">Usage Count</span>
                  </div>
                  <span className="text-gray-100 font-medium">{payload.usage_count}</span>
                </div>
                
                {payload.last_used_at && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-gray-400">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">Last Used</span>
                    </div>
                    <span className="text-gray-100 text-sm">
                      {new Date(payload.last_used_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">Created</span>
                  </div>
                  <span className="text-gray-100 text-sm">
                    {new Date(payload.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">Updated</span>
                  </div>
                  <span className="text-gray-100 text-sm">
                    {new Date(payload.updated_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-400">
                    <Star className="w-4 h-4 mr-2" />
                    <span className="text-sm">Favorite</span>
                  </div>
                  <span className={`text-sm font-medium ${payload.is_favorite ? 'text-yellow-500' : 'text-gray-400'}`}>
                    {payload.is_favorite ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-400">
                    <Shield className="w-4 h-4 mr-2" />
                    <span className="text-sm">Private</span>
                  </div>
                  <span className={`text-sm font-medium ${payload.is_private ? 'text-green-500' : 'text-gray-400'}`}>
                    {payload.is_private ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h2>
              
              <div className="space-y-3">
                <button
                  onClick={handleCopyPayload}
                  className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Payload
                </button>
                
                <Link
                  to={`/payloads?action=edit&id=${payload.id}`}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Payload
                </Link>
                
                <button
                  onClick={handleToggleFavorite}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                    payload.is_favorite 
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Star className={`w-4 h-4 mr-2 ${payload.is_favorite ? 'fill-current' : ''}`} />
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
