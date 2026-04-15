import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { Search, UserPlus, Check, X, MessageCircle, Users, UserCheck, Clock } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { getSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'friends' | 'pending' | 'add';

interface Props {
  onClose?: () => void;
}

export function FriendRequestsPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const { addConversation, setActiveConversation } = useChatStore();

  const load = async () => {
    try {
      const [f, r] = await Promise.all([api.friends.list(), api.friends.requests()]);
      setFriends(f);
      setRequests(r);
    } catch {}
  };

  useEffect(() => { load(); }, [tab]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.friends.search(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleAccept = async (requestId: string) => {
    setLoadingAction(requestId);
    try {
      await api.friends.accept(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      load();
    } catch {} finally { setLoadingAction(null); }
  };

  const handleReject = async (requestId: string) => {
    setLoadingAction(requestId);
    try {
      await api.friends.reject(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {} finally { setLoadingAction(null); }
  };

  const handleSendRequest = async (userId: string) => {
    setLoadingAction(userId);
    try {
      await api.friends.sendRequest(userId);
      setSentRequests((prev) => new Set([...prev, userId]));
    } catch (err: any) {
      if (err.message?.includes('already')) {
        setSentRequests((prev) => new Set([...prev, userId]));
      }
    } finally { setLoadingAction(null); }
  };

  const handleMessage = async (friendId: string) => {
    try {
      const conv = await api.conversations.create({ type: 'dm', memberIds: [friendId] });
      addConversation(conv);
      setActiveConversation(conv.id);
      const socket = getSocket();
      if (socket) {
        socket.emit('conversation:join', conv.id);
        socket.emit('conversation:created', {
          conversationId: conv.id,
          memberIds: conv.members.map((m: any) => m.userId),
        });
      }
      onClose?.();
    } catch {}
  };

  const handleRemoveFriend = async (friendId: string) => {
    setLoadingAction(friendId);
    try {
      await api.friends.remove(friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch {} finally { setLoadingAction(null); }
  };

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'friends', label: 'Friends', icon: UserCheck, badge: friends.length },
    { id: 'pending', label: 'Pending', icon: Clock, badge: requests.length },
    { id: 'add', label: 'Add Friend', icon: UserPlus },
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Friends</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors relative
                ${tab === t.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {/* Friends tab */}
          {tab === 'friends' && (
            <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {friends.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Users className="mb-3 h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground">No friends yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">Add friends to start chatting</p>
                  <button
                    onClick={() => setTab('add')}
                    className="mt-3 flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add Friend
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/50 transition-colors group"
                    >
                      <div className="relative shrink-0">
                        {friend.avatar ? (
                          <img src={fileUrl(friend.avatar)} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${getAvatarColor(friend.username)} text-xs font-semibold text-white`}>
                            {getInitials(friend.username)}
                          </div>
                        )}
                        <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${friend.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{friend.username}</p>
                        <p className="text-xs text-muted-foreground capitalize">{friend.status || 'offline'}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMessage(friend.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          title="Message"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(friend.id)}
                          disabled={loadingAction === friend.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          title="Remove friend"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Pending tab */}
          {tab === 'pending' && (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {requests.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Clock className="mb-3 h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground">No pending requests</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">Friend requests you receive will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    Incoming — {requests.length}
                  </p>
                  {requests.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-secondary/30">
                      <div className="relative shrink-0">
                        {req.sender.avatar ? (
                          <img src={fileUrl(req.sender.avatar)} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${getAvatarColor(req.sender.username)} text-xs font-semibold text-white`}>
                            {getInitials(req.sender.username)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{req.sender.username}</p>
                        <p className="text-xs text-muted-foreground">Wants to be your friend</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAccept(req.id)}
                          disabled={loadingAction === req.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          title="Accept"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={loadingAction === req.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Add Friend tab */}
          {tab === 'add' && (
            <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users by username..."
                  className="h-10 w-full rounded-lg bg-secondary/50 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              {searching && (
                <div className="flex justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}

              {!searching && searchQuery && searchResults.length === 0 && (
                <div className="flex flex-col items-center py-8">
                  <Search className="mb-2 h-7 w-7 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No users found</p>
                </div>
              )}

              {!searching && !searchQuery && (
                <div className="flex flex-col items-center py-8 text-center">
                  <UserPlus className="mb-3 h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground">Find friends</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">Search for users by their username</p>
                </div>
              )}

              <div className="space-y-1">
                {searchResults.map((user) => {
                  const alreadySent = sentRequests.has(user.id);
                  const isLoading = loadingAction === user.id;
                  return (
                    <div key={user.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/50 transition-colors">
                      <div className="relative shrink-0">
                        {user.avatar ? (
                          <img src={fileUrl(user.avatar)} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${getAvatarColor(user.username)} text-xs font-semibold text-white`}>
                            {getInitials(user.username)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.status || 'offline'}</p>
                      </div>
                      <button
                        onClick={() => !alreadySent && handleSendRequest(user.id)}
                        disabled={alreadySent || isLoading}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors
                          ${alreadySent
                            ? 'bg-emerald-500/10 text-emerald-500 cursor-default'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                          } disabled:opacity-60`}
                      >
                        {isLoading ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : alreadySent ? (
                          <><Check className="h-3.5 w-3.5" /> Sent</>
                        ) : (
                          <><UserPlus className="h-3.5 w-3.5" /> Add</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
