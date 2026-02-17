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

// Helper to get current user from auth header
function getAuthUser(authHeader: string | undefined): { type: 'human' | 'agent', id: number, name: string } | null {
  if (!authHeader) return null
  
  if (authHeader.startsWith('Bearer agent_')) {
    const apiKey = authHeader.replace('Bearer ', '')
    const agent = db.prepare('SELECT id, name FROM agents WHERE api_key = ?').get(apiKey) as any
    if (!agent) return null
    return { type: 'agent', id: agent.id, name: agent.name }
  } else {
    const token = authHeader.replace('Bearer ', '')
    try {
      const decoded = verifyJwt(token, JWT_SECRET)
      const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(decoded.id) as any
      if (!user) return null
      return { type: 'human', id: user.id, name: user.name }
    } catch {
      return null
    }
  }
}

// Initialize database - original tables
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

// ========== MIGRATIONS - Safe ALTER TABLE additions ==========

// Profile fields for users
const userColumns = db.prepare("PRAGMA table_info(users)").all() as any[]
const userColumnNames = userColumns.map(c => c.name)

if (!userColumnNames.includes('username')) {
  db.run("ALTER TABLE users ADD COLUMN username TEXT DEFAULT NULL")
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL")
}
if (!userColumnNames.includes('bio')) {
  db.run("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
}
if (!userColumnNames.includes('avatar_url')) {
  db.run("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''")
}
if (!userColumnNames.includes('banner_url')) {
  db.run("ALTER TABLE users ADD COLUMN banner_url TEXT DEFAULT ''")
}
if (!userColumnNames.includes('location')) {
  db.run("ALTER TABLE users ADD COLUMN location TEXT DEFAULT ''")
}
if (!userColumnNames.includes('website')) {
  db.run("ALTER TABLE users ADD COLUMN website TEXT DEFAULT ''")
}

// Profile fields for agents
const agentColumns = db.prepare("PRAGMA table_info(agents)").all() as any[]
const agentColumnNames = agentColumns.map(c => c.name)

if (!agentColumnNames.includes('username')) {
  db.run("ALTER TABLE agents ADD COLUMN username TEXT DEFAULT NULL")
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_username ON agents(username) WHERE username IS NOT NULL")
}
if (!agentColumnNames.includes('bio')) {
  db.run("ALTER TABLE agents ADD COLUMN bio TEXT DEFAULT ''")
}
if (!agentColumnNames.includes('avatar_url')) {
  db.run("ALTER TABLE agents ADD COLUMN avatar_url TEXT DEFAULT ''")
}
if (!agentColumnNames.includes('banner_url')) {
  db.run("ALTER TABLE agents ADD COLUMN banner_url TEXT DEFAULT ''")
}
if (!agentColumnNames.includes('location')) {
  db.run("ALTER TABLE agents ADD COLUMN location TEXT DEFAULT ''")
}
if (!agentColumnNames.includes('website')) {
  db.run("ALTER TABLE agents ADD COLUMN website TEXT DEFAULT ''")
}

// Reply support in posts
const postColumns = db.prepare("PRAGMA table_info(posts)").all() as any[]
const postColumnNames = postColumns.map(c => c.name)

if (!postColumnNames.includes('reply_to_id')) {
  db.run("ALTER TABLE posts ADD COLUMN reply_to_id INTEGER DEFAULT NULL")
  db.run("CREATE INDEX IF NOT EXISTS idx_posts_reply_to ON posts(reply_to_id) WHERE reply_to_id IS NOT NULL")
}

// Follows table
db.run(`
  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_type TEXT NOT NULL,
    follower_id INTEGER NOT NULL,
    following_type TEXT NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_type, follower_id, following_type, following_id)
  )
`)
db.run("CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_type, follower_id)")
db.run("CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_type, following_id)")

// Reposts table
db.run(`
  CREATE TABLE IF NOT EXISTS reposts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    reposter_type TEXT NOT NULL,
    reposter_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, reposter_type, reposter_id)
  )
`)
db.run("CREATE INDEX IF NOT EXISTS idx_reposts_post ON reposts(post_id)")

app.use('/*', cors())

// Health check
app.get('/', (c) => c.json({ status: 'ok', name: 'Agent Feed API', version: '0.2.0' }))

// ========== AUTH ==========

// Register human
app.post('/auth/register', async (c) => {
  const { email, password, name, username } = await c.req.json()
  
  if (!email || !password || !name) {
    return c.json({ error: 'Missing fields' }, 400)
  }
  
  // Validate username if provided
  if (username) {
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return c.json({ error: 'Username must be 3-30 chars, alphanumeric and underscores only' }, 400)
    }
    // Check if username exists in users or agents
    const existsUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    const existsAgent = db.prepare('SELECT id FROM agents WHERE username = ?').get(username)
    if (existsUser || existsAgent) {
      return c.json({ error: 'Username already taken' }, 400)
    }
  }
  
  const hash = await Bun.password.hash(password)
  
  try {
    const stmt = db.prepare('INSERT INTO users (email, password, name, username) VALUES (?, ?, ?, ?)')
    const result = stmt.run(email, hash, name, username || null)
    
    const token = signJwt({ id: result.lastInsertRowid, type: 'human' }, JWT_SECRET)
    
    return c.json({ token, user: { id: result.lastInsertRowid, email, name, username } })
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
  
  return c.json({ 
    token, 
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url
    } 
  })
})

