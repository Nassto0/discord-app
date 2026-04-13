import { useState, useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { getSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { formatDuration } from '@/lib/utils';
import { sounds } from '@/lib/sounds';
import { Send, Mic, X, ImagePlus, Smile, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageInputProps {
  conversationId: string;
}

const EMOJI_CATEGORIES = [
  { name: 'Smileys', emojis: ['😀','😃','😄','😁','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😛','😜','🤪','😎','🤩','🥳','😏','😒','😞','😢','😭','😤','😡','🤬','😈','💀','💩','🤡','👻','👽','🤖'] },
  { name: 'Gestures', emojis: ['👍','👎','👊','✊','🤛','🤜','👏','🙌','🤝','🙏','💪','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❣️','💕','💞','💓','💗','💖','💘','💝'] },
  { name: 'Objects', emojis: ['🔥','✨','💫','⭐','🌟','💥','💯','🎉','🎊','🎵','🎶','🎮','🎯','🏆','🎁','💎','🔔','📢','💡','📌','📎','✏️','📝','💻','📱','🎧','🎤','📷','🎬','🍕','🍔','☕','🍺','🥂'] },
];

export function MessageInput({ conversationId }: MessageInputProps) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);
  const { replyingTo, setReplyingTo } = useChatStore();
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useMediaRecorder();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmojis) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojis(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojis]);

  const handleTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing:start', { conversationId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => { socket.emit('typing:stop', { conversationId }); }, 2000);
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string | null, type: string, fileUrl: string | null, fileDuration?: number | null) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('message:send', { conversationId, content, type, fileUrl, replyToId: replyingTo?.id || null, fileDuration: fileDuration || null }, () => {});
    sounds.messageSent();
    setReplyingTo(null);
    socket.emit('typing:stop', { conversationId });
  }, [conversationId, replyingTo, setReplyingTo]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text.trim(), 'text', null);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { url } = await api.uploads.upload(file);
        const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'text';
        sendMessage(null, type, url);
      }
    } catch (err) { console.error(err); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleVoiceStop = async () => {
    const dur = duration;
    const blob = await stopRecording();
    if (!blob) return;
    setUploading(true);
    try {
      const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
      const { url } = await api.uploads.upload(file);
      sendMessage(null, 'voice', url, dur);
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  return (
    <div className="px-4 pb-2 pt-1" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}>
      <AnimatePresence>
        {replyingTo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-1 flex items-center gap-2 rounded-t-2xl bg-card px-4 py-2 border border-b-0 border-border">
            <div className="h-5 w-0.5 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <span className="text-xs text-muted-foreground">Replying to </span>
              <span className="text-xs font-semibold text-primary">{replyingTo.sender.username}</span>
              <p className="text-xs text-muted-foreground truncate">{replyingTo.content || 'attachment'}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {isRecording ? (
        <div className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 h-[48px] shadow-sm">
          <button onClick={cancelRecording} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-semibold tabular-nums text-foreground w-10">{formatDuration(duration)}</span>
          <div className="flex items-end gap-[2px] h-5 flex-1">
            {Array.from({ length: 50 }).map((_, i) => (
              <div key={i} className="w-[3px] rounded-full bg-primary/40" style={{ height: `${(Math.sin(i * 0.4 + duration * 1.5) * 0.3 + 0.7) * 20}px` }} />
            ))}
          </div>
          <button onClick={handleVoiceStop} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition-colors">
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className={`flex items-end gap-0 rounded-2xl bg-card border border-border shadow-sm transition-colors focus-within:border-primary/40 ${replyingTo ? 'rounded-t-none border-t-0' : ''}`}>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" multiple className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex h-[48px] w-12 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            {uploading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <PlusCircle className="h-5 w-5" />}
          </button>

          <textarea ref={textareaRef} value={text} onChange={(e) => { setText(e.target.value); handleTyping(); }} onKeyDown={handleKeyDown}
            placeholder="Type a message..." rows={1}
            className="max-h-48 flex-1 resize-none bg-transparent py-3 text-sm text-foreground placeholder-muted-foreground outline-none leading-relaxed"
            style={{ minHeight: '48px' }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = '48px'; t.style.height = `${Math.min(t.scrollHeight, 192)}px`; }} />

          <div className="relative" ref={emojiRef}>
            <button onClick={() => setShowEmojis(!showEmojis)}
              className={`flex h-[48px] w-10 shrink-0 items-center justify-center transition-colors ${showEmojis ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Smile className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {showEmojis && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-14 right-0 z-50 w-[280px] sm:w-[320px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[60vh]">
                  <div className="flex border-b border-border">
                    {EMOJI_CATEGORIES.map((cat, i) => (
                      <button key={cat.name} onClick={() => setEmojiCat(i)}
                        className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${i === emojiCat ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-0 p-2 max-h-[200px] overflow-y-auto">
                    {EMOJI_CATEGORIES[emojiCat].emojis.map((e) => (
                      <button key={e} onClick={() => { setText((p) => p + e); textareaRef.current?.focus(); }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-secondary transition-colors">{e}</button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {text.trim() ? (
            <button onClick={handleSend} className="flex h-[48px] w-12 shrink-0 items-center justify-center text-primary hover:text-primary/80 transition-colors">
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={startRecording} className="flex h-[48px] w-12 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
