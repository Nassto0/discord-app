import { useCallStore } from '@/stores/callStore';
import { getSocket } from './useSocket';

// Build ICE config from env (TURN servers are needed for production behind NAT)
function buildIceConfig(): RTCConfiguration {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  // Add TURN server if configured (set VITE_TURN_URL, VITE_TURN_USER, VITE_TURN_PASS)
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USER || '',
      credential: import.meta.env.VITE_TURN_PASS || '',
    });
  }
  return { iceServers: servers };
}

const ICE_CONFIG = buildIceConfig();

let pc: RTCPeerConnection | null = null;
let audioEl: HTMLAudioElement | null = null;
let inputGainNode: GainNode | null = null;
let inputAudioCtx: AudioContext | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];
let activeCallId: string | null = null;
let activeTargetUserId: string | null = null;
// Track the live remote stream to attach listeners only once
let remoteBaseStream: MediaStream | null = null;
// Prevent concurrent renegotiations from causing offer/answer spirals
let isNegotiating = false;
// Output audio processing chain for volume boost (>100%)
let outputAudioCtx: AudioContext | null = null;
let outputGainNode: GainNode | null = null;
let outputSourceNode: MediaStreamAudioSourceNode | null = null;
let outputMediaDest: MediaStreamAudioDestinationNode | null = null;
let audioSettingsListenerBound = false;

// Mute the audio element whenever isDeafened toggles in the store
useCallStore.subscribe((state) => {
  if (audioEl) audioEl.muted = state.isDeafened;
});

// Forward output-volume and voice-processing changes from AudioSettings to live calls
async function switchInputDevice(deviceId: string) {
  if (!pc) return;
  const store = useCallStore.getState();
  const currentStream = store.localStream;
  if (!currentStream) return;

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined },
    });
    const newTrack = newStream.getAudioTracks()[0];
    const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
    if (sender) {
      // Stop old track, replace with new
      sender.track?.stop();
      await sender.replaceTrack(newTrack);
      // Update local stream reference
      const updated = new MediaStream([newTrack, ...currentStream.getVideoTracks()]);
      store.setLocalStream(updated);
    }
  } catch (err) {
    console.error('[WebRTC] input device switch failed:', err);
  }
}

function onAudioSettingsChanged(e: Event) {
  const { type, key, value } = (e as CustomEvent).detail;
  if (type === 'output-volume') {
    if (outputGainNode) outputGainNode.gain.value = Math.max(0, Math.min(2, value / 100));
  } else if (type === 'input-volume') {
    if (inputGainNode) inputGainNode.gain.value = Math.max(0, Math.min(2, value / 50));
  } else if (type === 'output-device') {
    // Switch output device on audio element (Chrome/Edge only)
    if (audioEl && typeof (audioEl as any).setSinkId === 'function') {
      (audioEl as any).setSinkId(value).catch(() => {});
    }
  } else if (type === 'input-device') {
    switchInputDevice(value);
  } else if (type === 'toggle') {
    const constraints: MediaTrackConstraints = {};
    if (key === 'echo-cancel') constraints.echoCancellation = value;
    if (key === 'noise-suppress') constraints.noiseSuppression = value;
    if (key === 'auto-gain') constraints.autoGainControl = value;
    if (Object.keys(constraints).length > 0) applyAudioConstraintsInternal(constraints);
  }
}
if (!audioSettingsListenerBound) {
  window.addEventListener('audio-settings-changed', onAudioSettingsChanged);
  audioSettingsListenerBound = true;
}

function applyAudioConstraintsInternal(constraints: MediaTrackConstraints) {
  const stream = useCallStore.getState().localStream;
  stream?.getAudioTracks().forEach((t) => t.applyConstraints(constraints).catch(() => {}));
}

function getSavedOutputVolume(): number {
  try {
    const saved = localStorage.getItem('call-user-volume');
    if (saved) return Math.max(0.1, Math.min(2, Number(saved) / 100));
  } catch {}
  return 1;
}

function cleanupWebRTC() {
  isNegotiating = false;
  if (pc) {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.onnegotiationneeded = null;
    try { pc.close(); } catch {}
    pc = null;
  }
  if (audioEl) {
    audioEl.pause();
    audioEl.srcObject = null;
    audioEl = null;
  }
  if (outputSourceNode) { try { outputSourceNode.disconnect(); } catch {} outputSourceNode = null; }
  if (outputGainNode) { try { outputGainNode.disconnect(); } catch {} outputGainNode = null; }
  outputMediaDest = null;
  if (outputAudioCtx) { try { outputAudioCtx.close(); } catch {} outputAudioCtx = null; }
  remoteBaseStream = null;
  pendingCandidates = [];
  activeTargetUserId = null;
  const socket = getSocket();
  if (socket) {
    socket.off('webrtc:offer');
    socket.off('webrtc:answer');
    socket.off('webrtc:ice-candidate');
  }
}

