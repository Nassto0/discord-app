import { useState, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { api } from '@/lib/api';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { X, Search, Users, UserPlus, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSocket } from '@/hooks/useSocket';

interface Props {
  onClose: () => void;
}

export function NewConversationDialog({ onClose }: Props) {
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const { addConversation, setActiveConversation, onlineUsers } = useChatStore();

  useEffect(() => {
    api.friends.list().then(setAllUsers).catch(() => {});
  }, []);

  const filtered = allUsers.filter((u) => {
    if (selected.find((s) => s.id === u.id)) return false;
    if (!search) return true;
    return u.username.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = (user: any) => {
    if (isGroup) {
      setSelected([...selected, user]);
    } else {
      startDm(user);
    }
  };

  const startDm = async (user: any) => {
    setLoading(true);
    try {
      const conv = await api.conversations.create({ type: 'dm', memberIds: [user.id] });
      addConversation(conv);
      setActiveConversation(conv.id);
      const socket = getSocket();
      if (socket) {
        socket.emit('conversation:join', conv.id);
        socket.emit('conversation:created', {
          conversationId: conv.id,
          memberIds: conv.members.map((m: any) => m.userId),
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startGroup = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    try {
      const conv = await api.conversations.create({
        type: 'group',
        name: groupName || 'Group Chat',
        memberIds: selected.map((u) => u.id),
      });
      addConversation(conv);
      setActiveConversation(conv.id);
      const socket = getSocket();
      if (socket) {
        socket.emit('conversation:join', conv.id);
        socket.emit('conversation:created', {
          conversationId: conv.id,
          memberIds: conv.members.map((m: any) => m.userId),
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Conversation</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => { setIsGroup(false); setSelected([]); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              !isGroup ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Direct Message
          </button>
          <button
            onClick={() => setIsGroup(true)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isGroup ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            Group Chat
          </button>
        </div>

        {isGroup && (
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name..."
            className="mb-3 h-10 w-full rounded-lg bg-secondary/50 px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {isGroup && selected.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary"
              >
                {u.username}
                <button onClick={() => setSelected(selected.filter((s) => s.id !== u.id))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="h-10 w-full rounded-lg bg-secondary/50 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-8">
              <MessageCircle className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {allUsers.length === 0 ? 'Add friends first to start a DM' : 'No users found'}
              </p>
            </div>
          )}
          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
            >
              <div className="relative">
                {user.avatar ? (
                  <img src={fileUrl(user.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getAvatarColor(user.username)} text-sm font-semibold text-white`}>
                    {getInitials(user.username)}
                  </div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                  onlineUsers.has(user.id) ? 'bg-emerald-500' : 'bg-zinc-600'
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{user.username}</p>
                <p className="text-xs text-muted-foreground">
                  {onlineUsers.has(user.id) ? 'Online' : 'Offline'}
                </p>
              </div>
            </button>
          ))}
        </div>

        {isGroup && selected.length >= 2 && (
          <button
            onClick={startGroup}
            disabled={loading}
            className="mt-4 h-10 w-full rounded-lg bg-gradient-to-r from-primary to-accent font-medium text-white transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50"
          >
            {loading ? 'Creating...' : `Create Group (${selected.length} members)`}
          </button>
        )}
      </motion.div>
    </div>
  );
}
