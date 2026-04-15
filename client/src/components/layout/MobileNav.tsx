import { MessageSquare, Home, Settings, Shield, UserPlus, Sparkles, Server } from 'lucide-react';

interface MobileNavProps {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  activeSection: string;
  onSectionChange: (s: any) => void;
  canAccessAdmin?: boolean;
}

export function MobileNav({ onToggleSidebar, activeSection, onSectionChange, canAccessAdmin = false }: MobileNavProps) {
  const items = [
    { id: 'feed', label: 'Feed', icon: Home, action: () => onSectionChange('feed') },
    { id: 'chat', label: 'Chats', icon: MessageSquare, action: onToggleSidebar },
    { id: 'friends', label: 'Friends', icon: UserPlus, action: () => onSectionChange('friends') },
    { id: 'servers', label: 'Servers', icon: Server, action: () => onSectionChange('servers') },
    { id: 'nassai', label: 'NassAI', icon: Sparkles, action: () => onSectionChange('nassai') },
    { id: 'settings', label: 'Profile', icon: Settings, action: () => onSectionChange('settings') },
    ...(canAccessAdmin ? [{ id: 'admin', label: 'Admin', icon: Shield, action: () => onSectionChange('admin') }] : []),
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center overflow-x-auto scrollbar-none py-1 px-1 gap-0.5">
        {items.map(({ id, label, icon: Icon, action }) => (
          <button
            key={id}
            onClick={action}
            className={`flex min-h-[48px] min-w-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors shrink-0
              ${activeSection === id ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
          >
            <Icon className="h-[22px] w-[22px]" />
            <span className="text-[9px] font-semibold tracking-tight leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
