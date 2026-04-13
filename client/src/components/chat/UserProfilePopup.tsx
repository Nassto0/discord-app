import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { X, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSocket } from '@/hooks/useSocket';

interface UserProfilePopupProps {
  userId: string;
  onClose: () => void;
  onDmSent?: () => void;
}

export function UserProfilePopup({ userId, onClose, onDmSent }: UserProfilePopupProps) {
  const [user, setUser] = useState<any>(null);
  const me = useAuthStore((s) => s.user);
  const { conversations, addConversation, setActiveConversation, onlineUsers } = useChatStore();
  const isOnline = onlineUsers.has(userId);
  const isMe = me?.id === userId;

  useEffect(() => {
    api.users.get(userId).then(setUser).catch(() => {});
  }, [userId]);

  const startDm = async () => {
    if (!user || isMe) return;
    try {
      const existing = conversations.find(
        (c) => c.type === 'dm' && c.members.some((m: any) => m.userId === user.id)
      );
      if (existing) {
        setActiveConversation(existing.id);
        if (onDmSent) onDmSent(); else onClose();
        return;
      }
      const conv = await api.conversations.create({ type: 'dm', memberIds: [user.id] });
      addConversation(conv);
      setActiveConversation(conv.id);
      const socket = getSocket();
      if (socket) {
        socket.emit('conversation:join', conv.id);
        socket.emit('conversation:created', { conversationId: conv.id, memberIds: conv.members.map((m: any) => m.userId) });
      }
      if (onDmSent) onDmSent(); else onClose();
    } catch (err) {
      console.error('Failed to create DM:', err);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">

        <div className="relative">
          {user.banner ? (
            <img src={fileUrl(user.banner)} alt="" className="h-28 w-full object-cover" />
          ) : (
            <div className="h-28 w-full bg-gradient-to-br from-primary/60 to-accent/60" />
          )}
          <button onClick={onClose} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/80 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative px-4 pb-4">
          <div className="relative -mt-12 mb-3">
            <div className="relative inline-block">
              {user.avatar ? (
                <img src={fileUrl(user.avatar)} alt="" className="h-20 w-20 rounded-full border-4 border-card object-cover" />
              ) : (
                <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 border-card ${getAvatarColor(user.username)} text-2xl font-bold text-white`}>
                  {getInitials(user.username)}
                </div>
              )}
              <div className={`absolute bottom-0 right-0 h-5 w-5 rounded-full border-[3px] border-card ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
            </div>
          </div>

          <h2 className="text-xl font-bold text-foreground">{user.username}</h2>
          {user.customStatus && (
            <p className="mt-0.5 text-sm text-muted-foreground">{user.customStatus}</p>
          )}

          <div className="mt-3 rounded-xl bg-background p-3 space-y-2">
            {user.bio && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-1">About Me</h3>
                <p className="text-sm text-foreground">{user.bio}</p>
              </div>
            )}
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Member Since</h3>
              <p className="text-sm text-foreground">
                {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {!isMe && (
            <button onClick={startDm}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90">
              <MessageCircle className="h-4 w-4" /> Send Message
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
