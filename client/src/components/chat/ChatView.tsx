import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { NewConversationDialog } from './NewConversationDialog';
import { GroupPanel } from './GroupPanel';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { ArrowLeft, Phone, Video, Users, UserPlus } from 'lucide-react';
import { getSocket } from '@/hooks/useSocket';
import { useCallStore } from '@/stores/callStore';
import { AnimatePresence } from 'framer-motion';

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length]);

  const handleCall = (type: 'voice' | 'video') => {
    const socket = getSocket();
    if (!socket || !activeConversationId) return;
    if (callStatus !== 'idle') return;

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
          <button onClick={() => isGroup ? setShowGroupPanel(!showGroupPanel) : otherUser && onUserClick(otherUser.id)}
            className="text-sm font-bold text-foreground hover:underline truncate block">{displayName}</button>
          <p className="text-[11px] text-muted-foreground">
            {isGroup ? `${memberCount} members, ${onlineMemberCount} online` : isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
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
          <button onClick={() => setShowNewConv(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" title="Add People">
            <UserPlus className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex-1 overflow-y-auto py-4" onContextMenu={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-3xl space-y-0.5">
              {convMessages.map((msg, i) => {
                const prevMsg = convMessages[i - 1];
                const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId ||
                  new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 300000 ||
                  prevMsg.type === 'system';
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
