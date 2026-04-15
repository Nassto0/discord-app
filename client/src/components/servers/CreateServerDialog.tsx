import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Server } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onClose: () => void;
  onCreated: (server: any) => void;
}

export function CreateServerDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Server name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const server = await api.servers.create({ name: name.trim(), description: description.trim() || undefined, isPublic });
      onCreated(server);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Server className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold">Create Server</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Server Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome server"
              maxLength={64}
              className="h-10 w-full rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this server about?"
              rows={3}
              className="w-full resize-none rounded-lg bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/30 border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Public Server</p>
              <p className="text-xs text-muted-foreground">Anyone can join via browse</p>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${isPublic ? 'bg-primary' : 'bg-zinc-600'}`}
            >
              <div className={`absolute left-[2px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublic ? 'translate-x-[20px]' : 'translate-x-0'}`} />
            </button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-lg bg-secondary text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || loading}
              className="flex-1 h-10 rounded-lg bg-gradient-to-r from-primary to-accent text-sm font-medium text-white hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 transition-all"
            >
              {loading ? 'Creating...' : 'Create Server'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
