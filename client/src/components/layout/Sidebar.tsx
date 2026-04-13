import { useState, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { formatTime, getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { Search, Plus, LogOut, Users, Settings, Home, MessageSquare, X, CheckCheck, Download } from 'lucide-react';
import { NewConversationDialog } from '@/components/chat/NewConversationDialog';
import { AnimatePresence, motion } from 'framer-motion';

interface SidebarProps {
  onConversationSelect: () => void;
  onShowProfile: () => void;
  onLogoClick: () => void;
  activeSection: string;
  onSectionChange: (s: any) => void;
  onUserClick?: (userId: string) => void;
}

export function Sidebar({ onConversationSelect, onShowProfile, onLogoClick, activeSection, onSectionChange, onUserClick }: SidebarProps) {
  const { conversations, activeConversationId, setActiveConversation, removeConversation, onlineUsers, userStatuses, clearUnread } = useChatStore();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const filtered = conversations.filter((c) => {
    const name = c.type === 'dm' ? c.members.find((m) => m.userId !== user?.id)?.user.username || '' : c.name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleConvContext = (e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      id: convId,
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 120),
    });
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <button onClick={onLogoClick} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src="/icon.png" alt="Nasscord" className="h-11 w-11 object-contain" />
          <h1 className="text-base font-bold text-foreground">Nasscord</h1>
        </button>
        <button onClick={() => setShowNewConv(true)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="New conversation">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-1 px-3 py-2">
        <button onClick={() => onSectionChange('feed')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors
            ${activeSection === 'feed' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
          <Home className="h-3.5 w-3.5" /> Feed
        </button>
        <button onClick={() => onSectionChange('chat')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors
            ${activeSection === 'chat' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Chats
        </button>
      </div>

      {activeSection === 'chat' && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
              className="h-8 w-full rounded-lg bg-secondary pl-9 pr-3 text-xs text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-0.5">
        {activeSection === 'chat' ? (
          <>
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Direct Messages — {filtered.length}
            </p>
            <AnimatePresence>
              {filtered.map((conv) => {
                const isActive = activeConversationId === conv.id;
                const otherUser = conv.type === 'dm' ? conv.members.find((m) => m.userId !== user?.id)?.user : null;
                const displayName = conv.type === 'dm' ? otherUser?.username || 'Unknown' : conv.name || 'Group Chat';
                const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
                const userStatus = otherUser ? (userStatuses.get(otherUser.id) || (isOnline ? 'online' : 'offline')) : 'offline';
                const statusDot = userStatus === 'idle' ? 'bg-amber-400' : userStatus === 'dnd' ? 'bg-red-500' : isOnline ? 'bg-emerald-500' : 'bg-zinc-600';
                const avatar = conv.type === 'dm' ? otherUser?.avatar : conv.avatar;
                const lastMsg = conv.lastMessage;

                return (
                  <motion.div key={conv.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={`group mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-colors
                      ${isActive ? 'bg-primary/10 text-foreground' : 'text-foreground/70 hover:bg-secondary/60 hover:text-foreground'}`}
                    onClick={() => { setActiveConversation(conv.id); onConversationSelect(); }}
                    onContextMenu={(e) => handleConvContext(e, conv.id)}>
                    <div className="relative shrink-0">
                      {avatar ? <img src={fileUrl(avatar)} alt="" className="h-9 w-9 rounded-full object-cover" /> : (
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${getAvatarColor(displayName)} text-xs font-semibold text-white`}>
                          {conv.type === 'group' ? <Users className="h-3.5 w-3.5" /> : getInitials(displayName)}
                        </div>
                      )}
                      {conv.type === 'dm' && (
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar ${statusDot}`} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium">{displayName}</span>
                        {conv.unreadCount > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ml-2 shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {lastMsg.type === 'system' ? lastMsg.content : lastMsg.type === 'voice' ? '🎤 Voice message' : lastMsg.type === 'image' ? '📷 Photo' : lastMsg.type === 'video' ? '🎥 Video' : lastMsg.content}
                        </p>
                      )}
                    </div>
                    <div
                      className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground transition-all shrink-0"
                      title="Close"
                      onClick={(e) => { e.stopPropagation(); removeConversation(conv.id); }}>
                      <X className="h-3 w-3" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="mb-3 h-7 w-7 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">{search ? 'No results' : 'No conversations yet'}</p>
                {!search && <button onClick={() => setShowNewConv(true)} className="mt-2 text-xs font-medium text-primary hover:underline">Start a conversation</button>}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <Home className="mb-3 h-7 w-7 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">Your feed is on the right</p>
          </div>
        )}
      </div>

      <div className="border-t border-border px-2 py-2 bg-sidebar">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-secondary/50 transition-colors">
          <button onClick={() => user?.id && onUserClick?.(user.id)} className="relative shrink-0">
            {user?.avatar ? <img src={fileUrl(user.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" /> : (
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(user?.username || '')} text-xs font-semibold text-white`}>
                {getInitials(user?.username || '')}
              </div>
            )}
            {(() => {
              // Prefer authStore presence (actual, not effective) for current user
              const p = (user as any)?.presence || 'online';
              const dot = p === 'idle' ? 'bg-amber-400' : p === 'dnd' ? 'bg-red-500' : p === 'invisible' ? 'bg-zinc-500' : 'bg-emerald-500';
              return <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar ${dot}`} />;
            })()}
          </button>
          <button onClick={() => user?.id && onUserClick?.(user.id)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold text-foreground">{user?.username}</p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {(() => {
                const p = (user as any)?.presence || 'online';
                return p === 'dnd' ? 'Do Not Disturb' : p === 'invisible' ? 'Invisible' : p.charAt(0).toUpperCase() + p.slice(1);
              })()}
            </p>
          </button>
          <button onClick={onShowProfile}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Settings">
            <Settings className="h-3.5 w-3.5" />
          </button>
          <a href="https://github.com/Nassto0/discord-app/releases/latest" target="_blank" rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Download Desktop App">
            <Download className="h-3.5 w-3.5" />
          </a>
          <button onClick={logout}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Logout">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showNewConv && <NewConversationDialog onClose={() => setShowNewConv(false)} />}

      {contextMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()}>
          <div className="fixed z-[101] min-w-[160px] rounded-xl border border-border bg-card py-1.5 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { clearUnread(contextMenu.id); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary rounded-md mx-1" style={{ width: 'calc(100% - 8px)' }}>
              <CheckCheck className="h-4 w-4 text-muted-foreground" /> Mark as Read
            </button>
            <div className="h-px bg-border my-1 mx-2" />
            <button onClick={() => { removeConversation(contextMenu.id); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10 rounded-md mx-1" style={{ width: 'calc(100% - 8px)' }}>
              <X className="h-4 w-4" /> Close DM
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
