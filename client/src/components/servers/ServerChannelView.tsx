import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { Hash, Send, Users, X, Crown, Shield } from 'lucide-react';
import { getSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  server: any;
  channel: any;
}

function MemberBadge({ role }: { role: string }) {
  if (role === 'owner') return <Crown className="h-3 w-3 text-amber-400" />;
  if (role === 'admin') return <Shield className="h-3 w-3 text-primary" />;
  return null;
}

export function ServerChannelView({ server, channel }: Props) {
  const { user } = useAuthStore();
  const { onlineUsers } = useChatStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const members: any[] = server?.members || [];
  const onlineMembers = members.filter((m: any) => onlineUsers.has(m.userId));
  const offlineMembers = members.filter((m: any) => !onlineUsers.has(m.userId));

  useEffect(() => {
    if (!channel) return;
    setLoading(true);
    api.servers.channelMessages(server.id, channel.id)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoading(false));

    const socket = getSocket();
    if (socket) {
      socket.emit('server:join', { serverId: server.id, channelId: channel.id });
      const handler = (msg: any) => {
        if (msg.channelId === channel.id) {
          setMessages((prev) => [...prev, msg]);
        }
      };
      socket.on('server:message:received', handler);
      return () => { socket.off('server:message:received', handler); };
    }
  }, [channel?.id, server?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      await api.servers.sendMessage(server.id, channel.id, text);
    } catch {} finally {
      setSending(false);
    }
  };

  if (!channel) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-center">
          <Hash className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      {/* Main chat */}
      <div className="flex flex-1 flex-col bg-background min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 h-14 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{channel.name}</p>
              {channel.description && (
                <p className="text-[10px] text-muted-foreground truncate">{channel.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowMembers(!showMembers)}
            title="Members"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0
              ${showMembers ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
          >
            <Users className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Hash className="mb-3 h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm font-medium text-foreground">Welcome to #{channel.name}!</p>
              <p className="text-xs text-muted-foreground mt-1">This is the beginning of the channel.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const isGrouped = prevMsg && prevMsg.senderId === msg.senderId &&
                  (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-3 group ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
                  >
                    <div className="w-8 shrink-0">
                      {!isGrouped && (msg.sender?.avatar ? (
                        <img src={fileUrl(msg.sender.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(msg.sender?.username || '')} text-xs font-semibold text-white`}>
                          {getInitials(msg.sender?.username || '?')}
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      {!isGrouped && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground">{msg.sender?.username}</span>
                          <span className="text-[10px] text-muted-foreground/50">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      )}
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${isGrouped ? 'text-foreground/85 hover:text-foreground' : 'text-foreground/90'}`}>{msg.content}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={`Message #${channel.name}`}
              className="flex-1 h-10 rounded-xl bg-secondary/50 border border-border px-4 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Members Panel */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 200, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-border bg-sidebar/50 overflow-hidden shrink-0"
          >
            <div className="flex h-14 items-center justify-between border-b border-border px-3 shrink-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Members — {members.length}</p>
              <button onClick={() => setShowMembers(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2 space-y-0.5">
              {onlineMembers.length > 0 && (
                <>
                  <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Online — {onlineMembers.length}</p>
                  {onlineMembers.map((m: any) => (
                    <MemberRow key={m.userId} member={m} isOnline={true} isMe={m.userId === user?.id} />
                  ))}
                </>
              )}
              {offlineMembers.length > 0 && (
                <>
                  <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Offline — {offlineMembers.length}</p>
                  {offlineMembers.map((m: any) => (
                    <MemberRow key={m.userId} member={m} isOnline={false} isMe={m.userId === user?.id} />
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberRow({ member, isOnline, isMe }: { member: any; isOnline: boolean; isMe: boolean }) {
  const displayName = member.user?.username || member.userId?.slice(0, 8) || '?';
  const avatar = member.user?.avatar;
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/50 transition-colors group">
      <div className="relative shrink-0">
        {avatar ? (
          <img src={fileUrl(avatar)} alt="" className={`h-7 w-7 rounded-full object-cover ${!isOnline ? 'opacity-50' : ''}`} />
        ) : (
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${getAvatarColor(displayName)} text-[10px] font-semibold text-white ${!isOnline ? 'opacity-50' : ''}`}>
            {getInitials(displayName)}
          </div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar ${isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className={`truncate text-[11px] font-medium ${isOnline ? 'text-foreground' : 'text-muted-foreground'} ${isMe ? 'text-primary' : ''}`}>{displayName}{isMe ? ' (you)' : ''}</p>
          <MemberBadge role={member.role} />
        </div>
      </div>
    </div>
  );
}
