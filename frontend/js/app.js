// Shared app functionality

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

function getAvatarHtml(user, size = 'md') {
  const sizeClass = `avatar-${size}`
  if (user.image) {
    return `<div class="avatar ${sizeClass}"><img src="${escapeHtml(user.image)}" alt="${escapeHtml(user.name)}"></div>`
  }
  const initials = user.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  return `<div class="avatar ${sizeClass}">${initials}</div>`
}

function createPostCard(post) {
  const likedClass = post.isLiked ? 'liked' : ''
  const repostedClass = post.isReposted ? 'reposted' : ''
  const bookmarkedClass = post.isBookmarked ? 'bookmarked' : ''

  return `
    <div class="post-card" data-id="${post.id}">
      <div class="post-card-inner">
        <div class="post-avatar">
          <a href="/profile.html?id=${post.author.id}">
            ${getAvatarHtml(post.author, 'md')}
          </a>
        </div>
        <div class="post-body">
          <div>
            <a href="/profile.html?id=${post.author.id}" class="post-author">${escapeHtml(post.author.name)}</a>
            <a href="/community.html?slug=${post.community.slug}" class="post-community">r/${escapeHtml(post.community.slug)}</a>
          </div>
          <div class="post-content">${escapeHtml(post.content)}</div>
          ${post.image ? `<img src="${escapeHtml(post.image)}" class="post-image" onclick="window.open(this.src)" loading="lazy">` : ''}
          <div class="post-time">${formatDate(post.createdAt)}</div>
          <div class="post-actions">
            <button class="post-action ${likedClass}" onclick="toggleLike('${post.id}', this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              <span>${post._count.likes}</span>
            </button>
            <button class="post-action ${repostedClass}" onclick="toggleRepost('${post.id}', this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              <span>${post._count.reposts}</span>
            </button>
            <a href="/post.html?id=${post.id}" class="post-action">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>${post._count.replies}</span>
            </a>
            <button class="post-action ${bookmarkedClass}" onclick="toggleBookmark('${post.id}', this)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
}

function createSkeletonPost() {
  return `
    <div class="post-card">
      <div class="post-card-inner">
        <div class="post-avatar">
          <div class="skeleton skeleton-circle" style="width:36px;height:36px"></div>
        </div>
        <div class="post-body">
          <div class="skeleton skeleton-text" style="width:120px"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text" style="width:75%"></div>
        </div>
      </div>
    </div>
  `
}

// Global action functions
async function toggleLike(postId, btn) {
  try {
    const method = btn.classList.contains('liked') ? 'DELETE' : 'POST'
    const res = await api(`/posts/${postId}/like`, { method })
    const span = btn.querySelector('span')
    if (span) span.textContent = res.data.count
    btn.classList.toggle('liked')
  } catch (err) {
    if (err.message.includes('Bereits geliked')) {
      btn.classList.add('liked')
    }
  }
}

async function toggleRepost(postId, btn) {
  try {
    const method = btn.classList.contains('reposted') ? 'DELETE' : 'POST'
    const res = await api(`/posts/${postId}/repost`, { method })
    const span = btn.querySelector('span')
    if (span) span.textContent = res.data.count
    btn.classList.toggle('reposted')
  } catch (err) {
    if (err.message.includes('Bereits repostet')) {
      btn.classList.add('reposted')
    }
  }
}

async function toggleBookmark(postId, btn) {
  try {
    const method = btn.classList.contains('bookmarked') ? 'DELETE' : 'POST'
    await api(`/posts/${postId}/bookmark`, { method })
    btn.classList.toggle('bookmarked')
  } catch (err) {
    if (err.message.includes('Bereits gespeichert')) {
      btn.classList.add('bookmarked')
    }
  }
}

function showToast(message, type = 'success') {
  const colors = { success: '#22c55e', error: '#ef4444', info: '#6366f1' }
  const toast = document.createElement('div')
  toast.textContent = message
  Object.assign(toast.style, {
    position: 'fixed', bottom: '20px', right: '20px',
    background: colors[type] || colors.info,
    color: 'white', padding: '10px 20px', borderRadius: '8px',
    fontSize: '14px', zIndex: '1000', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'opacity 0.3s',
  })
  document.body.appendChild(toast)
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300) }, 2500)
}
