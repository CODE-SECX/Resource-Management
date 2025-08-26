
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthForm } from '../components/AuthForm';
import { Modal } from '../components/Modal';
import { 
  BookOpen, 
  GraduationCap, 
  Star, 
  Users, 
  Zap, 
  Shield,
  ChevronRight,
  Play,
  Check
} from 'lucide-react';

export function Index() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const handleAuthClick = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const features = [
    {
      icon: BookOpen,
      title: 'Resource Management',
      description: 'Organize and access your learning resources with intelligent categorization and search.',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: GraduationCap,
      title: 'Progress Tracking',
      description: 'Monitor your learning journey with detailed analytics and milestone tracking.',
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      icon: Star,
      title: 'Smart Recommendations',
      description: 'Get personalized content suggestions based on your learning patterns and goals.',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: Users,
      title: 'Collaborative Learning',
      description: 'Share resources and learn together with built-in collaboration tools.',
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  const stats = [
    { number: '10K+', label: 'Active Learners' },
    { number: '50K+', label: 'Resources Shared' },
    { number: '1M+', label: 'Learning Hours' },
    { number: '99%', label: 'User Satisfaction' }
  ];

  const benefits = [
    'Unlimited resource storage and organization',
    'Advanced search and filtering capabilities',
    'Progress tracking and analytics dashboard',
    'Collaborative learning tools and sharing',
    'Mobile-responsive design for learning anywhere',
    'Secure data encryption and privacy protection'
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                ResourceHub
              </span>
            </Link>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <Link to="/dashboard" className="btn-primary">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => handleAuthClick('signin')}
                    className="btn-ghost"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => handleAuthClick('signup')}
                    className="btn-primary"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-8 animate-fade-in-up">
              Your Learning
              <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-indigo-400 bg-clip-text text-transparent block">
                Journey Starts Here
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 max-w-4xl mx-auto mb-12 leading-relaxed animate-fade-in-up" style={{'--stagger': 1} as any}>
              Organize, track, and optimize your learning with our comprehensive resource management platform. 
              Built for modern learners who demand efficiency and results.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{'--stagger': 2} as any}>
              {!user && (
                <>
                  <button
                    onClick={() => handleAuthClick('signup')}
                    className="btn-primary text-lg px-8 py-4 group"
                  >
                    Start Learning Free
                    <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                  </button>
                  <button className="btn-secondary text-lg px-8 py-4 group">
                    <Play className="w-5 h-5 mr-2" />
                    Watch Demo
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
            {stats.map((stat, index) => (
              <div key={stat.label} className="text-center animate-fade-in-up" style={{'--stagger': index} as any}>
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="section-title animate-fade-in-up">
              Everything You Need to Excel
            </h2>
            <p className="section-subtitle animate-fade-in-up" style={{'--stagger': 1} as any}>
              Powerful features designed to accelerate your learning journey and maximize your potential.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="card card-hover p-8 text-center group animate-fade-in-up"
                  style={{'--stagger': index} as any}
                >
                  <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
                Why Choose ResourceHub?
              </h2>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={benefit} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mt-0.5">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-gray-300 leading-relaxed">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative animate-fade-in-up" style={{'--stagger': 1} as any}>
              <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl p-8 border border-gray-700">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-white mb-2">Lightning Fast</h4>
                    <p className="text-gray-400 text-sm">Optimized performance for seamless learning</p>
                  </div>
                  <div className="text-center">
                    <Shield className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-white mb-2">Secure & Private</h4>
                    <p className="text-gray-400 text-sm">Your data is protected with enterprise-grade security</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-3xl p-12 border border-gray-700">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 animate-fade-in-up">
              Ready to Transform Your Learning?
            </h2>
            <p className="text-xl text-gray-400 mb-8 animate-fade-in-up" style={{'--stagger': 1} as any}>
              Join thousands of learners who have already revolutionized their educational journey.
            </p>
            {!user && (
              <button
                onClick={() => handleAuthClick('signup')}
                className="btn-primary text-lg px-8 py-4 group animate-fade-in-up"
                style={{'--stagger': 2} as any}
              >
                Start Your Free Journey
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800/50 border-t border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link to="/" className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                ResourceHub
              </span>
            </Link>
            
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} ResourceHub. Empowering learners worldwide.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title={authMode === 'signin' ? 'Sign In to Your Account' : 'Create Your Account'}
        size="md"
      >
        <AuthForm
          mode={authMode}
          onModeChange={setAuthMode}
          onSuccess={() => setShowAuthModal(false)}
        />
      </Modal>
    </div>
  );
}
