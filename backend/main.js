import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { initIO } from './lib/socket.js'
import { authMiddleware } from './lib/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Routes
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import postsRoutes from './routes/posts.js'
import communitiesRoutes from './routes/communities.js'
import conversationsRoutes from './routes/conversations.js'
import bookmarksRoutes from './routes/bookmarks.js'
import searchRoutes from './routes/search.js'
import uploadRoutes from './routes/upload.js'
import trendingRoutes from './routes/trending.js'
import healthRoutes from './routes/health.js'

const app = express()
const httpServer = createServer(app)

const PORT = Number(process.env.PORT) || 40272
const HOST = process.env.HOST || '0.0.0.0'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5501'

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5501', 'http://localhost:5500', 'https://sanderkopp.github.io'],
  credentials: true,
}))
app.use(express.json())

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Public routes
app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)

// Protected routes (auth optional for some)
app.use('/api/users', (req, res, next) => {
  // authMiddleware is optional for GET /:id, /:id/posts, /:id/likes
  if (req.method === 'GET' && (req.path === '/' || req.path.match(/^\/([^/]+)$/) || req.path.match(/^\/([^/]+)\/(posts|likes)$/))) {
    const token = req.headers.authorization?.split?.(' ')?.[1]
    if (token) {
      const { verifyToken } = require('./lib/auth.js')
      const decoded = verifyToken(token)
      if (decoded) req.user = decoded
    }
    return next()
  }
  authMiddleware(req, res, next)
}, usersRoutes)

app.use('/api/posts', (req, res, next) => {
  if (req.method === 'GET') {
    const token = req.headers.authorization?.split?.(' ')?.[1]
    if (token) {
      const { verifyToken } = require('./lib/auth.js')
      const decoded = verifyToken(token)
      if (decoded) req.user = decoded
    }
    return next()
  }
  authMiddleware(req, res, next)
}, postsRoutes)

app.use('/api/communities', (req, res, next) => {
  if (req.method === 'GET') {
    const token = req.headers.authorization?.split?.(' ')?.[1]
    if (token) {
      const { verifyToken } = require('./lib/auth.js')
      const decoded = verifyToken(token)
      if (decoded) req.user = decoded
    }
    return next()
  }
  authMiddleware(req, res, next)
}, communitiesRoutes)

app.use('/api/trending', (req, res, next) => {
  const token = req.headers.authorization?.split?.(' ')?.[1]
  if (token) {
    const { verifyToken } = require('./lib/auth.js')
    const decoded = verifyToken(token)
    if (decoded) req.user = decoded
  }
  next()
}, trendingRoutes)

app.use('/api/conversations', authMiddleware, conversationsRoutes)
app.use('/api/bookmarks', authMiddleware, bookmarksRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/upload', uploadRoutes)

initIO(httpServer)

httpServer.listen(PORT, HOST, () => {
  console.log(`Server bereit auf http://${HOST}:${PORT}`)
  console.log(`API verfügbar unter http://${HOST}:${PORT}/api`)
})
