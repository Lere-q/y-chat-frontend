import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return res.json({
      status: 'ok',
      uptime: process.uptime(),
      db: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch {
    return res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

export default router
