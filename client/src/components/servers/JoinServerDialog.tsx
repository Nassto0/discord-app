import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { X, Hash, Users, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onClose: () => void;
  onJoined: (server: any) => void;
}

export function JoinServerDialog({ onClose, onJoined }: Props) {
  const [tab, setTab] = useState<'code' | 'browse'>('browse');
  const [inviteCode, setInviteCode] = useState('');
  const [publicServers, setPublicServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tab === 'browse') {
      setBrowsing(true);
      api.servers.public().then(setPublicServers).catch(() => {}).finally(() => setBrowsing(false));
    }
  }, [tab]);

  const handleJoin = async (code: string) => {
    if (!code.trim()) { setError('Invite code required'); return; }
    setLoading(true);
    setError('');
    try {
      const server = await api.servers.join(code.trim());
      onJoined(server);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to join server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-card p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Join a Server</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setTab('browse')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors
              ${tab === 'browse' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            <Globe className="h-3.5 w-3.5" /> Browse Public
          </button>
          <button
            onClick={() => setTab('code')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors
              ${tab === 'code' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            <Hash className="h-3.5 w-3.5" /> Invite Code
          </button>
        </div>

        {tab === 'code' && (
          <div className="space-y-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code..."
              className="h-10 w-full rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleJoin(inviteCode)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              onClick={() => handleJoin(inviteCode)}
              disabled={!inviteCode.trim() || loading}
              className="h-10 w-full rounded-lg bg-gradient-to-r from-primary to-accent text-sm font-medium text-white disabled:opacity-50 transition-all"
            >
              {loading ? 'Joining...' : 'Join Server'}
            </button>
          </div>
        )}

        {tab === 'browse' && (
          <div>
            {browsing ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : publicServers.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Globe className="mb-2 h-7 w-7 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No public servers yet</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2">
                {publicServers.map((server) => (
                  <div key={server.id} className="flex items-center gap-3 rounded-lg bg-secondary/30 border border-border p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                      {server.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{server.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{server.members?.length || 0} members</span>
                      </div>
                      {server.description && (
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{server.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleJoin(server.inviteCode)}
                      disabled={loading}
                      className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
