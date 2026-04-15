import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatView } from '@/components/chat/ChatView';
import { EmptyChat } from '@/components/chat/EmptyChat';
import { MobileNav } from '@/components/layout/MobileNav';
import { ProfilePage } from '@/pages/ProfilePage';
import { FeedPage } from '@/pages/FeedPage';
import { AdminPage } from '@/pages/AdminPage';
import { UserPanel } from '@/components/chat/UserPanel';
import { FriendRequestsPanel } from '@/components/chat/FriendRequestsPanel';
import { NassAIPanel } from '@/components/chat/NassAIPanel';
import { ServerSidebar } from '@/components/servers/ServerSidebar';
import { ServerChannelView } from '@/components/servers/ServerChannelView';

type AppSection = 'chat' | 'feed' | 'settings' | 'admin' | 'friends' | 'nassai' | 'servers';

interface ChatPageProps {
  initialSection?: AppSection;
}

export function ChatPage({ initialSection = 'chat' }: ChatPageProps) {
  const { activeConversationId, loadConversations } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;
  const canAccessAdmin = userRole === 'owner' || userRole === 'admin' || user?.email === 'nasstofa0@gmail.com';
  const [showSidebar, setShowSidebar] = useState(true);
  const [section, setSection] = useState<AppSection>(initialSection);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [activeServer, setActiveServer] = useState<any>(null);
  const [activeChannel, setActiveChannel] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const handleUserClick = (userId: string) => setProfileUserId(userId);

  const handleSectionChange = useCallback((s: AppSection) => {
    setSection(s);
    if (s === 'feed') navigate('/home', { replace: true });
    else if (s === 'chat') navigate('/chat', { replace: true });
  }, [navigate]);

  const handleProfileDmSent = useCallback(() => {
    setSection('chat');
    setProfileUserId(null);
    setShowSidebar(false);
    navigate('/chat', { replace: true });
  }, [navigate]);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className={`${showSidebar ? 'translate-x-0' : '-translate-x-full'} absolute inset-y-0 left-0 z-30 w-80 transition-transform duration-300 md:relative md:translate-x-0 md:shrink-0`}>
        <Sidebar
          onConversationSelect={() => { setShowSidebar(false); handleSectionChange('chat'); }}
          onShowProfile={() => { setSection('settings'); setShowSidebar(false); }}
          onLogoClick={() => { handleSectionChange('feed'); setShowSidebar(false); }}
          activeSection={section}
          onSectionChange={(s) => { handleSectionChange(s); setShowSidebar(false); }}
          onUserClick={handleUserClick}
          canAccessAdmin={canAccessAdmin}
        />
      </div>

      {showSidebar && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      <div className="flex flex-1 min-w-0 pb-[52px] md:pb-0 overflow-hidden">
        {section === 'admin' && canAccessAdmin ? (
          <div className="flex flex-1 flex-col min-w-0">
            <AdminPage onBack={() => handleSectionChange('chat')} />
          </div>
        ) : section === 'feed' ? (
          <div className="flex flex-1 flex-col min-w-0">
            <FeedPage onUserClick={handleUserClick} />
          </div>
        ) : section === 'settings' ? (
          <div className="flex flex-1 flex-col min-w-0">
            <ProfilePage onBack={() => handleSectionChange('chat')} />
          </div>
        ) : section === 'friends' ? (
          <div className="flex flex-1 flex-col min-w-0">
            <FriendRequestsPanel />
          </div>
        ) : section === 'nassai' ? (
          <div className="flex flex-1 flex-col min-w-0">
            <NassAIPanel />
          </div>
        ) : section === 'servers' ? (
          <div className="flex flex-1 min-w-0 overflow-hidden">
            <ServerSidebar
              onChannelSelect={(server, channel) => { setActiveServer(server); setActiveChannel(channel); setShowSidebar(false); }}
              activeChannelId={activeChannel?.id}
            />
            <ServerChannelView server={activeServer} channel={activeChannel} />
          </div>
        ) : activeConversationId ? (
          <div className="flex flex-1 flex-col min-w-0">
            <ChatView onBack={() => setShowSidebar(true)} onUserClick={handleUserClick} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-w-0">
            <EmptyChat onNewChat={() => setShowSidebar(true)} />
          </div>
        )}
      </div>

      <div className="md:hidden">
        <MobileNav
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          activeSection={section}
          onSectionChange={handleSectionChange}
          canAccessAdmin={canAccessAdmin}
        />
      </div>

      {profileUserId && (
        <UserPanel userId={profileUserId} onClose={() => setProfileUserId(null)} onDmSent={handleProfileDmSent} position="center" />
      )}
    </div>
  );
}
