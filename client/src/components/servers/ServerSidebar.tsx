import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Hash, LogOut, Trash2, Globe, Copy, Check } from 'lucide-react';
import { CreateServerDialog } from './CreateServerDialog';
import { JoinServerDialog } from './JoinServerDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  onChannelSelect: (server: any, channel: any) => void;
  activeChannelId?: string;
}

export function ServerSidebar({ onChannelSelect, activeChannelId }: Props) {
  const { user } = useAuthStore();
  const [servers, setServers] = useState<any[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [addingChannel, setAddingChannel] = useState(false);

  const activeServer = servers.find((s) => s.id === activeServerId);

  const loadServers = async () => {
    try {
      const list = await api.servers.list();
      setServers(list);
      if (list.length > 0 && !activeServerId) {
        setActiveServerId(list[0].id);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadServers(); }, []);

  const handleLeave = async (serverId: string) => {
    try {
      await api.servers.leave(serverId);
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      if (activeServerId === serverId) setActiveServerId(null);
    } catch {}
  };

  const handleDelete = async (serverId: string) => {
    if (!confirm('Delete this server? This cannot be undone.')) return;
    try {
      await api.servers.delete(serverId);
      setServers((prev) => prev.filter((s) => s.id !== serverId));
      if (activeServerId === serverId) setActiveServerId(null);
    } catch {}
  };

  const copyInvite = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode).catch(() => {});
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleAddChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name || !activeServerId || addingChannel) return;
    setAddingChannel(true);
    try {
      const channel = await api.servers.createChannel(activeServerId, { name });
      setServers((prev) => prev.map((s) =>
        s.id === activeServerId ? { ...s, channels: [...(s.channels || []), channel] } : s
      ));
      setNewChannelName('');
      setShowAddChannel(false);
    } catch {} finally { setAddingChannel(false); }
  };

  return (
    <div className="flex h-full">
      {/* Server icon strip */}
      <div className="flex w-16 flex-col items-center gap-2 border-r border-border bg-sidebar py-3 overflow-y-auto shrink-0">
        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <>
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => setActiveServerId(server.id)}
                title={server.name}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95 font-bold text-lg
                  ${activeServerId === server.id
                    ? 'rounded-xl bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-secondary/60 text-foreground/70 hover:rounded-xl hover:bg-primary/20 hover:text-primary'
                  }`}
              >
                {server.icon ? (
                  <img src={server.icon} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  server.name.charAt(0).toUpperCase()
                )}
              </button>
            ))}
            <div className="h-px w-8 bg-border my-1" />
            <button
              onClick={() => setShowCreate(true)}
              title="Create Server"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/60 text-emerald-500 hover:rounded-xl hover:bg-emerald-500/10 transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowJoin(true)}
              title="Discover Servers"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/60 text-muted-foreground hover:rounded-xl hover:bg-secondary transition-all active:scale-95"
            >
              <Globe className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Channels panel */}
      {activeServer ? (
        <div className="flex w-52 flex-col bg-sidebar/50 border-r border-border">
          <div className="border-b border-border px-3 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground truncate">{activeServer.name}</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => copyInvite(activeServer.inviteCode)}
                  title="Copy invite code"
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedInvite ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                {activeServer.ownerId === user?.id ? (
                  <button
                    onClick={() => handleDelete(activeServer.id)}
                    title="Delete server"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleLeave(activeServer.id)}
                    title="Leave server"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {activeServer.description && (
              <p className="mt-1 text-[10px] text-muted-foreground/60 truncate">{activeServer.description}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Text Channels</p>
              {(activeServer.ownerId === user?.id || activeServer.members?.find((m: any) => m.userId === user?.id)?.role === 'admin') && (
                <button
                  onClick={() => setShowAddChannel(!showAddChannel)}
                  title="Add Channel"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {showAddChannel && (
              <div className="mb-2 px-1">
                <input
                  autoFocus
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddChannel(); if (e.key === 'Escape') setShowAddChannel(false); }}
                  placeholder="channel-name"
                  className="h-8 w-full rounded-lg bg-secondary/70 px-3 text-xs text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={handleAddChannel} disabled={!newChannelName.trim() || addingChannel}
                    className="flex-1 h-6 rounded-md bg-primary text-[11px] font-semibold text-white hover:bg-primary/90 disabled:opacity-40">
                    {addingChannel ? '...' : 'Add'}
                  </button>
                  <button onClick={() => setShowAddChannel(false)}
                    className="flex-1 h-6 rounded-md bg-secondary text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <AnimatePresence>
              {(activeServer.channels || []).map((channel: any) => (
                <motion.button
                  key={channel.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => onChannelSelect(activeServer, channel)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors
                    ${activeChannelId === channel.id
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    }`}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{channel.name}</span>
                </motion.button>
              ))}
            </AnimatePresence>
            {(activeServer.channels || []).length === 0 && !showAddChannel && (
              <p className="px-2 py-2 text-xs text-muted-foreground/40">No channels yet</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">
              {servers.length === 0 ? 'Create or join a server to get started' : 'Select a server'}
            </p>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateServerDialog
          onClose={() => setShowCreate(false)}
          onCreated={(server) => { setServers((prev) => [...prev, server]); setActiveServerId(server.id); }}
        />
      )}
      {showJoin && (
        <JoinServerDialog
          onClose={() => setShowJoin(false)}
          onJoined={(server) => { setServers((prev) => [...prev, server]); setActiveServerId(server.id); }}
        />
      )}
    </div>
  );
}
