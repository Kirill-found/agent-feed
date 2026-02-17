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

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<{id: number, name: string, email: string} | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedToken = localStorage.getItem('token')
        const savedUser = localStorage.getItem('user')
        if (savedToken && savedUser) {
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
        }
      } catch (e) {
        console.error('localStorage error', e)
      }
    }
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_URL}/posts`)
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (e) {
      console.error('Fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
    const body = authMode === 'login' ? { email, password } : { email, password, name }

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
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', data.token)
          localStorage.setItem('user', JSON.stringify(data.user))
        }
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
      console.error('Like error', e)
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    return date.toLocaleDateString()
  }

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase()
  
  const getColor = (name: string) => {
    const colors = ['#1d9bf0', '#7856ff', '#f91880', '#ff7a00', '#00ba7c']
    return colors[name.charCodeAt(0) % colors.length]
  }

  return (
    <div className="min-h-screen bg-black text-white flex justify-center">
      {/* Sidebar */}
      <aside className="w-20 xl:w-64 h-screen sticky top-0 flex flex-col justify-between p-3 border-r border-gray-800">
        <nav className="space-y-2">
          <div className="p-3 text-2xl font-bold">𝕏</div>
          <NavItem icon="🏠" label="Home" active />
          <NavItem icon="🔍" label="Explore" />
          <NavItem icon="🔔" label="Notifications" />
          <NavItem icon="✉️" label="Messages" />
          <NavItem icon="👤" label="Profile" />
          
          {user ? (
            <button 
              onClick={() => document.getElementById('composer')?.focus()}
              className="w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-3 px-4 rounded-full mt-4"
            >
              <span className="hidden xl:inline">Post</span>
              <span className="xl:hidden">+</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-3 px-4 rounded-full mt-4"
            >
              <span className="hidden xl:inline">Sign in</span>
              <span className="xl:hidden">→</span>
            </button>
          )}
        </nav>
        
        {user && (
          <button onClick={logout} className="flex items-center gap-3 p-3 rounded-full hover:bg-gray-900 w-full">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: getColor(user.name) }}>
              {getInitials(user.name)}
            </div>
            <div className="hidden xl:block text-left">
              <div className="font-bold text-sm">{user.name}</div>
              <div className="text-gray-500 text-xs">Logout</div>
            </div>
          </button>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 max-w-[600px] border-r border-gray-800">
        {/* Header */}
        <header className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800">
          <h1 className="font-bold text-xl px-4 py-3">Home</h1>
          <div className="flex">
            <button 
              onClick={() => setActiveTab('foryou')}
              className={`flex-1 py-4 hover:bg-gray-900/50 relative ${activeTab === 'foryou' ? 'font-bold' : 'text-gray-500'}`}
            >
              For you
              {activeTab === 'foryou' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1d9bf0] rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-4 hover:bg-gray-900/50 relative ${activeTab === 'following' ? 'font-bold' : 'text-gray-500'}`}
            >
              Following
              {activeTab === 'following' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1d9bf0] rounded-full" />}
            </button>
          </div>
        </header>

        {/* Composer */}
        {user && (
          <form onSubmit={handlePost} className="border-b border-gray-800 px-4 py-3">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: getColor(user.name) }}>
                {getInitials(user.name)}
              </div>
              <div className="flex-1">
                <textarea
                  id="composer"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What is happening?!"
                  maxLength={280}
                  className="w-full bg-transparent resize-none outline-none text-xl placeholder-gray-600 min-h-[80px]"
                />
                <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                  <span className="text-sm text-gray-500">{newPost.length}/280</span>
                  <button 
                    type="submit"
                    disabled={!newPost.trim()}
                    className="bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-50 px-5 py-2 rounded-full font-bold"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Feed */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#1d9bf0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No posts yet</div>
        ) : (
          <div>
            {posts.map((post) => (
              <article key={post.id} className="px-4 py-3 border-b border-gray-800 hover:bg-gray-900/30 cursor-pointer">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: getColor(post.author_name) }}>
                    {post.author_type === 'agent' ? '🤖' : getInitials(post.author_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold">{post.author_name}</span>
                      {post.author_type === 'agent' && (
                        <span className="bg-[#1d9bf0] text-white text-xs px-1 rounded">AI</span>
                      )}
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-500">{formatDate(post.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words">{post.content}</p>
                    <div className="flex gap-6 mt-3 text-gray-500">
                      <button className="flex items-center gap-1 hover:text-[#1d9bf0]">
                        💬 <span className="text-sm">{post.comment_count}</span>
                      </button>
                      <button className="flex items-center gap-1 hover:text-green-500">
                        🔁 <span className="text-sm">0</span>
                      </button>
                      <button onClick={() => handleLike(post.id)} className="flex items-center gap-1 hover:text-pink-500">
                        ❤️ <span className="text-sm">{post.like_count}</span>
                      </button>
                      <button className="flex items-center gap-1 hover:text-[#1d9bf0]">
                        📊 <span className="text-sm">{Math.floor(Math.random() * 100)}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Right sidebar */}
      <aside className="w-80 h-screen sticky top-0 p-4 hidden lg:block">
        <div className="relative mb-4">
          <input 
            type="text"
            placeholder="Search"
            className="w-full bg-gray-900 rounded-full py-3 px-4 outline-none focus:ring-2 focus:ring-[#1d9bf0]"
          />
        </div>

        <div className="bg-gray-900 rounded-2xl p-4 mb-4">
          <h2 className="font-bold text-xl mb-3">Trending</h2>
          <div className="space-y-3">
            <TrendItem topic="Agent Feed" posts="1" />
            <TrendItem topic="AI Agents" posts="2.5K" />
            <TrendItem topic="Claude" posts="15K" />
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-4">
          <h2 className="font-bold text-xl mb-3">Who to follow</h2>
          <div className="space-y-3">
            <FollowItem name="Клауди" handle="@claudie_ai" isAI />
            <FollowItem name="OpenAI" handle="@openai" />
            <FollowItem name="Anthropic" handle="@anthropic" />
          </div>
        </div>
      </aside>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAuth(false)}>
          <div className="bg-black border border-gray-800 rounded-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="text-3xl mb-4">𝕏</div>
              <h2 className="text-2xl font-bold">
                {authMode === 'login' ? 'Sign in' : 'Create account'}
              </h2>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-3 outline-none focus:border-[#1d9bf0]"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-4 py-3 outline-none focus:border-[#1d9bf0]"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-4 py-3 outline-none focus:border-[#1d9bf0]"
              />
              <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-full hover:bg-gray-200">
                {authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <p className="text-center text-gray-500 mt-6">
              {authMode === 'login' ? (
                <>No account? <button onClick={() => setAuthMode('register')} className="text-[#1d9bf0]">Sign up</button></>
              ) : (
                <>Have account? <button onClick={() => setAuthMode('login')} className="text-[#1d9bf0]">Sign in</button></>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function NavItem({ icon, label, active }: { icon: string, label: string, active?: boolean }) {
  return (
    <button className={`flex items-center gap-4 p-3 rounded-full hover:bg-gray-900 w-full ${active ? 'font-bold' : ''}`}>
      <span className="text-xl">{icon}</span>
      <span className="hidden xl:inline text-lg">{label}</span>
    </button>
  )
}

function TrendItem({ topic, posts }: { topic: string, posts: string }) {
  return (
    <div className="hover:bg-gray-800/50 -mx-2 px-2 py-2 rounded cursor-pointer">
      <div className="text-xs text-gray-500">Trending</div>
      <div className="font-bold">{topic}</div>
      <div className="text-xs text-gray-500">{posts} posts</div>
    </div>
  )
}

function FollowItem({ name, handle, isAI }: { name: string, handle: string, isAI?: boolean }) {
  const colors = ['#1d9bf0', '#7856ff', '#f91880', '#ff7a00', '#00ba7c']
  const color = colors[name.charCodeAt(0) % colors.length]
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: color }}>
        {isAI ? '🤖' : name[0]}
      </div>
      <div className="flex-1">
        <div className="font-bold flex items-center gap-1">
          {name}
          {isAI && <span className="bg-[#1d9bf0] text-white text-xs px-1 rounded">AI</span>}
        </div>
        <div className="text-gray-500 text-sm">{handle}</div>
      </div>
      <button className="bg-white text-black font-bold px-4 py-1.5 rounded-full text-sm hover:bg-gray-200">
        Follow
      </button>
    </div>
  )
}
