import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Download } from 'lucide-react';

type ForgotStep = 'email' | 'reset' | 'success';

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
  const { language } = useLanguageStore();

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotCodeHint, setForgotCodeHint] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

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

  const handleForgotSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.auth.forgotPassword(forgotEmail);
      setForgotCodeHint(res.code || '');
      setForgotStep('reset');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to send code');
    } finally { setForgotLoading(false); }
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await api.auth.resetPassword(forgotEmail, forgotCode, newPassword);
      setForgotStep('success');
    } catch (err: any) {
      setForgotError(err.message || 'Reset failed');
    } finally { setForgotLoading(false); }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotStep('email');
    setForgotEmail('');
    setForgotCode('');
    setForgotCodeHint('');
    setNewPassword('');
    setForgotError('');
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
                  <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{t('username', language)}</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    className="h-11 w-full rounded-lg border border-white/[0.08] bg-secondary/50 px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Choose a username" required={!isLogin} />
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{t('email', language)}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-secondary/50 px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="you@example.com" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{t('password', language)}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-secondary/50 px-4 pr-10 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Min. 6 characters" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="mt-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {t('forgotPassword', language)}
                </button>
              )}
            </div>
            {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">{error}</motion.p>}
            <button type="submit" disabled={loading}
              className="h-11 w-full rounded-lg bg-gradient-to-r from-primary to-accent font-medium text-white shadow-lg shadow-primary/25 hover:shadow-xl disabled:opacity-50">
              {loading
                ? <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : isLogin ? t('signIn', language) : t('signUp', language)
              }
            </button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-sm text-muted-foreground hover:text-primary">
              {isLogin ? `${t('noAccount', language)} ` : `${t('haveAccount', language)} `}
              <span className="font-medium text-primary">{isLogin ? t('signUp', language) : t('signIn', language)}</span>
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

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeForgot}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-card p-6 shadow-2xl"
            >
              {forgotStep === 'email' && (
                <>
                  <h3 className="mb-1 text-lg font-bold">Reset Password</h3>
                  <p className="mb-4 text-sm text-muted-foreground">Enter your email to get a reset code.</p>
                  <form onSubmit={handleForgotSendCode} className="space-y-3">
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="h-11 w-full rounded-lg border border-border bg-secondary/50 px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={closeForgot} className="flex-1 h-10 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                      <button type="submit" disabled={forgotLoading} className="flex-1 h-10 rounded-lg bg-primary text-sm text-white disabled:opacity-50 transition-colors">
                        {forgotLoading ? 'Sending...' : 'Get Code'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {forgotStep === 'reset' && (
                <>
                  <h3 className="mb-1 text-lg font-bold">Enter Reset Code</h3>
                  <p className="mb-2 text-sm text-muted-foreground">A reset code has been generated for your account.</p>
                  {forgotCodeHint && (
                    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                      <p className="text-xs text-amber-400">Your reset code (in production, this would be emailed):</p>
                      <p className="mt-1 text-lg font-mono font-bold text-amber-300">{forgotCodeHint}</p>
                    </div>
                  )}
                  <form onSubmit={handleForgotReset} className="space-y-3">
                    <input
                      type="text"
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value)}
                      placeholder="6-digit code"
                      required
                      maxLength={6}
                      className="h-11 w-full rounded-lg border border-border bg-secondary/50 px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min. 6 chars)"
                      required
                      minLength={6}
                      className="h-11 w-full rounded-lg border border-border bg-secondary/50 px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={closeForgot} className="flex-1 h-10 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                      <button type="submit" disabled={forgotLoading} className="flex-1 h-10 rounded-lg bg-primary text-sm text-white disabled:opacity-50 transition-colors">
                        {forgotLoading ? 'Resetting...' : 'Reset Password'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {forgotStep === 'success' && (
                <div className="text-center py-4">
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Password Reset!</h3>
                  <p className="text-sm text-muted-foreground mb-4">Your password has been successfully updated.</p>
                  <button
                    onClick={() => { closeForgot(); setIsLogin(true); }}
                    className="h-10 w-full rounded-lg bg-primary text-sm text-white hover:bg-primary/90 transition-colors"
                  >
                    Sign In Now
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
