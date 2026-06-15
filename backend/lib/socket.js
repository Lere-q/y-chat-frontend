import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'y-chat-secret-key-change-in-production'

let io = null
const onlineUsers = new Map()
const userSockets = new Map()

export function getUserSockets(userId) {
  return Array.from(userSockets.get(userId) || [])
}

export function getIO() {
  return io
}

export function initIO(httpServer) {
  if (io) return io

  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token
      if (!token) {
        return next(new Error('Unauthorized'))
      }

      const decoded = jwt.verify(token, JWT_SECRET)
      if (!decoded?.id) {
        return next(new Error('Unauthorized'))
      }

      socket.data.userId = decoded.id
      socket.data.userName = decoded.name || 'Unknown'
      socket.data.userImage = decoded.image || null
      next()
    } catch (err) {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.data.userId

    if (!userSockets.has(userId)) userSockets.set(userId, new Set())
    userSockets.get(userId).add(socket.id)

    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) userSockets.delete(userId)
      }
    })

    socket.on('presence:ping', () => {
      onlineUsers.set(userId, {
        lastPing: Date.now(),
        user: { id: userId, name: socket.data.userName, image: socket.data.userImage },
      })
    })

    socket.on('join:feed', async () => {
      socket.join('feed')
      const { prisma } = await import('./prisma.js')
      const convs = await prisma.conversation.findMany({
        where: { participants: { some: { userId, deletedAt: null } } },
        select: { id: true },
      })
      convs.forEach((c) => socket.join(`conversation:${c.id}`))
    })

    socket.on('leave:feed', () => {
      socket.leave('feed')
    })

    socket.on('join:community', (slug) => {
      socket.join(`community:${slug}`)
    })

    socket.on('join:conversation', async (conversationId) => {
      try {
        const { prisma } = await import('./prisma.js')
        const participant = await prisma.conversationParticipant.findUnique({
          where: { userId_conversationId: { userId, conversationId } },
        })
        if (participant) {
          socket.join(`conversation:${conversationId}`)
        } else {
          socket.emit('error', { message: 'Kein Mitglied dieser Konversation' })
        }
      } catch (err) {
        socket.emit('error', { message: 'Conversation check failed' })
      }
    })

    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`)
    })

    socket.on('message:send', async (payload) => {
      try {
        const { z } = await import('zod')
        const { prisma } = await import('./prisma.js')

        const schema = z.object({
          conversationId: z.string(),
          content: z.string().min(1).max(2000),
        })

        const parsed = schema.safeParse(payload)
        if (!parsed.success) {
          socket.emit('error', { message: 'Ungültige Nachricht' })
          return
        }

        const { conversationId, content } = parsed.data

        const participant = await prisma.conversationParticipant.findUnique({
          where: { userId_conversationId: { userId, conversationId } },
        })

        if (!participant) {
          socket.emit('error', { message: 'Kein Mitglied dieser Konversation' })
          return
        }

        const otherParticipant = await prisma.conversationParticipant.findFirst({
          where: { conversationId, userId: { not: userId } },
        })

        const message = await prisma.message.create({
          data: { content, senderId: userId, conversationId },
          select: {
            id: true, content: true, createdAt: true, readAt: true,
            sender: { select: { id: true, name: true, image: true } },
            conversationId: true,
          },
        })

        const msg = {
          ...message,
          createdAt: message.createdAt.toISOString(),
          readAt: message.readAt?.toISOString() || null,
        }

        if (otherParticipant?.deletedAt) {
          await prisma.conversationParticipant.update({
            where: { userId_conversationId: { userId: otherParticipant.userId, conversationId } },
            data: { deletedAt: null, clearedAt: otherParticipant.deletedAt },
          })
        }

        io.to(`conversation:${conversationId}`).emit('dm:new', msg)

        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
          select: { userId: true },
        })
        participants.forEach((p) => {
          const sockets = userSockets.get(p.userId)
          if (sockets) {
            sockets.forEach((sid) => {
              const sock = io.sockets.sockets.get(sid)
              if (sock && !sock.rooms.has(`conversation:${conversationId}`)) {
                sock.emit('dm:new', msg)
              }
            })
          }
        })
      } catch (err) {
        socket.emit('error', { message: 'Nachricht konnte nicht gesendet werden' })
      }
    })
  })

  setInterval(() => {
    const now = Date.now()
    Array.from(onlineUsers.entries()).forEach(([id, data]) => {
      if (now - data.lastPing > 30000) {
        onlineUsers.delete(id)
      }
    })
    const users = Array.from(onlineUsers.values()).map((u) => u.user)
    io.emit('presence:update', users)
  }, 5000)

  console.log('[Socket] IO initialized')
  return io
}
