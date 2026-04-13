import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const onlineUsers = new Map<string, Set<string>>();

function getUserId(socket: Socket): string {
  return (socket as any).userId;
}

export function getOnlineUsers(): string[] {
  return [...onlineUsers.keys()];
}

function serializeUser(u: any) {
  return {
    ...u,
    lastSeen: u.lastSeen instanceof Date ? u.lastSeen.toISOString() : u.lastSeen,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
  };
}

function serializeMessage(m: any) {
  return {
    ...m,
    readBy: typeof m.readBy === 'string' ? JSON.parse(m.readBy) : m.readBy,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    editedAt: m.editedAt instanceof Date ? m.editedAt.toISOString() : (m.editedAt || null),
    sender: serializeUser(m.sender),
    replyTo: m.replyTo ? {
      ...m.replyTo,
      readBy: typeof m.replyTo.readBy === 'string' ? JSON.parse(m.replyTo.readBy) : m.replyTo.readBy,
      createdAt: m.replyTo.createdAt instanceof Date ? m.replyTo.createdAt.toISOString() : m.replyTo.createdAt,
      editedAt: m.replyTo.editedAt instanceof Date ? m.replyTo.editedAt.toISOString() : (m.replyTo.editedAt || null),
      sender: serializeUser(m.replyTo.sender),
      replyTo: null,
    } : null,
  };
}

const userSelect = { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true, presence: true, bio: true, banner: true, customStatus: true, links: true, badges: true };

