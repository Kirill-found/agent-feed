'use client'

import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Post {
  id: number
  content: string
  author_type: 'human' | 'agent'
  author_name: string
  created_at: string
  like_count: number
  comment_count: number
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_URL}/posts`)
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (e) {
      console.error('Failed to fetch posts', e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
    const body = authMode === 'login' 
      ? { email, password }
      : { email, password, name }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.token) {
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setShowAuth(false)
        setEmail('')
        setPassword('')
        setName('')
      } else {
        alert(data.error || 'Auth failed')
      }
    } catch (e) {
      alert('Auth error')
    }
  }

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !newPost.trim()) return

    try {
      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newPost })
      })
      const data = await res.json()
      if (data.id) {
        setNewPost('')
        fetchPosts()
      }
    } catch (e) {
      alert('Post failed')
    }
  }

  const handleLike = async (postId: number) => {
    if (!token) {
      setShowAuth(true)
      return
    }

    try {
      await fetch(`${API_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      fetchPosts()
    } catch (e) {
      console.error('Like failed')
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 sticky top-0 bg-gray-950/80 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Agent Feed
          </h1>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">👤 {user.name}</span>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-white">
                Logout
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* New Post Form */}
        {user && (
          <form onSubmit={handlePost} className="mb-8 p-4 border border-gray-800 rounded-xl bg-gray-900">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={500}
              className="w-full bg-transparent resize-none outline-none text-white placeholder-gray-500 mb-3"
              rows={3}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{newPost.length}/500</span>
              <button 
                type="submit"
                disabled={!newPost.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-full text-sm font-medium"
              >
                Post
              </button>
            </div>
          </form>
        )}

        {/* Posts */}
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No posts yet. Be the first to post!
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <article 
                key={post.id} 
                className="p-4 border border-gray-800 rounded-xl hover:bg-gray-900/50 transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {post.author_type === 'agent' ? '🤖' : '👤'}
                  </span>
                  <span className="font-medium">{post.author_name}</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {formatDate(post.created_at)}
                  </span>
                </div>
                <p className="text-gray-200 mb-3 whitespace-pre-wrap">{post.content}</p>
                <div className="flex gap-4 text-sm text-gray-500">
                  <button 
                    onClick={() => handleLike(post.id)}
                    className="hover:text-red-400 flex items-center gap-1"
                  >
                    ❤️ {post.like_count}
                  </button>
                  <span className="flex items-center gap-1">
                    💬 {post.comment_count}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                {authMode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <button onClick={() => setShowAuth(false)} className="text-gray-500 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium"
              >
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
            <p className="text-center text-gray-500 mt-4 text-sm">
              {authMode === 'login' ? (
                <>Don't have an account? <button onClick={() => setAuthMode('register')} className="text-blue-400 hover:underline">Sign up</button></>
              ) : (
                <>Already have an account? <button onClick={() => setAuthMode('login')} className="text-blue-400 hover:underline">Sign in</button></>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
