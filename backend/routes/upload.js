import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { authMiddleware } from '../lib/auth.js'
import { upload, getUploadPath } from '../lib/upload.js'
import { prisma } from '../lib/prisma.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const router = Router()

router.post('/', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err instanceof Error ? err.message : 'Upload fehlgeschlagen'
      return res.status(400).json({ error: msg })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' })
    }

    const url = getUploadPath(req.file.filename, req.file.fieldname === 'avatar' ? 'avatar' : 'post')

    if (req.file.fieldname === 'avatar') {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { image: url },
      })
    }

    return res.json({ data: { url } })
  })
})

export default router