export function setupSocketHandlers(io: Server) {
  io.on('connection', async (socket) => {
    const userId = getUserId(socket);
    console.log(`User connected: ${userId} (${socket.id})`);

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { presence: true } });
    const userPresence = userRecord?.presence || 'online';
    const effectiveStatus = userPresence === 'invisible' ? 'offline' : userPresence;

    await prisma.user.update({
      where: { id: userId },
      data: { status: effectiveStatus, lastSeen: new Date() },
    });

    io.emit('presence:update', { userId, status: effectiveStatus });

    // Send current presences of all OTHER online users to this new socket
    // so the client immediately knows idle/dnd/etc. without waiting for changes
    const otherOnlineIds = [...onlineUsers.keys()].filter((id) => id !== userId);
    if (otherOnlineIds.length > 0) {
      const presences = await prisma.user.findMany({
        where: { id: { in: otherOnlineIds } },
        select: { id: true, presence: true },
      });
      for (const u of presences) {
        const st = u.presence === 'invisible' ? 'offline' : (u.presence || 'online');
        socket.emit('presence:update', { userId: u.id, status: st });
      }
    }

    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    for (const c of memberships) {
      socket.join(`conv:${c.conversationId}`);
    }

    socket.on('message:send', async (data, callback) => {
      try {
        const { conversationId, content, type, fileUrl, replyToId, fileDuration } = data;

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content: content || null,
            type: type || 'text',
            fileUrl: fileUrl || null,
            fileDuration: fileDuration || null,
            replyToId: replyToId || null,
            readBy: JSON.stringify([userId]),
          },
          include: {
            sender: { select: userSelect },
            replyTo: { include: { sender: { select: userSelect } } },
          },
        });

        const serialized = serializeMessage(message);

        io.to(`conv:${conversationId}`).emit('message:received', serialized);
        if (callback) callback(serialized);
      } catch (error) {
        console.error('Message send error:', error);
      }
    });

    socket.on('message:read', async (data) => {
      try {
        const { conversationId } = data;
        // Only fetch messages NOT already read by this user (much faster)
        const unread = await prisma.message.findMany({
          where: {
            conversationId,
            senderId: { not: userId },
            NOT: { readBy: { contains: userId } },
          },
        });
        if (unread.length > 0) {
          await prisma.$transaction(
            unread.map((msg) => {
              const readBy: string[] = JSON.parse(msg.readBy);
              readBy.push(userId);
              return prisma.message.update({ where: { id: msg.id }, data: { readBy: JSON.stringify(readBy) } });
            }),
          );
        }
        socket.to(`conv:${conversationId}`).emit('message:read', { conversationId, userId });
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    socket.on('post:new', (post) => {
      socket.broadcast.emit('post:new', post);
    });

    socket.on('post:liked', (data) => {
      socket.broadcast.emit('post:liked', { ...data, userId });
    });

    socket.on('post:commented', (data) => {
      socket.broadcast.emit('post:commented', data);
    });

    socket.on('post:deleted', (data) => {
      socket.broadcast.emit('post:deleted', data);
    });

    socket.on('message:edit', async (data) => {
      try {
        const { messageId, conversationId, content } = data;
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (msg && msg.senderId === userId && msg.type === 'text') {
          const updated = await prisma.message.update({
            where: { id: messageId },
            data: { content, editedAt: new Date() },
            include: { sender: { select: userSelect }, replyTo: { include: { sender: { select: userSelect } } } },
          });
          io.to(`conv:${conversationId}`).emit('message:edited', serializeMessage(updated));
        }
      } catch (error) {
        console.error('Message edit error:', error);
      }
    });

    socket.on('message:delete', async (data) => {
      try {
        const { messageId, conversationId } = data;
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (msg && msg.senderId === userId) {
          await prisma.message.delete({ where: { id: messageId } });
          io.to(`conv:${conversationId}`).emit('message:deleted', { messageId, conversationId });
        }
      } catch (error) {
        console.error('Message delete error:', error);
      }
    });

    socket.on('message:react', async (data) => {
      try {
        const { messageId, conversationId, emoji } = data;

        const updated = await prisma.$transaction(async (tx) => {
          const msg = await tx.message.findUnique({ where: { id: messageId } });
          if (!msg) return null;

          let reactions: Record<string, string[]> = {};
          try { reactions = JSON.parse(msg.reactions || '{}'); } catch {}

          if (!reactions[emoji]) reactions[emoji] = [];
          const idx = reactions[emoji].indexOf(userId);
          if (idx >= 0) {
            reactions[emoji].splice(idx, 1);
            if (reactions[emoji].length === 0) delete reactions[emoji];
          } else {
            reactions[emoji].push(userId);
          }

          await tx.message.update({
            where: { id: messageId },
            data: { reactions: JSON.stringify(reactions) },
          });

          return reactions;
        });

        if (updated !== null) {
          io.to(`conv:${conversationId}`).emit('message:reacted', { messageId, conversationId, reactions: updated });
        }
      } catch (error) {
        console.error('Message react error:', error);
      }
    });

    socket.on('typing:start', async (data) => {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
      socket.to(`conv:${data.conversationId}`).emit('typing:start', {
        conversationId: data.conversationId,
        userId,
        username: user?.username || '',
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(`conv:${data.conversationId}`).emit('typing:stop', {
        conversationId: data.conversationId,
        userId,
      });
    });

    socket.on('presence:set', async (data) => {
      const { presence } = data;
      const effectiveStatus = presence === 'invisible' ? 'offline' : presence;
      await prisma.user.update({ where: { id: userId }, data: { status: effectiveStatus, presence } });
      io.emit('presence:update', { userId, status: effectiveStatus });
    });

    socket.on('conversation:join', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('conversation:created', async (data) => {
      const { conversationId, memberIds } = data;
      for (const memberId of memberIds) {
        const memberSockets = onlineUsers.get(memberId);
        if (memberSockets) {
          for (const sid of memberSockets) {
            const targetSocket = io.sockets.sockets.get(sid);
            if (targetSocket) {
              targetSocket.join(`conv:${conversationId}`);
            }
          }
        }
      }

      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          members: { include: { user: { select: userSelect } } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: userSelect } },
          },
        },
      });

      if (conv) {
        const result = {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          avatar: conv.avatar,
          createdBy: conv.createdBy,
          createdAt: conv.createdAt.toISOString(),
          members: conv.members.map((m) => ({
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt.toISOString(),
            user: serializeUser(m.user),
          })),
          lastMessage: null,
          unreadCount: 0,
        };

        for (const memberId of memberIds) {
          if (memberId !== userId) {
            const memberSockets = onlineUsers.get(memberId);
            if (memberSockets) {
              for (const sid of memberSockets) {
                io.to(sid).emit('conversation:created', result);
              }
            }
          }
        }
      }
    });

    socket.on('call:initiate', async (data, callback) => {
      try {
        const { conversationId, type } = data;
        console.log(`[Call] ${userId} initiating ${type} call in ${conversationId}`);

        const members = await prisma.conversationMember.findMany({
          where: { conversationId },
          select: { userId: true },
        });

        const call = await prisma.callSession.create({
          data: {
            conversationId,
            type,
            startedBy: userId,
            participants: JSON.stringify([userId]),
          },
        });

        const caller = await prisma.user.findUnique({
          where: { id: userId },
          select: userSelect,
        });

        for (const member of members) {
          if (member.userId !== userId) {
            const sockets = onlineUsers.get(member.userId);
            if (sockets) {
              for (const sid of sockets) {
                io.to(sid).emit('call:incoming', {
                  callId: call.id,
                  conversationId,
                  type,
                  caller: serializeUser(caller!),
                });
              }
            }
          }
        }

        const callResult = {
          id: call.id,
          conversationId: call.conversationId,
          type: call.type,
          startedBy: call.startedBy,
          startedAt: call.startedAt.toISOString(),
          endedAt: null,
          participants: [userId],
        };

        if (callback) callback(callResult);
      } catch (error) {
        console.error('Call initiate error:', error);
      }
    });

    socket.on('call:accept', async (data) => {
      const { callId } = data;
      console.log(`[Call] ${userId} accepting call ${callId}`);
      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call) return;

      const participants = JSON.parse(call.participants);
      if (!participants.includes(userId)) {
        participants.push(userId);
        await prisma.callSession.update({
          where: { id: callId },
          data: { participants: JSON.stringify(participants) },
        });
      }

      const starterSockets = onlineUsers.get(call.startedBy);
      if (starterSockets) {
        for (const sid of starterSockets) {
          io.to(sid).emit('call:accepted', { callId, userId });
        }
      }
    });

    socket.on('call:reject', async (data) => {
      const { callId } = data;
      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call) return;

      await prisma.callSession.update({
        where: { id: callId },
        data: { endedAt: new Date() },
      });

      const starterSockets = onlineUsers.get(call.startedBy);
      if (starterSockets) {
        for (const sid of starterSockets) {
          io.to(sid).emit('call:rejected', { callId, userId });
        }
      }

      await createCallMessage(call.conversationId, userId, call.type, 'missed', io);
    });

    socket.on('call:rejoin', async (data) => {
      const { callId } = data;
      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call || call.endedAt) {
        socket.emit('call:rejoin_failed', { callId });
        return;
      }

      const participants: string[] = JSON.parse(call.participants);
      // Add rejoining user if not already in participants
      if (!participants.includes(userId)) {
        participants.push(userId);
        await prisma.callSession.update({ where: { id: callId }, data: { participants: JSON.stringify(participants) } });
      }

      // Notify other participants so they can reset WebRTC and receive a new offer
      for (const participantId of participants) {
        if (participantId === userId) continue;
        const sockets = onlineUsers.get(participantId);
        if (sockets) {
          for (const sid of sockets) {
            io.to(sid).emit('call:peer_rejoined', { callId, userId, callType: call.type });
          }
        }
      }

      // Send ack with participant list to the rejoining user
      const otherParticipants = participants.filter((p) => p !== userId);
      socket.emit('call:rejoin_ack', {
        callId,
        callType: call.type,
        conversationId: call.conversationId,
        participants: otherParticipants,
      });
      console.log(`[Call] ${userId} rejoined call ${callId}`);
    });

    socket.on('call:end', async (data) => {
      const { callId } = data;
      console.log(`[Call] ${userId} ending call ${callId}`);
      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call || call.endedAt) return;

      const duration = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);
      await prisma.callSession.update({
        where: { id: callId },
        data: { endedAt: new Date() },
      });

      const members = await prisma.conversationMember.findMany({
        where: { conversationId: call.conversationId },
        select: { userId: true },
      });
      for (const member of members) {
        if (member.userId === userId) continue;
        const sockets = onlineUsers.get(member.userId);
        if (sockets) {
          for (const sid of sockets) {
            io.to(sid).emit('call:ended', { callId });
          }
        }
      }

      await createCallMessage(call.conversationId, call.startedBy, call.type, 'ended', io, duration);
    });

    socket.on('group:member-added', async (data) => {
      const { conversationId, userId: addedUserId } = data;
      const addedSockets = onlineUsers.get(addedUserId);
      if (addedSockets) {
        for (const sid of addedSockets) {
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) targetSocket.join(`conv:${conversationId}`);
        }
      }
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: { include: { user: { select: userSelect } } } },
      });
      if (conv) {
        const result = {
          id: conv.id, type: conv.type, name: conv.name, avatar: conv.avatar, createdBy: conv.createdBy,
          createdAt: conv.createdAt.toISOString(),
          members: conv.members.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt.toISOString(), user: serializeUser(m.user) })),
          lastMessage: null, unreadCount: 0,
        };
        if (addedSockets) {
          for (const sid of addedSockets) {
            io.to(sid).emit('conversation:created', result);
          }
        }
        socket.to(`conv:${conversationId}`).emit('conversation:updated', result);
      }
    });

    socket.on('group:member-removed', async (data) => {
      const { conversationId, userId: removedUserId } = data;
      const removedSockets = onlineUsers.get(removedUserId);
      if (removedSockets) {
        for (const sid of removedSockets) {
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) targetSocket.leave(`conv:${conversationId}`);
          io.to(sid).emit('conversation:removed', { conversationId });
        }
      }
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: { include: { user: { select: userSelect } } } },
      });
      if (conv) {
        const result = {
          id: conv.id, type: conv.type, name: conv.name, avatar: conv.avatar, createdBy: conv.createdBy,
          createdAt: conv.createdAt.toISOString(),
          members: conv.members.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt.toISOString(), user: serializeUser(m.user) })),
        };
        socket.to(`conv:${conversationId}`).emit('conversation:updated', result);
      }
    });

    socket.on('group:member-left', async (data) => {
      const { conversationId } = data;
      socket.leave(`conv:${conversationId}`);
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: { include: { user: { select: userSelect } } } },
      });
      if (conv) {
        const result = {
          id: conv.id, type: conv.type, name: conv.name, avatar: conv.avatar, createdBy: conv.createdBy,
          createdAt: conv.createdAt.toISOString(),
          members: conv.members.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt.toISOString(), user: serializeUser(m.user) })),
        };
        socket.to(`conv:${conversationId}`).emit('conversation:updated', result);
      }
    });

    socket.on('webrtc:offer', (data) => {
      const { callId, targetUserId, sdp } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('webrtc:offer', { callId, sdp, fromUserId: userId });
        }
      }
    });

    socket.on('webrtc:answer', (data) => {
      const { callId, targetUserId, sdp } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('webrtc:answer', { callId, sdp, fromUserId: userId });
        }
      }
    });

    socket.on('webrtc:ice-candidate', (data) => {
      const { callId, targetUserId, candidate } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('webrtc:ice-candidate', { callId, candidate, fromUserId: userId });
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId} (${socket.id})`);
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await prisma.user.update({
            where: { id: userId },
            data: { status: 'offline', lastSeen: new Date() },
          });
          io.emit('presence:update', { userId, status: 'offline' });
        }
      }
    });
  });
}

async function createCallMessage(
  conversationId: string,
  senderId: string,
  callType: string,
  status: string,
  io: Server,
  duration?: number,
) {
  const content = status === 'missed'
    ? `Missed ${callType} call`
    : `${callType.charAt(0).toUpperCase() + callType.slice(1)} call ended${duration ? ` (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})` : ''}`;

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      type: 'system',
      readBy: JSON.stringify([]),
    },
    include: {
      sender: { select: userSelect },
      replyTo: { include: { sender: { select: userSelect } } },
    },
  });

  io.to(`conv:${conversationId}`).emit('message:received', serializeMessage(message));
}
