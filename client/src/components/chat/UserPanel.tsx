import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { X, MessageCircle, Shield, Star, Zap, Award, Heart, Crown, Flame, Globe, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSocket } from '@/hooks/useSocket';

const BADGE_MAP: Record<string, { icon: typeof Star; color: string; label: string }> = {
  early_supporter: { icon: Heart, color: 'text-pink-400', label: 'Early Supporter' },
  admin: { icon: Shield, color: 'text-red-400', label: 'Admin' },
  moderator: { icon: Crown, color: 'text-amber-400', label: 'Moderator' },
  verified: { icon: Zap, color: 'text-blue-400', label: 'Verified' },
  premium: { icon: Star, color: 'text-yellow-400', label: 'Premium' },
  contributor: { icon: Award, color: 'text-emerald-400', label: 'Contributor' },
  bug_hunter: { icon: Flame, color: 'text-orange-400', label: 'Bug Hunter' },
  active: { icon: Coffee, color: 'text-purple-400', label: 'Active Member' },
};

const PRESENCE_COLORS: Record<string, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  dnd: 'bg-red-500',
  offline: 'bg-zinc-500',
  invisible: 'bg-zinc-500',
};

const PRESENCE_LABELS: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
  invisible: 'Invisible',
};

interface UserPanelProps {
  userId: string;
  onClose: () => void;
  onDmSent?: () => void;
  position?: 'right' | 'center';
}

export function UserPanel({ userId, onClose, onDmSent, position = 'right' }: UserPanelProps) {
  const [user, setUser] = useState<any>(null);
  const [dmStreak, setDmStreak] = useState<number>(0);
  const [updatingRelation, setUpdatingRelation] = useState(false);
  const me = useAuthStore((s) => s.user);
  const { conversations, addConversation, setActiveConversation, onlineUsers, userStatuses } = useChatStore();
  const isOnline = onlineUsers.has(userId);
  const isMe = me?.id === userId;

  useEffect(() => {
    api.users.get(userId).then(setUser).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (isMe || !userId) {
      setDmStreak(0);
      return;
    }
    const dm = conversations.find((c) => c.type === 'dm' && c.members.some((m: any) => m.userId === userId));
    if (!dm) {
      setDmStreak(0);
      return;
    }
    api.streaks.get(dm.id)
      .then((rows) => {
        const best = rows.reduce((max: number, row: any) => Math.max(max, row.currentStreak || 0), 0);
        setDmStreak(best);
      })
      .catch(() => setDmStreak(0));
  }, [userId, isMe, conversations]);

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

  const toggleFollow = async () => {
    if (!user || isMe || updatingRelation) return;
    setUpdatingRelation(true);
    try {
      if (user.isFollowing) {
        await api.users.unfollow(user.id);
        setUser((prev: any) => ({ ...prev, isFollowing: false }));
      } else {
        await api.users.follow(user.id);
        setUser((prev: any) => ({ ...prev, isFollowing: true }));
      }
    } finally {
      setUpdatingRelation(false);
    }
  };

  const toggleBlock = async () => {
    if (!user || isMe || updatingRelation) return;
    setUpdatingRelation(true);
    try {
      if (user.isBlockedByMe) {
        await api.users.unblock(user.id);
        setUser((prev: any) => ({ ...prev, isBlockedByMe: false }));
      } else {
        await api.users.block(user.id);
        setUser((prev: any) => ({ ...prev, isBlockedByMe: true, isFollowing: false }));
      }
    } finally {
      setUpdatingRelation(false);
    }
  };

  if (!user) return null;

  const badges: string[] = (() => {
    try { return JSON.parse(user.badges || '[]'); } catch { return []; }
  })();

  const links: string[] = (() => {
    try { return JSON.parse(user.links || '[]'); } catch { return []; }
  })();

  // Real-time presence from socket updates takes priority over profile fetch
  const realtimeStatus = userStatuses.get(userId);
  const presence = realtimeStatus || user.presence || (isOnline ? 'online' : 'offline');
  const displayPresence = isOnline ? presence : (realtimeStatus === 'invisible' ? 'offline' : (realtimeStatus || 'offline'));

  if (position === 'center') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <PanelContent user={user} isMe={isMe} displayPresence={displayPresence}
            badges={badges} links={links} onClose={onClose} startDm={startDm} dmStreak={dmStreak} toggleFollow={toggleFollow} toggleBlock={toggleBlock} updatingRelation={updatingRelation} />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.2 }}
      className="absolute right-0 top-0 bottom-0 z-20 w-80 border-l border-border bg-card flex flex-col overflow-y-auto">
      <PanelContent user={user} isMe={isMe} displayPresence={displayPresence}
        badges={badges} links={links} onClose={onClose} startDm={startDm} dmStreak={dmStreak} toggleFollow={toggleFollow} toggleBlock={toggleBlock} updatingRelation={updatingRelation} />
    </motion.div>
  );
}

