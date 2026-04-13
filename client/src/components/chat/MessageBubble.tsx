import { useState, useEffect, useRef, useCallback } from 'react';
import { formatMessageTime, getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { Reply, Copy, Trash2, SmilePlus, Phone, PhoneOff, Video, Check, CheckCheck, Pencil, Share2, Flag } from 'lucide-react';
import { VoicePlayer } from '@/components/media/VoicePlayer';
import { MediaPreview } from '@/components/media/MediaPreview';
import { motion } from 'framer-motion';

const URL_REGEX = /https?:\/\/[^\s<>'")\]]+/g;

// Inline formatting: **bold**, *italic*, ~~strikethrough~~, `code`, ```code blocks```
function formatInline(text: string, isOwn: boolean): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Pattern order matters: code block first, then inline code, bold, strikethrough, italic
  const INLINE_RE = /```([\s\S]*?)```|`([^`]+)`|\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const key = m.index;
    if (m[1] !== undefined) {
      tokens.push(<code key={key} className={`block my-1 px-2 py-1 rounded text-xs font-mono whitespace-pre-wrap ${isOwn ? 'bg-black/20 text-white/90' : 'bg-secondary text-foreground'}`}>{m[1]}</code>);
    } else if (m[2] !== undefined) {
      tokens.push(<code key={key} className={`px-1 py-0.5 rounded text-[13px] font-mono ${isOwn ? 'bg-black/20 text-white/90' : 'bg-secondary text-foreground'}`}>{m[2]}</code>);
    } else if (m[3] !== undefined) {
      tokens.push(<strong key={key}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      tokens.push(<del key={key} className="opacity-60">{m[4]}</del>);
    } else if (m[5] !== undefined) {
      tokens.push(<em key={key}>{m[5]}</em>);
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

function Linkify({ children, isOwn }: { children: string; isOwn: boolean }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(URL_REGEX);
  while ((match = regex.exec(children)) !== null) {
    if (match.index > lastIndex) parts.push(...formatInline(children.slice(lastIndex, match.index), isOwn));
    parts.push(
      <a key={`link-${match.index}`} href={match[0]} target="_blank" rel="noopener noreferrer"
        className={`underline break-all ${isOwn ? 'text-white/90 hover:text-white' : 'text-primary hover:text-primary/80'}`}
        onClick={(e) => e.stopPropagation()}>
        {match[0]}
      </a>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < children.length) parts.push(...formatInline(children.slice(lastIndex), isOwn));
  return <>{parts}</>;
}

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
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [showForward, setShowForward] = useState(false);
  const [forwardConvs, setForwardConvs] = useState<any[]>([]);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

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

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? window.innerWidth / 2 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? window.innerHeight / 2 : e.clientY;
    setContextMenu({
      x: Math.max(8, Math.min(clientX, window.innerWidth - 200)),
      y: Math.max(8, Math.min(clientY, window.innerHeight - 320)),
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null; // Mark as consumed so touchEnd knows it was a long press
      if (navigator.vibrate) navigator.vibrate(30);
      setContextMenu({
        x: Math.max(8, Math.min(touch.clientX, window.innerWidth - 200)),
        y: Math.max(8, Math.min(touch.clientY, window.innerHeight - 320)),
      });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      // If not a long press, check for double-tap
      handleDoubleTap();
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleReact = (emoji: string) => {
    getSocket()?.emit('message:react', { messageId: message.id, conversationId: message.conversationId, emoji });
    setContextMenu(null);
    setShowEmojiPicker(false);
  };

  const handleEdit = () => {
    setEditText(message.content || '');
    setIsEditing(true);
    setContextMenu(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const submitEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content) {
      getSocket()?.emit('message:edit', { messageId: message.id, conversationId: message.conversationId, content: trimmed });
    }
    setIsEditing(false);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleReact('❤️');
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleForwardOpen = () => {
    setForwardConvs(useChatStore.getState().conversations.filter((c) => c.id !== message.conversationId));
    setShowForward(true);
    setContextMenu(null);
  };

  const handleForward = (targetConvId: string) => {
    const socket = getSocket();
    if (!socket) return;
    const fwdContent = message.type === 'text' && message.content
      ? `↪ *${message.sender.username}*: ${message.content}`
      : null;
    socket.emit('message:send', {
      conversationId: targetConvId,
      content: fwdContent,
      type: message.type,
      fileUrl: message.fileUrl || null,
      replyToId: null,
      fileDuration: message.fileDuration || null,
    });
    setShowForward(false);
  };

  const handleReport = async () => {
    const reason = window.prompt('Report reason (spam, harassment, nudity, violence, other):', 'other');
    if (!reason) return;
    const details = window.prompt('Optional details (recommended):', '');
    try {
      await api.reports.create({
        targetType: 'message',
        targetId: message.id,
        reason: reason.trim(),
        details: details?.trim() || undefined,
      });
      alert('Report submitted. Thank you.');
      setContextMenu(null);
    } catch (err) {
      console.error('Report message error:', err);
      alert('Could not submit report. You may have already reported this.');
    }
  };

  const getConvName = (c: any) => {
    if (c.type === 'dm') {
      const other = c.members.find((m: any) => m.userId !== userId);
      return other?.user?.username || 'Unknown';
    }
    return c.name || 'Group Chat';
  };

  const getConvAvatar = (c: any) => {
    if (c.type === 'dm') {
      const other = c.members.find((m: any) => m.userId !== userId);
      return other?.user?.avatar || null;
    }
    return c.avatar || null;
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
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
                {message.type === 'text' && message.content && !isEditing && (
                  <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
                    <Linkify isOwn={isOwn}>{message.content}</Linkify>
                  </p>
                )}
                {isEditing && (
                  <div className="min-w-[200px]">
                    <textarea ref={editInputRef} value={editText} onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); } if (e.key === 'Escape') setIsEditing(false); }}
                      className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none" rows={1}
                      onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }} />
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[10px] ${isOwn ? 'text-white/40' : 'text-muted-foreground/40'}`}>escape to cancel · enter to save</span>
                    </div>
                  </div>
                )}
                {message.type === 'voice' && message.fileUrl && (
                  <VoicePlayer src={fileUrl(message.fileUrl)} duration={message.fileDuration} isOwn={isOwn} />
                )}
                {(message.type === 'image' || message.type === 'video') && message.fileUrl && (
                  <MediaPreview type={message.type} src={fileUrl(message.fileUrl)} />
                )}
                <div className={`flex items-center gap-1 justify-end mt-0.5 ${isOwn ? 'text-white/50' : 'text-muted-foreground/50'}`}>
                  {message.editedAt && <span className="text-[10px] italic">edited</span>}
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
            <button onClick={handleForwardOpen}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
              <Share2 className="h-4 w-4 text-muted-foreground" /> Forward
            </button>
            {!isOwn && (
              <button onClick={handleReport}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
                <Flag className="h-4 w-4 text-muted-foreground" /> Report Message
              </button>
            )}
            {isOwn && (
              <>
                {message.type === 'text' && message.content && (
                  <button onClick={handleEdit}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
                    <Pencil className="h-4 w-4 text-muted-foreground" /> Edit Message
                  </button>
                )}
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

      {showForward && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowForward(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-80 max-h-96 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-bold text-foreground">Forward Message</p>
              <p className="text-xs text-muted-foreground mt-0.5">Select a conversation</p>
            </div>
            <div className="overflow-y-auto max-h-72">
              {forwardConvs.map((c) => {
                const name = getConvName(c);
                const avatar = getConvAvatar(c);
                return (
                  <button key={c.id} onClick={() => handleForward(c.id)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-secondary/50 transition-colors text-left">
                    {avatar ? (
                      <img src={fileUrl(avatar)} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${getAvatarColor(name)} text-xs font-bold text-white`}>
                        {getInitials(name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.type === 'dm' ? 'Direct Message' : `${c.members.length} members`}</p>
                    </div>
                  </button>
                );
              })}
              {forwardConvs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No conversations to forward to</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
