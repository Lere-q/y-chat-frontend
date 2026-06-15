// Sidebar and RightPanel rendering

let sidebarCollapsed = false

// Restore collapsed state
try { sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true' } catch {}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar')
  if (!sidebar) return

  const currentPath = window.location.pathname
  const user = getUser()

  if (sidebarCollapsed) sidebar.classList.add('collapsed')

  let html = `
    <div class="sidebar-header">
      <a href="/" class="sidebar-brand" style="display:flex;align-items:center;gap:2px;text-decoration:none">
        <span class="logo-y logo-text">Y</span>
        <span class="logo-chat logo-text">Chat</span>
      </a>
    </div>
    <nav class="sidebar-nav">
  `

  const navItems = [
    { href: '/', label: 'Home', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    { href: '/trending.html', label: 'Trending', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' },
    { href: '/communities.html', label: 'Communities', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
    { href: '/messages.html', label: 'Messages', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    { href: '/bookmarks.html', label: 'Bookmarks', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' },
  ]

  navItems.forEach(item => {
    const isActive = currentPath === item.href || (item.href === '/' && (currentPath === '/' || currentPath === '/index.html'))
    html += `<a href="${item.href}" class="nav-link ${isActive ? 'active' : ''}">${item.icon}<span>${item.label}</span></a>`
  })

  html += `<div class="sidebar-divider"></div>`

  // Settings link always visible
  html += `<a href="/settings.html" class="nav-link ${currentPath === '/settings.html' ? 'active' : ''}" style="margin-bottom:4px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    <span>Einstellungen</span>
  </a>`

  // Load communities for sidebar
  loadCommunitiesForSidebar().then(communities => {
    const sidebarNav = sidebar.querySelector('.sidebar-nav')
    if (!sidebarNav) return
    const existingDynamic = sidebarNav.querySelectorAll('[data-dynamic]')
    existingDynamic.forEach(el => el.remove())
    if (communities.length > 0) {
      const label = document.createElement('div')
      label.setAttribute('data-dynamic', '')
      label.className = 'sidebar-section-label'
      label.textContent = 'Communities'
      sidebarNav.appendChild(label)

      communities.slice(0, 3).forEach(c => {
        const link = document.createElement('a')
        link.setAttribute('data-dynamic', '')
        link.href = `/community.html?slug=${c.slug}`
        link.className = `community-link ${currentPath.includes(c.slug) ? 'active' : ''}`
        link.innerHTML = `<span class="community-icon-small">${c.name[0]}</span><span class="truncate">${escapeHtml(c.name)}</span>`
        sidebarNav.appendChild(link)
      })

      const viewAll = document.createElement('a')
      viewAll.setAttribute('data-dynamic', '')
      viewAll.href = '/communities.html'
      viewAll.className = 'view-all-link'
      viewAll.textContent = 'Alle anzeigen'
      sidebarNav.appendChild(viewAll)
    }
  })

  // Sidebar collapse toggle (desktop only) + footer
  html += `</nav>
    <div class="sidebar-footer">
      <button class="collapse-btn" onclick="toggleSidebarCollapse()" title="Sidebar umschalten" style="display:flex;align-items:center;justify-content:center;width:100%;margin-top:4px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
  `

  if (user) {
    html += `
      <div class="user-card">
        ${getAvatarHtml(user, 'sm')}
        <span class="user-name">${escapeHtml(user.name)}</span>
        <button class="logout-btn" onclick="logout()" title="Abmelden">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    `
  }

  html += '</div>'
  sidebar.innerHTML = html
}

function toggleSidebarCollapse() {
  const sidebar = document.getElementById('sidebar')
  if (!sidebar) return
  sidebarCollapsed = !sidebarCollapsed
  sidebar.classList.toggle('collapsed', sidebarCollapsed)
  const main = document.querySelector('.main-content')
  if (main && window.innerWidth >= 1024) {
    main.style.marginLeft = sidebarCollapsed ? '60px' : '220px'
  }
  localStorage.setItem('sidebarCollapsed', sidebarCollapsed)
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('mobileOverlay')
  if (!sidebar) return
  const isOpen = sidebar.classList.contains('mobile-open')
  sidebar.classList.toggle('mobile-open')
  if (overlay) {
    overlay.classList.add('sidebar-backdrop')
    overlay.classList.toggle('hidden')
    overlay.classList.toggle('open', !isOpen)
  }
}

function renderTopBarAvatar() {
  const el = document.getElementById('topBarAvatar')
  if (!el) return
  const user = getUser()
  el.innerHTML = user ? getAvatarHtml(user, 'sm') : ''
}

async function loadCommunitiesForSidebar() {
  try {
    const data = await api('/communities?limit=3')
    return data.data || []
  } catch { return [] }
}

function renderRightPanel() {
  const panel = document.getElementById('rightPanel')
  if (!panel) return

  panel.innerHTML = `
    <div class="panel-card" id="trendingCard">
      <div class="panel-card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        Trending
      </div>
      <div id="trendingMini"><p class="text-sm text-muted">Keine Trending-Daten</p></div>
    </div>
    <div class="panel-card">
      <div class="panel-card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        Suche
      </div>
      <a href="/search.html" style="display:block;text-decoration:none">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Suchen..." readonly>
        </div>
      </a>
    </div>
    <div class="panel-card">
      <div class="panel-card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Online jetzt
      </div>
      <div id="onlineUsers"><p class="text-sm text-muted">Keine User online</p></div>
    </div>
  `

  // Load trending
  api('/trending').then(data => {
    const trendingEl = document.getElementById('trendingMini')
    const items = (data.data || []).slice(0, 5)
    if (items.length === 0) {
      trendingEl.innerHTML = '<p class="text-sm text-muted">Keine Trending-Daten</p>'
      return
    }
    trendingEl.innerHTML = items.map((item, i) => `
      <a href="/community.html?slug=${item.slug}" class="trending-item" style="display:flex;align-items:center;gap:12px;padding:8px 0;text-decoration:none;color:inherit;border-bottom:1px solid rgba(30,41,59,0.3)">
        <div style="font-size:14px;font-weight:500;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">
          r/${item.slug}
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:#64748b;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          ${item.postCount}
        </div>
      </a>
    `).join('')
  }).catch(() => {})

  // Online users
  api('/users/online').then(data => {
    const onlineEl = document.getElementById('onlineUsers')
    const users = (data.data || []).slice(0, 8)
    if (users.length === 0) {
      onlineEl.innerHTML = '<p class="text-sm text-muted">Keine User online</p>'
      return
    }
    onlineEl.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      users.map(u => `<div style="position:relative;display:inline-flex" title="${escapeHtml(u.name)}">
        ${getAvatarHtml(u, 'sm')}
        <span style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;background:#22c55e;border-radius:50%;border:2px solid #0f172a"></span>
      </div>`).join('') +
      '</div>'
  }).catch(() => {})
}
