// In dev, Vite proxies /api to localhost:3001 so no base is needed.
// In production, set VITE_API_URL to the server origin (e.g. https://your-server.onrender.com)
const API_ORIGIN = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';


async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    const err = new Error(error.message || 'Request failed') as Error & { code?: string };
    if (error.code) err.code = error.code;
    throw err;
  }
  return res.json();
}

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string }) =>
      request<{ token: string; user: any; assetBaseUrl?: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: any; assetBaseUrl?: string }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<any>('/auth/me'),
    forgotPassword: (email: string) => request<{ code?: string; message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (email: string, code: string, newPassword: string) => request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) }),
  },
  users: {
    search: (q: string) => request<any[]>(`/users/search?q=${encodeURIComponent(q)}`),
    all: () => request<any[]>('/users/all'),
    get: (id: string) => request<any>(`/users/${id}`),
    updateProfile: (data: any) => request<any>('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
    follow: (id: string) => request<any>(`/users/${id}/follow`, { method: 'POST' }),
    unfollow: (id: string) => request<any>(`/users/${id}/follow`, { method: 'DELETE' }),
    block: (id: string) => request<any>(`/users/${id}/block`, { method: 'POST' }),
    unblock: (id: string) => request<any>(`/users/${id}/block`, { method: 'DELETE' }),
    notifications: () => request<any[]>('/users/notifications/list'),
    markNotificationRead: (id: string) => request<any>(`/users/notifications/${id}/read`, { method: 'POST' }),
  },
  conversations: {
    list: () => request<any[]>('/conversations'),
    create: (data: { type: string; name?: string; memberIds: string[] }) =>
      request<any>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
    messages: (id: string, cursor?: string) =>
      request<any[]>(`/conversations/${id}/messages${cursor ? `?cursor=${cursor}` : ''}`),
    addMember: (id: string, userId: string) =>
      request<any[]>(`/conversations/${id}/members`, { method: 'POST', body: JSON.stringify({ userId }) }),
    removeMember: (id: string, userId: string) =>
      request<any>(`/conversations/${id}/members/${userId}`, { method: 'DELETE' }),
    leave: (id: string) =>
      request<any>(`/conversations/${id}/leave`, { method: 'POST' }),
  },
  uploads: {
    upload: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<{ url: string; filename: string; mimetype: string }>('/uploads', { method: 'POST', body: form });
    },
    avatar: (file: File) => {
      const form = new FormData();
      form.append('avatar', file);
      return request<{ url: string }>('/uploads/avatar', { method: 'POST', body: form });
    },
  },
  posts: {
    list: (cursor?: string) => request<any[]>(`/posts${cursor ? `?cursor=${cursor}` : ''}`),
    create: (data: { content: string; imageUrl?: string }) =>
      request<any>('/posts', { method: 'POST', body: JSON.stringify(data) }),
    like: (id: string) => request<{ liked: boolean }>(`/posts/${id}/like`, { method: 'POST' }),
    delete: (id: string) => request<any>(`/posts/${id}`, { method: 'DELETE' }),
    comment: (postId: string, content: string) =>
      request<any>(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  },
  online: () => request<string[]>('/online'),
  reports: {
    create: (data: { targetType: string; targetId: string; reason: string; details?: string }) =>
      request<any>('/reports', { method: 'POST', body: JSON.stringify(data) }),
  },
  stories: {
    list: () => request<any[]>('/stories'),
    create: (data: { mediaUrl: string; caption?: string }) =>
      request<any>('/stories', { method: 'POST', body: JSON.stringify(data) }),
    view: (id: string) => request<any>(`/stories/${id}/view`, { method: 'POST' }),
    delete: (id: string) => request<any>(`/stories/${id}`, { method: 'DELETE' }),
    deleteMineAll: () => request<any>('/stories/mine/all', { method: 'DELETE' }),
  },
  admin: {
    stats: () => request<any>('/admin/stats'),
    reports: (status?: string) => request<any[]>(`/admin/reports${status ? `?status=${status}` : ''}`),
    updateReport: (id: string, data: { status: string; reviewNote?: string }) =>
      request<any>(`/admin/reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    users: () => request<any[]>('/admin/users'),
    updateRole: (id: string, role: string) =>
      request<any>(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    moderateUser: (id: string, data: { action: string; reason: string; minutes?: number }) =>
      request<any>(`/admin/users/${id}/moderate`, { method: 'POST', body: JSON.stringify(data) }),
    userActions: (id: string) => request<any[]>(`/admin/users/${id}/actions`),
    deletePost: (id: string) => request<any>(`/admin/posts/${id}`, { method: 'DELETE' }),
    deleteMessage: (id: string) => request<any>(`/admin/messages/${id}`, { method: 'DELETE' }),
    deleteStory: (id: string) => request<any>(`/admin/stories/${id}`, { method: 'DELETE' }),
    flagged: () => request<any>('/admin/flagged'),
  },
  streaks: {
    get: (conversationId: string) => request<any[]>(`/streaks/${conversationId}`),
  },
  friends: {
    list: () => request<any[]>('/friends'),
    requests: () => request<any[]>('/friends/requests'),
    sent: () => request<any[]>('/friends/sent'),
    sendRequest: (userId: string) => request<any>(`/friends/request/${userId}`, { method: 'POST' }),
    accept: (requestId: string) => request<any>(`/friends/accept/${requestId}`, { method: 'POST' }),
    reject: (requestId: string) => request<any>(`/friends/reject/${requestId}`, { method: 'POST' }),
    remove: (userId: string) => request<any>(`/friends/${userId}`, { method: 'DELETE' }),
    search: (q: string) => request<any[]>(`/users/search?q=${encodeURIComponent(q)}`),
  },
  ai: {
    chat: (messages: any[]) => request<any>('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, model: 'gpt-4o-mini' }) }),
  },
  servers: {
    list: () => request<any[]>('/servers'),
    create: (data: { name: string; description?: string; isPublic?: boolean }) => request<any>('/servers', { method: 'POST', body: JSON.stringify(data) }),
    public: () => request<any[]>('/servers/public'),
    join: (inviteCode: string) => request<any>(`/servers/join/${inviteCode}`, { method: 'POST' }),
    get: (id: string) => request<any>(`/servers/${id}`),
    createChannel: (serverId: string, data: { name: string; type?: string; description?: string }) => request<any>(`/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify(data) }),
    leave: (id: string) => request<any>(`/servers/${id}/leave`, { method: 'POST' }),
    delete: (id: string) => request<any>(`/servers/${id}`, { method: 'DELETE' }),
    channelMessages: (serverId: string, channelId: string) => request<any[]>(`/servers/${serverId}/channels/${channelId}/messages`),
    sendMessage: (serverId: string, channelId: string, content: string) => request<any>(`/servers/${serverId}/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  },
};
