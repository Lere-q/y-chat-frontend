import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../lib/auth.js'

const router = Router()

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q || ''
    if (q.length < 1) {
      return res.json({ data: [] })
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.id } },
          { name: { contains: q } },
        ],
      },
      select: { id: true, name: true, image: true },
      take: 10,
      orderBy: { name: 'asc' },
    })

    return res.json({ data: users })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id
    const currentUserId = req.user?.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, image: true, bio: true, createdAt: true,
        _count: { select: { posts: true, followedBy: true, following: true, memberships: true } },
        ...(currentUserId ? {
          followedBy: {
            where: { followerId: currentUserId },
            select: { followerId: true },
          },
        } : {}),
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' })
    }

    const isFollowing = currentUserId
      ? user.followedBy && user.followedBy.length > 0
      : false

    const data = {
      id: user.id, name: user.name, email: user.email,
      image: user.image, bio: user.bio,
      createdAt: user.createdAt.toISOString(),
      _count: {
        posts: user._count.posts, followers: user._count.followedBy,
        following: user._count.following, memberships: user._count.memberships,
      },
      isFollowing,
      isOwnProfile: currentUserId === userId,
    }

    return res.json({ data })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  bio: z.string().max(160).optional(),
  image: z.string().optional(),
})

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Nicht berechtigt' })
    }

    const parsed = updateProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validierungsfehler', details: parsed.error.flatten() })
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: { id: true, name: true, email: true, image: true, bio: true, createdAt: true },
    })

    return res.json({ data: { ...user, createdAt: user.createdAt.toISOString() } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.post('/:id/follow', authMiddleware, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Du kannst dir nicht selbst folgen' })
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!target) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' })
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user.id, followingId: req.params.id } },
    })

    if (existing) {
      return res.status(409).json({ error: 'Folgt bereits' })
    }

    await prisma.follow.create({
      data: { followerId: req.user.id, followingId: req.params.id },
    })

    const followerCount = await prisma.follow.count({ where: { followingId: req.params.id } })
    return res.status(201).json({ data: { following: true, followerCount } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.delete('/:id/follow', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user.id, followingId: req.params.id } },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Folgt nicht' })
    }

    await prisma.follow.deleteMany({
      where: { followerId: req.user.id, followingId: req.params.id },
    })

    const followerCount = await prisma.follow.count({ where: { followingId: req.params.id } })
    return res.json({ data: { following: false, followerCount } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.get('/:id/posts', async (req, res) => {
  try {
    const currentUserId = req.user?.id

    const posts = await prisma.post.findMany({
      where: { authorId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, content: true, image: true, createdAt: true,
        author: { select: { id: true, name: true, image: true } },
        community: { select: { id: true, name: true, slug: true } },
        _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } },
        ...(currentUserId ? {
          likes: { where: { userId: currentUserId }, select: { id: true } },
          reposts: { where: { userId: currentUserId }, select: { id: true } },
          bookmarks: { where: { userId: currentUserId }, select: { id: true } },
        } : {}),
      },
    })

    const data = posts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      isLiked: (p.likes?.length || 0) > 0,
      isReposted: (p.reposts?.length || 0) > 0,
      isBookmarked: (p.bookmarks?.length || 0) > 0,
    }))

    return res.json({ data })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.get('/:id/likes', async (req, res) => {
  try {
    const currentUserId = req.user?.id

    const likes = await prisma.like.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        post: {
          select: {
            id: true, content: true, image: true, createdAt: true,
            author: { select: { id: true, name: true, image: true } },
            community: { select: { id: true, name: true, slug: true } },
            _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } },
            ...(currentUserId ? {
              likes: { where: { userId: currentUserId }, select: { id: true } },
              reposts: { where: { userId: currentUserId }, select: { id: true } },
              bookmarks: { where: { userId: currentUserId }, select: { id: true } },
            } : {}),
          },
        },
      },
    })

    const data = likes.map((l) => ({
      ...l.post,
      createdAt: l.post.createdAt.toISOString(),
      isLiked: (l.post.likes?.length || 0) > 0,
      isReposted: (l.post.reposts?.length || 0) > 0,
      isBookmarked: (l.post.bookmarks?.length || 0) > 0,
    }))

    return res.json({ data })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

export default router
