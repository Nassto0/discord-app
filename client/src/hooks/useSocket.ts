import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore, getStoredCall } from '@/stores/callStore';
import { sounds, showNotification, requestNotificationPermission } from '@/lib/sounds';
import { api } from '@/lib/api';
import { startWebRTC, hangup } from './useWebRTC';

let globalSocket: Socket | null = null;

export function getSocket(): Socket | null {
  return globalSocket;
}

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    requestNotificationPermission();

    const serverUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/');
    const socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    globalSocket = socket;

    socket.on('connect', async () => {
      console.log('Socket connected');
      try {
        const onlineIds = await api.online();
        useChatStore.getState().setOnlineUsers(onlineIds);
      } catch {}

      // Attempt to rejoin a call that was active before a page refresh
      const stored = getStoredCall();
      if (stored) {
        console.log('[Call] Attempting to rejoin call:', stored.callId);
        socket.emit('call:rejoin', { callId: stored.callId });
      }
    });

    socket.on('message:received', (message) => {
      useChatStore.getState().addMessage(message);
      const activeConvId = useChatStore.getState().activeConversationId;
      if (message.senderId !== user?.id && message.type !== 'system') {
        if (activeConvId === message.conversationId) {
          socket.emit('message:read', { conversationId: message.conversationId });
        } else {
          useChatStore.getState().incrementUnread(message.conversationId);
        }
        sounds.messageReceived();
        if (document.hidden) {
          showNotification(message.sender.username,
            message.type === 'voice' ? 'Sent a voice message' : message.type === 'image' ? 'Sent a photo' : message.content || '');
        }
      }
    });

    socket.on('message:deleted', (data) => useChatStore.getState().deleteMessage(data.messageId, data.conversationId));
    socket.on('message:reacted', (data) => useChatStore.getState().updateReactions(data.messageId, data.conversationId, data.reactions));
    socket.on('message:read', (data) => {
      if (data?.conversationId && data?.userId) {
        useChatStore.getState().markRead(data.conversationId, data.userId);
      }
    });

    socket.on('typing:start', (data) => useChatStore.getState().setTyping(data.conversationId, data.userId, data.username, true));
    socket.on('typing:stop', (data) => useChatStore.getState().setTyping(data.conversationId, data.userId, '', false));
    socket.on('presence:update', (data) => {
      useChatStore.getState().setUserOnline(data.userId, data.status !== 'offline');
      useChatStore.getState().setUserStatus(data.userId, data.status);
    });

    socket.on('conversation:created', (conv) => {
      useChatStore.getState().addConversation(conv);
      socket.emit('conversation:join', conv.id);
    });

    socket.on('call:incoming', (data) => {
      const callStore = useCallStore.getState();
      if (callStore.status !== 'idle') return;
      callStore.receiveIncoming(data.callId, data.type, data.conversationId, data.caller);
      sounds.callRinging();
      showNotification('Incoming Call', `${data.caller.username} is calling...`);
    });

    socket.on('call:accepted', (data) => {
      const callStore = useCallStore.getState();
      if (callStore.callId !== data.callId) return;
      if (callStore.status !== 'outgoing') return;
      const remoteUserId = callStore.remoteUser?.id;
      if (remoteUserId) {
        startWebRTC(true, remoteUserId);
      }
    });

    socket.on('call:rejected', (data) => {
      const callStore = useCallStore.getState();
      if (data?.callId && callStore.callId !== data.callId) return;
      callStore.cleanup();
      sounds.callEnd();
    });

    socket.on('call:ended', (data) => {
      const callStore = useCallStore.getState();
      if (!data?.callId) return;
      if (callStore.callId !== data.callId) return;
      hangup(true);
      sounds.callEnd();
    });

    // Rejoin acknowledged — the call is still active, restore state and reconnect WebRTC
    socket.on('call:rejoin_ack', async (data) => {
      const stored = getStoredCall();
      if (!stored) return;
      console.log('[Call] Rejoin acknowledged, restoring call...');
      const callStore = useCallStore.getState();
      callStore.restoreConnected(data.callId, data.callType, data.conversationId, stored.remoteUser);
      // Rejoin user sends fresh offers to all current participants
      for (const remoteUserId of (data.participants as string[])) {
        await startWebRTC(true, remoteUserId);
      }
    });

    // A peer rejoined — tear down our side and wait for their new offer
    socket.on('call:peer_rejoined', async (data) => {
      const callStore = useCallStore.getState();
      if (callStore.callId !== data.callId) return;
      console.log('[Call] Peer rejoined, resetting WebRTC as receiver...');
      await startWebRTC(false, data.userId);
    });

    // Rejoin failed (call has ended) — clear the stored session
    socket.on('call:rejoin_failed', () => {
      console.log('[Call] Rejoin failed, call has ended');
      getStoredCall(); // just to check it exists
      useCallStore.getState().cleanup(); // also clears sessionStorage
    });

    socket.on('conversation:updated', (conv) => {
      useChatStore.getState().updateConversation(conv);
    });

    socket.on('conversation:removed', (data) => {
      if (data?.conversationId) {
        useChatStore.getState().removeConversation(data.conversationId);
      }
    });

    return () => {
      socket.disconnect();
      globalSocket = null;
    };
  }, [token, user?.id]);

  return socketRef;
}
