import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { ArrowLeft, Camera, Check, ImagePlus, User, Mic, Palette, Plus, X, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioSettings } from '@/components/settings/AudioSettings';
import { themes, applyTheme, loadSavedTheme } from '@/lib/themes';
import { getSocket } from '@/hooks/useSocket';

interface ProfilePageProps { onBack: () => void; }
type SettingsTab = 'account' | 'voice' | 'appearance';

const PRESENCE_OPTIONS = [
  { value: 'online', label: 'Online', color: 'bg-emerald-500' },
  { value: 'idle', label: 'Idle', color: 'bg-amber-400' },
  { value: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500' },
  { value: 'invisible', label: 'Invisible', color: 'bg-zinc-500' },
];

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState<SettingsTab>('account');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState((user as any)?.bio || '');
  const [customStatus, setCustomStatus] = useState((user as any)?.customStatus || '');
  const [presence, setPresence] = useState((user as any)?.presence || 'online');
  const [links, setLinks] = useState<string[]>(() => {
    try { return JSON.parse((user as any)?.links || '[]'); } catch { return []; }
  });
  const [newLink, setNewLink] = useState('');
  const [uploading, setUploading] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => loadSavedTheme());
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  // Sync local state if the user object is updated externally (e.g. socket event)
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setBio((user as any)?.bio || '');
      setCustomStatus((user as any)?.customStatus || '');
      setPresence((user as any)?.presence || 'online');
      try { setLinks(JSON.parse((user as any)?.links || '[]')); } catch { setLinks([]); }
    }
  }, [user]);

  const uploadFile = async (file: File, field: 'avatar' | 'banner') => {
    setUploading(field);
    try {
      const { url } = await api.uploads.avatar(file);
      await api.users.updateProfile({ [field]: url });
      updateUser({ [field]: url });
    } catch (err) {
      console.error(`Failed to upload ${field}:`, err);
    } finally {
      setUploading('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: any = {};
      if (username.trim() && username !== user?.username) data.username = username.trim();
      if (bio !== ((user as any)?.bio || '')) data.bio = bio;
      if (customStatus !== ((user as any)?.customStatus || '')) data.customStatus = customStatus;
      data.presence = presence;
      data.links = JSON.stringify(links);
      await api.users.updateProfile(data);
      updateUser({ ...data, links: JSON.stringify(links) });
      getSocket()?.emit('presence:set', { presence });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    setLinks([...links, newLink.trim()]);
    setNewLink('');
  };

  const removeLink = (index: number) => setLinks(links.filter((_, i) => i !== index));

  const tabList: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'account', label: 'My Account', icon: User },
    { id: 'voice', label: 'Voice & Audio', icon: Mic },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  const inputClass = 'w-full rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full bg-background">
      {/* Desktop sidebar */}
      <div className="w-64 shrink-0 border-r border-border bg-card/30 p-3 flex-col hidden md:flex">
        <div className="flex items-center gap-3 px-3 py-4 mb-2">
          <button onClick={onBack} className="group flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Settings</span>
        </div>
        <nav className="space-y-1">
          {tabList.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98]
                ${tab === t.id ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <t.icon className={`h-4 w-4 ${tab === t.id ? 'text-primary-foreground' : 'opacity-70'}`} />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-bold text-foreground">Settings</span>
          </div>
          <div className="flex gap-1 px-3 py-2 overflow-x-auto">
            {tabList.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-none rounded-lg px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-colors
                  ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 md:px-10 py-8">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

              {/* ── Account tab ── */}
              {tab === 'account' && (
                <div className="space-y-8">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground tracking-tight">My Account</h2>
                      <p className="text-sm text-muted-foreground">Manage your profile and presence</p>
                    </div>
                  </div>

                  {/* Profile preview card */}
                  <div className="rounded-2xl border border-border bg-card/30 shadow-sm overflow-hidden">
                    <div className="relative">
                      <input type="file" ref={bannerRef} onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], 'banner')} accept="image/*" className="hidden" />
                      <button onClick={() => bannerRef.current?.click()} className="group relative block w-full h-32 sm:h-40 bg-secondary overflow-hidden">
                        {(user as any)?.banner
                          ? <img src={fileUrl((user as any).banner)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          : <div className="h-full w-full bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
                        }
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <div className="flex items-center gap-2 bg-black/60 text-white px-4 py-2 rounded-full text-xs font-medium">
                            {uploading === 'banner'
                              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              : <ImagePlus className="h-4 w-4" />}
                            Change Banner
                          </div>
                        </div>
                      </button>

                      <div className="absolute -bottom-10 left-6">
                        <input type="file" ref={avatarRef} onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], 'avatar')} accept="image/*" className="hidden" />
                        <button onClick={() => avatarRef.current?.click()} className="group relative block rounded-full bg-background p-1.5 shadow-xl transition-transform active:scale-95">
                          {user?.avatar
                            ? <img src={fileUrl(user.avatar)} alt="" className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover" />
                            : <div className={`flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full ${getAvatarColor(user?.username || '')} text-3xl font-bold text-white`}>{getInitials(user?.username || '')}</div>
                          }
                          <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200">
                            {uploading === 'avatar'
                              ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              : <Camera className="h-6 w-6 text-white" />}
                          </div>
                        </button>
                      </div>
                    </div>
                    <div className="px-6 pt-14 pb-5 flex justify-between items-start">
                      <div>
                        <p className="text-xl font-bold text-foreground tracking-tight">{user?.username}</p>
                        {(user as any)?.customStatus
                          ? <p className="text-sm text-foreground/70 mt-1">{(user as any).customStatus}</p>
                          : <p className="text-sm text-muted-foreground italic mt-1">No custom status set</p>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-6 rounded-2xl border border-border bg-card/30 p-5 sm:p-6">
                    <Field label="Display Name">
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
                    </Field>

                    <Field label="Custom Status">
                      <input type="text" value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} placeholder="What are you up to?" className={inputClass} />
                    </Field>

                    <Field label="About Me">
                      <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." className={`${inputClass} resize-none h-24`} />
                    </Field>

                    <Field label="Presence Status">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {PRESENCE_OPTIONS.map((p) => (
                          <button key={p.value} onClick={() => setPresence(p.value)}
                            aria-pressed={presence === p.value}
                            className={`flex flex-col items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold border transition-all active:scale-95
                              ${presence === p.value ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                            <div className={`h-3.5 w-3.5 rounded-full ${p.color} shadow-sm`} />
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="Social Links">
                      <div className="space-y-2 mb-3">
                        <AnimatePresence>
                          {links.map((link, i) => (
                            <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                              className="flex items-center gap-3 rounded-xl bg-secondary/50 border border-border px-4 py-2.5">
                              <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm text-foreground truncate flex-1">{link}</span>
                              <button onClick={() => removeLink(i)} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors shrink-0">
                                <X className="h-4 w-4" />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://twitter.com/..."
                          className={`${inputClass} flex-1`} onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }} />
                        <button onClick={addLink} disabled={!newLink.trim()}
                          className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-40 shrink-0 transition-all active:scale-95 shadow-sm">
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </Field>
                  </div>

                  {/* Sticky save button */}
                  <div className="sticky bottom-4 z-10 flex justify-end">
                    <button onClick={handleSave} disabled={saving}
                      className={`flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-white transition-all shadow-xl active:scale-95
                        ${saved ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-primary shadow-primary/20 hover:bg-primary/90'}
                        ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                      {saved ? <><Check className="h-5 w-5" /> Saved!</> : saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Voice tab ── */}
              {tab === 'voice' && <AudioSettings />}

              {/* ── Appearance tab ── */}
              {tab === 'appearance' && (
                <div className="space-y-8">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Palette className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground tracking-tight">Appearance</h2>
                      <p className="text-sm text-muted-foreground">Customize the look and feel of your app</p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-4 block text-xs font-bold uppercase tracking-wider text-muted-foreground">App Theme</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {themes.map((theme) => (
                        <button key={theme.id} onClick={() => { applyTheme(theme); setCurrentTheme(theme); }}
                          className={`relative rounded-2xl p-4 text-left border-2 transition-all active:scale-[0.97]
                            ${currentTheme.id === theme.id ? 'border-primary shadow-md shadow-primary/20' : 'border-transparent hover:border-border'}`}
                          style={{ backgroundColor: theme.colors.card }}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-3.5 w-3.5 rounded-full shadow-sm" style={{ backgroundColor: theme.colors.primary }} />
                            <span className="text-xs font-semibold truncate" style={{ color: theme.colors.foreground }}>{theme.name}</span>
                          </div>
                          <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                            <div className="flex-1 rounded-full" style={{ backgroundColor: theme.colors.background }} />
                            <div className="flex-1 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
                            <div className="flex-1 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                          </div>
                          {currentTheme.id === theme.id && (
                            <div className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          <div className="mt-12 pb-6 text-center">
            <p className="text-xs text-muted-foreground/50">
              Made by{' '}
              <a href="https://nassto.social" target="_blank" rel="noopener noreferrer"
                className="font-semibold text-muted-foreground/70 hover:text-primary transition-colors">
                Nassto
              </a>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
