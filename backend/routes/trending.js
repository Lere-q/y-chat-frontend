import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const communities = await prisma.community.findMany({
      select: {
        id: true, name: true, slug: true, icon: true,
        _count: { select: { posts: true, members: true } },
        posts: { where: { createdAt: { gte: since } }, select: { id: true } },
      },
    })

    const data = communities
      .map((c) => ({
        id: c.id, name: c.name, slug: c.slug, icon: c.icon,
        postCount: c.posts.length, memberCount: c._count.members, totalPosts: c._count.posts,
      }))
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 10)

    return res.json({ data })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

export default router
