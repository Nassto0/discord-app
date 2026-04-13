import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  status: string;
  lastSeen: string;
  createdAt: string;
  nassPoints?: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: User;
  content: string | null;
  type: string;
  fileUrl: string | null;
  fileDuration: number | null;
  replyToId: string | null;
  replyTo: Message | null;
  createdAt: string;
  readBy: string[];
  reactions: Record<string, string[]>;
}

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  avatar: string | null;
  createdBy: string;
  createdAt: string;
  members: { userId: string; role: string; joinedAt: string; user: User }[];
  lastMessage: Message | null;
  unreadCount: number;
}

interface TypingUser {
  userId: string;
  username: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, TypingUser[]>;
  onlineUsers: Set<string>;
  userStatuses: Map<string, string>;
  replyingTo: Message | null;
  allUsers: User[];

  setActiveConversation: (id: string | null) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadAllUsers: () => Promise<void>;
  addMessage: (message: Message) => void;
  deleteMessage: (messageId: string, conversationId: string) => void;
  editMessage: (messageId: string, conversationId: string, content: string, editedAt: string) => void;
  updateReactions: (messageId: string, conversationId: string, reactions: Record<string, string[]>) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversation: Conversation) => void;
  removeConversation: (conversationId: string) => void;
  setTyping: (conversationId: string, userId: string, username: string, isTyping: boolean) => void;
  setUserOnline: (userId: string, isOnline: boolean) => void;
  setUserStatus: (userId: string, status: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setReplyingTo: (message: Message | null) => void;
  updateLastMessage: (conversationId: string, message: Message) => void;
  incrementUnread: (conversationId: string) => void;
  markRead: (conversationId: string, userId: string) => void;
  clearUnread: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  onlineUsers: new Set(),
  userStatuses: new Map(),
  replyingTo: null,
  allUsers: [],

  setActiveConversation: (id) => {
    set({ activeConversationId: id, replyingTo: null });
    if (id) get().clearUnread(id);
  },

  loadConversations: async () => {
    const conversations = await api.conversations.list();
    set({ conversations });
  },

  loadMessages: async (conversationId) => {
    const msgs = await api.conversations.messages(conversationId);
    set((state) => ({
      messages: { ...state.messages, [conversationId]: msgs.reverse() },
    }));
  },

  loadAllUsers: async () => {
    try {
      const users = await api.users.all();
      set({ allUsers: users });
    } catch {}
  },

  addMessage: (message) => {
    set((state) => {
      const convMessages = state.messages[message.conversationId] || [];
      if (convMessages.find((m) => m.id === message.id)) return state;
      return {
        messages: {
          ...state.messages,
          [message.conversationId]: [...convMessages, message],
        },
      };
    });
    get().updateLastMessage(message.conversationId, message);
  },

  deleteMessage: (messageId, conversationId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).filter((m) => m.id !== messageId),
      },
    }));
  },

  editMessage: (messageId, conversationId, content, editedAt) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, content, editedAt } : m,
        ),
      },
    }));
  },

  updateReactions: (messageId, conversationId, reactions) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m,
        ),
      },
    }));
  },

  addConversation: (conversation) => {
    set((state) => {
      if (state.conversations.find((c) => c.id === conversation.id)) return state;
      return { conversations: [conversation, ...state.conversations] };
    });
  },

  updateConversation: (conversation) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversation.id ? { ...c, ...conversation } : c
      ),
    }));
  },

  removeConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      activeConversationId: state.activeConversationId === conversationId ? null : state.activeConversationId,
    }));
  },

  setTyping: (conversationId, userId, username, isTyping) => {
    set((state) => {
      const current = state.typingUsers[conversationId] || [];
      const filtered = current.filter((t) => t.userId !== userId);
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: isTyping ? [...filtered, { userId, username }] : filtered,
        },
      };
    });
  },

  setUserOnline: (userId, isOnline) => {
    set((state) => {
      const newSet = new Set(state.onlineUsers);
      if (isOnline) newSet.add(userId);
      else newSet.delete(userId);
      return { onlineUsers: newSet };
    });
  },

  setUserStatus: (userId, status) => {
    set((state) => {
      const newMap = new Map(state.userStatuses);
      newMap.set(userId, status);
      return { userStatuses: newMap };
    });
  },

  setOnlineUsers: (userIds) => {
    set({ onlineUsers: new Set(userIds) });
  },

  setReplyingTo: (message) => set({ replyingTo: message }),

  updateLastMessage: (conversationId, message) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessage: message } : c,
      ).sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }),
    }));
  },

  incrementUnread: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c,
      ),
    }));
  },

  markRead: (conversationId, userId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) => {
          const readBy = Array.isArray(m.readBy) ? m.readBy : [];
          if (readBy.includes(userId)) return m;
          return { ...m, readBy: [...readBy, userId] };
        }),
      },
    }));
  },

  clearUnread: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    }));
  },
}));