// Get current user profile
app.get('/auth/me', (c) => {
  const authUser = getAuthUser(c.req.header('Authorization'))
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401)
  
  if (authUser.type === 'human') {
    const user = db.prepare(`
      SELECT id, email, name, username, bio, avatar_url, banner_url, location, website, created_at
      FROM users WHERE id = ?
    `).get(authUser.id) as any
    return c.json({ user, type: 'human' })
  } else {
    const agent = db.prepare(`
      SELECT id, name, username, description, bio, avatar_url, banner_url, location, website, created_at
      FROM agents WHERE id = ?
    `).get(authUser.id) as any
    return c.json({ agent, type: 'agent' })
  }
})

// Update current user profile
app.patch('/auth/me', async (c) => {
  const authUser = getAuthUser(c.req.header('Authorization'))
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401)
  
  const { username, bio, avatar_url, banner_url, location, website, name } = await c.req.json()
  
  // Validate username if changing
  if (username !== undefined) {
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return c.json({ error: 'Username must be 3-30 chars, alphanumeric and underscores only' }, 400)
    }
    if (username) {
      const existsUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, authUser.type === 'human' ? authUser.id : -1)
      const existsAgent = db.prepare('SELECT id FROM agents WHERE username = ? AND id != ?').get(username, authUser.type === 'agent' ? authUser.id : -1)
      if (existsUser || existsAgent) {
        return c.json({ error: 'Username already taken' }, 400)
      }
    }
  }
  
  const table = authUser.type === 'human' ? 'users' : 'agents'
  const updates: string[] = []
  const values: any[] = []
  
  if (username !== undefined) { updates.push('username = ?'); values.push(username || null) }
  if (bio !== undefined) { updates.push('bio = ?'); values.push(bio) }
  if (avatar_url !== undefined) { updates.push('avatar_url = ?'); values.push(avatar_url) }
  if (banner_url !== undefined) { updates.push('banner_url = ?'); values.push(banner_url) }
  if (location !== undefined) { updates.push('location = ?'); values.push(location) }
  if (website !== undefined) { updates.push('website = ?'); values.push(website) }
  if (name !== undefined) { updates.push('name = ?'); values.push(name) }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }
  
  values.push(authUser.id)
  db.prepare(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  
  return c.json({ success: true })
})

// ========== AGENTS ==========

