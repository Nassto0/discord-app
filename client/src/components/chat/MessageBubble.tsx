import { useState, useEffect, useRef, useCallback } from 'react';
import { formatMessageTime, getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/hooks/useSocket';
import { Reply, Copy, Trash2, SmilePlus, Phone, PhoneOff, Video, Check, CheckCheck } from 'lucide-react';
import { VoicePlayer } from '@/components/media/VoicePlayer';
import { MediaPreview } from '@/components/media/MediaPreview';
import { motion } from 'framer-motion';

interface MessageBubbleProps {
  message: any;
  isOwn: boolean;
  showAvatar: boolean;
  onUserClick: (userId: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

export function MessageBubble({ message, isOwn, showAvatar, onUserClick }: MessageBubbleProps) {
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const userId = useAuthStore((s) => s.user?.id);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.max(8, Math.min(e.clientX, window.innerWidth - 200)),
      y: Math.max(8, Math.min(e.clientY, window.innerHeight - 320)),
    });
  };

  const handleReact = (emoji: string) => {
    getSocket()?.emit('message:react', { messageId: message.id, conversationId: message.conversationId, emoji });
    setContextMenu(null);
    setShowEmojiPicker(false);
  };

  if (message.type === 'system') {
    return (
      <div className="my-3 flex items-center justify-center gap-3 px-4">
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {message.content?.includes('Missed') ? <PhoneOff className="h-3 w-3 text-red-400" /> :
           message.content?.includes('Video') ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3 text-emerald-400" />}
          <span>{message.content}</span>
        </div>
        <div className="h-px flex-1 bg-border/50" />
      </div>
    );
  }

  const reactions: Record<string, string[]> = typeof message.reactions === 'string'
    ? (() => { try { return JSON.parse(message.reactions); } catch { return {}; } })()
    : (message.reactions || {});
  const reactionEntries = Object.entries(reactions).filter(([, v]) => v.length > 0);

  const readBy: string[] = Array.isArray(message.readBy) ? message.readBy :
    typeof message.readBy === 'string' ? (() => { try { return JSON.parse(message.readBy); } catch { return []; } })() : [];
  const isSeen = isOwn && readBy.length > 1;

  return (
    <>
      <div
        ref={rowRef}
        className={`group/msg relative flex gap-2 px-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => { setShowActions(false); if (!showEmojiPicker) setShowEmojiPicker(false); }}
      >
        {!isOwn && (
          <div className="w-8 shrink-0 self-end">
            {showAvatar && (
              <button onClick={() => onUserClick(message.senderId)}>
                {message.sender.avatar ? (
                  <img src={fileUrl(message.sender.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(message.sender.username)} text-xs font-semibold text-white`}>
                    {getInitials(message.sender.username)}
                  </div>
                )}
              </button>
            )}
          </div>
        )}

        <div className={`max-w-[70%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
          {showAvatar && !isOwn && (
            <button onClick={() => onUserClick(message.senderId)}
              className="mb-0.5 px-1.5 text-xs font-semibold text-primary hover:underline">
              {message.sender.username}
            </button>
          )}

          {message.replyTo && (
            <div className={`mb-1 max-w-full truncate rounded-xl border-l-2 border-primary/40 bg-primary/5 px-3 py-1.5 text-xs ${isOwn ? 'self-end' : 'self-start'}`}>
              <span className="font-semibold text-primary">{message.replyTo.sender.username}: </span>
              <span className="text-muted-foreground">{message.replyTo.type === 'voice' ? 'Voice message' : (message.replyTo.content?.slice(0, 50) || 'attachment')}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            {isOwn && showActions && (
              <div className="flex gap-0.5 shrink-0">
                <button
                  onMouseDown={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary shadow-sm transition-colors">
                  <SmilePlus className="h-3 w-3" />
                </button>
                <button
                  onMouseDown={(e) => { e.stopPropagation(); setReplyingTo(message); setShowActions(false); }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary shadow-sm transition-colors">
                  <Reply className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="relative">
              <div className={`rounded-2xl px-3.5 py-2 shadow-sm
                ${isOwn
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-card text-foreground rounded-bl-md border border-border/50'
                }
                ${showAvatar ? '' : isOwn ? 'rounded-tr-2xl' : 'rounded-tl-2xl'}`}>
                {message.type === 'text' && message.content && (
                  <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{message.content}</p>
                )}
                {message.type === 'voice' && message.fileUrl && (
                  <VoicePlayer src={fileUrl(message.fileUrl)} duration={message.fileDuration} isOwn={isOwn} />
                )}
                {(message.type === 'image' || message.type === 'video') && message.fileUrl && (
                  <MediaPreview type={message.type} src={fileUrl(message.fileUrl)} />
                )}
                <div className={`flex items-center gap-1 justify-end mt-0.5 ${isOwn ? 'text-white/50' : 'text-muted-foreground/50'}`}>
                  <span className="text-[10px]">{formatMessageTime(message.createdAt)}</span>
                  {isOwn && (
                    isSeen
                      ? <CheckCheck className="h-3 w-3 text-white/70" />
                      : <Check className="h-3 w-3" />
                  )}
                </div>
              </div>

              {showEmojiPicker && (
                <div ref={emojiRef}
                  className={`absolute -top-10 z-20 flex gap-0.5 rounded-xl border border-border bg-card px-1.5 py-1 shadow-xl ${isOwn ? 'right-0' : 'left-0'}`}
                  onMouseDown={(e) => e.stopPropagation()}>
                  {QUICK_EMOJIS.map((e) => (
                    <button key={e} onMouseDown={(ev) => { ev.stopPropagation(); handleReact(e); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-base hover:bg-secondary transition-colors hover:scale-110">{e}</button>
                  ))}
                </div>
              )}
            </div>

            {!isOwn && showActions && (
              <div className="flex gap-0.5 shrink-0">
                <button
                  onMouseDown={(e) => { e.stopPropagation(); setReplyingTo(message); setShowActions(false); }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary shadow-sm transition-colors">
                  <Reply className="h-3 w-3" />
                </button>
                <button
                  onMouseDown={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary shadow-sm transition-colors">
                  <SmilePlus className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {reactionEntries.length > 0 && (
            <div className={`mt-0.5 flex flex-wrap gap-1 ${isOwn ? 'self-end' : 'self-start'}`}>
              {reactionEntries.map(([emoji, userIds]) => (
                <button key={emoji} onClick={() => handleReact(emoji)}
                  className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors
                    ${userIds.includes(userId || '')
                      ? 'bg-primary/15 border-primary/30 text-primary'
                      : 'bg-card border-border text-muted-foreground hover:bg-secondary'
                    }`}>
                  <span className="text-sm leading-none">{emoji}</span>
                  {userIds.length > 1 && <span className="text-[10px] font-medium">{userIds.length}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div className="fixed inset-0 z-[100]" onMouseDown={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()}>
          <div ref={menuRef}
            className="fixed z-[101] min-w-[180px] overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-2xl backdrop-blur-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border mb-1">
              {QUICK_EMOJIS.map((e) => (
                <button key={e} onClick={() => handleReact(e)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-secondary transition-colors">{e}</button>
              ))}
            </div>
            <button onClick={() => { setReplyingTo(message); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
              <Reply className="h-4 w-4 text-muted-foreground" /> Reply
            </button>
            {message.content && (
              <button onClick={() => { navigator.clipboard.writeText(message.content); setContextMenu(null); }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
                <Copy className="h-4 w-4 text-muted-foreground" /> Copy Text
              </button>
            )}
            {isOwn && (
              <>
                <div className="h-px bg-border my-1" />
                <button onClick={() => { getSocket()?.emit('message:delete', { messageId: message.id, conversationId: message.conversationId }); setContextMenu(null); }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" /> Delete Message
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
