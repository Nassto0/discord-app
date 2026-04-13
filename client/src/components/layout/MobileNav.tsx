import { MessageSquare, Home, Settings } from 'lucide-react';

interface MobileNavProps {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  activeSection: string;
  onSectionChange: (s: any) => void;
}

export function MobileNav({ onToggleSidebar, activeSection, onSectionChange }: MobileNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around py-2">
        <button onClick={() => onSectionChange('feed')} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors ${activeSection === 'feed' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
          <Home className="h-5 w-5" /><span className="text-[10px] font-medium">Feed</span>
        </button>
        <button onClick={onToggleSidebar} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors ${activeSection === 'chat' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
          <MessageSquare className="h-5 w-5" /><span className="text-[10px] font-medium">Chats</span>
        </button>
        <button onClick={() => onSectionChange('settings')} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors ${activeSection === 'settings' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
          <Settings className="h-5 w-5" /><span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}
