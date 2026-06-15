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

1. Enable GitHub Pages in your repo settings (branch: `main`, folder: `/frontend`)
2. Update `API_BASE` in `js/api.js` to point to your backend server
3. Update the Socket.IO server URL in `messages.html`

## Backend

The backend is an Express.js server with Socket.IO and Prisma (SQLite).  
Find it in the `backend/` folder of the original repository or at:

```bash
git clone https://github.com/Lere-q/y-chat-backend
```

### Backend Quick Start

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
node main.js
```

Default port: `40272` · Public IP: `168.119.139.61:40272`

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Backend:** Express.js, Socket.IO, Prisma (SQLite)
- **Real-time:** Socket.IO
- **Auth:** JWT (JSON Web Tokens)

## License

MIT
