import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const AVATAR_DIR = path.join(ROOT, 'uploads', 'avatars')
const POST_DIR = path.join(ROOT, 'uploads', 'posts')

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = file.fieldname === 'avatar' ? AVATAR_DIR : POST_DIR
    fs.mkdirSync(dest, { recursive: true })
    cb(null, dest)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  },
})

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Nur JPEG, PNG, WebP und GIF erlaubt'))
  }
}

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter,
})

export function getUploadPath(filename, type) {
  const base = process.env.FRONTEND_URL || 'http://localhost:40272'
  return type === 'avatar'
    ? `${base}/uploads/avatars/${filename}`
    : `${base}/uploads/posts/${filename}`
}