// Register agent (returns API key)
app.post('/agents/register', async (c) => {
  const { name, description, owner_email, username, bio, avatar_url } = await c.req.json()
  
  if (!name) {
    return c.json({ error: 'Name required' }, 400)
  }
  
  // Validate username if provided
  if (username) {
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return c.json({ error: 'Username must be 3-30 chars, alphanumeric and underscores only' }, 400)
    }
    const existsUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    const existsAgent = db.prepare('SELECT id FROM agents WHERE username = ?').get(username)
    if (existsUser || existsAgent) {
      return c.json({ error: 'Username already taken' }, 400)
    }
  }
  
  const apiKey = `agent_${crypto.randomBytes(32).toString('hex')}`
  
  let ownerId = null
  if (owner_email) {
    const owner = db.prepare('SELECT id FROM users WHERE email = ?').get(owner_email) as any
    ownerId = owner?.id
  }
  
  const stmt = db.prepare('INSERT INTO agents (name, description, api_key, owner_id, username, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const result = stmt.run(name, description || '', apiKey, ownerId, username || null, bio || '', avatar_url || '')
  
  return c.json({
    id: result.lastInsertRowid,
    name,
    username,
    api_key: apiKey,
    message: 'Save this API key - it won\'t be shown again!'
  })
})

// ========== USER PROFILES ==========

// Helper: get profile counts
function getProfileCounts(type: string, id: number) {
  const posts_count = (db.prepare('SELECT COUNT(*) as c FROM posts WHERE author_type = ? AND author_id = ? AND reply_to_id IS NULL').get(type, id) as any).c
  const followers_count = (db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_type = ? AND following_id = ?').get(type, id) as any).c
  const following_count = (db.prepare('SELECT COUNT(*) as c FROM follows WHERE follower_type = ? AND follower_id = ?').get(type, id) as any).c
  return { posts_count, followers_count, following_count }
}

// Get user/agent by username
app.get('/users/:username', (c) => {
  const username = c.req.param('username')
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  // Try users first
  let profile = db.prepare(`
    SELECT id, name, username, bio, avatar_url, banner_url, location, website, created_at
    FROM users WHERE username = ?
  `).get(username) as any
  
  let type = 'human'
  
  if (!profile) {
    // Try agents
    profile = db.prepare(`
      SELECT id, name, username, description, bio, avatar_url, banner_url, location, website, created_at
      FROM agents WHERE username = ?
    `).get(username) as any
    type = 'agent'
  }
  
  if (!profile) {
    return c.json({ error: 'User not found' }, 404)
  }
  
  const counts = getProfileCounts(type, profile.id)
  
  // Check if current user follows this profile
  let is_following = false
  if (authUser) {
    const follow = db.prepare(
      'SELECT id FROM follows WHERE follower_type = ? AND follower_id = ? AND following_type = ? AND following_id = ?'
    ).get(authUser.type, authUser.id, type, profile.id)
    is_following = !!follow
  }
  
  return c.json({ 
    profile: { ...profile, type },
    ...counts,
    is_following
  })
})

// Follow user
app.post('/users/:username/follow', (c) => {
  const username = c.req.param('username')
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401)
  
  // Find target
  let target = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any
  let targetType = 'human'
  
  if (!target) {
    target = db.prepare('SELECT id FROM agents WHERE username = ?').get(username) as any
    targetType = 'agent'
  }
  
  if (!target) {
    return c.json({ error: 'User not found' }, 404)
  }
  
  // Can't follow yourself
  if (authUser.type === targetType && authUser.id === target.id) {
    return c.json({ error: 'Cannot follow yourself' }, 400)
  }
  
  try {
    db.prepare(
      'INSERT INTO follows (follower_type, follower_id, following_type, following_id) VALUES (?, ?, ?, ?)'
    ).run(authUser.type, authUser.id, targetType, target.id)
    return c.json({ success: true, following: true })
  } catch {
    // Already following - unfollow
    db.prepare(
      'DELETE FROM follows WHERE follower_type = ? AND follower_id = ? AND following_type = ? AND following_id = ?'
    ).run(authUser.type, authUser.id, targetType, target.id)
    return c.json({ success: true, following: false })
  }
})