/** Pre-request mic/camera permissions before starting a call.
 *  Returns true if granted, false if denied. On mobile browsers the permission
 *  prompt must happen BEFORE the WebRTC flow or it gets auto-dismissed. */
export async function ensureMediaPermissions(callType: 'voice' | 'video'): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    });
    // Immediately stop all tracks — we just needed the permission grant
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err: any) {
    console.warn('[WebRTC] permission pre-check failed:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      alert('Microphone access is required for calls. Please allow microphone access in your browser settings and try again.');
    }
    return false;
  }
}

export async function startWebRTC(isInitiator: boolean, targetUserId: string) {
  const socket = getSocket();
  const store = useCallStore.getState();
  if (!socket || !store.callId) return;

  cleanupWebRTC();

  const callId = store.callId;
  activeCallId = callId;
  activeTargetUserId = targetUserId;

  // Flags to handle the race condition between media loading and receiving the offer
  let localStreamReady = false;
  let pendingOfferData: any = null;
  let isSetupComplete = false;

  pc = new RTCPeerConnection(ICE_CONFIG);
  store.setPeerConnection(pc);

  // Guard: only renegotiate after initial setup is done, preventing the receiver
  // from accidentally sending an unsolicited offer when addTrack() is called
  pc.onnegotiationneeded = async () => {
    if (!isSetupComplete || !pc || pc.signalingState !== 'stable' || isNegotiating) return;
    const tid = activeTargetUserId;
    const cid = activeCallId;
    if (!tid || !cid) return;
    isNegotiating = true;
    console.log('[WebRTC] renegotiating...');
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') { isNegotiating = false; return; }
      await pc.setLocalDescription(offer);
      getSocket()?.emit('webrtc:offer', { callId: cid, targetUserId: tid, sdp: offer });
    } catch (err) {
      console.error('[WebRTC] renegotiation error:', err);
    }
    // isNegotiating cleared when we receive the answer
  };

  // Helper: push a new MediaStream snapshot into Zustand so React re-renders
  const pushRemoteStream = (stream: MediaStream) => {
    useCallStore.getState().setRemoteStream(new MediaStream(stream.getTracks()));
  };

  pc.ontrack = (event) => {
    const remote = event.streams[0];
    if (!remote) return;

    // Attach stream-level listeners only once so track additions/removals trigger re-renders
    if (remoteBaseStream !== remote) {
      remoteBaseStream = remote;
      remote.addEventListener('addtrack', () => pushRemoteStream(remote));
      remote.addEventListener('removetrack', () => pushRemoteStream(remote));
    }

    // Track-level events: when screen share stops (track ends/mutes), update the store
    event.track.addEventListener('ended', () => pushRemoteStream(remote));
    event.track.addEventListener('mute', () => pushRemoteStream(remote));
    event.track.addEventListener('unmute', () => pushRemoteStream(remote));

    // Force a fresh object reference so Zustand detects the change
    pushRemoteStream(remote);

    // Route audio through a GainNode to support volume boost beyond 100%
    if (event.track.kind === 'audio') {
      if (!outputAudioCtx) {
        outputAudioCtx = new AudioContext();
        outputGainNode = outputAudioCtx.createGain();
        outputGainNode.gain.value = getSavedOutputVolume();
        outputMediaDest = outputAudioCtx.createMediaStreamDestination();
        outputGainNode.connect(outputMediaDest);
      }
      if (outputAudioCtx.state === 'suspended') outputAudioCtx.resume().catch(() => {});
      if (outputSourceNode) { try { outputSourceNode.disconnect(); } catch {} }
      outputSourceNode = outputAudioCtx.createMediaStreamSource(remote);
      outputSourceNode.connect(outputGainNode!);

      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        audioEl.muted = false;
      }
      if (audioEl.srcObject !== outputMediaDest!.stream) {
        audioEl.srcObject = outputMediaDest!.stream;
        audioEl.play().catch((e) => console.error('[WebRTC] autoplay blocked:', e));
      }
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc:ice-candidate', {
        callId,
        targetUserId,
        candidate: event.candidate.toJSON(),
      });
    }
  };

  pc.onconnectionstatechange = () => {
    const state = pc?.connectionState;
    console.log('[WebRTC] connection state:', state);
    if (state === 'connected') {
      useCallStore.getState().setConnected();
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log('[WebRTC] ICE state:', pc?.iceConnectionState);
    if (pc?.iceConnectionState === 'failed') {
      console.error('[WebRTC] ICE failed — check STUN reachability and candidate exchange');
    }
  };

  // Helper: process an incoming offer and send an answer
  const processOffer = async (data: any) => {
    if (!pc || pc.signalingState === 'closed') return;
    console.log('[WebRTC] processing offer');
    try {
      // Handle glare: if we're also trying to send an offer, roll back ours
      // Polite peer (non-initiator) always yields to incoming offers
      if (pc.signalingState === 'have-local-offer') {
        if (isInitiator) {
          // We're the initiator and we already sent an offer — ignore theirs
          console.log('[WebRTC] ignoring offer (we are initiator with pending offer)');
          return;
        }
        // We're not initiator — roll back our offer and accept theirs
        await pc.setLocalDescription({ type: 'rollback' });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      isNegotiating = false;

      for (const c of pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc:answer', {
        callId: data.callId,
        targetUserId,
        sdp: answer,
      });
      console.log('[WebRTC] sent answer');
    } catch (e) {
      console.error('[WebRTC] offer handling error:', e);
      isNegotiating = false;
    }
  };

  socket.on('webrtc:offer', async (data) => {
    // Queue the offer if local media isn't ready yet — ensures our tracks are
    // included in the generated answer and avoids a silent call
    if (!localStreamReady) {
      console.log('[WebRTC] offer queued until local media is ready');
      pendingOfferData = data;
      return;
    }
    await processOffer(data);
  });

  socket.on('webrtc:answer', async (data) => {
    if (!pc || pc.signalingState === 'closed') return;
    // Only accept answers when we're waiting for one
    if (pc.signalingState !== 'have-local-offer') {
      console.log('[WebRTC] ignoring answer (not in have-local-offer state)');
      return;
    }
    console.log('[WebRTC] received answer');
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      isNegotiating = false;
      for (const c of pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates = [];
    } catch (e) {
      console.error('[WebRTC] answer handling error:', e);
      isNegotiating = false;
    }
  });

  socket.on('webrtc:ice-candidate', async (data) => {
    if (!pc) return;
    if (!pc.remoteDescription) {
      pendingCandidates.push(data.candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.error('[WebRTC] ICE candidate error:', e);
    }
  });

  // Read all voice-processing settings from localStorage — all default to ON (true)
  // 'false' must be explicitly stored to disable any of them
  const echoCancel = localStorage.getItem('audio-echo-cancel') !== 'false';
  const noiseSuppress = localStorage.getItem('audio-noise-suppress') !== 'false';
  const autoGain = localStorage.getItem('audio-auto-gain') !== 'false';
  const savedSettings = localStorage.getItem('audio-settings');
  let inputDeviceId: string | undefined;
  if (savedSettings) {
    try {
      const s = JSON.parse(savedSettings);
      if (s.inputDevice && s.inputDevice !== 'default') inputDeviceId = s.inputDevice;
    } catch {}
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: inputDeviceId ? { ideal: inputDeviceId } : undefined,
        echoCancellation: echoCancel, // Reads from setting — defaults to true
        noiseSuppression: noiseSuppress,
        autoGainControl: autoGain,
        sampleRate: 48000,
        sampleSize: 16,
        channelCount: 2,
      },
      video: store.callType === 'video',
    });
  } catch (err: any) {
    console.error('[WebRTC] getUserMedia failed:', err);
    // If permission was denied or dismissed, don't silently hang up — let the user know
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      alert('Microphone access is required for calls. Please allow microphone access in your browser settings and try again.');
    }
    hangup();
    return;
  }

  if (useCallStore.getState().callId !== callId) {
    stream.getTracks().forEach((t) => t.stop());
    return;
  }

  store.setLocalStream(stream);
  // addTrack fires onnegotiationneeded but isSetupComplete is still false,
  // so the guard at the top of the handler prevents a spurious offer
  stream.getTracks().forEach((track) => pc!.addTrack(track, stream));
  localStreamReady = true;

  if (isInitiator) {
    console.log('[WebRTC] creating initial offer');
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { callId, targetUserId, sdp: offer });
      console.log('[WebRTC] sent offer');
    } catch (e) {
      console.error('[WebRTC] failed to create initial offer:', e);
    }
  } else {
    // Process any offer that arrived before our mic was ready
    if (pendingOfferData) {
      await processOffer(pendingOfferData);
      pendingOfferData = null;
    }
  }

  // From this point on, onnegotiationneeded is live for screen share renegotiation
  isSetupComplete = true;
}

