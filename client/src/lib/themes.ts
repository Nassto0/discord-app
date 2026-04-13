export interface Theme {
  id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    primary: string;
    accent: string;
    secondary: string;
    muted: string;
    mutedForeground: string;
    sidebar: string;
    surface: string;
    border: string;
  };
}

export const themes: Theme[] = [
  { id: 'dark', name: 'Dark', colors: { background: '#09090b', foreground: '#fafafa', card: '#18181b', primary: '#6366f1', accent: '#7c3aed', secondary: '#27272a', muted: '#27272a', mutedForeground: '#a1a1aa', sidebar: '#0f0f12', surface: '#121215', border: '#27272a' } },
  { id: 'midnight', name: 'Midnight', colors: { background: '#0a0a1a', foreground: '#e8e8f0', card: '#12122a', primary: '#818cf8', accent: '#a78bfa', secondary: '#1e1e3a', muted: '#1e1e3a', mutedForeground: '#8888aa', sidebar: '#08081a', surface: '#0e0e22', border: '#1e1e3a' } },
  { id: 'spotify', name: 'Spotify', colors: { background: '#121212', foreground: '#ffffff', card: '#1a1a1a', primary: '#1db954', accent: '#1ed760', secondary: '#282828', muted: '#282828', mutedForeground: '#b3b3b3', sidebar: '#0a0a0a', surface: '#161616', border: '#282828' } },
  { id: 'purple', name: 'Purple', colors: { background: '#0d0815', foreground: '#f0e8ff', card: '#1a1028', primary: '#a855f7', accent: '#c084fc', secondary: '#261a3a', muted: '#261a3a', mutedForeground: '#9e8ab8', sidebar: '#0a0610', surface: '#130c20', border: '#261a3a' } },
  { id: 'ocean', name: 'Ocean', colors: { background: '#0a1520', foreground: '#e0f0ff', card: '#101e2e', primary: '#0ea5e9', accent: '#06b6d4', secondary: '#1a2e42', muted: '#1a2e42', mutedForeground: '#7aa8c8', sidebar: '#081018', surface: '#0c1822', border: '#1a2e42' } },
  { id: 'forest', name: 'Forest', colors: { background: '#0a150a', foreground: '#e0f0e0', card: '#101e10', primary: '#22c55e', accent: '#10b981', secondary: '#1a2e1a', muted: '#1a2e1a', mutedForeground: '#7ab87a', sidebar: '#081008', surface: '#0c180c', border: '#1a2e1a' } },
  { id: 'sunset', name: 'Sunset', colors: { background: '#1a0a0a', foreground: '#fff0e0', card: '#251510', primary: '#f97316', accent: '#ef4444', secondary: '#332218', muted: '#332218', mutedForeground: '#c8a080', sidebar: '#140808', surface: '#1e1010', border: '#332218' } },
  { id: 'neon', name: 'Neon', colors: { background: '#0a0a0a', foreground: '#f0f0f0', card: '#141414', primary: '#00ff88', accent: '#ff00ff', secondary: '#1e1e1e', muted: '#1e1e1e', mutedForeground: '#888888', sidebar: '#080808', surface: '#101010', border: '#1e1e1e' } },
  { id: 'rose', name: 'Rose', colors: { background: '#150a10', foreground: '#ffe0f0', card: '#201520', primary: '#f43f5e', accent: '#ec4899', secondary: '#2e1a28', muted: '#2e1a28', mutedForeground: '#b87a98', sidebar: '#100810', surface: '#180c15', border: '#2e1a28' } },
  { id: 'amber', name: 'Amber', colors: { background: '#151008', foreground: '#fff8e0', card: '#201a10', primary: '#f59e0b', accent: '#d97706', secondary: '#2e2518', muted: '#2e2518', mutedForeground: '#b8a070', sidebar: '#100c06', surface: '#181408', border: '#2e2518' } },
  { id: 'emerald', name: 'Emerald', colors: { background: '#08150e', foreground: '#e0fff0', card: '#101e18', primary: '#34d399', accent: '#10b981', secondary: '#1a2e25', muted: '#1a2e25', mutedForeground: '#70b898', sidebar: '#061008', surface: '#0c1810', border: '#1a2e25' } },
  { id: 'sapphire', name: 'Sapphire', colors: { background: '#080e18', foreground: '#e0f0ff', card: '#101828', primary: '#3b82f6', accent: '#2563eb', secondary: '#182840', muted: '#182840', mutedForeground: '#6090c0', sidebar: '#060a12', surface: '#0a1220', border: '#182840' } },
  { id: 'crimson', name: 'Crimson', colors: { background: '#150808', foreground: '#ffe0e0', card: '#201010', primary: '#dc2626', accent: '#b91c1c', secondary: '#2e1818', muted: '#2e1818', mutedForeground: '#c07070', sidebar: '#100606', surface: '#180a0a', border: '#2e1818' } },
  { id: 'lavender', name: 'Lavender', colors: { background: '#100a18', foreground: '#f0e8ff', card: '#181028', primary: '#c084fc', accent: '#a855f7', secondary: '#251a38', muted: '#251a38', mutedForeground: '#9880b8', sidebar: '#0c0812', surface: '#140e20', border: '#251a38' } },
  { id: 'teal', name: 'Teal', colors: { background: '#081515', foreground: '#e0ffff', card: '#101e1e', primary: '#14b8a6', accent: '#0d9488', secondary: '#1a2e2e', muted: '#1a2e2e', mutedForeground: '#70b8b8', sidebar: '#061010', surface: '#0c1818', border: '#1a2e2e' } },
  { id: 'gold', name: 'Gold', colors: { background: '#151208', foreground: '#fff8e0', card: '#1e1a10', primary: '#eab308', accent: '#ca8a04', secondary: '#2e2818', muted: '#2e2818', mutedForeground: '#b8a860', sidebar: '#100e06', surface: '#181508', border: '#2e2818' } },
  { id: 'cozy', name: 'Cozy', colors: { background: '#1a1614', foreground: '#f5e8dc', card: '#231e1a', primary: '#d4956a', accent: '#c07850', secondary: '#302820', muted: '#302820', mutedForeground: '#a89080', sidebar: '#141010', surface: '#1e1816', border: '#302820' } },
  { id: 'light', name: 'Light', colors: { background: '#ffffff', foreground: '#111111', card: '#f4f4f5', primary: '#6366f1', accent: '#7c3aed', secondary: '#e4e4e7', muted: '#e4e4e7', mutedForeground: '#71717a', sidebar: '#f8f8fa', surface: '#fafafa', border: '#e4e4e7' } },
];

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--color-background', c.background);
  root.style.setProperty('--color-foreground', c.foreground);
  root.style.setProperty('--color-card', c.card);
  root.style.setProperty('--color-primary', c.primary);
  root.style.setProperty('--color-accent', c.accent);
  root.style.setProperty('--color-secondary', c.secondary);
  root.style.setProperty('--color-muted', c.muted);
  root.style.setProperty('--color-muted-foreground', c.mutedForeground);
  root.style.setProperty('--color-sidebar', c.sidebar);
  root.style.setProperty('--color-surface', c.surface);
  root.style.setProperty('--color-border', c.border);
  root.style.setProperty('--color-input', c.secondary);
  root.style.setProperty('--color-ring', c.primary);
  root.style.setProperty('--color-sidebar-foreground', c.mutedForeground);
  root.style.setProperty('--color-sidebar-hover', c.secondary);
  root.style.setProperty('--color-sidebar-active', c.primary);
  root.style.setProperty('--color-card-foreground', c.foreground);
  root.style.setProperty('--color-popover', c.card);
  root.style.setProperty('--color-popover-foreground', c.foreground);
  root.style.setProperty('--color-primary-foreground', '#ffffff');
  root.style.setProperty('--color-secondary-foreground', c.foreground);
  root.style.setProperty('--color-accent-foreground', c.foreground);
  root.style.setProperty('--color-destructive', '#ef4444');
  root.style.setProperty('--color-destructive-foreground', '#fafafa');

  localStorage.setItem('nasscord-theme', theme.id);
}

export function loadSavedTheme() {
  const id = localStorage.getItem('nasscord-theme') || 'dark';
  const theme = themes.find((t) => t.id === id) || themes[0];
  applyTheme(theme);
  return theme;
}
