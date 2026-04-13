import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { getInitials, getAvatarColor, formatTime, fileUrl } from '@/lib/utils';
import { Heart, Trash2, ImagePlus, Send, MessageCircle, Sparkles, Share2, Copy, Bookmark, BookmarkCheck, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/hooks/useSocket';

interface FeedPageProps {
  onUserClick: (userId: string) => void;
}

export function FeedPage({ onUserClick }: FeedPageProps) {
  const user = useAuthStore((s) => s.user);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const [savedPosts, setSavedPosts] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('saved-posts') || '[]')); } catch { return new Set(); }
  });
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentLoading, setCommentLoading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadPosts(); }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (post: any) => {
      setPosts((prev) => prev.find((p) => p.id === post.id) ? prev : [post, ...prev]);
    };
    socket.on('post:new', handler);
    return () => { socket.off('post:new', handler); };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const loadPosts = async () => {
    try { setPosts(await api.posts.list()); } catch {}
  };

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      const post = await api.posts.create({ content: newPost.trim(), imageUrl: imageUrl || undefined });
      setPosts([{ ...post, comments: [] }, ...posts]);
      getSocket()?.emit('post:new', post);
      setNewPost('');
      setImageUrl(null);
    } catch {}
    finally { setPosting(false); }
  };

  const handleLike = async (postId: string) => {
    try {
      const { liked } = await api.posts.like(postId);
      setPosts(posts.map((p) => p.id === postId ? { ...p, isLiked: liked, likeCount: liked ? p.likeCount + 1 : p.likeCount - 1 } : p));
    } catch {}
  };

  const handleDelete = async (postId: string) => {
    try { await api.posts.delete(postId); setPosts(posts.filter((p) => p.id !== postId)); } catch {}
  };

  const handleShare = async (post: any) => {
    const link = `${window.location.origin}/home#post-${post.id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setShared(post.id);
    setTimeout(() => setShared(null), 2000);
  };

  const handleComment = async (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text) return;
    setCommentLoading(postId);
    try {
      const comment = await api.posts.comment(postId, text);
      setPosts(posts.map((p) =>
        p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p
      ));
      setCommentText({ ...commentText, [postId]: '' });
    } catch (err) {
      console.error('Comment error:', err);
    }
    finally { setCommentLoading(null); }
  };

  const toggleSave = (postId: string) => {
    const next = new Set(savedPosts);
    if (next.has(postId)) next.delete(postId); else next.add(postId);
    setSavedPosts(next);
    localStorage.setItem('saved-posts', JSON.stringify([...next]));
  };

  const toggleComments = (postId: string) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) next.delete(postId); else next.add(postId);
    setExpandedComments(next);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const { url } = await api.uploads.upload(file); setImageUrl(url); } catch {}
    finally { setUploading(false); e.target.value = ''; }
  };

  const handlePostContext = (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    setContextMenu({ id: postId, x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 200) });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-surface px-6 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Nasscord Community</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{onlineUsers.size} online</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="flex gap-3 p-4">
              {user?.avatar ? (
                <img src={fileUrl(user.avatar)} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getAvatarColor(user?.username || '')} text-sm font-semibold text-white`}>
                  {getInitials(user?.username || '')}
                </div>
              )}
              <div className="flex-1">
                <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Share something with the community..."
                  className="w-full resize-none bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none min-h-[56px]" rows={2}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && newPost.trim()) { e.preventDefault(); handlePost(); } }} />
                {imageUrl && (
                  <div className="relative mt-2 inline-block">
                    <img src={fileUrl(imageUrl)} alt="" className="h-40 rounded-xl object-cover border border-border" />
                    <button onClick={() => setImageUrl(null)}
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground border border-border text-xs font-bold">×</button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
              <div className="flex gap-1">
                <input type="file" ref={fileRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  {uploading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <ImagePlus className="h-4 w-4" />}
                  Photo
                </button>
              </div>
              <button onClick={handlePost} disabled={posting || !newPost.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-30 hover:bg-primary/90 transition-colors">
                <Send className="h-3.5 w-3.5" /> Post
              </button>
            </div>
          </div>

          <AnimatePresence>
            {posts.map((post, i) => {
              const isExpanded = expandedComments.has(post.id);
              const isSaved = savedPosts.has(post.id);
              const comments = post.comments || [];
              return (
                <motion.div key={post.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                  className="group rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:border-primary/20 transition-colors"
                  onContextMenu={(e) => handlePostContext(e, post.id)}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <button onClick={() => onUserClick(post.authorId)} className="shrink-0 relative">
                        {post.author.avatar ? (
                          <img src={fileUrl(post.author.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getAvatarColor(post.author.username)} text-sm font-semibold text-white`}>
                            {getInitials(post.author.username)}
                          </div>
                        )}
                        {onlineUsers.has(post.authorId) && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button onClick={() => onUserClick(post.authorId)} className="text-sm font-semibold text-foreground hover:underline">{post.author.username}</button>
                          <span className="text-[11px] text-muted-foreground">{formatTime(post.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-[14px] text-foreground/90 leading-relaxed">{post.content}</p>
                      </div>
                    </div>
                    {post.imageUrl && (
                      <div className="mt-3 ml-[52px]">
                        <img src={fileUrl(post.imageUrl)} alt="" className="max-h-96 rounded-xl object-cover border border-border" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 border-t border-border px-4 py-2">
                    <button onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
                        ${post.isLiked ? 'text-red-400 bg-red-500/10' : 'text-muted-foreground hover:text-red-400 hover:bg-red-500/5'}`}>
                      <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                      {post.likeCount > 0 && <span>{post.likeCount}</span>}
                    </button>
                    <button onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {comments.length > 0 && <span>{comments.length}</span>}
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    <button onClick={() => handleShare(post)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      {shared === post.id ? <><Link2 className="h-3.5 w-3.5 text-emerald-400" /> <span className="text-emerald-400">Link copied!</span></> : <><Share2 className="h-3.5 w-3.5" /> Share</>}
                    </button>
                    <button onClick={() => toggleSave(post.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ml-auto
                        ${isSaved ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
                      {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    </button>
                    {post.authorId === user?.id && (
                      <button onClick={() => handleDelete(post.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border">
                        <div className="px-4 py-3 space-y-2.5">
                          {comments.length === 0 && (
                            <p className="text-xs text-muted-foreground/60 text-center py-2">No comments yet. Be the first!</p>
                          )}
                          {comments.map((c: any) => (
                            <div key={c.id} className="flex gap-2">
                              <button onClick={() => onUserClick(c.authorId)} className="shrink-0">
                                {c.author?.avatar ? <img src={fileUrl(c.author?.avatar)} alt="" className="h-7 w-7 rounded-full object-cover" /> : (
                                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${getAvatarColor(c.author?.username || '')} text-[10px] font-bold text-white`}>
                                    {getInitials(c.author?.username || '')}
                                  </div>
                                )}
                              </button>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-foreground">{c.author?.username}</span>
                                  <span className="text-[10px] text-muted-foreground">{formatTime(c.createdAt)}</span>
                                </div>
                                <p className="text-xs text-foreground/80">{c.content}</p>
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-2 pt-1">
                            <input type="text" value={commentText[post.id] || ''} onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                              placeholder="Write a comment..." className="flex-1 h-8 rounded-lg bg-secondary px-3 text-xs text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
                              onKeyDown={(e) => { if (e.key === 'Enter' && commentText[post.id]?.trim()) handleComment(post.id); }} />
                            <button onClick={() => handleComment(post.id)} disabled={commentLoading === post.id || !commentText[post.id]?.trim()}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 shrink-0 transition-colors disabled:opacity-40">
                              {commentLoading === post.id ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {posts.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-card mb-4 border border-border">
                <MessageCircle className="h-10 w-10 text-muted-foreground/20" />
              </div>
              <p className="text-lg font-semibold text-foreground/80 mb-1">No posts yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">Be the first to share something with the Nasscord community!</p>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()}>
          <div className="fixed z-[101] min-w-[160px] rounded-xl border border-border bg-card py-1.5 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { handleShare(posts.find((p) => p.id === contextMenu.id)!); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
              <Link2 className="h-4 w-4 text-muted-foreground" /> Copy Link
            </button>
            <button onClick={() => { const p = posts.find((p) => p.id === contextMenu.id); if (p) navigator.clipboard.writeText(p.content); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
              <Copy className="h-4 w-4 text-muted-foreground" /> Copy Text
            </button>
            <button onClick={() => { toggleSave(contextMenu.id); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
              <Bookmark className="h-4 w-4 text-muted-foreground" /> {savedPosts.has(contextMenu.id) ? 'Unsave' : 'Save Post'}
            </button>
            <button onClick={() => { handleLike(contextMenu.id); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-foreground/90 hover:bg-primary/10 hover:text-primary">
              <Heart className="h-4 w-4 text-muted-foreground" /> Like Post
            </button>
            {posts.find((p) => p.id === contextMenu.id)?.authorId === user?.id && (
              <>
                <div className="h-px bg-border my-1" />
                <button onClick={() => { handleDelete(contextMenu.id); setContextMenu(null); }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" /> Delete Post
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
