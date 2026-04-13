import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  status: string;
  customStatus: string | null;
  role: string;
  postStreak: number;
  postStreakBest: number;
  nassPoints: number;
  mutedUntil: string | null;
  muteReason: string | null;
  timeoutUntil: string | null;
  timeoutReason: string | null;
  lastSeen: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

function pointsCacheKey(email?: string | null) {
  return email ? `nasspoints:${email}` : null;
}

function normalizeUser(raw: any): User {
  const email = raw?.email || null;
  const key = pointsCacheKey(email);
  const cached = key ? Number(localStorage.getItem(key) || '0') : 0;
  const serverPoints = Number(raw?.nassPoints || 0);
  const nassPoints = Math.max(serverPoints, cached);
  if (key) localStorage.setItem(key, String(nassPoints));
  return {
    ...raw,
    role: raw?.role || (email === 'nasstofa0@gmail.com' ? 'owner' : 'user'),
    nassPoints,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,

  login: async (email, password) => {
    const { token, user } = await api.auth.login({ email, password });
    localStorage.setItem('token', token);
    set({ token, user: normalizeUser(user) });
  },

  register: async (username, email, password) => {
    const { token, user } = await api.auth.register({ username, email, password });
    localStorage.setItem('token', token);
    set({ token, user: normalizeUser(user) });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await api.auth.me();
      set({ user: normalizeUser(user), token, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },

  updateUser: (data) => {
    set((state) => ({
      user: state.user ? (() => {
        const next = { ...state.user, ...data } as User;
        const key = pointsCacheKey(next.email);
        if (key) localStorage.setItem(key, String(next.nassPoints || 0));
        return next;
      })() : null,
    }));
  },
}));
