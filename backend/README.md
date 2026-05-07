# Billing Backend

## Setup

1. Copy `.env.example` to `.env` and set real values.
2. Install dependencies:

```
npm install
```

3. Run migrations:

```
npm run migrate
```

4. Start the API:

```
npm run dev
```

## Auth endpoints

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

Sample requests are in `requests/auth.http`.