// Get followers
app.get('/users/:username/followers', (c) => {
  const username = c.req.param('username')
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  
  // Find target
  let target = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any
  let targetType = 'human'
  
  if (!target) {
    target = db.prepare('SELECT id FROM agents WHERE username = ?').get(username) as any
    targetType = 'agent'
  }
  
  if (!target) {
    return c.json({ error: 'User not found' }, 404)
  }
  
  const followers = db.prepare(`
    SELECT 
      f.follower_type as type,
      f.follower_id as id,
      f.created_at as followed_at,
      CASE 
        WHEN f.follower_type = 'human' THEN u.name
        WHEN f.follower_type = 'agent' THEN a.name
      END as name,
      CASE 
        WHEN f.follower_type = 'human' THEN u.username
        WHEN f.follower_type = 'agent' THEN a.username
      END as username,
      CASE 
        WHEN f.follower_type = 'human' THEN u.avatar_url
        WHEN f.follower_type = 'agent' THEN a.avatar_url
      END as avatar_url,
      CASE 
        WHEN f.follower_type = 'human' THEN u.bio
        WHEN f.follower_type = 'agent' THEN a.bio
      END as bio
    FROM follows f
    LEFT JOIN users u ON f.follower_type = 'human' AND f.follower_id = u.id
    LEFT JOIN agents a ON f.follower_type = 'agent' AND f.follower_id = a.id
    WHERE f.following_type = ? AND f.following_id = ?
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `).all(targetType, target.id, limit, offset)
  
  return c.json({ followers })
})

// Get following
app.get('/users/:username/following', (c) => {
  const username = c.req.param('username')
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  
  // Find target
  let target = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any
  let targetType = 'human'
  
  if (!target) {
    target = db.prepare('SELECT id FROM agents WHERE username = ?').get(username) as any
    targetType = 'agent'
  }
  
  if (!target) {
    return c.json({ error: 'User not found' }, 404)
  }
  
  const following = db.prepare(`
    SELECT 
      f.following_type as type,
      f.following_id as id,
      f.created_at as followed_at,
      CASE 
        WHEN f.following_type = 'human' THEN u.name
        WHEN f.following_type = 'agent' THEN a.name
      END as name,
      CASE 
        WHEN f.following_type = 'human' THEN u.username
        WHEN f.following_type = 'agent' THEN a.username
      END as username,
      CASE 
        WHEN f.following_type = 'human' THEN u.avatar_url
        WHEN f.following_type = 'agent' THEN a.avatar_url
      END as avatar_url,
      CASE 
        WHEN f.following_type = 'human' THEN u.bio
        WHEN f.following_type = 'agent' THEN a.bio
      END as bio
    FROM follows f
    LEFT JOIN users u ON f.following_type = 'human' AND f.following_id = u.id
    LEFT JOIN agents a ON f.following_type = 'agent' AND f.following_id = a.id
    WHERE f.follower_type = ? AND f.follower_id = ?
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `).all(targetType, target.id, limit, offset)
  
  return c.json({ following })
})

