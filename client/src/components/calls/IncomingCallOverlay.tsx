import { useEffect, useRef } from 'react';
import { useCallStore } from '@/stores/callStore';
import { acceptIncoming, rejectIncoming } from '@/hooks/useWebRTC';
import { getInitials, getAvatarColor, fileUrl } from '@/lib/utils';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';

export function IncomingCallOverlay() {
  const status = useCallStore((s) => s.status);
  const callType = useCallStore((s) => s.callType);
  const remoteUser = useCallStore((s) => s.remoteUser);
  const ringRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === 'incoming') {
      sounds.callRinging();
      ringRef.current = window.setInterval(sounds.callRinging, 3000);
    }
    return () => { if (ringRef.current) clearInterval(ringRef.current); };
  }, [status]);

  if (status !== 'incoming' || !remoteUser) return null;

  const name = remoteUser.username;

  const handleAccept = () => {
    if (ringRef.current) clearInterval(ringRef.current);
    acceptIncoming();
  };

  const handleReject = () => {
    if (ringRef.current) clearInterval(ringRef.current);
    rejectIncoming();
    sounds.callEnd();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -80 }} className="fixed left-1/2 top-4 z-[60] -translate-x-1/2">
        <div className="flex items-center gap-4 rounded-2xl border border-white/[0.1] bg-card/95 px-5 py-3.5 shadow-2xl backdrop-blur-xl">
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            {remoteUser.avatar ? <img src={fileUrl(remoteUser.avatar)} alt="" className="h-12 w-12 rounded-full object-cover" /> :
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getAvatarColor(name)} text-lg font-bold text-white`}>{getInitials(name)}</div>}
          </motion.div>
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            <p className="text-sm text-muted-foreground">Incoming {callType} call</p>
          </div>
          <div className="ml-3 flex gap-2">
            <button onClick={handleReject} className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20"><PhoneOff className="h-5 w-5" /></button>
            <motion.button onClick={handleAccept} animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600">
              <Phone className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
