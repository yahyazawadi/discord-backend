import ServerModel from '../models/Server.js';

const formatReactions = (reactions, userId, isServerAdminOrOwner) => {
  if (!reactions) return [];
  return reactions.map(reaction => {
    const rxObj = reaction.toObject ? reaction.toObject() : reaction;
    if (isServerAdminOrOwner) {
      return rxObj;
    } else {
      return {
        emoji: rxObj.emoji,
        users: rxObj.users || [],
        anonymousReactors: (rxObj.anonymousReactors || []).map(r => {
          const isCurrentUser = r.realUserId && userId && r.realUserId.toString() === userId.toString();
          return {
            anonymousName: r.anonymousName,
            isMe: !!isCurrentUser
          };
        })
      };
    }
  });
};

export const formatMessage = (msg, userId, isServerAdminOrOwner) => {
  if (!msg) return msg;
  const msgObj = msg.toObject ? msg.toObject() : msg;
  
  if (msgObj.reactions) {
    msgObj.reactions = formatReactions(msgObj.reactions, userId, isServerAdminOrOwner);
  }

  if (msgObj.parentMessage) {
    msgObj.parentMessage = formatMessage(msgObj.parentMessage, userId, isServerAdminOrOwner);
  }
  
  if (msgObj.isSystem || !msgObj.isAnonymous) {
    return msgObj;
  }
  
  const senderId = msgObj.sender?._id || msgObj.sender;
  const isSender = senderId && senderId.toString() === userId.toString();
  
  if (isSender || isServerAdminOrOwner) {
    return msgObj;
  } else {
    return {
      ...msgObj,
      sender: {
        _id: senderId,
        username: 'anonymous',
        displayName: msgObj.anonymousSenderName || 'Anonymous Member',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msgObj.anonymousSenderName || 'anonymous')}`
      }
    };
  }
};

export const broadcastMessageToRoom = async (io, room, message, isServerMsg, serverId) => {
  try {
    const sockets = await io.in(room).fetchSockets();
    let server = null;
    if (isServerMsg && serverId) {
      server = await ServerModel.findById(serverId);
    }

    for (const s of sockets) {
      if (!s.user) continue;

      let isServerAdminOrOwner = false;
      if (server) {
        const isOwner = server.owner && server.owner.toString() === s.user._id.toString();
        const isAdmin = server.admins && server.admins.some(a => a && a.toString() === s.user._id.toString());
        isServerAdminOrOwner = !!(isOwner || isAdmin);
      }

      const formatted = formatMessage(message, s.user._id, isServerAdminOrOwner);
      s.emit('receive_message', formatted);
    }
  } catch (error) {
    console.error('Error broadcasting message to room:', error);
  }
};

export const broadcastMessageUpdateToRoom = async (io, room, message, isServerMsg, serverId) => {
  try {
    const sockets = await io.in(room).fetchSockets();
    let server = null;
    if (isServerMsg && serverId) {
      server = await ServerModel.findById(serverId);
    }

    for (const s of sockets) {
      if (!s.user) continue;

      let isServerAdminOrOwner = false;
      if (server) {
        const isOwner = server.owner && server.owner.toString() === s.user._id.toString();
        const isAdmin = server.admins && server.admins.some(a => a && a.toString() === s.user._id.toString());
        isServerAdminOrOwner = !!(isOwner || isAdmin);
      }

      const formatted = formatMessage(message, s.user._id, isServerAdminOrOwner);
      s.emit('message_updated', formatted);
    }
  } catch (error) {
    console.error('Error broadcasting message update to room:', error);
  }
};
