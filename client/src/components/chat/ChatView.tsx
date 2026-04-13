import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { NewConversationDialog } from './NewConversationDialog';
import { GroupPanel } from './GroupPanel';
import { getInitials, getAvatarColor, fileUrl, formatLastSeen } from '@/lib/utils';
import { ArrowLeft, Phone, Video, Users, UserPlus, Search, X, Flame, ImagePlus, Eraser } from 'lucide-react';
import { getSocket } from '@/hooks/useSocket';
import { useCallStore } from '@/stores/callStore';
import { ensureMediaPermissions } from '@/hooks/useWebRTC';
import { AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface ChatViewProps {
  onBack: () => void;
  onUserClick: (userId: string) => void;
}

export function ChatView({ onBack, onUserClick }: ChatViewProps) {
  const user = useAuthStore((s) => s.user);
  const { activeConversationId, conversations, messages, typingUsers, onlineUsers, loadMessages, clearUnread } = useChatStore();
  const callStatus = useCallStore((s) => s.status);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showNewConv, setShowNewConv] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('chat-wallpaper') || 'none');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('compact-mode') === 'true');
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getConversationWallpaper = () => {
      if (!activeConversationId) return localStorage.getItem('chat-wallpaper') || 'none';
      try {
        const map = JSON.parse(localStorage.getItem('chat-wallpapers') || '{}') as Record<string, string>;
        if (Object.prototype.hasOwnProperty.call(map, activeConversationId)) {
          return map[activeConversationId] || 'none';
        }
        return localStorage.getItem('chat-wallpaper') || 'none';
      } catch {
        return localStorage.getItem('chat-wallpaper') || 'none';
      }
    };
    const onWallpaper = () => setWallpaper(getConversationWallpaper());
    const onCompact = () => setCompactMode(localStorage.getItem('compact-mode') === 'true');
    setWallpaper(getConversationWallpaper());
    window.addEventListener('wallpaper-changed', onWallpaper);
    window.addEventListener('compact-mode-changed', onCompact);
    return () => { window.removeEventListener('wallpaper-changed', onWallpaper); window.removeEventListener('compact-mode-changed', onCompact); };
  }, [activeConversationId]);

  const conv = conversations.find((c) => c.id === activeConversationId);
  const convMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const typing = activeConversationId ? typingUsers[activeConversationId] || [] : [];
  const typingOthers = typing.filter((t) => t.userId !== user?.id);

  const otherUser = conv?.type === 'dm' ? conv.members.find((m) => m.userId !== user?.id)?.user : null;
  const displayName = conv?.type === 'dm' ? otherUser?.username || 'Unknown' : conv?.name || 'Group Chat';
  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const isGroup = conv?.type === 'group';
  const memberCount = conv?.members.length || 0;
  const onlineMemberCount = conv?.members.filter((m: any) => onlineUsers.has(m.userId)).length || 0;

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
      clearUnread(activeConversationId);
      getSocket()?.emit('conversation:join', activeConversationId);
      getSocket()?.emit('message:read', { conversationId: activeConversationId });
    }
    setShowGroupPanel(false);
  }, [activeConversationId, loadMessages, clearUnread]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeConversationId || conv?.type !== 'dm') {
      setStreaks({});
      return;
    }

    api.streaks.get(activeConversationId)
      .then((rows) => {
        const map: Record<string, number> = {};
        for (const row of rows) map[row.userId] = row.currentStreak || 0;
        setStreaks(map);
      })
      .catch(() => setStreaks({}));

    const onStreak = (payload: { conversationId: string; userId: string; currentStreak: number }) => {
      if (payload.conversationId !== activeConversationId) return;
      setStreaks((prev) => ({ ...prev, [payload.userId]: payload.currentStreak }));
    };

    socket.on('streak:updated', onStreak);
    return () => {
      socket.off('streak:updated', onStreak);
    };
  }, [activeConversationId, conv?.type]);

  const filteredMessages = searchQuery
    ? convMessages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : convMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length]);

  const handleCall = async (type: 'voice' | 'video') => {
    const socket = getSocket();
    if (!socket || !activeConversationId) return;
    if (callStatus !== 'idle') return;

    // Pre-request permissions so mobile browsers show the prompt before the call flow
    const granted = await ensureMediaPermissions(type);
    if (!granted) return;

    const remoteUser = isGroup
      ? { id: 'group', username: displayName, avatar: conv?.avatar || null }
      : otherUser
        ? { id: otherUser.id, username: otherUser.username, avatar: otherUser.avatar }
        : null;
    if (!remoteUser) return;

    socket.emit('call:initiate', { conversationId: activeConversationId, type }, (call: any) => {
      useCallStore.getState().initiateCall(call.id, type, activeConversationId, remoteUser);
    });
  };

  const saveConversationWallpaper = (value: string) => {
    if (!activeConversationId) return;
    const current = (() => {
      try { return JSON.parse(localStorage.getItem('chat-wallpapers') || '{}') as Record<string, string>; } catch { return {}; }
    })();
    current[activeConversationId] = value;
    localStorage.setItem('chat-wallpapers', JSON.stringify(current));
    setWallpaper(value);
    window.dispatchEvent(new Event('wallpaper-changed'));
  };

  const clearConversationWallpaper = () => {
    if (!activeConversationId) return;
    const current = (() => {
      try { return JSON.parse(localStorage.getItem('chat-wallpapers') || '{}') as Record<string, string>; } catch { return {}; }
    })();
    delete current[activeConversationId];
    localStorage.setItem('chat-wallpapers', JSON.stringify(current));
    setWallpaper(localStorage.getItem('chat-wallpaper') || 'none');
    window.dispatchEvent(new Event('wallpaper-changed'));
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;
    setUploadingWallpaper(true);
    try {
      const { url } = await api.uploads.upload(file);
      saveConversationWallpaper(`custom:${url}`);
    } catch (error) {
      console.error('Wallpaper upload error:', error);
    } finally {
      setUploadingWallpaper(false);
      e.target.value = '';
    }
  };

  const wallpaperStyles: Record<string, React.CSSProperties> = {
    dots: { backgroundImage: 'radial-gradient(circle, var(--color-border) 1px, transparent 1px)', backgroundSize: '20px 20px' },
    grid: { backgroundImage: 'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)', backgroundSize: '24px 24px' },
    diagonal: { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, var(--color-border) 10px, var(--color-border) 11px)' },
    cross: { backgroundImage: 'radial-gradient(circle, transparent 8px, var(--color-border) 8px, var(--color-border) 9px, transparent 9px)', backgroundSize: '30px 30px' },
    waves: { backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 14px, var(--color-border) 14px, var(--color-border) 15px)' },
  };
  const wallpaperStyle = wallpaper.startsWith('custom:')
    ? { backgroundImage: `url(${fileUrl(wallpaper.replace('custom:', ''))})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
    : (wallpaperStyles[wallpaper] || {});
  const bestStreak = Object.values(streaks).reduce((max, value) => Math.max(max, value), 0);

  if (!conv) return null;

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 h-12 shrink-0">
        <button onClick={onBack} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button onClick={() => isGroup ? setShowGroupPanel(!showGroupPanel) : otherUser && onUserClick(otherUser.id)} className="relative shrink-0">
          {otherUser?.avatar ? <img src={fileUrl(otherUser.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" /> : (
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(displayName)} text-xs font-semibold text-white`}>
              {isGroup ? <Users className="h-4 w-4" /> : getInitials(displayName)}
            </div>
          )}
          {conv.type === 'dm' && <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button onClick={() => isGroup ? setShowGroupPanel(!showGroupPanel) : otherUser && onUserClick(otherUser.id)}
              className="text-sm font-bold text-foreground hover:underline truncate block">{displayName}</button>
            {!isGroup && bestStreak > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-400">
                <Flame className="h-3 w-3" /> {bestStreak}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isGroup ? `${memberCount} members, ${onlineMemberCount} online` : isOnline ? 'Online' : otherUser?.lastSeen ? formatLastSeen(otherUser.lastSeen) : 'Offline'}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <input ref={wallpaperInputRef} type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} />
          <button onClick={() => wallpaperInputRef.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" title="Set chat wallpaper">
            {uploadingWallpaper ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <ImagePlus className="h-[18px] w-[18px]" />}
          </button>
          <button onClick={clearConversationWallpaper} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" title="Clear chat wallpaper">
            <Eraser className="h-[18px] w-[18px]" />
          </button>
          <button onClick={() => handleCall('voice')} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" title="Voice Call">
            <Phone className="h-[18px] w-[18px]" />
          </button>
          <button onClick={() => handleCall('video')} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" title="Video Call">
            <Video className="h-[18px] w-[18px]" />
          </button>
          {isGroup && (
            <button onClick={() => setShowGroupPanel(!showGroupPanel)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showGroupPanel ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              title="Members">
              <Users className="h-[18px] w-[18px]" />
            </button>
          )}
          <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showSearch ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
            title="Search Messages">
            <Search className="h-[18px] w-[18px]" />
          </button>
          <button onClick={() => setShowNewConv(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" title="Add People">
            <UserPlus className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2 shrink-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search in conversation..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none" autoFocus />
          {searchQuery && <span className="text-xs text-muted-foreground shrink-0">{filteredMessages.length} found</span>}
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex-1 overflow-y-auto py-4" onContextMenu={(e) => e.stopPropagation()} style={wallpaperStyle}>
            <div className={`mx-auto max-w-3xl ${compactMode ? 'space-y-0' : 'space-y-0.5'}`}>
              {filteredMessages.map((msg, i) => {
                const prevMsg = filteredMessages[i - 1];
                const showAvatar = compactMode ? false : (!prevMsg || prevMsg.senderId !== msg.senderId ||
                  new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 300000 ||
                  prevMsg.type === 'system');
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === user?.id}
                    showAvatar={showAvatar}
                    onUserClick={onUserClick}
                  />
                );
              })}
              {typingOthers.length > 0 && (
                <div className="flex items-center gap-2 px-5 py-2">
                  <div className="flex gap-0.5">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                  </div>
                  <span className="text-xs text-muted-foreground"><strong>{typingOthers.map((t) => t.username).join(', ')}</strong> is typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <MessageInput conversationId={activeConversationId!} />
        </div>

        <AnimatePresence>
          {showGroupPanel && isGroup && activeConversationId && (
            <GroupPanel conversationId={activeConversationId} onClose={() => setShowGroupPanel(false)} onUserClick={onUserClick} />
          )}
        </AnimatePresence>
      </div>

      {showNewConv && <NewConversationDialog onClose={() => setShowNewConv(false)} />}
    </div>
  );
}
