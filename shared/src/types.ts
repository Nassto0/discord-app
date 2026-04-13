export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  status: UserStatus;
  lastSeen: string;
  createdAt: string;
}

export type UserStatus = 'online' | 'offline' | 'away' | 'dnd';

export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  name: string | null;
  avatar: string | null;
  createdBy: string;
  createdAt: string;
  members: ConversationMember[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface ConversationMember {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  user: User;
}

export type MessageType = 'text' | 'image' | 'video' | 'voice';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: User;
  content: string | null;
  type: MessageType;
  fileUrl: string | null;
  fileDuration: number | null;
  replyToId: string | null;
  replyTo: Message | null;
  createdAt: string;
  readBy: string[];
}

export interface CallSession {
  id: string;
  conversationId: string;
  type: 'voice' | 'video';
  startedBy: string;
  startedAt: string;
  endedAt: string | null;
  participants: string[];
}

// Socket event types
export interface ServerToClientEvents {
  'message:received': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (data: { messageId: string; conversationId: string }) => void;
  'typing:start': (data: { conversationId: string; userId: string; username: string }) => void;
  'typing:stop': (data: { conversationId: string; userId: string }) => void;
  'presence:update': (data: { userId: string; status: UserStatus }) => void;
  'conversation:created': (conversation: Conversation) => void;
  'conversation:updated': (conversation: Conversation) => void;
  'call:incoming': (data: CallSignal) => void;
  'call:accepted': (data: { callId: string; userId: string }) => void;
  'call:rejected': (data: { callId: string; userId: string }) => void;
  'call:ended': (data: { callId: string }) => void;
  'webrtc:offer': (data: { callId: string; sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:answer': (data: { callId: string; sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { callId: string; candidate: RTCIceCandidateInit }) => void;
}

export interface ClientToServerEvents {
  'message:send': (data: { conversationId: string; content: string | null; type: MessageType; fileUrl: string | null; replyToId: string | null }, cb: (msg: Message) => void) => void;
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;
  'conversation:join': (conversationId: string) => void;
  'conversation:leave': (conversationId: string) => void;
  'call:initiate': (data: { conversationId: string; type: 'voice' | 'video' }, cb: (call: CallSession) => void) => void;
  'call:accept': (data: { callId: string }) => void;
  'call:reject': (data: { callId: string }) => void;
  'call:end': (data: { callId: string }) => void;
  'webrtc:offer': (data: { callId: string; targetUserId: string; sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:answer': (data: { callId: string; targetUserId: string; sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { callId: string; targetUserId: string; candidate: RTCIceCandidateInit }) => void;
}

export interface CallSignal {
  callId: string;
  conversationId: string;
  type: 'voice' | 'video';
  caller: User;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  code?: string;
}
