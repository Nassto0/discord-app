import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { X, UserPlus, Crown, LogOut, Trash2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/hooks/useSocket';

interface GroupPanelProps {
  conversationId: string;
  onClose: () => void;
  onUserClick: (userId: string) => void;
}

export function GroupPanel({ conversationId, onClose, onUserClick }: GroupPanelProps) {
  const user = useAuthStore((s) => s.user);
  const { conversations, allUsers, onlineUsers, removeConversation, loadConversations, loadAllUsers } = useChatStore();
  const conv = conversations.find((c) => c.id === conversationId);
  const [showAddUser, setShowAddUser] = useState(false);
  const [search, setSearch] = useState('');

  if (!conv) return null;

  const isLeader = conv.createdBy === user?.id;
  const members = conv.members || [];
  const memberIds = members.map((m: any) => m.userId);

  const handleRemoveMember = async (targetUserId: string) => {
    try {
      await api.conversations.removeMember(conversationId, targetUserId);
      await loadConversations();
      getSocket()?.emit('group:member-removed', { conversationId, userId: targetUserId });
    } catch (err) {
      console.error('Remove member error:', err);
    }
  };

  const handleLeave = async () => {
    try {
      await api.conversations.leave(conversationId);
      removeConversation(conversationId);
      getSocket()?.emit('group:member-left', { conversationId, userId: user?.id });
      onClose();
    } catch (err) {
      console.error('Leave group error:', err);
    }
  };

  const handleAddMember = async (targetUserId: string) => {
    try {
      await api.conversations.addMember(conversationId, targetUserId);
      await loadConversations();
      getSocket()?.emit('group:member-added', { conversationId, userId: targetUserId });
      setShowAddUser(false);
      setSearch('');
    } catch (err) {
      console.error('Add member error:', err);
    }
  };

  const nonMembers = allUsers.filter((u) => !memberIds.includes(u.id) && u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.2 }}
      className="absolute right-0 top-0 bottom-0 z-20 w-72 border-l border-border bg-sidebar flex flex-col">
      <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
        <h3 className="text-sm font-bold text-foreground">Members — {members.length}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {members.map((m: any) => {
          const isOnline = onlineUsers.has(m.userId);
          const isSelf = m.userId === user?.id;
          const isAdmin = m.role === 'admin' || m.userId === conv.createdBy;
          return (
            <div key={m.userId} className="group flex items-center gap-2.5 px-4 py-1.5 hover:bg-secondary/40 transition-colors">
              <button onClick={() => onUserClick(m.userId)} className="relative shrink-0">
                {m.user.avatar ? <img src={fileUrl(m.user.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" /> : (
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(m.user.username)} text-xs font-semibold text-white`}>
                    {getInitials(m.user.username)}
                  </div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar ${isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onUserClick(m.userId)} className="text-xs font-medium text-foreground truncate hover:underline">{m.user.username}</button>
                  {isAdmin && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
                  {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</p>
              </div>
              {isLeader && !isSelf && (
                <button onClick={() => handleRemoveMember(m.userId)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all" title="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-3 space-y-2 shrink-0">
        <button onClick={() => { loadAllUsers(); setShowAddUser(!showAddUser); }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
          <UserPlus className="h-3.5 w-3.5" /> Add Member
        </button>
        <button onClick={handleLeave}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
          <LogOut className="h-3.5 w-3.5" /> Leave Group
        </button>
      </div>

      <AnimatePresence>
        {showAddUser && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-24 left-3 right-3 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
                  className="h-8 w-full rounded-lg bg-secondary pl-8 pr-3 text-xs text-foreground placeholder-muted-foreground outline-none" autoFocus />
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {nonMembers.slice(0, 10).map((u) => (
                <button key={u.id} onClick={() => handleAddMember(u.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-secondary/60 transition-colors">
                  {u.avatar ? <img src={fileUrl(u.avatar)} alt="" className="h-6 w-6 rounded-full object-cover" /> : (
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${getAvatarColor(u.username)} text-[10px] font-bold text-white`}>
                      {getInitials(u.username)}
                    </div>
                  )}
                  <span className="truncate">{u.username}</span>
                </button>
              ))}
              {nonMembers.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground text-center">No users found</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