export async function toggleScreenShare() {
  if (!pc) return;
  const store = useCallStore.getState();
  const currentStream = store.localStream;
  const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');

  if (store.isScreenSharing) {
    if (store.callType === 'video' && currentStream) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = camStream.getVideoTracks()[0];
        if (videoSender) await videoSender.replaceTrack(camTrack);

        // Clone the stream so Zustand detects the reference change and React re-renders
        const newStream = new MediaStream(currentStream.getTracks());
        newStream.getVideoTracks().forEach((t) => { t.stop(); newStream.removeTrack(t); });
        newStream.addTrack(camTrack);
        useCallStore.getState().setLocalStream(newStream);
      } catch {
        if (videoSender) await videoSender.replaceTrack(null);
      }
    } else {
      if (videoSender) await videoSender.replaceTrack(null);
    }
    useCallStore.setState({ isScreenSharing: false });
    return;
  }

  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const screenTrack = screenStream.getVideoTracks()[0];

    if (videoSender) {
      // replaceTrack doesn't trigger onnegotiationneeded — no extra signaling needed
      await videoSender.replaceTrack(screenTrack);
    } else {
      // addTrack will trigger onnegotiationneeded (isSetupComplete is true at this point)
      pc.addTrack(screenTrack, currentStream || screenStream);
    }

    screenTrack.onended = () => { toggleScreenShare(); };

    if (currentStream) {
      const newStream = new MediaStream(currentStream.getTracks());
      newStream.getVideoTracks().forEach((t) => { t.stop(); newStream.removeTrack(t); });
      newStream.addTrack(screenTrack);
      useCallStore.getState().setLocalStream(newStream);
    } else {
      useCallStore.getState().setLocalStream(screenStream);
    }

    useCallStore.setState({ isScreenSharing: true });
  } catch (err) {
    console.error('[WebRTC] screen share failed:', err);
  }
}

