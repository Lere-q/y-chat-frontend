// Sidebar and RightPanel rendering

function renderSidebar() {
  const sidebar = document.getElementById('sidebar')
  if (!sidebar) return

  const currentPath = window.location.pathname
  const user = getUser()

  const navItems = [
    { href: '/', label: 'Home', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    { href: '/communities.html', label: 'Communities', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
    { href: '/messages.html', label: 'Messages', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    { href: '/trending.html', label: 'Trending', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' },
    { href: '/search.html', label: 'Suche', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' },
    { href: '/bookmarks.html', label: 'Lesezeichen', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' },
    { href: '/settings.html', label: 'Einstellungen', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
  ]

  let html = `<div class="logo">Y-Chat</div>`

  if (user) {
    html += `
      <a href="/profile.html" class="nav-item ${currentPath === '/profile.html' || currentPath === '/' ? '' : ''}" style="margin-bottom:12px">
        ${getAvatarHtml(user, 'sm')}
        <span>${escapeHtml(user.name)}</span>
      </a>
    `
  }

  navItems.forEach(item => {
    const isActive = currentPath === item.href || (item.href === '/' && currentPath === '/index.html')
    html += `<a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}">${item.icon}<span>${item.label}</span></a>`
  })

  if (user) {
    html += `<div style="margin-top:auto;border-top:1px solid var(--border);padding-top:8px">
      <button class="nav-item" onclick="logout()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span>Abmelden</span>
      </button>
    </div>`
  }

  sidebar.innerHTML = html
}

function renderRightPanel() {
  const panel = document.getElementById('rightPanel')
  if (!panel) return

  panel.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:12px;padding:16px;margin-bottom:16px">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">Trending</h3>
      <div id="trendingMini"></div>
    </div>
  `

  const trendingEl = document.getElementById('trendingMini')
  if (trendingEl) {
    trendingEl.innerHTML = '<div class="skeleton" style="height:32px;margin-bottom:4px"></div><div class="skeleton" style="height:32px;margin-bottom:4px"></div><div class="skeleton" style="height:32px"></div>'

    api('/trending').then(data => {
      const communities = (data.data || []).slice(0, 5)
      trendingEl.innerHTML = communities.map((c, i) => `
        <a href="/community.html?slug=${c.slug}" style="display:flex;align-items:center;gap:8px;padding:6px 0;text-decoration:none;color:inherit;border-bottom:1px solid rgba(51,65,85,0.3)">
          <span style="font-size:12px;font-weight:700;color:#475569;width:16px">${i+1}</span>
          <span style="flex:1;font-size:13px;color:white;truncate">${escapeHtml(c.name)}</span>
          <span style="font-size:11px;color:var(--text-muted)">${c.postCount}</span>
        </a>
      `).join('')
    }).catch(() => {
      if (trendingEl) trendingEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Keine Daten</p>'
    })
  }
}
