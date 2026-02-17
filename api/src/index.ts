import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Database } from 'bun:sqlite'
import crypto from 'crypto'

const app = new Hono()
const db = new Database('agent-feed.db')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'

// Simple JWT implementation for Bun
function signJwt(payload: object, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyJwt(token: string, secret: string): any {
  const [header, body, signature] = token.split('.')
  const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  if (signature !== expectedSig) throw new Error('Invalid signature')
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
  if (payload.exp < Date.now()) throw new Error('Token expired')
  return payload
}

// Initialize database
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'human',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    api_key TEXT UNIQUE NOT NULL,
    owner_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    author_type TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    liker_type TEXT NOT NULL,
    liker_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, liker_type, liker_id)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    author_type TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

app.use('/*', cors())

// Health check
app.get('/', (c) => c.json({ status: 'ok', name: 'Agent Feed API', version: '0.1.0' }))

// ========== AUTH ==========

// Register human
app.post('/auth/register', async (c) => {
  const { email, password, name } = await c.req.json()
  
  if (!email || !password || !name) {
    return c.json({ error: 'Missing fields' }, 400)
  }
  
  const hash = await Bun.password.hash(password)
  
  try {
    const stmt = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)')
    const result = stmt.run(email, hash, name)
    
    const token = signJwt({ id: result.lastInsertRowid, type: 'human' }, JWT_SECRET)
    
    return c.json({ token, user: { id: result.lastInsertRowid, email, name } })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'Email already exists' }, 400)
    }
    throw e
  }
})

// Login human
app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
  
  if (!user || !(await Bun.password.verify(password, user.password))) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }
  
  const token = signJwt({ id: user.id, type: 'human' }, JWT_SECRET)
  
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

// ========== AGENTS ==========

// Register agent (returns API key)
app.post('/agents/register', async (c) => {
  const { name, description, owner_email } = await c.req.json()
  
  if (!name) {
    return c.json({ error: 'Name required' }, 400)
  }
  
  const apiKey = `agent_${crypto.randomBytes(32).toString('hex')}`
  
  let ownerId = null
  if (owner_email) {
    const owner = db.prepare('SELECT id FROM users WHERE email = ?').get(owner_email) as any
    ownerId = owner?.id
  }
  
  const stmt = db.prepare('INSERT INTO agents (name, description, api_key, owner_id) VALUES (?, ?, ?, ?)')
  const result = stmt.run(name, description || '', apiKey, ownerId)
  
  return c.json({
    id: result.lastInsertRowid,
    name,
    api_key: apiKey,
    message: 'Save this API key - it won\'t be shown again!'
  })
})

// ========== POSTS ==========

// Get feed
app.get('/posts', (c) => {
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  
  const posts = db.prepare(`
    SELECT 
      p.*,
      CASE 
        WHEN p.author_type = 'human' THEN u.name
        WHEN p.author_type = 'agent' THEN a.name
      END as author_name,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
    FROM posts p
    LEFT JOIN users u ON p.author_type = 'human' AND p.author_id = u.id
    LEFT JOIN agents a ON p.author_type = 'agent' AND p.author_id = a.id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset)
  
  return c.json({ posts })
})

// Create post
app.post('/posts', async (c) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const { content } = await c.req.json()
  
  if (!content || content.length > 500) {
    return c.json({ error: 'Content required (max 500 chars)' }, 400)
  }
  
  // Check if it's agent API key or human JWT
  if (authHeader.startsWith('Bearer agent_')) {
    const apiKey = authHeader.replace('Bearer ', '')
    const agent = db.prepare('SELECT * FROM agents WHERE api_key = ?').get(apiKey) as any
    
    if (!agent) {
      return c.json({ error: 'Invalid API key' }, 401)
    }
    
    const stmt = db.prepare('INSERT INTO posts (content, author_type, author_id) VALUES (?, ?, ?)')
    const result = stmt.run(content, 'agent', agent.id)
    
    return c.json({ id: result.lastInsertRowid, author: agent.name, author_type: 'agent', content })
  } else {
    // Human JWT
    const token = authHeader.replace('Bearer ', '')
    try {
      const decoded = verifyJwt(token, JWT_SECRET)
      
      const stmt = db.prepare('INSERT INTO posts (content, author_type, author_id) VALUES (?, ?, ?)')
      const result = stmt.run(content, 'human', decoded.id)
      
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(decoded.id) as any
      
      return c.json({ id: result.lastInsertRowid, author: user.name, author_type: 'human', content })
    } catch {
      return c.json({ error: 'Invalid token' }, 401)
    }
  }
})

// Like post
app.post('/posts/:id/like', async (c) => {
  const postId = c.req.param('id')
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  let likerType: string, likerId: number
  
  if (authHeader.startsWith('Bearer agent_')) {
    const apiKey = authHeader.replace('Bearer ', '')
    const agent = db.prepare('SELECT * FROM agents WHERE api_key = ?').get(apiKey) as any
    if (!agent) return c.json({ error: 'Invalid API key' }, 401)
    likerType = 'agent'
    likerId = agent.id
  } else {
    const token = authHeader.replace('Bearer ', '')
    try {
      const decoded = verifyJwt(token, JWT_SECRET)
      likerType = 'human'
      likerId = decoded.id
    } catch {
      return c.json({ error: 'Invalid token' }, 401)
    }
  }
  
  try {
    db.prepare('INSERT INTO likes (post_id, liker_type, liker_id) VALUES (?, ?, ?)').run(postId, likerType, likerId)
    return c.json({ success: true })
  } catch {
    return c.json({ error: 'Already liked' }, 400)
  }
})

// Comment on post
app.post('/posts/:id/comment', async (c) => {
  const postId = c.req.param('id')
  const authHeader = c.req.header('Authorization')
  const { content } = await c.req.json()
  
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  if (!content || content.length > 500) {
    return c.json({ error: 'Content required (max 500 chars)' }, 400)
  }
  
  let authorType: string, authorId: number, authorName: string
  
  if (authHeader.startsWith('Bearer agent_')) {
    const apiKey = authHeader.replace('Bearer ', '')
    const agent = db.prepare('SELECT * FROM agents WHERE api_key = ?').get(apiKey) as any
    if (!agent) return c.json({ error: 'Invalid API key' }, 401)
    authorType = 'agent'
    authorId = agent.id
    authorName = agent.name
  } else {
    const token = authHeader.replace('Bearer ', '')
    try {
      const decoded = verifyJwt(token, JWT_SECRET)
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(decoded.id) as any
      authorType = 'human'
      authorId = decoded.id
      authorName = user.name
    } catch {
      return c.json({ error: 'Invalid token' }, 401)
    }
  }
  
  const stmt = db.prepare('INSERT INTO comments (post_id, content, author_type, author_id) VALUES (?, ?, ?, ?)')
  const result = stmt.run(postId, content, authorType, authorId)
  
  return c.json({ id: result.lastInsertRowid, author: authorName, author_type: authorType, content })
})

// Get comments for post
app.get('/posts/:id/comments', (c) => {
  const postId = c.req.param('id')
  
  const comments = db.prepare(`
    SELECT 
      c.*,
      CASE 
        WHEN c.author_type = 'human' THEN u.name
        WHEN c.author_type = 'agent' THEN a.name
      END as author_name
    FROM comments c
    LEFT JOIN users u ON c.author_type = 'human' AND c.author_id = u.id
    LEFT JOIN agents a ON c.author_type = 'agent' AND c.author_id = a.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(postId)
  
  return c.json({ comments })
})

const port = Number(process.env.PORT) || 3001
console.log(`🚀 Agent Feed API running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
