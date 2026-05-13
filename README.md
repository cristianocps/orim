# Orim — Collaborative Whiteboard Platform

> A real-time collaborative whiteboard built with React, PixiJS, NestJS and PostgreSQL.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Canvas Elements](#canvas-elements)
- [App SDK](#app-sdk)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Development](#development)

---

## Overview

Orim is a multiplayer whiteboard application inspired by Miro and FigJam. It supports:

- **Real-time collaboration** — cursors, element edits, viewport sync via Socket.io
- **Rich canvas elements** — shapes, sticky notes, connectors, cards, tables, drawings
- **Undo / Redo** — local history stack with keyboard shortcuts
- **AI assistant** — mock AI actions for summarizing, clustering, action plans
- **App marketplace** — installable third-party apps with a typed `postMessage` SDK
- **Mobile responsive** — touch, pinch-to-zoom, adaptive UI
- **Export** — PNG/SVG export of boards
- **Presentation mode** — fullscreen slideshow of frames
- **Comments** — threaded discussions on the canvas

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, TypeScript 5.9, PixiJS v8, Zustand, Socket.io-client, react-router-dom |
| **Backend** | NestJS 11, Fastify adapter, Prisma 6, Socket.io, JWT, bcryptjs, zod |
| **Database** | PostgreSQL 16 (JSONB for element data), Redis 7 (cursors, colors) |
| **Storage** | MinIO (S3-compatible object storage for uploads) |
| **Monorepo** | Turborepo v2, pnpm workspaces |
| **Node** | >= 22.0.0 |

---

## Project Structure

```
orim/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── src/
│   │       ├── auth/           # JWT auth (register, login, refresh, logout)
│   │       ├── boards/         # Board CRUD + element operations
│   │       ├── ai/             # AI mock actions (summarize, cluster, generate)
│   │       ├── apps/           # App marketplace CRUD + installs
│   │       ├── upload/         # File upload to MinIO
│   │       ├── sockets/        # Socket.io gateway (real-time)
│   │       ├── health/         # Health check endpoint
│   │       ├── common/         # Config, MinIO client, Redis client, exception filter
│   │       └── prisma/         # Prisma service & module
│   └── web/                    # React frontend
│       └── src/
│           ├── pages/          # Dashboard, BoardEditor, Login, Marketplace, Templates
│           ├── canvas/         # PixiJS engine, renderers, connectors, freehand
│           ├── components/     # UI components (toolbars, panels, sandbox, etc.)
│           ├── hooks/          # useSocket, useBoardSync
│           ├── stores/         # Zustand boardStore (elements, history, viewport)
│           ├── lib/            # API client, AI client, app helpers
│           └── contexts/       # AuthContext
├── packages/
│   ├── shared/                 # Shared TypeScript types & schemas
│   └── app-sdk/                # @orim/app-sdk — typed postMessage wrapper for apps
├── docker-compose.yml          # Postgres, Redis, MinIO
├── turbo.json                  # Turborepo pipeline
└── pnpm-workspace.yaml
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+ (via corepack)
- Docker & Docker Compose

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (5432), Redis (6379) and MinIO (9000/9001).

### 3. Run database migrations

```bash
pnpm db:migrate
```

### 4. Start dev servers

```bash
pnpm dev
```

- **Web** → http://localhost:3000
- **API** → http://localhost:3001
- **MinIO Console** → http://localhost:9001

---

## Environment Variables

The API reads from `apps/api/.env`:

```env
DATABASE_URL="postgresql://orim:orim_secret@localhost:5432/orim?schema=public"
REDIS_URL="redis://localhost:6379"
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY="orim"
MINIO_SECRET_KEY="orim_secret_key"
MINIO_BUCKET="orim-uploads"
JWT_SECRET="change-me-in-production"
JWT_REFRESH_SECRET="change-me-refresh-in-production"
COOKIE_SECRET="cookie-secret-change-me"
PORT=3001
NODE_ENV=development
```

---

## Architecture

### Frontend

- **Vite proxy** — `/api/*` → `localhost:3001/*` (strips `/api` prefix)
- **Socket.io** — connects via Vite WebSocket proxy to `/socket.io` → `localhost:3001`
- **PixiJS canvas** — `canvas/engine.ts` initializes an `Application` with pluggable renderers
- **State** — `boardStore.ts` holds elements, selected IDs, viewport, undo/redo history
- **Sync** — `useBoardSync.ts` batches element changes and flushes to `PATCH /boards/:id/elements` every 500ms

### Backend

- **NestJS + Fastify** — `main.ts` bootstraps with CORS, cookie parser
- **Auth** — JWT access token (15min) + refresh token (7d) in httpOnly cookies
- **Boards** — CRUD with Prisma; elements stored as JSONB fields (`data`, `transform`, `style`, `metadata`)
- **Real-time** — `BoardGateway` handles Socket.io events; colors persisted in Redis
- **Upload** — Multipart to MinIO via `@fastify/multipart`
- **Exception filter** — `GlobalExceptionFilter` catches all errors; `ZodError` returns 400

---

## API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, sets cookies |
| POST | `/auth/logout` | Clear cookies |
| GET | `/auth/me` | Current user |
| POST | `/auth/refresh` | Refresh access token |

### Boards

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/boards` | List user's boards |
| POST | `/boards` | Create board |
| GET | `/boards/:id` | Get board with elements & members |
| PATCH | `/boards/:id/elements` | Batch create/update elements |
| DELETE | `/boards/:id/elements/:elementId` | Soft-delete element |
| GET | `/boards/:id/history` | Get board history |

### AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/prompt` | Process AI prompt with board context |
| POST | `/ai/actions/summarize` | Summarize selected elements |
| POST | `/ai/actions/cluster` | Cluster elements into groups |

### Apps

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/apps` | List published apps |
| GET | `/apps/:id` | Get app details |
| POST | `/apps` | Create app (auth) |
| POST | `/apps/:id/install` | Install app on board (auth) |
| DELETE | `/apps/:id/install` | Uninstall app (auth) |
| GET | `/apps/board/:boardId/installed` | List installed apps on board |

### Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload file to MinIO (auth) |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

---

## WebSocket Events

### Client → Server

| Event | Payload |
|-------|---------|
| `board:join` | `{ boardId, userId, name }` |
| `board:leave` | `{ boardId }` |
| `cursor:move` | `{ boardId, x, y }` |
| `element:created` | `{ boardId, element }` |
| `element:updated` | `{ boardId, element }` |
| `element:deleted` | `{ boardId, elementId }` |
| `viewport:update` | `{ boardId, x, y, zoom }` |
| `follow:start` | `{ boardId, targetUserId }` |
| `follow:stop` | `{ boardId }` |
| `timer:start` | `{ boardId, duration }` |
| `timer:stop` | `{ boardId }` |
| `vote:add` | `{ boardId, elementId }` |
| `reaction:send` | `{ boardId, emoji, x, y }` |

### Server → Client

| Event | Payload |
|-------|---------|
| `users.list` | Array of online users |
| `user.joined` | `{ id, name, color, x, y }` |
| `user.left` | `{ id }` |
| `cursor.moved` | `{ id, x, y, name, color }` |
| `element.created` | Element object |
| `element.updated` | Element object |
| `element.deleted` | `{ id }` |
| `viewport.updated` | `{ userId, x, y, zoom, name, color }` |
| `follow.started` | `{ followerId, targetUserId }` |
| `follow.stopped` | `{ followerId }` |
| `timer.started` | `{ duration, startedBy }` |
| `timer.stopped` | `{ stoppedBy }` |
| `vote.added` | `{ elementId, userId }` |
| `reaction.sent` | `{ emoji, x, y, userId }` |

---

## Canvas Elements

Supported element types (`packages/shared/src/types.ts`):

| Type | Description |
|------|-------------|
| `rectangle` | Rectangle shape with size |
| `circle` | Circle with radius |
| `ellipse` | Ellipse shape |
| `line` | Simple line |
| `arrow` | Arrow line |
| `sticky_note` | Sticky note with text and color |
| `text` | Text element with font props |
| `image` | Image element |
| `connector` | Connector between two elements with anchors |
| `frame` | Frame/container with title and size |
| `card` | Kanban-style card with status, priority, tags |
| `drawing` | Freehand drawing (pen, highlighter, eraser) |
| `table` | Table with cells, col/row spans |

Each element has:
- `id` (UUID)
- `type` (ElementType)
- `transform` — `{ x, y, rotation, scaleX, scaleY }`
- `style` — JSONB object (fill, stroke, etc.)
- `metadata` — JSONB object (custom data)
- `data` — JSONB object (type-specific props like `text`, `size`, `radius`)
- `createdBy`, `updatedAt`, `deletedAt` (soft delete)

---

## App SDK

The `@orim/app-sdk` package provides a typed `postMessage` wrapper for third-party apps running inside `AppSandbox` (iframe).

### Install

```bash
pnpm add @orim/app-sdk
```

### Usage

```typescript
import { init, onInit, getElements, createElement, updateElement, deleteElement, getViewport, close } from '@orim/app-sdk';

init({ debug: true });

onInit((payload) => {
  console.log('Board ID:', payload.boardId);
  console.log('User:', payload.user);
});

const elements = await getElements();
await createElement({ id: crypto.randomUUID(), type: 'sticky_note', /* ... */ });
```

### SDK Methods

| Method | Description |
|--------|-------------|
| `init(options?)` | Initialize SDK, listen for messages |
| `onInit(callback)` | Called when `app:init` payload arrives |
| `getInitPayload()` | Get current init payload |
| `getElements()` | Fetch all board elements |
| `createElement(el)` | Create a new element |
| `updateElement(id, patch)` | Update an element |
| `deleteElement(id)` | Delete an element |
| `getViewport()` | Get current viewport state |
| `close()` | Notify parent to close the app |

### App Permissions

Apps declare permissions in their manifest:

- `canvas:read` / `canvas:write`
- `storage:board` / `storage:user` / `storage:app`
- `fetch` — external HTTP requests
- `socket` — real-time communication
- `ui:panel` / `ui:modal` / `ui:toolbar` / `ui:context_menu`

---

## Authentication

Orim uses **JWT tokens in httpOnly cookies**:

1. User registers/logs in → server sets `access_token` (15min) and `refresh_token` (7d) cookies
2. Frontend sends `credentials: 'include'` on all requests
3. `JwtAuthGuard` reads `access_token` from cookies and verifies it
4. On 401, frontend can call `POST /auth/refresh` to get a new access token
5. Logout clears both cookies

### Test Users

| Email | Password | Name |
|-------|----------|------|
| `test@example.com` | `123456` | Test |
| `upload@test.com` | `123456` | Upload |

---

## Database Schema

### Models

| Model | Description |
|-------|-------------|
| `User` | Accounts (`id`, `email`, `name`, `password`, `avatarUrl`) |
| `Board` | Whiteboards (`id`, `name`, `description`, `thumbnailUrl`, `ownerId`) |
| `BoardMember` | Membership with role (`owner`, `editor`, `viewer`) |
| `Element` | Canvas elements with JSONB fields (`data`, `transform`, `style`, `metadata`) |
| `History` | Audit log of actions (`action`, `payload`, `boardId`, `userId`) |
| `App` | Marketplace apps (`name`, `description`, `manifest`, `published`) |
| `AppVersion` | App versions (`version`, `entryPoint`) |
| `AppInstall` | Installed apps on boards (`config`, `enabled`) |

### Key Indexes

- `Element` — `(boardId)`, `(boardId, deletedAt)`
- `History` — `(boardId, createdAt)`

---

## Development

### Useful Commands

```bash
# Run everything
pnpm dev

# Build everything
pnpm build

# Database
pnpm db:migrate      # Run migrations
pnpm db:generate     # Generate Prisma client
pnpm db:studio       # Open Prisma Studio
pnpm db:seed         # Run seeders

# Lint
pnpm lint
```

### Ports

| Service | Port |
|---------|------|
| Web (Vite) | 3000 |
| API (NestJS) | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

### Mobile Testing

The board editor supports touch interactions:
- **Pan** — one finger drag
- **Zoom** — pinch gesture
- **Select** — tap
- **UI** — collapsible sidebar, adaptive toolbars

---

## License

MIT
