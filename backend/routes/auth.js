import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { generateToken, hashPassword, comparePassword } from '../lib/auth.js'

const router = Router()

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
})

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validierungsfehler', details: parsed.error.flatten() })
    }

    const { name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: 'E-Mail bereits vergeben' })
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, name: true, email: true, image: true },
    })

    const token = generateToken(user)

    return res.status(201).json({ data: { ...user, token } })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort' })
    }

    const valid = await comparePassword(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort' })
    }

    const token = generateToken({
      id: user.id, name: user.name, email: user.email, image: user.image,
    })

    return res.json({
      data: {
        id: user.id, name: user.name, email: user.email, image: user.image, token,
      },
    })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

router.get('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht autorisiert' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, image: true, bio: true, createdAt: true,
        _count: { select: { posts: true, followedBy: true, following: true, memberships: true } },
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' })
    }

    return res.json({ data: user })
  } catch {
    return res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

export default router
