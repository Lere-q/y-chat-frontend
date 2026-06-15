import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../lib/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const cursor = req.query.cursor
    const limit = Math.min(Number(req.query.limit) || 20, 50)

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        post: {
          select: {
            id: true, content: true, image: true, createdAt: true,
            author: { select: { id: true, name: true, image: true } },
            community: { select: { id: true, name: true, slug: true } },
            _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } },
            likes: { where: { userId }, select: { id: true } },
            reposts: { where: { userId }, select: { id: true } },
            bookmarks: { where: { userId }, select: { id: true } },
          },
        },
      },
    })

    const hasMore = bookmarks.length > limit
    const data = hasMore ? bookmarks.slice(0, limit) : bookmarks

    const mapped = data.map((b) => ({
      id: b.post.id, content: b.post.content, image: b.post.image,
      createdAt: b.post.createdAt.toISOString(),
      author: b.post.author, community: b.post.community,
      _count: b.post._count,
      isLiked: (b.post.likes?.length || 0) > 0,
      isReposted: (b.post.reposts?.length || 0) > 0,
      isBookmarked: true,
    }))

    return res.json({
      data: mapped,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

export default router
