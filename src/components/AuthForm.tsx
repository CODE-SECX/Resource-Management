import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Loader2, Lock, Mail, User as UserIcon, GraduationCap, Tags, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { ThemeToggle } from './ui/ThemeToggle';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

export function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(formData.name, formData.email, formData.password);
        if (error) {
          if (error.message.includes('email_not_confirmed')) {
            toast.success('Please check your email and click the confirmation link to complete registration.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created successfully! Please check your email for confirmation.');
          setIsSignUp(false);
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes('email_not_confirmed')) {
            toast.error('Please confirm your email address before signing in. Check your inbox for the confirmation link.');
          } else if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password. Please try again.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Signed in successfully!');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const features = [
    { icon: BookOpen, title: 'Centralize resources', desc: 'Keep every article, tool, and reference organized in one place.' },
    { icon: GraduationCap, title: 'Track your learning', desc: 'Log courses and materials with difficulty and progress context.' },
    { icon: Tags, title: 'Powerful taxonomy', desc: 'Categorize and tag everything for instant, precise retrieval.' },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left / brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-900 text-white">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">ResourceHub</span>
          </div>

          <div className="space-y-8 max-w-md">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-white/15 rounded-full px-3 py-1">
                <Sparkles className="w-3.5 h-3.5" /> Knowledge, organized
              </span>
              <h1 className="text-3xl xl:text-4xl font-bold leading-tight">
                Your resources and learning, in one calm workspace.
              </h1>
              <p className="text-white/80 leading-relaxed">
                A distraction-free platform to save, tag, and revisit everything you learn.
              </p>
            </div>
            <div className="space-y-5">
              {features.map((f) => (
                <div key={f.title} className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <f.icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="font-semibold">{f.title}</p>
                    <p className="text-sm text-white/70 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/60">© {new Date().getFullYear()} ResourceHub. All rights reserved.</p>
        </div>
      </div>

      {/* Right / form panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 lg:justify-end">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">ResourceHub</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 pb-12">
          <div className="w-full max-w-sm space-y-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {isSignUp ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:underline transition-colors duration-150"
                >
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isSignUp && (
                <div className="form-group">
                  <Label htmlFor="name">Full name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      required={isSignUp}
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Jane Doe"
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <Label htmlFor="email-address">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@company.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="form-group">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSignUp ? 'Create account' : 'Sign in'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