export function hangup(skipEmit = false) {
  const store = useCallStore.getState();
  if (store.status === 'idle' && !activeCallId) return;

  const socket = getSocket();
  const callId = store.callId || activeCallId;
  if (!skipEmit && socket && callId) {
    socket.emit('call:end', { callId });
  }
  activeCallId = null;
  cleanupWebRTC();
  store.cleanup();
}

export function acceptIncoming() {
  const socket = getSocket();
  const store = useCallStore.getState();
  if (!socket || !store.callId || !store.remoteUser) return;

  const remoteUserId = store.remoteUser.id;
  const callId = store.callId;
  socket.emit('call:accept', { callId });

  startWebRTC(false, remoteUserId);
}

export async function changeScreenSource() {
  if (!pc) return;
  try {
    const newStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const newTrack = newStream.getVideoTracks()[0];
    const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (videoSender) await videoSender.replaceTrack(newTrack);

    const store = useCallStore.getState();
    const currentStream = store.localStream;
    if (currentStream) {
      const updated = new MediaStream(currentStream.getTracks());
      updated.getVideoTracks().forEach((t) => { t.stop(); updated.removeTrack(t); });
      updated.addTrack(newTrack);
      store.setLocalStream(updated);
    }
    newTrack.onended = () => { toggleScreenShare(); };
  } catch (err) {
    console.error('[WebRTC] change screen source failed:', err);
  }
}

export function applyAudioConstraints(constraints: MediaTrackConstraints) {
  applyAudioConstraintsInternal(constraints);
}

export async function toggleCameraForVoiceCall() {
  if (!pc) return;
  const store = useCallStore.getState();
  const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');

  if (videoSender) {
    // Camera is on — turn it off
    videoSender.track?.stop();
    pc.removeTrack(videoSender);
    const current = store.localStream;
    if (current) store.setLocalStream(new MediaStream(current.getAudioTracks()));
    return;
  }

  // Camera is off — turn it on
  try {
    const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    const track = cam.getVideoTracks()[0];
    const current = store.localStream;
    pc.addTrack(track, current || cam);
    track.onended = () => toggleCameraForVoiceCall();
    const tracks = [...(current?.getTracks() ?? []), track];
    store.setLocalStream(new MediaStream(tracks));
  } catch (err) {
    console.error('[WebRTC] camera toggle failed:', err);
  }
}

export async function getCallStats(): Promise<{ rtt: number | null }> {
  if (!pc) return { rtt: null };
  try {
    const stats = await pc.getStats();
    let rtt: number | null = null;
    stats.forEach((report: any) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime !== undefined) {
        rtt = Math.round(report.currentRoundTripTime * 1000);
      }
    });
    return { rtt };
  } catch { return { rtt: null }; }
}

export function rejectIncoming() {
  const socket = getSocket();
  const store = useCallStore.getState();
  if (socket && store.callId) {
    socket.emit('call:reject', { callId: store.callId });
  }
  activeCallId = null;
  store.cleanup();
}
