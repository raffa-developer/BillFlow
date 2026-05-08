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
npm run db:setup   # Create all tables from schema.sql (first-time setup)
```

No test or lint scripts are configured yet.

## Setup

1. Copy `backend/.env.example` to `backend/.env` and fill in values
2. `npm install`
3. Create the database in PostgreSQL: `createdb billing`
4. `npm run db:setup` (runs `schema.sql` via psql)

Required env vars: `DATABASE_URL` (PostgreSQL), `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `PORT` (default 4000).

## Architecture

```
src/
├── server.ts         # HTTP server entry point
├── app.ts            # Express app — mounts middleware and routers
├── config/env.ts     # Zod-validated env vars, throws on startup if invalid
├── db/pool.ts        # pg Pool singleton (DATABASE_URL)
├── middleware/
│   ├── auth.ts       # JWT verification, attaches req.user
│   ├── validate.ts   # Zod schema validation wrapper
│   └── errorHandler.ts  # Centralized error → HTTP response
├── routes/           # One router per domain (auth, clients, products, health)
├── services/
│   ├── pdf.ts        # PDFKit invoice rendering
│   └── email.ts      # Nodemailer (mocked when SMTP_HOST unset)
└── utils/
    ├── errors.ts     # AppError class (status + message)
    ├── invoiceMath.ts # Subtotal / discount / tax calculations
    ├── jwt.ts        # Token sign/verify
    ├── password.ts   # Bcrypt hash/compare
    └── params.ts     # URL param parsing helpers
```

**Request flow:** `app.ts` → global middleware (helmet, cors, morgan, express.json) → router → `validate` middleware (Zod) → route handler → `errorHandler`.

**Data model** (`schema.sql`): `User` → `Client`, `Product`, `Invoice` → `InvoiceItem`. All resources are scoped by `userId`. `InvoiceStatus` enum: `PENDING | PAID | OVERDUE`. `DiscountType` enum: `NONE | PERCENT | FIXED`. Cascading deletes configured.

**Auth:** Protected routes require `Authorization: Bearer <token>`. The `auth` middleware attaches `req.user.id` which route handlers use to scope all DB queries.

## API Routes

| Method | Path | Auth |
|--------|------|------|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| POST | /api/auth/forgot | Public |
| POST | /api/auth/reset | Public |
| GET/PUT | /api/me | Required |
| PUT | /api/me/company | Required |
| PUT | /api/me/email | Required |
| PUT | /api/me/password | Required |
| GET/POST | /api/clients | Required |
| PUT/DELETE | /api/clients/:id | Required |
| GET/POST | /api/products | Required |
| PUT/DELETE | /api/products/:id | Required |
| GET/POST | /api/invoices | Required |
| PUT/DELETE | /api/invoices/:id | Required |
| GET | /api/invoices/:id/pdf | Required |
| POST | /api/invoices/:id/send | Required |
| GET | /api/public/invoices/:token | Public |
| GET | /api/public/invoices/:token/pdf | Public |
| GET | /api/health | Public |

Sample HTTP requests are in `backend/requests/`.