// Get user's posts
app.get('/users/:username/posts', (c) => {
  const username = c.req.param('username')
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  const include_replies = c.req.query('include_replies') === 'true'
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  // Find target
  let target = db.prepare('SELECT id, name, username, avatar_url FROM users WHERE username = ?').get(username) as any
  let targetType = 'human'
  
  if (!target) {
    target = db.prepare('SELECT id, name, username, avatar_url FROM agents WHERE username = ?').get(username) as any
    targetType = 'agent'
  }
  
  if (!target) {
    return c.json({ error: 'User not found' }, 404)
  }
  
  const replyFilter = include_replies ? '' : 'AND p.reply_to_id IS NULL'
  
  const posts = db.prepare(`
    SELECT 
      p.*,
      ? as author_name,
      ? as author_username,
      ? as author_avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_id = p.id) as reply_count
    FROM posts p
    WHERE p.author_type = ? AND p.author_id = ? ${replyFilter}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(target.name, target.username, target.avatar_url, targetType, target.id, limit, offset)
  
  // Add is_liked, is_reposted for auth user
  const postsWithStatus = posts.map((post: any) => {
    let is_liked = false, is_reposted = false
    if (authUser) {
      is_liked = !!db.prepare('SELECT id FROM likes WHERE post_id = ? AND liker_type = ? AND liker_id = ?').get(post.id, authUser.type, authUser.id)
      is_reposted = !!db.prepare('SELECT id FROM reposts WHERE post_id = ? AND reposter_type = ? AND reposter_id = ?').get(post.id, authUser.type, authUser.id)
    }
    return { ...post, is_liked, is_reposted }
  })
  
  return c.json({ posts: postsWithStatus })
})

// ========== POSTS ==========

// Get feed (posts from followed users + own posts)
app.get('/feed', (c) => {
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  // Get posts from people we follow + our own posts + reposts
  const posts = db.prepare(`
    SELECT DISTINCT
      p.*,
      CASE 
        WHEN p.author_type = 'human' THEN u.name
        WHEN p.author_type = 'agent' THEN a.name
      END as author_name,
      CASE 
        WHEN p.author_type = 'human' THEN u.username
        WHEN p.author_type = 'agent' THEN a.username
      END as author_username,
      CASE 
        WHEN p.author_type = 'human' THEN u.avatar_url
        WHEN p.author_type = 'agent' THEN a.avatar_url
      END as author_avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_id = p.id) as reply_count,
      COALESCE(r.created_at, p.created_at) as sort_time,
      CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as is_repost_item,
      r.reposter_type,
      r.reposter_id,
      CASE 
        WHEN r.reposter_type = 'human' THEN ru.name
        WHEN r.reposter_type = 'agent' THEN ra.name
      END as reposter_name,
      CASE 
        WHEN r.reposter_type = 'human' THEN ru.username
        WHEN r.reposter_type = 'agent' THEN ra.username
      END as reposter_username
    FROM posts p
    LEFT JOIN users u ON p.author_type = 'human' AND p.author_id = u.id
    LEFT JOIN agents a ON p.author_type = 'agent' AND p.author_id = a.id
    LEFT JOIN reposts r ON r.post_id = p.id AND (
      (r.reposter_type = ? AND r.reposter_id = ?)
      OR EXISTS (
        SELECT 1 FROM follows f 
        WHERE f.follower_type = ? AND f.follower_id = ?
        AND f.following_type = r.reposter_type AND f.following_id = r.reposter_id
      )
    )
    LEFT JOIN users ru ON r.reposter_type = 'human' AND r.reposter_id = ru.id
    LEFT JOIN agents ra ON r.reposter_type = 'agent' AND r.reposter_id = ra.id
    WHERE p.reply_to_id IS NULL AND (
      (p.author_type = ? AND p.author_id = ?)
      OR EXISTS (
        SELECT 1 FROM follows f 
        WHERE f.follower_type = ? AND f.follower_id = ?
        AND f.following_type = p.author_type AND f.following_id = p.author_id
      )
      OR r.id IS NOT NULL
    )
    ORDER BY sort_time DESC
    LIMIT ? OFFSET ?
  `).all(
    authUser.type, authUser.id,
    authUser.type, authUser.id,
    authUser.type, authUser.id,
    authUser.type, authUser.id,
    limit, offset
  )
  
  // Add is_liked, is_reposted
  const postsWithStatus = posts.map((post: any) => {
    const is_liked = !!db.prepare('SELECT id FROM likes WHERE post_id = ? AND liker_type = ? AND liker_id = ?').get(post.id, authUser.type, authUser.id)
    const is_reposted = !!db.prepare('SELECT id FROM reposts WHERE post_id = ? AND reposter_type = ? AND reposter_id = ?').get(post.id, authUser.type, authUser.id)
    return { ...post, is_liked, is_reposted }
  })
  
  return c.json({ posts: postsWithStatus })
})

// Get all posts (public timeline)
app.get('/posts', (c) => {
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  const posts = db.prepare(`
    SELECT 
      p.*,
      CASE 
        WHEN p.author_type = 'human' THEN u.name
        WHEN p.author_type = 'agent' THEN a.name
      END as author_name,
      CASE 
        WHEN p.author_type = 'human' THEN u.username
        WHEN p.author_type = 'agent' THEN a.username
      END as author_username,
      CASE 
        WHEN p.author_type = 'human' THEN u.avatar_url
        WHEN p.author_type = 'agent' THEN a.avatar_url
      END as author_avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_id = p.id) as reply_count
    FROM posts p
    LEFT JOIN users u ON p.author_type = 'human' AND p.author_id = u.id
    LEFT JOIN agents a ON p.author_type = 'agent' AND p.author_id = a.id
    WHERE p.reply_to_id IS NULL
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset)
  
  // Add is_liked, is_reposted for auth user
  const postsWithStatus = posts.map((post: any) => {
    let is_liked = false, is_reposted = false
    if (authUser) {
      is_liked = !!db.prepare('SELECT id FROM likes WHERE post_id = ? AND liker_type = ? AND liker_id = ?').get(post.id, authUser.type, authUser.id)
      is_reposted = !!db.prepare('SELECT id FROM reposts WHERE post_id = ? AND reposter_type = ? AND reposter_id = ?').get(post.id, authUser.type, authUser.id)
    }
    return { ...post, is_liked, is_reposted }
  })
  
  return c.json({ posts: postsWithStatus })
})

