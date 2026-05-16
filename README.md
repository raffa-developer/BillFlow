# Billing System

A full-stack invoicing and billing SaaS application. Manage clients, products, and invoices with PDF generation, email delivery, and a shareable public invoice link — all from a clean, multi-language dashboard.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express, TypeScript, PostgreSQL |
| Frontend | React, TypeScript, Vite |
| Auth | JWT (Bearer tokens) |
| PDF | PDFKit |
| Email | Nodemailer |
| i18n | EN, PT, ES, FR, DE, IT |

## Features

- **Dashboard** — revenue overview, invoice stats, recent activity
- **Clients** — create, edit, and delete client records
- **Products** — manage your product/service catalog with unit prices
- **Invoices** — create invoices with line items, discounts (percent or fixed), and tax; statuses: Pending / Paid / Overdue
- **PDF export** — download a formatted invoice PDF
- **Email delivery** — send invoices to clients directly from the app
- **Public invoice link** — share a read-only invoice page without requiring login
- **Reports** — revenue and invoice analytics
- **Settings** — company profile, email, and password management

## Project Structure

```
Billing-System/
├── backend/    # Express REST API
└── frontend/   # React SPA
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:setup       # creates all tables
npm run dev            # starts on port 4000
```

Required env vars (see `backend/.env.example`):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign tokens |
| `JWT_EXPIRES_IN` | Token TTL, e.g. `60m` |
| `BCRYPT_SALT_ROUNDS` | Password hashing rounds (default `10`) |
| `PORT` | API port (default `4000`) |

### Frontend

```bash
cd frontend
npm install
npm run dev   # starts on http://localhost:5173
```

## API Overview

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/forgot` | Public |
| POST | `/api/auth/reset` | Public |
| GET / PUT | `/api/me` | Required |
| PUT | `/api/me/company` | Required |
| PUT | `/api/me/email` | Required |
| PUT | `/api/me/password` | Required |
| GET / POST | `/api/clients` | Required |
| PUT / DELETE | `/api/clients/:id` | Required |
| GET / POST | `/api/products` | Required |
| PUT / DELETE | `/api/products/:id` | Required |
| GET / POST | `/api/invoices` | Required |
| PUT / DELETE | `/api/invoices/:id` | Required |
| GET | `/api/invoices/:id/pdf` | Required |
| POST | `/api/invoices/:id/send` | Required |
| GET | `/api/public/invoices/:token` | Public |
| GET | `/api/public/invoices/:token/pdf` | Public |
| GET | `/api/health` | Public |

Sample HTTP requests are in `backend/requests/`.

## License

MIT
