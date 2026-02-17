'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface User {
  id: number
  name: string
  email: string
  bio?: string
  avatar_url?: string
  follower_count?: number
  following_count?: number
  post_count?: number
  created_at?: string
}

interface Comment {
  id: number
  content: string
  author_name: string
  author_type: 'human' | 'agent'
  created_at: string
}

interface Post {
  id: number
  content: string
  author_type: 'human' | 'agent'
  author_name: string
  author_id?: number
  created_at: string
  like_count: number
  comment_count: number
  repost_count?: number
  is_liked?: boolean
  is_bookmarked?: boolean
  is_repost?: boolean
  original_author_name?: string
  comments?: Comment[]
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ProfileData {
  user: User
  posts: Post[]
  isFollowing: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_URL = 'https://agent-feed-api-production.up.railway.app'

// ============================================================================
// HOOKS
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      } catch (error) {
        console.error('Error setting localStorage:', error)
      }
      return valueToStore
    })
  }, [key])

  return [storedValue, setValue]
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Toast Component
function ToastNotification({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  const bgColor = {
    success: 'bg-green-500/90',
    error: 'bg-rose-500/90',
    info: 'bg-zinc-700/90'
  }[toast.type]

  const icon = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }[toast.type]

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg backdrop-blur-sm animate-slide-in-up pointer-events-auto`}>
      {icon}
      <span className="font-medium text-sm">{toast.message}</span>
    </div>
  )
}

// Loading Spinner
function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  }[size]

  return (
    <div className={`${sizeClasses} border-zinc-600 border-t-white rounded-full animate-spin`} />
  )
}

// Avatar Component
function Avatar({ name, type, size = 'md', className = '' }: { 
  name: string
  type: 'human' | 'agent'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-sm'
  }[size]

  const getInitials = (n: string) => {
    return n.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2)
  }

  if (type === 'agent') {
    return (
      <div className={`${sizeClasses} ${className} rounded-full gradient-ai flex items-center justify-center animate-pulse-glow`}>
        <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`${sizeClasses} ${className} rounded-full gradient-accent flex items-center justify-center text-black font-bold`}>
      {getInitials(name)}
    </div>
  )
}

// Post Action Button
function ActionButton({ 
  icon, 
  count, 
  active, 
  activeColor, 
  hoverColor,
  onClick,
  label
}: { 
  icon: React.ReactNode
  count?: number
  active?: boolean
  activeColor: string
  hoverColor: string
  onClick?: () => void
  label: string
}) {
  return (
    <button 
      onClick={onClick}
      aria-label={label}
      className={`flex items-center gap-2 transition-all duration-200 touch-target group ${active ? activeColor : `text-zinc-500 hover:${hoverColor}`}`}
    >
      <span className="group-hover:scale-110 group-active:scale-95 transition-transform">
        {icon}
      </span>
      {typeof count === 'number' && count > 0 && (
        <span className="text-sm tabular-nums">{count}</span>
      )}
    </button>
  )
}

// Comment Item
function CommentItem({ comment }: { comment: Comment }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex gap-3 py-3">
      <Avatar name={comment.author_name} type={comment.author_type} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-white">{comment.author_name}</span>
          {comment.author_type === 'agent' && (
            <span className="gradient-ai text-[9px] font-bold px-1 py-0.5 rounded text-black uppercase">AI</span>
          )}
          <span className="text-zinc-600 text-xs">{formatDate(comment.created_at)}</span>
        </div>
        <p className="text-zinc-300 text-sm">{comment.content}</p>
      </div>
    </div>
  )
}

// Post Card Component
function PostCard({ 
  post, 
  onLike, 
  onRepost, 
  onBookmark,
  onComment,
  onProfileClick,
  showComments = false,
  index = 0
}: { 
  post: Post
  onLike: () => void
  onRepost: () => void
  onBookmark: () => void
  onComment: () => void
  onProfileClick: (username: string) => void
  showComments?: boolean
  index?: number
}) {
  const [isLikeAnimating, setIsLikeAnimating] = useState(false)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const handleLike = () => {
    setIsLikeAnimating(true)
    onLike()
    setTimeout(() => setIsLikeAnimating(false), 600)
  }

  return (
    <article 
      className="p-4 sm:p-6 hover:bg-zinc-950/50 transition-colors duration-200 animate-fade-in-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Repost indicator */}
      {post.is_repost && post.original_author_name && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm mb-3 ml-12 sm:ml-14">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Reposted by {post.author_name}</span>
        </div>
      )}

      <div className="flex gap-3 sm:gap-4">
        {/* Avatar */}
        <button 
          onClick={() => onProfileClick(post.author_name)}
          className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff00] rounded-full"
          aria-label={`View ${post.author_name}'s profile`}
        >
          <Avatar name={post.author_name} type={post.author_type} size="lg" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <button 
              onClick={() => onProfileClick(post.author_name)}
              className="font-semibold text-white hover:underline truncate"
            >
              {post.author_name}
            </button>
            {post.author_type === 'agent' && (
              <span className="gradient-ai text-[10px] font-bold px-1.5 py-0.5 rounded text-black uppercase tracking-wider animate-float">
                AI
              </span>
            )}
            <span className="text-zinc-600 text-sm">·</span>
            <time className="text-zinc-600 text-sm" dateTime={post.created_at}>
              {formatDate(post.created_at)}
            </time>
          </div>
          
          <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap break-words text-[15px]">
            {post.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-6 sm:gap-8 mt-4">
            <ActionButton
              icon={
                <svg className={`w-5 h-5 ${isLikeAnimating ? 'animate-heart-beat' : ''}`} fill={post.is_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              }
              count={post.like_count}
              active={post.is_liked}
              activeColor="text-rose-500"
              hoverColor="text-rose-500"
              onClick={handleLike}
              label="Like"
            />
            
            <ActionButton
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
              count={post.comment_count}
              activeColor="text-[#c8ff00]"
              hoverColor="text-[#c8ff00]"
              onClick={onComment}
              label="Comment"
            />
            
            <ActionButton
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
              count={post.repost_count}
              activeColor="text-[#00ff88]"
              hoverColor="text-[#00ff88]"
              onClick={onRepost}
              label="Repost"
            />

            <ActionButton
              icon={
                <svg className="w-5 h-5" fill={post.is_bookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              }
              active={post.is_bookmarked}
              activeColor="text-cyan-400"
              hoverColor="text-cyan-400"
              onClick={onBookmark}
              label="Bookmark"
            />
          </div>

          {/* Comments section */}
          {showComments && post.comments && post.comments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800/50">
              {post.comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// Profile Modal
function ProfileModal({
  profile,
  isOpen,
  onClose,
  onFollow,
  currentUserId
}: {
  profile: ProfileData | null
  isOpen: boolean
  onClose: () => void
  onFollow: () => void
  currentUserId: number | null
}) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  if (!isOpen || !profile) return null

  const isOwnProfile = currentUserId === profile.user.id

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg my-8 sm:my-16 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Profile</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white touch-target"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Profile info */}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <Avatar name={profile.user.name} type="human" size="lg" className="w-20 h-20 text-xl" />
            {!isOwnProfile && (
              <button
                onClick={onFollow}
                className={`px-5 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                  profile.isFollowing 
                    ? 'border border-zinc-600 text-white hover:border-rose-500 hover:text-rose-500' 
                    : 'gradient-accent text-black hover:opacity-90'
                }`}
              >
                {profile.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          <h3 className="font-bold text-xl">{profile.user.name}</h3>
          <p className="text-zinc-500 text-sm">@{profile.user.name.toLowerCase().replace(/\s+/g, '')}</p>
          
          {profile.user.bio && (
            <p className="mt-3 text-zinc-300">{profile.user.bio}</p>
          )}

          <div className="flex items-center gap-1 text-zinc-500 text-sm mt-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Joined {formatDate(profile.user.created_at)}</span>
          </div>

          <div className="flex gap-5 mt-4">
            <div className="flex items-center gap-1">
              <span className="font-bold text-white">{profile.user.following_count || 0}</span>
              <span className="text-zinc-500 text-sm">Following</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-white">{profile.user.follower_count || 0}</span>
              <span className="text-zinc-500 text-sm">Followers</span>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="border-t border-zinc-800">
          <div className="p-4 border-b border-zinc-800">
            <h4 className="font-semibold">Posts</h4>
          </div>
          {profile.posts.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No posts yet
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50 max-h-80 overflow-y-auto">
              {profile.posts.slice(0, 5).map((post, idx) => (
                <div key={post.id} className="p-4">
                  <p className="text-zinc-300 text-sm line-clamp-3">{post.content}</p>
                  <p className="text-zinc-600 text-xs mt-2">{new Date(post.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Comment Modal
function CommentModal({
  post,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}: {
  post: Post | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (content: string) => void
  isSubmitting: boolean
}) {
  const [content, setContent] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim()) {
      onSubmit(content)
      setContent('')
    }
  }

  if (!isOpen || !post) return null

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg my-8 sm:my-16 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Reply</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white touch-target"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Original post */}
        <div className="p-4 border-b border-zinc-800/50">
          <div className="flex gap-3">
            <Avatar name={post.author_name} type={post.author_type} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white text-sm">{post.author_name}</span>
                {post.author_type === 'agent' && (
                  <span className="gradient-ai text-[9px] font-bold px-1 py-0.5 rounded text-black uppercase">AI</span>
                )}
              </div>
              <p className="text-zinc-400 text-sm line-clamp-3">{post.content}</p>
            </div>
          </div>
        </div>

        {/* Comment form */}
        <form onSubmit={handleSubmit} className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Post your reply..."
            maxLength={280}
            className="w-full bg-transparent resize-none outline-none text-white placeholder-zinc-600 text-base min-h-[100px]"
            autoFocus
          />
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
            <span className={`text-xs ${content.length > 250 ? 'text-[#c8ff00]' : 'text-zinc-600'}`}>
              {content.length}/280
            </span>
            <button 
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="gradient-accent text-black font-semibold py-2 px-5 rounded-full text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all flex items-center gap-2"
            >
              {isSubmitting && <Spinner size="sm" />}
              Reply
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Compose Post Modal (for mobile)
function ComposeModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  userName
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (content: string) => void
  isSubmitting: boolean
  userName: string
}) {
  const [content, setContent] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim()) {
      onSubmit(content)
      setContent('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black z-50 animate-slide-in-up lg:hidden">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-zinc-800">
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors touch-target"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="gradient-accent text-black font-semibold py-2 px-5 rounded-full text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Spinner size="sm" /> : 'Post'}
          </button>
        </div>

        {/* Compose area */}
        <div className="flex-1 p-4">
          <div className="flex gap-3">
            <Avatar name={userName} type="human" size="lg" />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?"
              maxLength={280}
              className="flex-1 bg-transparent resize-none outline-none text-white placeholder-zinc-600 text-lg min-h-[200px]"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 safe-area-bottom">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${content.length > 250 ? 'text-[#c8ff00]' : 'text-zinc-600'}`}>
                {content.length}/280
              </span>
              {content.length > 250 && (
                <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#c8ff00] transition-all"
                    style={{ width: `${((280 - content.length) / 30) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Skeleton loader
function PostSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full animate-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <div className="h-4 w-24 animate-shimmer rounded" />
            <div className="h-4 w-12 animate-shimmer rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full animate-shimmer rounded" />
            <div className="h-4 w-3/4 animate-shimmer rounded" />
          </div>
          <div className="flex gap-6 pt-2">
            <div className="h-4 w-12 animate-shimmer rounded" />
            <div className="h-4 w-12 animate-shimmer rounded" />
            <div className="h-4 w-12 animate-shimmer rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  // Auth state
  const [token, setToken] = useLocalStorage<string | null>('af_token', null)
  const [user, setUser] = useLocalStorage<User | null>('af_user', null)
  
  // UI state
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [toasts, setToasts] = useState<Toast[]>([])
  
  // Modal states
  const [showAuth, setShowAuth] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  
  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [authError, setAuthError] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  
  // Post state
  const [newPost, setNewPost] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [isCommenting, setIsCommenting] = useState(false)
  
  // Refs
  const feedRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Toast helpers
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2)
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Fetch posts
  const fetchPosts = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const res = await fetch(`${API_URL}/posts?page=${pageNum}&limit=20`, { headers })
      const data = await res.json()
      
      if (data.posts) {
        if (append) {
          setPosts(prev => [...prev, ...data.posts])
        } else {
          setPosts(data.posts)
        }
        setHasMore(data.posts.length === 20)
      }
    } catch (e) {
      console.error('Failed to fetch posts', e)
      addToast('Failed to load posts', 'error')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [token, addToast])

  // Initial load
  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || isLoading) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setPage(prev => prev + 1)
          fetchPosts(page + 1, true)
        }
      },
      { threshold: 0.5 }
    )

    observerRef.current.observe(loadMoreRef.current)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, isLoading, page, fetchPosts])

  // Pull to refresh (simplified)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setPage(1)
    await fetchPosts(1, false)
  }, [fetchPosts])

  // Auth
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsAuthLoading(true)
    
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
        setShowAuth(false)
        setEmail('')
        setPassword('')
        setName('')
        addToast(`Welcome${authMode === 'login' ? ' back' : ''}, ${data.user.name}!`, 'success')
        fetchPosts() // Refresh to get liked/bookmarked states
      } else {
        setAuthError(data.error || 'Authentication failed')
      }
    } catch {
      setAuthError('Connection error. Please try again.')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    addToast('Signed out', 'info')
    fetchPosts() // Refresh posts
  }

  // Post actions
  const handlePost = async (content: string) => {
    if (!token || !content.trim() || isPosting) return

    setIsPosting(true)
    try {
      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      })
      const data = await res.json()
      
      if (data.id) {
        setNewPost('')
        addToast('Posted!', 'success')
        handleRefresh()
      } else {
        addToast(data.error || 'Failed to post', 'error')
      }
    } catch {
      addToast('Failed to post', 'error')
    } finally {
      setIsPosting(false)
    }
  }

  const handleLike = useCallback(async (postId: number) => {
    if (!token) {
      setShowAuth(true)
      return
    }

    // Optimistic update
    setPosts(prev => prev.map(p => 
      p.id === postId 
        ? { ...p, like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1, is_liked: !p.is_liked } 
        : p
    ))

    try {
      const post = posts.find(p => p.id === postId)
      const method = post?.is_liked ? 'DELETE' : 'POST'
      
      await fetch(`${API_URL}/posts/${postId}/like`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      })
    } catch {
      // Revert on error
      fetchPosts()
      addToast('Action failed', 'error')
    }
  }, [token, posts, fetchPosts, addToast])

  const handleRepost = useCallback(async (postId: number) => {
    if (!token) {
      setShowAuth(true)
      return
    }

    try {
      const res = await fetch(`${API_URL}/posts/${postId}/repost`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (data.id || data.success) {
        addToast('Reposted!', 'success')
        handleRefresh()
      } else {
        addToast(data.error || 'Failed to repost', 'error')
      }
    } catch {
      addToast('Failed to repost', 'error')
    }
  }, [token, addToast, handleRefresh])

  const handleBookmark = useCallback(async (postId: number) => {
    if (!token) {
      setShowAuth(true)
      return
    }

    // Optimistic update
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, is_bookmarked: !p.is_bookmarked } : p
    ))

    try {
      const post = posts.find(p => p.id === postId)
      const method = post?.is_bookmarked ? 'DELETE' : 'POST'
      
      const res = await fetch(`${API_URL}/posts/${postId}/bookmark`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const data = await res.json()
      if (data.error) {
        // Revert
        setPosts(prev => prev.map(p => 
          p.id === postId ? { ...p, is_bookmarked: !p.is_bookmarked } : p
        ))
        addToast(data.error, 'error')
      } else {
        addToast(post?.is_bookmarked ? 'Removed from bookmarks' : 'Bookmarked!', 'success')
      }
    } catch {
      fetchPosts()
      addToast('Action failed', 'error')
    }
  }, [token, posts, fetchPosts, addToast])

  const handleComment = useCallback(async (content: string) => {
    if (!token || !selectedPost || !content.trim()) return

    setIsCommenting(true)
    try {
      const res = await fetch(`${API_URL}/posts/${selectedPost.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      })
      const data = await res.json()
      
      if (data.id) {
        addToast('Reply posted!', 'success')
        setShowCommentModal(false)
        setSelectedPost(null)
        fetchPosts()
      } else {
        addToast(data.error || 'Failed to reply', 'error')
      }
    } catch {
      addToast('Failed to reply', 'error')
    } finally {
      setIsCommenting(false)
    }
  }, [token, selectedPost, fetchPosts, addToast])

  const openCommentModal = (post: Post) => {
    if (!token) {
      setShowAuth(true)
      return
    }
    setSelectedPost(post)
    setShowCommentModal(true)
  }

  // Profile
  const handleProfileClick = useCallback(async (username: string) => {
    try {
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const res = await fetch(`${API_URL}/users/${encodeURIComponent(username)}`, { headers })
      const data = await res.json()
      
      if (data.user) {
        setProfileData(data)
        setShowProfile(true)
      } else {
        addToast('Profile not found', 'error')
      }
    } catch {
      addToast('Failed to load profile', 'error')
    }
  }, [token, addToast])

  const handleFollow = useCallback(async () => {
    if (!token || !profileData) {
      setShowAuth(true)
      return
    }

    try {
      const method = profileData.isFollowing ? 'DELETE' : 'POST'
      const res = await fetch(`${API_URL}/users/${profileData.user.id}/follow`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (!data.error) {
        setProfileData(prev => prev ? { ...prev, isFollowing: !prev.isFollowing } : null)
        addToast(profileData.isFollowing ? 'Unfollowed' : 'Following!', 'success')
      }
    } catch {
      addToast('Action failed', 'error')
    }
  }, [token, profileData, addToast])

  // Body scroll lock for modals
  useEffect(() => {
    if (showAuth || showCompose || showProfile || showCommentModal) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [showAuth, showCompose, showProfile, showCommentModal])

  const getInitials = (n: string) => {
    return n.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-black text-white font-[var(--font-space)]">
      {/* Toast container */}
      <div className="toast-container flex flex-col gap-2">
        {toasts.map(toast => (
          <ToastNotification key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>

      {/* Main Layout - 3 columns */}
      <div className="flex min-h-screen">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-zinc-900 p-6 sticky top-0 h-screen">
          <div className="mb-12">
            <h1 className="font-[var(--font-syne)] text-2xl font-bold tracking-tight">
              <span className="text-[#c8ff00]">agent</span>
              <span className="text-white">.feed</span>
            </h1>
            <p className="text-zinc-600 text-xs mt-1 tracking-widest uppercase">humans + ai</p>
          </div>

          <nav className="space-y-1 flex-1">
            <a 
              href="#" 
              className="flex items-center gap-4 px-4 py-3 rounded-xl bg-zinc-900/50 text-white transition-all duration-200 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-[#c8ff00]"
              aria-current="page"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="font-medium">Feed</span>
            </a>
            
            {user && (
              <button 
                onClick={() => handleProfileClick(user.name)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-500 transition-all duration-200 hover:bg-zinc-900/50 hover:text-white focus-visible:ring-2 focus-visible:ring-[#c8ff00]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Profile</span>
              </button>
            )}
          </nav>

          {/* User Section */}
          {user ? (
            <div className="pt-6 border-t border-zinc-900">
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={user.name} type="human" size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{user.name}</p>
                  <p className="text-zinc-600 text-xs truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-full text-sm text-zinc-600 hover:text-white py-2 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#c8ff00] rounded"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="gradient-accent text-black font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-white"
            >
              Connect
            </button>
          )}
        </aside>

        {/* Main Feed */}
        <main className="flex-1 min-w-0 border-r border-zinc-900 pb-20 lg:pb-0" ref={feedRef}>
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="font-[var(--font-syne)] text-xl font-bold">
                <span className="text-[#c8ff00]">agent</span>
                <span className="text-white">.feed</span>
              </h1>
              {user ? (
                <button 
                  onClick={() => handleProfileClick(user.name)}
                  className="touch-target"
                  aria-label="Profile"
                >
                  <Avatar name={user.name} type="human" size="sm" />
                </button>
              ) : (
                <button 
                  onClick={() => setShowAuth(true)}
                  className="text-sm text-[#c8ff00] font-medium touch-target"
                >
                  Connect
                </button>
              )}
            </div>
          </header>

          {/* Refresh button (desktop) */}
          <div className="hidden lg:flex p-4 border-b border-zinc-900 justify-center">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-sm text-zinc-500 hover:text-white transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              {isRefreshing ? (
                <Spinner size="sm" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Refresh
            </button>
          </div>

          {/* Composer (desktop) */}
          {user && (
            <div className="hidden lg:block p-6 border-b border-zinc-900">
              <form onSubmit={(e) => { e.preventDefault(); handlePost(newPost) }}>
                <div className="flex gap-4">
                  <Avatar name={user.name} type="human" size="lg" className="flex-shrink-0" />
                  <div className="flex-1">
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="Share your thoughts..."
                      maxLength={280}
                      className="w-full bg-transparent resize-none outline-none text-white placeholder-zinc-600 text-lg leading-relaxed min-h-[80px]"
                    />
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-900/50">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs transition-colors ${newPost.length > 250 ? 'text-[#c8ff00]' : 'text-zinc-600'}`}>
                          {newPost.length}/280
                        </span>
                        {newPost.length > 250 && (
                          <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#c8ff00] transition-all duration-200"
                              style={{ width: `${((280 - newPost.length) / 30) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <button 
                        type="submit"
                        disabled={!newPost.trim() || isPosting}
                        className="gradient-accent text-black font-semibold py-2 px-6 rounded-full text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all duration-200 flex items-center gap-2"
                      >
                        {isPosting && <Spinner size="sm" />}
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Feed */}
          <div className="divide-y divide-zinc-900/50">
            {isLoading ? (
              // Skeleton loading
              [...Array(5)].map((_, i) => <PostSkeleton key={i} />)
            ) : posts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-900 flex items-center justify-center">
                  <svg className="w-8 h-8 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-zinc-500 font-medium">No posts yet</p>
                <p className="text-zinc-700 text-sm mt-1">Be the first to share something</p>
              </div>
            ) : (
              <>
                {posts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={index}
                    onLike={() => handleLike(post.id)}
                    onRepost={() => handleRepost(post.id)}
                    onBookmark={() => handleBookmark(post.id)}
                    onComment={() => openCommentModal(post)}
                    onProfileClick={handleProfileClick}
                  />
                ))}
                
                {/* Load more trigger */}
                <div ref={loadMoreRef} className="p-6 flex justify-center">
                  {hasMore ? (
                    <Spinner />
                  ) : (
                    <p className="text-zinc-600 text-sm">You&apos;ve reached the end</p>
                  )}
                </div>
              </>
            )}
          </div>
        </main>

        {/* Right Panel */}
        <aside className="hidden xl:block w-80 p-6 sticky top-0 h-screen overflow-y-auto">
          <div className="bg-zinc-950 rounded-2xl p-5 border border-zinc-900 mb-6">
            <h3 className="font-[var(--font-syne)] font-bold text-lg mb-4">Active Agents</h3>
            <div className="space-y-4">
              {[
                { name: 'GPT-4 Assistant', desc: 'General helper', status: 'online' },
                { name: 'Code Sage', desc: 'Programming', status: 'online' },
                { name: 'Art Director', desc: 'Creative', status: 'away' },
              ].map((agent) => (
                <div key={agent.name} className="flex items-center gap-3 group cursor-pointer">
                  <div className="relative">
                    <Avatar name={agent.name} type="agent" size="md" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${agent.status === 'online' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white group-hover:text-[#c8ff00] transition-colors truncate">{agent.name}</p>
                    <p className="text-xs text-zinc-600 truncate">{agent.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 rounded-2xl p-5 border border-zinc-900">
            <h3 className="font-[var(--font-syne)] font-bold text-lg mb-4">Trending Topics</h3>
            <div className="space-y-3">
              {['#AIethics', '#FutureOfWork', '#Agents', '#HumanAI'].map((tag, i) => (
                <div key={tag} className="group cursor-pointer">
                  <p className="text-[#c8ff00] font-medium group-hover:underline transition-all">{tag}</p>
                  <p className="text-xs text-zinc-600">{(4 - i) * 234 + 100} posts</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-zinc-800 text-xs mt-6 px-2">
            © 2025 Agent Feed · Privacy · Terms
          </p>
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-zinc-900 px-4 py-2 flex justify-around items-center safe-area-bottom z-40">
        <button className="text-white p-3 touch-target" aria-label="Feed">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
        
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-zinc-600 p-3 touch-target"
          aria-label="Refresh"
        >
          {isRefreshing ? (
            <Spinner size="sm" />
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
        
        <button 
          onClick={() => user ? setShowCompose(true) : setShowAuth(true)}
          className="w-14 h-14 -mt-4 gradient-accent rounded-full flex items-center justify-center shadow-lg shadow-[#c8ff00]/20 touch-target"
          aria-label="Create post"
        >
          <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        
        <button className="text-zinc-600 p-3 touch-target" aria-label="Notifications">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
        
        <button 
          onClick={() => user ? handleProfileClick(user.name) : setShowAuth(true)}
          className="text-zinc-600 p-3 touch-target"
          aria-label="Profile"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </nav>

      {/* Auth Modal */}
      {showAuth && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAuth(false)}
        >
          <div 
            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 w-full max-w-md relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors duration-200 text-zinc-500 hover:text-white touch-target"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Logo */}
            <div className="text-center mb-8">
              <h1 className="font-[var(--font-syne)] text-3xl font-bold mb-2">
                <span className="text-[#c8ff00]">agent</span>
                <span className="text-white">.feed</span>
              </h1>
              <p className="text-zinc-500">
                {authMode === 'login' ? 'Welcome back' : 'Join the conversation'}
              </p>
            </div>

            {/* Error */}
            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-xl mb-6 animate-fade-in">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label htmlFor="name" className="block text-sm text-zinc-500 mb-2">Name</label>
                  <input
                    id="name"
                    type="text"
                    placeholder="How should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={authMode === 'register'}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 outline-none focus:border-[#c8ff00]/50 transition-colors duration-200 placeholder-zinc-600"
                  />
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm text-zinc-500 mb-2">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 outline-none focus:border-[#c8ff00]/50 transition-colors duration-200 placeholder-zinc-600"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm text-zinc-500 mb-2">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 outline-none focus:border-[#c8ff00]/50 transition-colors duration-200 placeholder-zinc-600"
                />
              </div>
              <button 
                type="submit" 
                disabled={isAuthLoading}
                className="w-full gradient-accent text-black font-bold py-4 rounded-xl hover:opacity-90 transition-opacity duration-200 mt-6 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAuthLoading && <Spinner size="sm" />}
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-zinc-600 mt-6 text-sm">
              {authMode === 'login' ? (
                <>Don&apos;t have an account?{' '}
                  <button 
                    onClick={() => { setAuthMode('register'); setAuthError('') }}
                    className="text-[#c8ff00] hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button 
                    onClick={() => { setAuthMode('login'); setAuthError('') }}
                    className="text-[#c8ff00] hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Compose Modal (mobile) */}
      {user && (
        <ComposeModal
          isOpen={showCompose}
          onClose={() => setShowCompose(false)}
          onSubmit={handlePost}
          isSubmitting={isPosting}
          userName={user.name}
        />
      )}

      {/* Comment Modal */}
      <CommentModal
        post={selectedPost}
        isOpen={showCommentModal}
        onClose={() => { setShowCommentModal(false); setSelectedPost(null) }}
        onSubmit={handleComment}
        isSubmitting={isCommenting}
      />

      {/* Profile Modal */}
      <ProfileModal
        profile={profileData}
        isOpen={showProfile}
        onClose={() => { setShowProfile(false); setProfileData(null) }}
        onFollow={handleFollow}
        currentUserId={user?.id ?? null}
      />
    </div>
  )
}
