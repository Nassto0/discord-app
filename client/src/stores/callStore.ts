import { create } from 'zustand';

interface CallUser {
  id: string;
  username: string;
  avatar: string | null;
}

// 'reconnecting' = refreshed mid-call; peerConnection is being re-established
// UI should stay visible but not trigger hangup on missing peerConnection
type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'reconnecting';

interface CallState {
  callId: string | null;
  callType: 'voice' | 'video' | null;
  status: CallStatus;
  conversationId: string | null;
  remoteUser: CallUser | null;
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  elapsed: number;

  initiateCall: (callId: string, type: 'voice' | 'video', conversationId: string, remoteUser: CallUser) => void;
  receiveIncoming: (callId: string, type: 'voice' | 'video', conversationId: string, caller: CallUser) => void;
  setConnected: () => void;
  restoreConnected: (callId: string, type: 'voice' | 'video', conversationId: string, remoteUser: CallUser) => void;
  cleanup: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setLocalStream: (s: MediaStream | null) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  setPeerConnection: (pc: RTCPeerConnection | null) => void;
  tick: () => void;
}

function saveCallSession(callId: string, callType: string, conversationId: string, remoteUser: CallUser, connectedAt?: number) {
  try {
    sessionStorage.setItem('activeCall', JSON.stringify({
      callId, callType, conversationId, remoteUser,
      connectedAt: connectedAt ?? Date.now(),
    }));
  } catch {}
}

function clearCallSession() {
  try { sessionStorage.removeItem('activeCall'); } catch {}
}

export function getStoredCall(): { callId: string; callType: 'voice' | 'video'; conversationId: string; remoteUser: CallUser; connectedAt: number } | null {
  try {
    const raw = sessionStorage.getItem('activeCall');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export const useCallStore = create<CallState>((set, get) => ({
  callId: null,
  callType: null,
  status: 'idle',
  conversationId: null,
  remoteUser: null,
  isMuted: false,
  isDeafened: false,
  isScreenSharing: false,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  elapsed: 0,

  initiateCall: (callId, type, conversationId, remoteUser) => {
    if (get().status !== 'idle') return;
    set({ callId, callType: type, status: 'outgoing', conversationId, remoteUser, isMuted: false, isDeafened: false, isScreenSharing: false, elapsed: 0 });
  },

  receiveIncoming: (callId, type, conversationId, caller) => {
    if (get().status !== 'idle') return;
    set({ callId, callType: type, status: 'incoming', conversationId, remoteUser: caller, isMuted: false, isDeafened: false, isScreenSharing: false, elapsed: 0 });
  },

  setConnected: () => {
    const { callId, callType, conversationId, remoteUser, status } = get();
    const stored = getStoredCall();
    // When transitioning from 'reconnecting', preserve the original connectedAt
    const isRejoin = status === 'reconnecting';
    const connectedAt = isRejoin && stored?.connectedAt ? stored.connectedAt : Date.now();
    const elapsed = isRejoin && stored?.connectedAt
      ? Math.max(0, Math.floor((Date.now() - stored.connectedAt) / 1000))
      : 0;
    if (callId && callType && conversationId && remoteUser) {
      saveCallSession(callId, callType, conversationId, remoteUser, connectedAt);
    }
    set({ status: 'connected', elapsed });
  },

  restoreConnected: (callId, type, conversationId, remoteUser) => {
    const stored = getStoredCall();
    const connectedAt = stored?.connectedAt ?? Date.now();
    const elapsed = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
    saveCallSession(callId, type, conversationId, remoteUser, connectedAt);
    // Use 'reconnecting' — NOT 'connected' — so the UI doesn't treat a null
    // peerConnection as a broken call and trigger an automatic hangup.
    // Streams and peerConnection are intentionally left at their defaults (null)
    // since startWebRTC will create new ones. They are not zeroed out here so that
    // any existing valid streams from a previous hot-reload are preserved.
    set({
      callId,
      callType: type,
      status: 'reconnecting',
      conversationId,
      remoteUser,
      elapsed,
      isMuted: false,
      isDeafened: false,
      isScreenSharing: false,
    });
  },

  cleanup: () => {
    clearCallSession();
    const { localStream, peerConnection } = get();
    localStream?.getTracks().forEach((t) => t.stop());
    peerConnection?.close();
    set({
      callId: null, callType: null, status: 'idle', conversationId: null, remoteUser: null,
      isMuted: false, isDeafened: false, isScreenSharing: false,
      localStream: null, remoteStream: null, peerConnection: null, elapsed: 0,
    });
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    localStream?.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    set({ isMuted: !isMuted });
  },

  toggleDeafen: () => {
    const { remoteStream, isDeafened } = get();
    remoteStream?.getAudioTracks().forEach((t) => (t.enabled = isDeafened));
    set({ isDeafened: !isDeafened });
  },

  setLocalStream: (s) => set({ localStream: s }),
  setRemoteStream: (s) => set({ remoteStream: s }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  tick: () => set((s) => ({ elapsed: s.elapsed + 1 })),
}));
