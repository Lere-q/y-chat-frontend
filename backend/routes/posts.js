import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../lib/auth.js'
import { getIO } from '../lib/socket.js'

const router = Router()

const postSelect = {
  id: true, content: true, image: true, createdAt: true,
  author: { select: { id: true, name: true, image: true } },
  community: { select: { id: true, name: true, slug: true } },
  _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } },
}

router.get('/', async (req, res) => {
  try {
    const currentUserId = req.user?.id
    const cursor = req.query.cursor
    const limit = Math.min(Number(req.query.limit) || 20, 50)
    const communitySlug = req.query.communitySlug
    const feed = req.query.feed || 'latest'

    const where = {}
    if (communitySlug) {
      where.community = { slug: communitySlug }
    }

    if (feed === 'foryou' && currentUserId) {
      const userCommunities = await prisma.membership.findMany({
        where: { userId: currentUserId },
        select: { communityId: true },
      })
      where.communityId = { in: userCommunities.map((m) => m.communityId) }
    }

    let orderBy = { createdAt: 'desc' }
    if (feed === 'foryou') {
      orderBy = [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }]
    }

    const posts = await prisma.post.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy,
      select: {
        ...postSelect,
        ...(currentUserId ? {
          likes: { where: { userId: currentUserId }, select: { id: true } },
          reposts: { where: { userId: currentUserId }, select: { id: true } },
          bookmarks: { where: { userId: currentUserId }, select: { id: true } },
        } : {}),
      },
    })

    const hasMore = posts.length > limit
    const data = hasMore ? posts.slice(0, limit) : posts

    const mapped = data.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      isLiked: (p.likes?.length || 0) > 0,
      isReposted: (p.reposts?.length || 0) > 0,
      isBookmarked: (p.bookmarks?.length || 0) > 0,
    }))

    return res.json({
      data: mapped,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: await prisma.post.count({ where }),
    })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

