const API_BASE = 'http://168.119.139.61:40272/api'

function getToken() {
  return localStorage.getItem('y-chat-token')
}

function setToken(token) {
  localStorage.setItem('y-chat-token', token)
}

function clearToken() {
  localStorage.removeItem('y-chat-token')
}

function getAuthHeaders() {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`
  const headers = getAuthHeaders()
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    ...options,
    headers: options.body instanceof FormData ? { Authorization: headers['Authorization'] } : headers,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'API Error')
  return data
}

function getUser() {
  const stored = localStorage.getItem('y-chat-user')
  return stored ? JSON.parse(stored) : null
}

function setUser(user) {
  localStorage.setItem('y-chat-user', JSON.stringify(user))
}

function clearUser() {
  localStorage.removeItem('y-chat-user')
}

function logout() {
  clearToken()
  clearUser()
  window.location.href='login.html'
}

function isLoggedIn() {
  return !!getToken()
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href='login.html'
    return false
  }
  return true
}
