import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { Send, Trash2, Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

const HISTORY_KEY = 'nassai-history';
const SUGGESTIONS = [
  'How can I use Nasscord?',
  'Summarize this: [paste text]',
  'Write me a message to a friend',
  'Tell me a fun fact',
  'Help me debug some code',
  'What can you help with?',
];

// Render markdown-like content: code blocks, inline code, bold, italic
function MarkdownContent({ text, isOwn }: { text: string; isOwn: boolean }) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={i} className={`my-2 rounded-lg overflow-x-auto ${isOwn ? 'bg-black/20' : 'bg-secondary/80 border border-border'}`}>
          {lang && <div className={`px-3 py-1 text-[10px] font-mono font-bold border-b ${isOwn ? 'border-white/10 text-white/50' : 'border-border text-muted-foreground'}`}>{lang}</div>}
          <pre className={`px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words ${isOwn ? 'text-white/90' : 'text-foreground'}`}>{codeLines.join('\n')}</pre>
        </div>
      );
    } else {
      nodes.push(<InlineLine key={i} text={line} isOwn={isOwn} />);
      nodes.push(<br key={`br-${i}`} />);
    }
    i++;
  }
  // Remove trailing br
  if (nodes.length > 0 && nodes[nodes.length - 1] && (nodes[nodes.length - 1] as any)?.type === 'br') {
    nodes.pop();
  }
  return <>{nodes}</>;
}

function InlineLine({ text, isOwn }: { text: string; isOwn: boolean }) {
  const parts: React.ReactNode[] = [];
  // Heading
  if (text.startsWith('### ')) return <h3 className={`font-bold text-sm my-1 ${isOwn ? 'text-white' : 'text-foreground'}`}>{text.slice(4)}</h3>;
  if (text.startsWith('## ')) return <h2 className={`font-bold text-base my-1 ${isOwn ? 'text-white' : 'text-foreground'}`}>{text.slice(3)}</h2>;
  if (text.startsWith('# ')) return <h1 className={`font-bold text-lg my-1 ${isOwn ? 'text-white' : 'text-foreground'}`}>{text.slice(2)}</h1>;
  // Bullet
  if (text.match(/^[-*] /)) {
    return <li className={`ml-4 list-disc text-sm ${isOwn ? 'text-white/90' : 'text-foreground/90'}`}><InlineLine text={text.slice(2)} isOwn={isOwn} /></li>;
  }
  // Numbered
  const numMatch = text.match(/^(\d+)\. (.+)/);
  if (numMatch) {
    return <li className={`ml-4 list-decimal text-sm ${isOwn ? 'text-white/90' : 'text-foreground/90'}`}><InlineLine text={numMatch[2]} isOwn={isOwn} /></li>;
  }

  const RE = /```([\s\S]*?)```|`([^`]+)`|\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const k = m.index;
    if (m[1] !== undefined) parts.push(<code key={k} className={`px-1 rounded text-xs font-mono ${isOwn ? 'bg-black/20 text-white/90' : 'bg-secondary text-foreground'}`}>{m[1]}</code>);
    else if (m[2] !== undefined) parts.push(<code key={k} className={`px-1 rounded text-xs font-mono ${isOwn ? 'bg-black/20 text-white/90' : 'bg-secondary text-foreground'}`}>{m[2]}</code>);
    else if (m[3] !== undefined) parts.push(<strong key={k}>{m[3]}</strong>);
    else if (m[4] !== undefined) parts.push(<del key={k} className="opacity-60">{m[4]}</del>);
    else if (m[5] !== undefined) parts.push(<em key={k}>{m[5]}</em>);
    last = RE.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className="text-sm leading-relaxed">{parts}</span>;
}

export function NassAIPanel() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-100)));
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');

    const newMessage: AIMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const apiMessages = [
        {
          role: 'system',
          content: 'You are NassAI, a helpful AI assistant integrated into Nasscord, a modern chat application. Be helpful, concise, and friendly. Use markdown for formatting when helpful.',
        },
        ...updatedMessages.slice(-20), // Keep last 20 messages for context
      ];
      const response = await api.ai.chat(apiMessages);
      const reply = response?.choices?.[0]?.message?.content || 'No response received.';
      setMessages([...updatedMessages, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setError(err.message || 'NassAI is offline — make sure the NassAI server is running on port 7777');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleClear = () => {
    setMessages([]);
    setError('');
    localStorage.removeItem(HISTORY_KEY);
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 h-14 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">NassAI</p>
            <p className="text-[10px] text-muted-foreground">Powered by GPT-4o mini · Local</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">Welcome to NassAI</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Your free AI assistant powered by GPT-4o mini. Runs locally, no API costs.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              {msg.role === 'assistant' ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/20">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              ) : (
                <div className="shrink-0">
                  {user?.avatar ? (
                    <img src={fileUrl(user.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(user?.username || '')} text-xs font-semibold text-white`}>
                      {getInitials(user?.username || '')}
                    </div>
                  )}
                </div>
              )}

              {/* Bubble */}
              <div className={`group relative max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-tr-sm'
                  : 'bg-card border border-border text-foreground rounded-tl-sm'
              }`}>
                <MarkdownContent text={msg.content} isOwn={msg.role === 'user'} />
                <button
                  onClick={() => copyMessage(msg.content, i)}
                  className={`absolute -top-2 ${msg.role === 'user' ? 'left-0' : 'right-0'} opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground transition-all shadow-sm`}
                >
                  {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/20">
              <RefreshCw className="h-4 w-4 text-white animate-spin" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            ⚠️ {error}
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask NassAI anything... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 overflow-y-auto"
            style={{ minHeight: '42px', maxHeight: '128px' }}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">NassAI requires the local NassAI server running on port 7777</p>
      </div>
    </div>
  );
}
