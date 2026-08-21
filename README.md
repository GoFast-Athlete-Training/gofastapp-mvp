# GoFast Next.js App

Official GoFast Next.js application built with Next.js 14+ App Router.

## Architecture

This app follows a strict canonical architecture:

- **No middleware.ts** - Authentication handled at page level
- **No route groups** - Simple flat routes
- **Axios instance** - Single instance in `lib/api.ts` with Firebase token interceptor
- **Domain files** - All business logic in `lib/domain-*.ts`
- **API routes** - Thin controllers that call domain functions
- **Dynamic rendering** - All pages that use auth/localStorage declare `export const dynamic = 'force-dynamic'`

## Project Structure

```
gofastapp-mvp/
├── app/
│   ├── page.tsx                     # Entry point (bouncer)
│   ├── welcome/page.tsx             # Universal hydration
│   ├── home/page.tsx                # Main dashboard
│   ├── profile/page.tsx
│   ├── activities/
│   ├── settings/
│   ├── runcrew/
│   └── api/                         # API routes
├── lib/
│   ├── api.ts                       # Axios instance (ONLY ONE)
│   ├── prisma.ts
│   ├── firebase.ts                  # Firebase client
│   ├── firebaseAdmin.ts             # Firebase Admin (server-only)
│   ├── auth.ts
│   ├── localstorage.ts
│   ├── domain-athlete.ts            # Business logic
│   ├── domain-runcrew.ts
│   └── domain-garmin.ts
├── components/
│   └── RunCrew/                     # RunCrew components
└── prisma/
    └── schema.prisma
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

3. Configure your `.env.local`:
- Firebase client config (NEXT_PUBLIC_*)
- Firebase Admin credentials
- Database URL
- Garmin OAuth credentials
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (embedded Connect onboarding in GoFast With Me Studio)
- Sponsorship: `GOFAST_SPONSOR_MANAGE_URL` (credited earnings totals)

4. Generate Prisma client:
```bash
npm run db:generate
```

5. Run database migrations:
```bash
npm run db:push
```

6. Start development server:
```bash
npm run dev
```

## Key Features

### Hydration Model

1. **Welcome Hydration** (`/welcome`)
   - One API call: `POST /api/athlete/hydrate`
   - Stores: athlete, crews, weekly activities, weekly totals
   - Redirects to `/athlete-home`

2. **Athlete home** (`/athlete-home`)
   - Second API call: `POST /api/runcrew/hydrate`
   - Stores: full crew object with members, messages, announcements, runs

### API Usage

**Client Components:**
- Import: `import api from '@/lib/api'`
- All requests automatically include Firebase token
- Example: `await api.post('/athlete/hydrate')`

**API Routes:**
- Call domain functions directly
- Example: `import { hydrateAthlete } from '@/lib/domain-athlete'`
- Never use Axios in API routes

**Domain Files:**
- Never import Axios
- Only use Prisma
- Source of truth for business logic

## Routes

- `/` - Entry point (sign in)
- `/welcome` - Universal hydration
- `/athlete-home` - Main athlete dashboard
- `/profile` - Athlete profile
- `/activities` - Activity feed
- `/settings` - Settings
- `/runcrew` - Join/create crew
- `/runcrew/[id]` - Crew dashboard
- `/runcrew/[id]/admin` - Admin dashboard
- `/runcrew/[id]/settings` - Crew settings
- `/runcrew/[id]/runs/[runId]` - Run details

## Development

- All pages using auth/localStorage must have `export const dynamic = 'force-dynamic'`
- Client components use `'use client'` directive
- API routes are server-only (no directive needed)

