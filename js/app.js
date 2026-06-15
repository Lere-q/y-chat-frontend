function formatDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} Minuten`
  if (diffHour < 24) return `vor ${diffHour} Stunden`
  if (diffDay < 7) return `vor ${diffDay} Tagen`
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function getAvatarHtml(user, size) {
  if (!user) return ''
  const sizeMap = { sm: 'avatar-sm', md: 'avatar-md', lg: 'avatar-lg', xl: 'avatar-xl' }
  const cls = sizeMap[size] || 'avatar-md'
  if (user.image) {
    return `<img src="${escapeHtml(user.image)}" alt="${escapeHtml(user.name)}" class="avatar ${cls}">`
  }
  const initials = (user.name || '?').split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)
  return `<div class="avatar-placeholder ${cls}">${initials}</div>`
}

function createPostCard(post) {
  const likedClass = post.isLiked ? 'liked' : ''
  const repostedClass = post.isReposted ? 'reposted' : ''
  const bookmarkedClass = post.isBookmarked ? 'bookmarked' : ''

  return `
    <div class="post-card" data-id="${post.id}">
      <div class="post-card-inner">
        <div class="post-avatar">
          <a href="profile.html?id=${post.author.id}">${getAvatarHtml(post.author, 'md')}</a>
        </div>
        <div class="post-body">
          <div class="post-header">
            <a href="profile.html?id=${post.author.id}" class="post-author-name">${escapeHtml(post.author.name)}</a>
            <a href="community.html?slug=${post.community.slug}" class="post-community-name">r/${escapeHtml(post.community.slug)}</a>
            <span class="post-separator">·</span>
            <span class="post-time">${formatDate(post.createdAt)}</span>
          </div>
          <a href="post.html?id=${post.id}" style="text-decoration:none;color:inherit">
            <div class="post-content">${escapeHtml(post.content)}</div>
          </a>
          ${post.image ? `<div class="post-image-container"><img src="${escapeHtml(post.image)}" alt="" onclick="event.stopPropagation();window.open(this.src)" loading="lazy"></div>` : ''}
          <div class="post-actions">
            <button class="post-action-btn ${likedClass}" onclick="event.stopPropagation();toggleLike('${post.id}', this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              ${post._count.likes > 0 ? `<span>${post._count.likes}</span>` : ''}
            </button>
            <a href="post.html?id=${post.id}" class="post-action-btn reply" style="text-decoration:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${post._count.replies > 0 ? `<span>${post._count.replies}</span>` : ''}
            </a>
            <button class="post-action-btn repost ${repostedClass}" onclick="event.stopPropagation();toggleRepost('${post.id}', this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              ${post._count.reposts > 0 ? `<span>${post._count.reposts}</span>` : ''}
            </button>
            <button class="post-action-btn bookmark ${bookmarkedClass}" onclick="event.stopPropagation();toggleBookmark('${post.id}', this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
}

async function toggleLike(postId, btn) {
  try {
    const method = btn.classList.contains('liked') ? 'DELETE' : 'POST'
    const res = await api(`/posts/${postId}/like`, { method })
    const span = btn.querySelector('span')
    if (span) span.textContent = res.data.count || ''
    btn.classList.toggle('liked')
  } catch {}
}

async function toggleRepost(postId, btn) {
  try {
    const method = btn.classList.contains('reposted') ? 'DELETE' : 'POST'
    const res = await api(`/posts/${postId}/repost`, { method })
    const span = btn.querySelector('span')
    if (span) span.textContent = res.data.count || ''
    btn.classList.toggle('reposted')
  } catch {}
}

async function toggleBookmark(postId, btn) {
  try {
    const method = btn.classList.contains('bookmarked') ? 'DELETE' : 'POST'
    await api(`/posts/${postId}/bookmark`, { method })
    btn.classList.toggle('bookmarked')
  } catch {}
}

function showToast(message, type) {
  const colors = { success: '#22C55E', error: '#EF4444', info: '#4F46E5' }
  const toast = document.createElement('div')
  toast.textContent = message
  Object.assign(toast.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '1000',
    background: '#1E293B', color: '#F1F5F9', padding: '10px 20px',
    borderRadius: '8px', fontSize: '14px',
    border: `1px solid ${colors[type] || colors.info}`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'opacity 0.3s',
  })
  document.body.appendChild(toast)
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300) }, 2500)
}