function PanelContent({ user, isMe, displayPresence, badges, links, onClose, startDm, dmStreak, toggleFollow, toggleBlock, updatingRelation }: {
  user: any; isMe: boolean; displayPresence: string;
  badges: string[]; links: string[]; onClose: () => void; startDm: () => void; dmStreak: number;
  toggleFollow: () => void; toggleBlock: () => void; updatingRelation: boolean;
}) {
  return (
    <>
      <div className="relative">
        {user.banner ? (
          <img src={fileUrl(user.banner)} alt="" className="h-28 w-full object-cover" />
        ) : (
          <div className="h-28 w-full bg-gradient-to-br from-primary/60 to-primary/20" />
        )}
        <button onClick={onClose} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/80 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative px-4 pb-4">
        <div className="relative -mt-12 mb-2">
          <div className="relative inline-block">
            {user.avatar ? (
              <img src={fileUrl(user.avatar)} alt="" className="h-20 w-20 rounded-full border-4 border-card object-cover" />
            ) : (
              <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 border-card ${getAvatarColor(user.username)} text-2xl font-bold text-white`}>
                {getInitials(user.username)}
              </div>
            )}
            <div className={`absolute bottom-0.5 right-0.5 h-5 w-5 rounded-full border-[3px] border-card ${PRESENCE_COLORS[displayPresence] || 'bg-zinc-500'}`} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-foreground">{user.username}</h2>
          {!isMe && dmStreak > 0 && (
            <span className="flex items-center gap-1 text-sm font-semibold text-orange-400">
              <Flame className="h-4 w-4" /> {dmStreak}
            </span>
          )}
          <span className="text-xs font-semibold text-amber-400">{user.nassPoints || 0} NassPoints</span>
          {badges.length > 0 && (
            <div className="flex items-center gap-1">
              {badges.map((badge) => {
                const b = BADGE_MAP[badge];
                if (!b) return null;
                const Icon = b.icon;
                return (
                  <div key={badge} className={`${b.color}`} title={b.label}>
                    <Icon className="h-4 w-4" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">
          {PRESENCE_LABELS[displayPresence] || 'Offline'}
        </p>

        {user.customStatus && (
          <p className="mt-1 text-sm text-foreground/80">{user.customStatus}</p>
        )}

        <div className="mt-3 rounded-xl bg-background p-3 space-y-3">
          {user.bio && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">About Me</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap">{user.bio}</p>
            </div>
          )}

          {links.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Links</h3>
              <div className="space-y-1">
                {links.map((link, i) => (
                  <a key={i} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate">
                    <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                    {link.replace(/^https?:\/\//, '')}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Member Since</h3>
            <p className="text-sm text-foreground">
              {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {!isMe && (
          <div className="mt-3 space-y-2">
            <button onClick={startDm} disabled={user.isBlockedByMe}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50">
              <MessageCircle className="h-4 w-4" /> Send Message
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={toggleFollow} disabled={updatingRelation || user.isBlockedByMe}
                className="rounded-lg bg-secondary py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 disabled:opacity-50">
                {user.isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button onClick={toggleBlock} disabled={updatingRelation}
                className={`rounded-lg py-2 text-xs font-semibold ${user.isBlockedByMe ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                {user.isBlockedByMe ? 'Unblock' : 'Block'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