const createPostSchema = z.object({
  content: z.string().min(1).max(280),
  communityId: z.string(),
  image: z.string().optional().nullable(),
})

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = createPostSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validierungsfehler', details: parsed.error.flatten() })
    }

    const { content, communityId, image } = parsed.data

    const membership = await prisma.membership.findUnique({
      where: { userId_communityId: { userId: req.user.id, communityId } },
    })

    if (!membership) {
      return res.status(403).json({ error: 'Du bist kein Mitglied dieser Community' })
    }

    const post = await prisma.post.create({
      data: { content, image, communityId, authorId: req.user.id },
      select: { ...postSelect, likes: false, reposts: false, bookmarks: false },
    })

    const createdPost = { ...post, createdAt: post.createdAt.toISOString(), isLiked: false, isReposted: false, isBookmarked: false }

    try {
      const io = getIO()
      const community = await prisma.community.findUnique({ where: { id: communityId } })
      if (io) {
        io.to('feed').emit('post:new', createdPost)
        if (community) {
          io.to(`community:${community.slug}`).emit('post:new', createdPost)
        }
      }
    } catch {}

    return res.status(201).json({ data: createdPost, message: 'Beitrag erstellt' })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const currentUserId = req.user?.id

    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: {
        ...postSelect,
        replies: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, content: true, createdAt: true,
            author: { select: { id: true, name: true, image: true } },
          },
        },
        ...(currentUserId ? {
          likes: { where: { userId: currentUserId }, select: { id: true } },
          reposts: { where: { userId: currentUserId }, select: { id: true } },
          bookmarks: { where: { userId: currentUserId }, select: { id: true } },
        } : {}),
      },
    })

    if (!post) {
      return res.status(404).json({ error: 'Beitrag nicht gefunden' })
    }

    const data = {
      ...post,
      createdAt: post.createdAt.toISOString(),
      replies: post.replies?.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      isLiked: (post.likes?.length || 0) > 0,
      isReposted: (post.reposts?.length || 0) > 0,
      isBookmarked: (post.bookmarks?.length || 0) > 0,
    }

    return res.json({ data })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        community: {
          include: {
            members: {
              where: { userId: req.user.id },
              select: { role: true },
            },
          },
        },
      },
    })

    if (!post) {
      return res.status(404).json({ error: 'Beitrag nicht gefunden' })
    }

    const membership = post.community.members[0]
    const canDelete = post.authorId === req.user.id || membership?.role === 'OWNER' || membership?.role === 'MOD'

    if (!canDelete) {
      return res.status(403).json({ error: 'Nicht berechtigt' })
    }

    await prisma.post.delete({ where: { id: req.params.id } })
    return res.json({ data: { deleted: true }, message: 'Beitrag gelöscht' })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!post) {
      return res.status(404).json({ error: 'Beitrag nicht gefunden' })
    }

    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId: req.user.id, postId: req.params.id } },
    })

    if (existing) {
      return res.status(409).json({ error: 'Bereits geliked' })
    }

    await prisma.like.create({
      data: { userId: req.user.id, postId: req.params.id },
    })

    const count = await prisma.like.count({ where: { postId: req.params.id } })

    try {
      const io = getIO()
      const _count = await prisma.post.findUnique({ where: { id: req.params.id }, select: { _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } } } })
      if (io && _count) io.to('feed').emit('post:updated', { id: req.params.id, _count: _count._count })
    } catch {}

    return res.status(201).json({ data: { liked: true, count } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.delete('/:id/like', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId: req.user.id, postId: req.params.id } },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Like nicht gefunden' })
    }

    await prisma.like.delete({ where: { id: existing.id } })

    const count = await prisma.like.count({ where: { postId: req.params.id } })

    try {
      const io = getIO()
      const _count = await prisma.post.findUnique({ where: { id: req.params.id }, select: { _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } } } })
      if (io && _count) io.to('feed').emit('post:updated', { id: req.params.id, _count: _count._count })
    } catch {}

    return res.json({ data: { liked: false, count } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.post('/:id/bookmark', authMiddleware, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!post) {
      return res.status(404).json({ error: 'Beitrag nicht gefunden' })
    }

    const existing = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId: req.user.id, postId: req.params.id } },
    })

    if (existing) {
      return res.status(409).json({ error: 'Bereits gespeichert' })
    }

    await prisma.bookmark.create({
      data: { userId: req.user.id, postId: req.params.id },
    })

    const count = await prisma.bookmark.count({ where: { postId: req.params.id } })
    return res.status(201).json({ data: { bookmarked: true, count } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.delete('/:id/bookmark', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId: req.user.id, postId: req.params.id } },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Lesezeichen nicht gefunden' })
    }

    await prisma.bookmark.delete({ where: { id: existing.id } })

    const count = await prisma.bookmark.count({ where: { postId: req.params.id } })
    return res.json({ data: { bookmarked: false, count } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.post('/:id/repost', authMiddleware, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!post) {
      return res.status(404).json({ error: 'Beitrag nicht gefunden' })
    }

    const existing = await prisma.repost.findUnique({
      where: { userId_postId: { userId: req.user.id, postId: req.params.id } },
    })

    if (existing) {
      return res.status(409).json({ error: 'Bereits repostet' })
    }

    const quote = req.body?.quote?.trim?.()?.slice(0, 280) || null

    await prisma.$transaction(async (tx) => {
      if (quote) {
        await tx.post.create({
          data: { content: quote, authorId: req.user.id, communityId: post.communityId, originalPostId: req.params.id },
        })
      }
      await tx.repost.create({
        data: { userId: req.user.id, postId: req.params.id, ...(quote ? { quote } : {}) },
      })
    })

    const count = await prisma.repost.count({ where: { postId: req.params.id } })

    try {
      const io = getIO()
      const _count = await prisma.post.findUnique({ where: { id: req.params.id }, select: { _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } } } })
      if (io && _count) io.to('feed').emit('post:updated', { id: req.params.id, _count: _count._count })
    } catch {}

    return res.status(201).json({ data: { reposted: true, count } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.delete('/:id/repost', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.repost.findUnique({
      where: { userId_postId: { userId: req.user.id, postId: req.params.id } },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Repost nicht gefunden' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.repost.delete({ where: { id: existing.id } })
      if (existing.quote) {
        const quotePost = await tx.post.findFirst({
          where: { originalPostId: req.params.id, authorId: req.user.id },
          select: { id: true },
        })
        if (quotePost) {
          await tx.post.delete({ where: { id: quotePost.id } })
        }
      }
    })

    const count = await prisma.repost.count({ where: { postId: req.params.id } })

    try {
      const io = getIO()
      const _count = await prisma.post.findUnique({ where: { id: req.params.id }, select: { _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } } } })
      if (io && _count) io.to('feed').emit('post:updated', { id: req.params.id, _count: _count._count })
    } catch {}

    return res.json({ data: { reposted: false, count } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.post('/:id/replies', authMiddleware, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!post) {
      return res.status(404).json({ error: 'Beitrag nicht gefunden' })
    }

    const { content } = req.body
    if (!content || !content.trim() || content.length > 280) {
      return res.status(400).json({ error: 'Antwort muss 1-280 Zeichen haben' })
    }

    const reply = await prisma.reply.create({
      data: { content: content.trim(), authorId: req.user.id, postId: req.params.id },
      select: {
        id: true, content: true, createdAt: true,
        author: { select: { id: true, name: true, image: true } },
      },
    })

    const replyData = { ...reply, createdAt: reply.createdAt.toISOString(), postId: req.params.id }

    try {
      const io = getIO()
      if (io) {
        io.emit('reply:new', replyData)
        const _count = await prisma.post.findUnique({ where: { id: req.params.id }, select: { _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } } } })
        if (_count) io.to('feed').emit('post:updated', { id: req.params.id, _count: _count._count })
      }
    } catch {}

    return res.status(201).json({ data: replyData })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.get('/:id/replies', async (req, res) => {
  try {
    const replies = await prisma.reply.findMany({
      where: { postId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, content: true, createdAt: true,
        author: { select: { id: true, name: true, image: true } },
      },
    })

    const data = replies.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
    return res.json({ data })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

export default router
