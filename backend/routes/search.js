import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../lib/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q || ''
    const type = req.query.type || 'all'
    const limit = Math.min(Math.abs(Number(req.query.limit)) || 10, 50)

    if (q.length < 2) {
      return res.json({ data: { users: [], communities: [], posts: [] } })
    }

    const results = { users: [], communities: [], posts: [] }

    if (type === 'all' || type === 'users') {
      results.users = await prisma.user.findMany({
        where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] },
        select: { id: true, name: true, image: true },
        take: limit,
      })
    }

    if (type === 'all' || type === 'communities') {
      results.communities = await prisma.community.findMany({
        where: { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { description: { contains: q } }] },
        select: { id: true, name: true, slug: true, icon: true, description: true, _count: { select: { members: true, posts: true } } },
        take: limit,
      })
    }

    if (type === 'all' || type === 'posts') {
      results.posts = await prisma.post.findMany({
        where: { content: { contains: q } },
        select: {
          id: true, content: true, createdAt: true,
          author: { select: { id: true, name: true, image: true } },
          community: { select: { id: true, name: true, slug: true } },
          _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    }

    return res.json({ data: results })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error' })
  }
})

export default router
