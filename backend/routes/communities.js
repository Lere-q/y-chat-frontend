import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../lib/auth.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const currentUserId = req.user?.id
    const joined = req.query.joined === 'true'
    const search = req.query.search || ''
    const limit = Math.min(Number(req.query.limit) || 20, 50)
    const cursor = req.query.cursor

    const where = {}
    if (joined && currentUserId) {
      where.members = { some: { userId: currentUserId } }
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ]
    }

    const communities = await prisma.community.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { members: { _count: 'desc' } },
      include: {
        _count: { select: { members: true, posts: true } },
        creator: { select: { id: true, name: true, image: true } },
        ...(currentUserId ? {
          members: { where: { userId: currentUserId }, select: { role: true } },
        } : {}),
      },
    })

    const hasMore = communities.length > limit
    const data = hasMore ? communities.slice(0, limit) : communities

    const mapped = data.map((c) => ({
      id: c.id, name: c.name, slug: c.slug,
      description: c.description, icon: c.icon,
      isPrivate: c.isPrivate,
      createdAt: c.createdAt.toISOString(),
      creator: c.creator,
      _count: c._count,
      ...(currentUserId ? { isJoined: c.members && c.members.length > 0, role: c.members?.[0]?.role } : {}),
    }))

    return res.json({
      data: mapped,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: await prisma.community.count({ where }),
    })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

const createSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  isPrivate: z.boolean().optional().default(false),
})

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validierungsfehler', details: parsed.error.flatten() })
    }

    const { name, slug, description, isPrivate } = parsed.data

    const existing = await prisma.community.findUnique({ where: { slug } })
    if (existing) {
      return res.status(400).json({ error: 'Slug bereits vergeben' })
    }

    const community = await prisma.community.create({
      data: {
        name, slug, description, isPrivate,
        creatorId: req.user.id,
        members: { create: { userId: req.user.id, role: 'OWNER' } },
      },
      include: {
        _count: { select: { members: true, posts: true } },
        creator: { select: { id: true, name: true, image: true } },
      },
    })

    return res.status(201).json({ data: community, message: 'Community erstellt' })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const currentUserId = req.user?.id

    const community = await prisma.community.findUnique({
      where: { slug: req.params.slug },
      include: {
        _count: { select: { members: true, posts: true } },
        creator: { select: { id: true, name: true, image: true } },
        ...(currentUserId ? {
          members: { where: { userId: currentUserId }, select: { role: true } },
        } : {}),
      },
    })

    if (!community) {
      return res.status(404).json({ error: 'Community nicht gefunden' })
    }

    const membership = currentUserId ? community.members : []
    const data = {
      ...community,
      createdAt: community.createdAt.toISOString(),
      ...(currentUserId ? { isJoined: membership?.length > 0, role: membership?.[0]?.role } : {}),
    }

    return res.json({ data })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

const patchSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
})

router.patch('/:slug', authMiddleware, async (req, res) => {
  try {
    const community = await prisma.community.findUnique({
      where: { slug: req.params.slug },
      include: { members: { where: { userId: req.user.id } } },
    })

    if (!community) {
      return res.status(404).json({ error: 'Community nicht gefunden' })
    }

    const membership = community.members[0]
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'MOD')) {
      return res.status(403).json({ error: 'Nicht berechtigt' })
    }

    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validierungsfehler', details: parsed.error.flatten() })
    }

    const updated = await prisma.community.update({
      where: { id: community.id },
      data: parsed.data,
    })

    return res.json({ data: updated, message: 'Community aktualisiert' })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.post('/:slug/join', authMiddleware, async (req, res) => {
  try {
    const community = await prisma.community.findUnique({ where: { slug: req.params.slug } })
    if (!community) {
      return res.status(404).json({ error: 'Community nicht gefunden' })
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_communityId: { userId: req.user.id, communityId: community.id } },
    })

    if (existing) {
      return res.status(400).json({ error: 'Bereits Mitglied' })
    }

    await prisma.membership.create({
      data: { userId: req.user.id, communityId: community.id, role: 'MEMBER' },
    })

    return res.status(201).json({ data: { joined: true }, message: 'Community beigetreten' })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.delete('/:slug/join', authMiddleware, async (req, res) => {
  try {
    const community = await prisma.community.findUnique({ where: { slug: req.params.slug } })
    if (!community) {
      return res.status(404).json({ error: 'Community nicht gefunden' })
    }

    const membership = await prisma.membership.findUnique({
      where: { userId_communityId: { userId: req.user.id, communityId: community.id } },
    })

    if (!membership) {
      return res.status(400).json({ error: 'Nicht Mitglied' })
    }

    if (membership.role === 'OWNER') {
      return res.status(400).json({ error: 'Als Gründer kannst du die Community nicht verlassen. Lösche sie stattdessen.' })
    }

    await prisma.membership.delete({
      where: { userId_communityId: { userId: req.user.id, communityId: community.id } },
    })

    return res.json({ data: { joined: false }, message: 'Community verlassen' })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

export default router
