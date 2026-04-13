import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Download } from 'lucide-react';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) await login(email, password);
      else await register(username, email, password);
      navigate('/chat');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/2 left-1/4 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl" />
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="rounded-2xl border border-white/[0.08] bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 flex flex-col items-center pt-4">
            <img src="/icon.png" alt="Nasscord" className="mb-6 mt-6 h-40 w-40 sm:h-44 sm:w-44 object-contain" />
            <h1 className="text-2xl font-bold tracking-tight">Nasscord</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isLogin ? 'Welcome back' : 'Create your account'}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div key="username" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    className="h-11 w-full rounded-lg border border-white/[0.08] bg-secondary/50 px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Choose a username" required={!isLogin} />
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-secondary/50 px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="you@example.com" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-secondary/50 px-4 pr-10 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Min. 6 characters" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">{error}</motion.p>}
            <button type="submit" disabled={loading}
              className="h-11 w-full rounded-lg bg-gradient-to-r from-primary to-accent font-medium text-white shadow-lg shadow-primary/25 hover:shadow-xl disabled:opacity-50">
              {loading ? <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-sm text-muted-foreground hover:text-primary">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span className="font-medium text-primary">{isLogin ? 'Sign up' : 'Sign in'}</span>
            </button>
          </div>
        </div>
        <div className="mt-4 text-center">
          <a href="https://github.com/Nassto0/discord-app/releases/latest" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <Download className="h-4 w-4" /> Download Desktop App
          </a>
        </div>
      </motion.div>
    </div>
  );
}
