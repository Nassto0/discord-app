import { useEffect, useRef, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import { useCallStore } from '@/stores/callStore';
import { hangup, toggleScreenShare, changeScreenSource, applyAudioConstraints, getCallStats, toggleCameraForVoiceCall } from '@/hooks/useWebRTC';
import { getInitials, getAvatarColor, formatDuration, fileUrl } from '@/lib/utils';
import { Mic, MicOff, PhoneOff, Headphones, HeadphoneOff, Video, VideoOff, Settings2, Monitor, MonitorOff, Maximize2, Minimize2, RefreshCw, X, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';

export function CallView() {
  const {
    callId, status, callType, remoteUser, isMuted, isDeafened, isScreenSharing,
    localStream, remoteStream, elapsed, toggleMute, toggleDeafen, tick,
  } = useCallStore();
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const remoteScreenRef = useRef<HTMLVideoElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [screenExpanded, setScreenExpanded] = useState(false);
  const [remoteScreenExpanded, setRemoteScreenExpanded] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(() => localStorage.getItem('audio-noise-suppress') === 'true');
  const [echoCancellation, setEchoCancellation] = useState(() => localStorage.getItem('audio-echo-cancel') === 'true');
  const [autoGain, setAutoGain] = useState(() => localStorage.getItem('audio-auto-gain') === 'true');
  const [ping, setPing] = useState<number | null>(null);
  const [userVolume, setUserVolume] = useState(() => {
    try { return Number(localStorage.getItem('call-user-volume')) || 100; } catch { return 100; }
  });

  // Persistent drag positions — useMotionValue keeps position through re-renders
  const screenDragX = useMotionValue(0);
  const screenDragY = useMotionValue(0);
  const remoteScreenDragX = useMotionValue(0);
  const remoteScreenDragY = useMotionValue(0);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (!screenRef.current) return;
    if (isScreenSharing && localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        screenRef.current.srcObject = new MediaStream(videoTracks);
      }
    } else {
      screenRef.current.srcObject = null;
    }
  }, [localStream, isScreenSharing]);

  useEffect(() => {
    if (!remoteScreenRef.current) return;
    const videoTracks = remoteStream?.getVideoTracks().filter(t => t.readyState === 'live') ?? [];
    remoteScreenRef.current.srcObject = videoTracks.length > 0 ? new MediaStream(videoTracks) : null;
  }, [remoteStream]);

  // Keep ticking elapsed during both connected AND reconnecting so the clock
  // runs continuously even while WebRTC is being re-established after a refresh
  useEffect(() => {
    if (status !== 'connected' && status !== 'reconnecting') return;
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [status, tick]);

  // Poll RTT ping every 2 seconds while connected
  useEffect(() => {
    if (status !== 'connected') return;
    const poll = async () => {
      const { rtt } = await getCallStats();
      setPing(rtt);
    };
    poll();
    const i = setInterval(poll, 2000);
    return () => clearInterval(i);
  }, [status]);

  useEffect(() => {
    if (status !== 'outgoing') return;
    sounds.callRinging();
    const i = setInterval(sounds.callRinging, 3000);
    return () => clearInterval(i);
  }, [status]);

  useEffect(() => {
    if (!isScreenSharing) setScreenExpanded(false);
  }, [isScreenSharing]);

  // Show UI for outgoing, connected, AND reconnecting (but not idle/incoming)
  if (!callId || status === 'idle' || status === 'incoming') return null;

  const name = remoteUser?.username || 'Unknown';
  const isVideo = callType === 'video';
  const remoteHasVideo = !isVideo && (remoteStream?.getVideoTracks().some(t => t.readyState === 'live') ?? false);
  const cameraOn = localStream?.getVideoTracks().some((t) => t.enabled) ?? false;

  const toggleNoise = () => {
    const next = !noiseSuppression;
    setNoiseSuppression(next);
    localStorage.setItem('audio-noise-suppress', String(next));
    applyAudioConstraints({ noiseSuppression: next });
  };

  const toggleEcho = () => {
    const next = !echoCancellation;
    setEchoCancellation(next);
    localStorage.setItem('audio-echo-cancel', String(next));
    applyAudioConstraints({ echoCancellation: next });
  };

  const toggleAutoGain = () => {
    const next = !autoGain;
    setAutoGain(next);
    localStorage.setItem('audio-auto-gain', String(next));
    applyAudioConstraints({ autoGainControl: next });
  };

  const handleVolumeChange = (val: number) => {
    setUserVolume(val);
    localStorage.setItem('call-user-volume', String(val));
    window.dispatchEvent(new CustomEvent('audio-settings-changed', { detail: { type: 'output-volume', value: val } }));
  };

  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    useCallStore.setState({});
  };

  const pingColor = ping === null ? 'text-white/40' : ping < 80 ? 'text-emerald-400' : ping < 150 ? 'text-yellow-400' : 'text-red-400';
  // For voice calls: camera is on when localStream has a live video track
  const voiceCameraOn = !isVideo && (localStream?.getVideoTracks().some(t => t.readyState === 'live') ?? false);

  if (isVideo) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/95">
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {remoteStream?.getVideoTracks().some((t) => t.enabled) ? (
            <video ref={remoteRef} autoPlay playsInline muted className="h-full w-full object-cover sm:object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
              {remoteUser?.avatar ? (
                <img src={fileUrl(remoteUser.avatar)} alt="" className="h-32 w-32 rounded-full object-cover shadow-2xl ring-4 ring-white/10" />
              ) : (
                <div className={`flex h-32 w-32 items-center justify-center rounded-full ${getAvatarColor(name)} text-5xl font-bold text-white shadow-2xl ring-4 ring-white/10`}>
                  {getInitials(name)}
                </div>
              )}
              <div className="text-center">
                <p className="text-3xl font-bold text-white tracking-tight">{name}</p>
                <p className="text-sm font-medium text-white/50 mt-1">
                  {status === 'connected' ? formatDuration(elapsed) : 'Connecting...'}
                </p>
              </div>
            </div>
          )}

          {localStream?.getVideoTracks().length ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="absolute bottom-32 right-6 md:bottom-8 md:right-8 h-48 w-32 md:h-56 md:w-40 rounded-2xl border border-white/20 bg-zinc-900 shadow-2xl overflow-hidden z-10">
              <video ref={localRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            </motion.div>
          ) : null}

          <div className="absolute top-6 left-6 flex items-center gap-2.5 rounded-full bg-black/40 border border-white/10 px-4 py-2 backdrop-blur-xl shadow-lg">
            <div className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-yellow-400'}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
            </div>
            <span className="text-sm font-medium text-white">{name}</span>
            {status === 'connected' && (
              <>
                <div className="h-3 w-px bg-white/20 mx-1" />
                <span className="text-sm font-medium text-white/70">{formatDuration(elapsed)}</span>
                {ping !== null && (
                  <>
                    <div className="h-3 w-px bg-white/20 mx-1" />
                    <span className={`text-xs font-mono font-medium ${pingColor}`}>{ping}ms</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-[2rem] bg-black/50 border border-white/10 px-6 py-4 backdrop-blur-2xl shadow-2xl">
          <VCallBtn active={isMuted} onClick={toggleMute} icon={isMuted ? MicOff : Mic} danger={isMuted} label={isMuted ? 'Unmute' : 'Mute'} />
          <VCallBtn active={isDeafened} onClick={toggleDeafen} icon={isDeafened ? HeadphoneOff : Headphones} danger={isDeafened} label={isDeafened ? 'Undeafen' : 'Deafen'} />
          <VCallBtn onClick={toggleCamera} icon={cameraOn ? Video : VideoOff} active={!cameraOn} danger={!cameraOn} label="Camera" />
          <VCallBtn onClick={() => toggleScreenShare()} icon={isScreenSharing ? MonitorOff : Monitor} active={isScreenSharing} label="Screen Share" />

          <div className="relative">
            <VCallBtn onClick={() => setShowSettings(!showSettings)} icon={Settings2} label="Settings" active={showSettings} />
            <AnimatePresence>
              {showSettings && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full mb-4 right-0 w-64 rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl p-4 shadow-2xl z-50">
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-4">Voice Settings (Live)</p>
                  <div className="space-y-1">
                    <SettingToggle label="Noise Suppression" enabled={noiseSuppression} onToggle={toggleNoise} />
                    <SettingToggle label="Echo Cancellation" enabled={echoCancellation} onToggle={toggleEcho} />
                    <SettingToggle label="Auto Gain Control" enabled={autoGain} onToggle={toggleAutoGain} />
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <Volume2 className="h-3.5 w-3.5 text-white/50" />
                        <span className="text-xs font-medium text-white/70">User Volume</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/40">{userVolume}%</span>
                    </div>
                    <input type="range" min={0} max={200} value={userVolume} onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/10 accent-emerald-500" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mx-2 h-10 w-px bg-white/10" />

          <button onClick={() => hangup()}
            className="group flex h-14 items-center gap-2.5 rounded-full bg-red-500 px-6 font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-600 hover:shadow-red-500/30 active:scale-95">
            <PhoneOff className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline">Leave Call</span>
          </button>
        </div>
      </motion.div>
    );
  }

  // Voice Call View
  return (
    <>
      {/* Local screen share — draggable, position persists via useMotionValue */}
      <AnimatePresence>
        {isScreenSharing && (
          <motion.div
            drag dragMomentum={false} dragElastic={0}
            style={{ x: screenDragX, y: screenDragY }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed z-40 rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing
              ${screenExpanded ? 'inset-4 bottom-20 z-50' : 'bottom-16 right-4 w-80 h-48 hover:border-white/20'}`}
          >
            <video ref={screenRef} autoPlay playsInline muted className="w-full h-full object-contain bg-zinc-950" />
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); changeScreenSource(); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all active:scale-90"
                title="Change window"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setScreenExpanded(!screenExpanded); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all active:scale-90">
                {screenExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleScreenShare(); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/60 text-white hover:bg-red-500 backdrop-blur-md transition-all active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="absolute bottom-3 left-3 rounded-full bg-black/40 border border-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-md pointer-events-none">
              Your Screen
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local camera PIP during voice call */}
      <AnimatePresence>
        {voiceCameraOn && !isScreenSharing && (
          <motion.div
            drag dragMomentum={false} dragElastic={0}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-16 left-4 z-40 w-40 rounded-2xl overflow-hidden border border-white/20 bg-zinc-950 shadow-2xl cursor-grab active:cursor-grabbing"
            style={{ aspectRatio: '3/4' }}
          >
            <video ref={localRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="absolute bottom-2 left-2 right-2 text-center rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/70 pointer-events-none">
              You
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remote screen share — draggable */}
      <AnimatePresence>
        {remoteHasVideo && (
          <motion.div
            drag dragMomentum={false} dragElastic={0}
            style={{ x: remoteScreenDragX, y: remoteScreenDragY }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed z-40 rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing
              ${remoteScreenExpanded ? 'inset-4 bottom-20 z-50' : 'bottom-16 right-4 w-80 h-48 hover:border-white/20'}`}
          >
            <video ref={remoteScreenRef} autoPlay playsInline muted className="w-full h-full object-contain bg-zinc-950" />
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            <div className="absolute top-3 right-3 flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); setRemoteScreenExpanded(!remoteScreenExpanded); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all active:scale-90">
                {remoteScreenExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
            <div className="absolute bottom-3 left-3 rounded-full bg-black/40 border border-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-md pointer-events-none">
              {name}'s Screen
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 border-b border-border bg-card/50 backdrop-blur-xl shrink-0 shadow-sm">
        <div className="flex items-center gap-4 px-4 py-2.5">
          <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping
              ${status === 'connected' ? 'bg-emerald-400' : status === 'reconnecting' ? 'bg-amber-400' : 'bg-yellow-400'}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full
              ${status === 'connected' ? 'bg-emerald-500' : status === 'reconnecting' ? 'bg-amber-500' : 'bg-yellow-500'}`} />
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold leading-none ${status === 'connected' ? 'text-emerald-500' : status === 'reconnecting' ? 'text-amber-400' : 'text-yellow-500'}`}>
                {status === 'connected'
                  ? (isScreenSharing ? 'Sharing Screen' : remoteHasVideo ? `${name} is sharing` : 'Voice Connected')
                  : status === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
              </p>
              {status === 'connected' && ping !== null && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-black/20 ${pingColor}`}>{ping}ms</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-1 font-medium">
              {name} {status === 'connected' && <span className="opacity-70">· {formatDuration(elapsed)}</span>}
            </p>
          </div>

          <div className="flex items-center shrink-0 -space-x-2 mr-2">
            {[remoteUser].filter(Boolean).map((u: any) => (
              u.avatar ? (
                <img key={u.id} src={fileUrl(u.avatar)} alt="" className="h-8 w-8 rounded-full border-2 border-background object-cover shadow-sm" />
              ) : (
                <div key={u.id} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background ${getAvatarColor(u.username)} text-[10px] font-bold text-white shadow-sm`}>
                  {getInitials(u.username)}
                </div>
              )
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 bg-background/50 p-1 rounded-xl border border-border">
            <SmBtn active={isMuted} onClick={toggleMute} icon={isMuted ? MicOff : Mic} danger={isMuted} />
            <SmBtn active={isDeafened} onClick={toggleDeafen} icon={isDeafened ? HeadphoneOff : Headphones} danger={isDeafened} />
            <SmBtn active={voiceCameraOn} onClick={() => toggleCameraForVoiceCall()} icon={voiceCameraOn ? Video : VideoOff} danger={!voiceCameraOn && false} />
            <SmBtn active={isScreenSharing} onClick={() => { toggleScreenShare(); if (!isScreenSharing) setScreenExpanded(false); }} icon={isScreenSharing ? MonitorOff : Monitor} />
            <SmBtn active={showSettings} onClick={() => setShowSettings(!showSettings)} icon={Settings2} />
            <div className="mx-1 h-5 w-px bg-border" />
            <button onClick={() => hangup()} className="group flex h-8 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90">
              <PhoneOff className="h-4 w-4 transition-transform group-hover:scale-110" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border bg-card/30">
              <div className="px-5 py-4 flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                  <SettingToggle label="Noise Suppression" enabled={noiseSuppression} onToggle={toggleNoise} />
                </div>
                <div className="flex-1">
                  <SettingToggle label="Echo Cancellation" enabled={echoCancellation} onToggle={toggleEcho} />
                </div>
                <div className="flex-1">
                  <SettingToggle label="Auto Gain Control" enabled={autoGain} onToggle={toggleAutoGain} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-foreground/60" />
                      <span className="text-sm font-medium text-foreground/80">User Volume</span>
                    </div>
                    <span className="text-xs font-mono text-foreground/50">{userVolume}%</span>
                  </div>
                  <input type="range" min={0} max={200} value={userVolume} onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-600 accent-emerald-500 mx-2" style={{ width: 'calc(100% - 16px)' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

function VCallBtn({ active, onClick, icon: Icon, danger, label }: any) {
  return (
    <button onClick={onClick} title={label}
      className={`group relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 active:scale-90
        ${danger
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'
          : active
            ? 'bg-white/90 text-black hover:bg-white shadow-lg shadow-white/20'
            : 'bg-white/10 text-white hover:bg-white/20'}`}>
      <Icon className="h-6 w-6 transition-transform group-hover:scale-110" />
    </button>
  );
}

function SmBtn({ active, onClick, icon: Icon, danger }: any) {
  return (
    <button onClick={onClick}
      className={`group flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 active:scale-90
        ${danger
          ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
          : active
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
      <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
    </button>
  );
}

function SettingToggle({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="group flex w-full items-center justify-between rounded-lg p-2 hover:bg-white/5 transition-colors">
      <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">{label}</span>
      <div className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
        <div className={`absolute left-[2px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-[16px]' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}
