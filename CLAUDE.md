# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A REST API backend for a billing/invoicing system. All work lives under `backend/`.

## Commands

All commands run from `backend/`:

```bash
npm run dev        # Start dev server with file watching (tsx watch)
npm run build      # Compile TypeScript → dist/ (tsconfig.build.json)
npm start          # Run production build
npm run migrate    # Run Prisma migrations (prisma migrate dev)
npm run generate   # Regenerate Prisma client after schema changes
```

No test or lint scripts are configured yet.

## Setup

1. Copy `backend/.env.example` to `backend/.env` and fill in values
2. `npm install`
3. `npm run migrate`

Required env vars: `DATABASE_URL` (PostgreSQL), `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `PORT` (default 4000).

## Architecture

```
src/
├── server.ts         # HTTP server entry point
├── app.ts            # Express app — mounts middleware and routers
├── config/env.ts     # Zod-validated env vars, throws on startup if invalid
├── db/prisma.ts      # Prisma client singleton
├── middleware/
│   ├── auth.ts       # JWT verification, attaches req.user
│   ├── validate.ts   # Zod schema validation wrapper
│   └── errorHandler.ts  # Centralized error → HTTP response
├── routes/           # One router per domain (auth, clients, products, health)
└── utils/
    ├── errors.ts     # AppError class (status + message)
    ├── jwt.ts        # Token sign/verify
    ├── password.ts   # Bcrypt hash/compare
    └── params.ts     # URL param parsing helpers
```

**Request flow:** `app.ts` → global middleware (helmet, cors, morgan, express.json) → router → `validate` middleware (Zod) → route handler → `errorHandler`.

**Data model** (`prisma/schema.prisma`): `User` → `Client`, `Product`, `Invoice` → `InvoiceItem`. All resources are scoped by `userId`. `InvoiceStatus` enum: `PENDING | PAID | OVERDUE`. Cascading deletes are configured.

**Auth:** Protected routes require `Authorization: Bearer <token>`. The `auth` middleware attaches `req.user.id` which route handlers use to scope all DB queries.

## API Routes

| Method | Path | Auth |
|--------|------|------|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| GET | /api/auth/me | Required |
| GET/POST | /api/clients | Required |
| PUT/DELETE | /api/clients/:id | Required |
| GET/POST | /api/products | Required |
| PUT/DELETE | /api/products/:id | Required |
| GET | /api/health | Public |

Sample HTTP requests are in `backend/requests/`.