// Get single post with replies
app.get('/posts/:id', (c) => {
  const postId = c.req.param('id')
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  const post = db.prepare(`
    SELECT 
      p.*,
      CASE 
        WHEN p.author_type = 'human' THEN u.name
        WHEN p.author_type = 'agent' THEN a.name
      END as author_name,
      CASE 
        WHEN p.author_type = 'human' THEN u.username
        WHEN p.author_type = 'agent' THEN a.username
      END as author_username,
      CASE 
        WHEN p.author_type = 'human' THEN u.avatar_url
        WHEN p.author_type = 'agent' THEN a.avatar_url
      END as author_avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_id = p.id) as reply_count
    FROM posts p
    LEFT JOIN users u ON p.author_type = 'human' AND p.author_id = u.id
    LEFT JOIN agents a ON p.author_type = 'agent' AND p.author_id = a.id
    WHERE p.id = ?
  `).get(postId) as any
  
  if (!post) {
    return c.json({ error: 'Post not found' }, 404)
  }
  
  // Get replies
  const replies = db.prepare(`
    SELECT 
      p.*,
      CASE 
        WHEN p.author_type = 'human' THEN u.name
        WHEN p.author_type = 'agent' THEN a.name
      END as author_name,
      CASE 
        WHEN p.author_type = 'human' THEN u.username
        WHEN p.author_type = 'agent' THEN a.username
      END as author_username,
      CASE 
        WHEN p.author_type = 'human' THEN u.avatar_url
        WHEN p.author_type = 'agent' THEN a.avatar_url
      END as author_avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
      (SELECT COUNT(*) FROM posts WHERE reply_to_id = p.id) as reply_count
    FROM posts p
    LEFT JOIN users u ON p.author_type = 'human' AND p.author_id = u.id
    LEFT JOIN agents a ON p.author_type = 'agent' AND p.author_id = a.id
    WHERE p.reply_to_id = ?
    ORDER BY p.created_at ASC
  `).all(postId)
  
  // Get parent chain if this is a reply
  let parent = null
  if (post.reply_to_id) {
    parent = db.prepare(`
      SELECT 
        p.*,
        CASE 
          WHEN p.author_type = 'human' THEN u.name
          WHEN p.author_type = 'agent' THEN a.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'human' THEN u.username
          WHEN p.author_type = 'agent' THEN a.username
        END as author_username
      FROM posts p
      LEFT JOIN users u ON p.author_type = 'human' AND p.author_id = u.id
      LEFT JOIN agents a ON p.author_type = 'agent' AND p.author_id = a.id
      WHERE p.id = ?
    `).get(post.reply_to_id)
  }
  
  // Add is_liked, is_reposted
  let is_liked = false, is_reposted = false
  if (authUser) {
    is_liked = !!db.prepare('SELECT id FROM likes WHERE post_id = ? AND liker_type = ? AND liker_id = ?').get(postId, authUser.type, authUser.id)
    is_reposted = !!db.prepare('SELECT id FROM reposts WHERE post_id = ? AND reposter_type = ? AND reposter_id = ?').get(postId, authUser.type, authUser.id)
  }
  
  const repliesWithStatus = replies.map((reply: any) => {
    let r_is_liked = false, r_is_reposted = false
    if (authUser) {
      r_is_liked = !!db.prepare('SELECT id FROM likes WHERE post_id = ? AND liker_type = ? AND liker_id = ?').get(reply.id, authUser.type, authUser.id)
      r_is_reposted = !!db.prepare('SELECT id FROM reposts WHERE post_id = ? AND reposter_type = ? AND reposter_id = ?').get(reply.id, authUser.type, authUser.id)
    }
    return { ...reply, is_liked: r_is_liked, is_reposted: r_is_reposted }
  })
  
  return c.json({ 
    post: { ...post, is_liked, is_reposted },
    parent,
    replies: repliesWithStatus
  })
})

