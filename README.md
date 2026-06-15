# Y-Chat

A social platform for communities, chats, and posts. Built with a static frontend (HTML/CSS/JS) and a Node.js backend.

## Features

- Feed with "For You" and "Latest" tabs
- Communities (create, join, browse)
- Real-time direct messaging (Socket.IO)
- Posts with likes, reposts, bookmarks, and replies
- User profiles with follow system
- Search for users, communities, and posts
- Trending communities
- Responsive dark-mode UI

## Frontend (GitHub Pages)

The frontend is a pure static site that connects to the Y-Chat backend API.

### Setup

1. Enable GitHub Pages in your repo settings (branch: `main`, folder: `/`)
2. Update `API_BASE` in `js/api.js` to point to your backend server
3. Update the Socket.IO server URL in `messages.html`

## Tech Stack

- HTML, CSS, JavaScript
- Socket.IO
- JWT

## License

MIT
