import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Resolve relative file URLs (e.g. /uploads/file.jpg) to absolute when API is on another origin.
// Set VITE_API_URL on Vercel to your Render API origin (no trailing slash). Redeploy after changing env.
const API_BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function fileUrl(url: string | null | undefined): string {
  if (!url) return '';
  const clean = String(url).replace(/\\/g, '/').trim();

  if (/^https?:\/\//i.test(clean) || clean.startsWith('blob:') || clean.startsWith('data:')) return clean;

  // Protocol-less hosts (e.g. api.onrender.com/uploads/...) from older persisted values.
  if (/^[a-z0-9.-]+\.[a-z]{2,}\/.+/i.test(clean)) return `https://${clean}`;

  let path = clean;
  if (!path.startsWith('/')) {
    if (/^uploads\//i.test(path)) path = `/${path}`;
    else if (path.includes('/')) path = `/${path}`;
    else path = `/uploads/${path}`;
  }

  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

export function formatLastSeen(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins}m ago`;
  if (hours < 24) return `Last seen ${hours}h ago`;
  if (days < 7) return `Last seen ${days}d ago`;
  return `Last seen ${date.toLocaleDateString()}`;
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500',
    'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500',
    'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-fuchsia-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