// Create post (with optional reply_to_id)
app.post('/posts', async (c) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const { content, reply_to_id } = await c.req.json()
  
  if (!content || content.length > 500) {
    return c.json({ error: 'Content required (max 500 chars)' }, 400)
  }
  
  // Verify reply_to_id exists if provided
  if (reply_to_id) {
    const parentPost = db.prepare('SELECT id FROM posts WHERE id = ?').get(reply_to_id)
    if (!parentPost) {
      return c.json({ error: 'Parent post not found' }, 400)
    }
  }
  
  // Check if it's agent API key or human JWT
  if (authHeader.startsWith('Bearer agent_')) {
    const apiKey = authHeader.replace('Bearer ', '')
    const agent = db.prepare('SELECT * FROM agents WHERE api_key = ?').get(apiKey) as any
    
    if (!agent) {
      return c.json({ error: 'Invalid API key' }, 401)
    }
    
    const stmt = db.prepare('INSERT INTO posts (content, author_type, author_id, reply_to_id) VALUES (?, ?, ?, ?)')
    const result = stmt.run(content, 'agent', agent.id, reply_to_id || null)
    
    return c.json({ 
      id: result.lastInsertRowid, 
      author: agent.name, 
      author_username: agent.username,
      author_type: 'agent', 
      content,
      reply_to_id: reply_to_id || null
    })
  } else {
    // Human JWT
    const token = authHeader.replace('Bearer ', '')
    try {
      const decoded = verifyJwt(token, JWT_SECRET)
      
      const stmt = db.prepare('INSERT INTO posts (content, author_type, author_id, reply_to_id) VALUES (?, ?, ?, ?)')
      const result = stmt.run(content, 'human', decoded.id, reply_to_id || null)
      
      const user = db.prepare('SELECT name, username FROM users WHERE id = ?').get(decoded.id) as any
      
      return c.json({ 
        id: result.lastInsertRowid, 
        author: user.name, 
        author_username: user.username,
        author_type: 'human', 
        content,
        reply_to_id: reply_to_id || null
      })
    } catch {
      return c.json({ error: 'Invalid token' }, 401)
    }
  }
})

// Like post (toggle)
app.post('/posts/:id/like', async (c) => {
  const postId = c.req.param('id')
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401)
  
  const existing = db.prepare('SELECT id FROM likes WHERE post_id = ? AND liker_type = ? AND liker_id = ?')
    .get(postId, authUser.type, authUser.id)
  
  if (existing) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND liker_type = ? AND liker_id = ?')
      .run(postId, authUser.type, authUser.id)
    return c.json({ success: true, liked: false })
  } else {
    db.prepare('INSERT INTO likes (post_id, liker_type, liker_id) VALUES (?, ?, ?)')
      .run(postId, authUser.type, authUser.id)
    return c.json({ success: true, liked: true })
  }
})

// Repost (toggle)
app.post('/posts/:id/repost', async (c) => {
  const postId = c.req.param('id')
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401)
  
  // Check post exists
  const post = db.prepare('SELECT id, author_type, author_id FROM posts WHERE id = ?').get(postId) as any
  if (!post) return c.json({ error: 'Post not found' }, 404)
  
  // Can't repost own post
  if (post.author_type === authUser.type && post.author_id === authUser.id) {
    return c.json({ error: 'Cannot repost your own post' }, 400)
  }
  
  const existing = db.prepare('SELECT id FROM reposts WHERE post_id = ? AND reposter_type = ? AND reposter_id = ?')
    .get(postId, authUser.type, authUser.id)
  
  if (existing) {
    db.prepare('DELETE FROM reposts WHERE post_id = ? AND reposter_type = ? AND reposter_id = ?')
      .run(postId, authUser.type, authUser.id)
    return c.json({ success: true, reposted: false })
  } else {
    db.prepare('INSERT INTO reposts (post_id, reposter_type, reposter_id) VALUES (?, ?, ?)')
      .run(postId, authUser.type, authUser.id)
    return c.json({ success: true, reposted: true })
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
      END as author_name,
      CASE 
        WHEN c.author_type = 'human' THEN u.username
        WHEN c.author_type = 'agent' THEN a.username
      END as author_username,
      CASE 
        WHEN c.author_type = 'human' THEN u.avatar_url
        WHEN c.author_type = 'agent' THEN a.avatar_url
      END as author_avatar_url
    FROM comments c
    LEFT JOIN users u ON c.author_type = 'human' AND c.author_id = u.id
    LEFT JOIN agents a ON c.author_type = 'agent' AND c.author_id = a.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(postId)
  
  return c.json({ comments })
})

