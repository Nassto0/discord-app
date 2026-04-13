import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import { AuthPage } from '@/pages/AuthPage';
import { ChatPage } from '@/pages/ChatPage';
import { IncomingCallOverlay } from '@/components/calls/IncomingCallOverlay';
import { CallView } from '@/components/calls/CallView';
import { TitleBar } from '@/components/layout/TitleBar';
import { useCallStore } from '@/stores/callStore';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';

export function App() {
  const { user, isLoading, checkAuth } = useAuthStore();
  const callStatus = useCallStore((s) => s.status);
  const callType = useCallStore((s) => s.callType);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/icon.png" alt="" className="h-14 w-14 object-contain animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Routes><Route path="/auth" element={<AuthPage />} /><Route path="*" element={<Navigate to="/auth" replace />} /></Routes>;
  }

  const showCallBar = callStatus === 'outgoing' || callStatus === 'connected';
  const isVideoCall = showCallBar && callType === 'video';

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TitleBar />
      <SocketProvider />
      <AnimatePresence>{showCallBar && !isVideoCall && <CallView />}</AnimatePresence>
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/chat/*" element={<ChatPage initialSection="chat" />} />
          <Route path="/home" element={<ChatPage initialSection="feed" />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
      <IncomingCallOverlay />
      <AnimatePresence>{isVideoCall && <CallView />}</AnimatePresence>
      <Analytics />
    </div>
  );
}

function SocketProvider() { useSocket(); return null; }
