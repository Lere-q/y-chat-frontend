import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../lib/auth.js'
import { getIO } from '../lib/socket.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId, deletedAt: null } },
        messages: { some: {} },
      },
      include: {
        participants: {
          select: { user: { select: { id: true, name: true, image: true } }, pinnedAt: true, deletedAt: true },
        },
        messages: {
          take: 1, orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true },
        },
        _count: {
          select: { messages: { where: { senderId: { not: userId }, readAt: null } } },
        },
      },
      orderBy: { messages: { _count: 'desc' } },
    })

    const data = conversations
      .map((c) => {
        const other = c.participants.find((p) => p.user.id !== userId)
        if (!other) return null
        const myParticipant = c.participants.find((p) => p.user.id === userId)
        return {
          id: c.id,
          participant: other.user,
          lastMessage: c.messages[0] ? { content: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() } : null,
          unreadCount: c._count.messages,
          isPinned: !!myParticipant?.pinnedAt,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        if (!a.lastMessage) return 1
        if (!b.lastMessage) return -1
        return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      })

    return res.json({ data })
  } catch (err) {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { recipientId } = req.body

    if (!recipientId) {
      return res.status(400).json({ error: 'Empfänger-ID erforderlich' })
    }

    if (recipientId === userId) {
      return res.status(400).json({ error: 'Du kannst keine Konversation mit dir selbst starten' })
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } })
    if (!recipient) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' })
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: {
        participants: {
          select: { user: { select: { id: true, name: true, image: true } }, deletedAt: true, pinnedAt: true },
        },
      },
    })

    if (existing) {
      const myParticipant = existing.participants.find((p) => p.user.id === userId)
      if (myParticipant?.deletedAt) {
        await prisma.conversationParticipant.update({
          where: { userId_conversationId: { userId, conversationId: existing.id } },
          data: { deletedAt: null },
        })
      }
      const other = existing.participants.find((p) => p.user.id !== userId)
      return res.json({
        data: { id: existing.id, participant: other?.user, lastMessage: null, unreadCount: 0, isPinned: !!myParticipant?.pinnedAt },
      })
    }

    const conversation = await prisma.conversation.create({
      data: {
        participants: { createMany: { data: [{ userId }, { userId: recipientId }] } },
      },
      include: {
        participants: {
          select: { user: { select: { id: true, name: true, image: true } }, pinnedAt: true },
        },
      },
    })

    const other = conversation.participants.find((p) => p.user.id !== userId)
    const myParticipant = conversation.participants.find((p) => p.user.id === userId)
    return res.status(201).json({
      data: { id: conversation.id, participant: other?.user, lastMessage: null, unreadCount: 0, isPinned: !!myParticipant?.pinnedAt },
    })
  } catch (err) {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const conversationId = req.params.id

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId, deletedAt: null } } },
      include: {
        participants: {
          select: { user: { select: { id: true, name: true, image: true } }, pinnedAt: true },
        },
      },
    })

    if (!conversation) {
      return res.status(404).json({ error: 'Not found' })
    }

    const other = conversation.participants.find((p) => p.user.id !== userId)
    const myParticipant = conversation.participants.find((p) => p.user.id === userId)
    if (!other) {
      return res.status(404).json({ error: 'Not found' })
    }

    return res.json({
      data: {
        id: conversation.id, participant: other.user, lastMessage: null, unreadCount: 0, isPinned: !!myParticipant?.pinnedAt,
      },
    })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
})

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const conversationId = req.params.id

    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    })
    if (!participant) {
      return res.status(404).json({ error: 'Not found' })
    }

    await prisma.conversationParticipant.update({
      where: { userId_conversationId: { userId, conversationId } },
      data: { deletedAt: new Date() },
    })

    await prisma.message.deleteMany({
      where: { conversationId, senderId: userId },
    })

    try {
      const io = getIO()
      if (io) {
        io.to(`conversation:${conversationId}`).emit('conversation:deleted', { conversationId, deletedBy: userId })
      }
    } catch {}

    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
})

// Messages
router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const conversationId = req.params.id
    const cursor = req.query.cursor
    const limit = Math.min(Number(req.query.limit) || 30, 50)

    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    })

    if (!participant) {
      return res.status(403).json({ error: 'Kein Mitglied dieser Konversation' })
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(participant.clearedAt ? { createdAt: { gte: participant.clearedAt } } : {}),
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, content: true, createdAt: true, readAt: true,
        sender: { select: { id: true, name: true, image: true } },
        conversationId: true,
      },
    })

    const updated = await prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    })

    if (updated.count > 0) {
      try {
        const io = getIO()
        if (io) {
          io.to(`conversation:${conversationId}`).emit('dm:read', { conversationId, readAt: new Date().toISOString() })
        }
      } catch {}
    }

    const hasMore = messages.length > limit
    const data = hasMore ? messages.slice(0, limit) : messages

    return res.json({
      data: data.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() || null })).reverse(),
      nextCursor: hasMore ? data[data.length - 1].id : null,
    })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

const sendSchema = z.object({
  content: z.string().min(1).max(2000),
})

router.post('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const conversationId = req.params.id

    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    })

    if (!participant) {
      return res.status(403).json({ error: 'Kein Mitglied dieser Konversation' })
    }

    const parsed = sendSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const message = await prisma.message.create({
      data: { content: parsed.data.content, senderId: userId, conversationId },
      select: {
        id: true, content: true, createdAt: true, readAt: true,
        sender: { select: { id: true, name: true, image: true } },
        conversationId: true,
      },
    })

    const msg = { ...message, createdAt: message.createdAt.toISOString(), readAt: message.readAt?.toISOString() || null }

    try {
      const io = getIO()
      if (io) {
        io.to(`conversation:${conversationId}`).emit('dm:new', msg)
      }
    } catch {}

    return res.status(201).json({ data: msg })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.delete('/:id/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { id: conversationId, messageId } = req.params

    const message = await prisma.message.findUnique({ where: { id: messageId } })
    if (!message) return res.status(404).json({ error: 'Not found' })
    if (message.senderId !== userId) return res.status(403).json({ error: 'Forbidden' })
    if (message.conversationId !== conversationId) return res.status(400).json({ error: 'Mismatch' })

    await prisma.message.delete({ where: { id: messageId } })

    try {
      const io = getIO()
      if (io) {
        io.to(`conversation:${conversationId}`).emit('dm:deleted', { conversationId, messageId })
      }
    } catch {}

    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
})

router.post('/:id/pin', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const conversationId = req.params.id

    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    })
    if (!participant) return res.status(404).json({ error: 'Not found' })

    if (participant.pinnedAt) {
      await prisma.conversationParticipant.update({
        where: { userId_conversationId: { userId, conversationId } },
        data: { pinnedAt: null },
      })
      return res.json({ pinned: false })
    }

    const pinnedCount = await prisma.conversationParticipant.count({
      where: { userId, pinnedAt: { not: null } },
    })

    if (pinnedCount >= 5) {
      return res.status(400).json({ error: 'Maximal 5 Chats anpinnbar' })
    }

    await prisma.conversationParticipant.update({
      where: { userId_conversationId: { userId, conversationId } },
      data: { pinnedAt: new Date() },
    })

    return res.json({ pinned: true })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
})

export default router