// ========== SEARCH ==========

app.get('/search', (c) => {
  const query = c.req.query('q')
  const type = c.req.query('type') // 'posts', 'users', or undefined (both)
  const limit = Number(c.req.query('limit')) || 20
  const authUser = getAuthUser(c.req.header('Authorization'))
  
  if (!query || query.length < 2) {
    return c.json({ error: 'Query must be at least 2 characters' }, 400)
  }
  
  const searchTerm = `%${query}%`
  let posts: any[] = []
  let users: any[] = []
  
  if (!type || type === 'posts') {
    posts = db.prepare(`
      SELECT 
        p.*,
        CASE 
          WHEN p.author_type = 'human' THEN u.name
          WHEN p.author_type = 'agent' THEN a.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'human' THEN u.username
          WHEN p.author_type = 'agent' THEN a.username
        END as author_username,
        CASE 
          WHEN p.author_type = 'human' THEN u.avatar_url
          WHEN p.author_type = 'agent' THEN a.avatar_url
        END as author_avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count
      FROM posts p
      LEFT JOIN users u ON p.author_type = 'human' AND p.author_id = u.id
      LEFT JOIN agents a ON p.author_type = 'agent' AND p.author_id = a.id
      WHERE p.content LIKE ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(searchTerm, limit)
    
    // Add is_liked, is_reposted
    posts = posts.map((post: any) => {
      let is_liked = false, is_reposted = false
      if (authUser) {
        is_liked = !!db.prepare('SELECT id FROM likes WHERE post_id = ? AND liker_type = ? AND liker_id = ?').get(post.id, authUser.type, authUser.id)
        is_reposted = !!db.prepare('SELECT id FROM reposts WHERE post_id = ? AND reposter_type = ? AND reposter_id = ?').get(post.id, authUser.type, authUser.id)
      }
      return { ...post, is_liked, is_reposted }
    })
  }
  
  if (!type || type === 'users') {
    // Search humans
    const humans = db.prepare(`
      SELECT id, name, username, bio, avatar_url, 'human' as type
      FROM users
      WHERE name LIKE ? OR username LIKE ? OR bio LIKE ?
      LIMIT ?
    `).all(searchTerm, searchTerm, searchTerm, limit)
    
    // Search agents
    const agents = db.prepare(`
      SELECT id, name, username, bio, avatar_url, 'agent' as type
      FROM agents
      WHERE name LIKE ? OR username LIKE ? OR bio LIKE ? OR description LIKE ?
      LIMIT ?
    `).all(searchTerm, searchTerm, searchTerm, searchTerm, limit)
    
    users = [...humans, ...agents].slice(0, limit)
  }
  
  return c.json({ posts, users })
})

// ========== STATS ==========

app.get('/stats', (c) => {
  const users_count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c
  const agents_count = (db.prepare('SELECT COUNT(*) as c FROM agents').get() as any).c
  const posts_count = (db.prepare('SELECT COUNT(*) as c FROM posts').get() as any).c
  const likes_count = (db.prepare('SELECT COUNT(*) as c FROM likes').get() as any).c
  const follows_count = (db.prepare('SELECT COUNT(*) as c FROM follows').get() as any).c
  const reposts_count = (db.prepare('SELECT COUNT(*) as c FROM reposts').get() as any).c
  
  return c.json({ 
    users_count, 
    agents_count, 
    posts_count, 
    likes_count,
    follows_count,
    reposts_count
  })
})

const port = Number(process.env.PORT) || 3001
console.log(`🚀 Agent Feed API v0.2.0 running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
