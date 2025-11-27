# Database Setup - Prisma Accelerate

**Last Updated**: January 2025  
**Database Provider**: Prisma Data Platform

---

## Database URLs

You have three database connection options:

### Option 1: Prisma Accelerate (Recommended)

**Use this for production and development** - Provides connection pooling and caching.

```bash
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19DUVRFOGVuWE1ZWExabWNkRXUxZDMiLCJhcGlfa2V5IjoiMDFLQjM0NjRSVEVCOEo0VzJFUUowNDk3M1IiLCJ0ZW5hbnRfaWQiOiIyOWY0MTAyYmFhOGNiOTQ1NTcxNTM0MzczOTkyYWQyNGJjNTI3OTNjMzQ1OTlhMmE2MmQ5MmUzYTNmNmRmMmQ5IiwiaW50ZXJuYWxfc2VjcmV0IjoiZWFkYzM3NTYtMjA1Yi00MjM0LWIxNGItMGRjMDE0YjJjNDhmIn0.rQqjhZKvmJ4IEZwPzs8xNInnv6vHHjrswP-HmA-F5cI"
```

### Option 2: Direct PostgreSQL Connection

**Use this for Prisma Studio and migrations** - Direct connection to database.

```bash
DATABASE_URL="postgres://29f4102baa8cb945571534373992ad24bc52793c34599a2a62d92e3a3f6df2d9:sk_CQTE8enXMYXLZmcdEu1d3@db.prisma.io:5432/postgres?sslmode=require"
```

### Option 3: Alternative Direct Connection

```bash
DATABASE_POSTGRES_URL="postgres://29f4102baa8cb945571534373992ad24bc52793c34599a2a62d92e3a3f6df2d9:sk_CQTE8enXMYXLZmcdEu1d3@db.prisma.io:5432/postgres?sslmode=require"
```

---

## Setup Steps

### 1. Set Environment Variable

**Local Development** (`.env.local`):
```bash
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19DUVRFOGVuWE1ZWExabWNkRXUxZDMiLCJhcGlfa2V5IjoiMDFLQjM0NjRSVEVCOEo0VzJFUUowNDk3M1IiLCJ0ZW5hbnRfaWQiOiIyOWY0MTAyYmFhOGNiOTQ1NTcxNTM0MzczOTkyYWQyNGJjNTI3OTNjMzQ1OTlhMmE2MmQ5MmUzYTNmNmRmMmQ5IiwiaW50ZXJuYWxfc2VjcmV0IjoiZWFkYzM3NTYtMjA1Yi00MjM0LWIxNGItMGRjMDE0YjJjNDhmIn0.rQqjhZKvmJ4IEZwPzs8xNInnv6vHHjrswP-HmA-F5cI"
```

**Vercel Production**:
1. Go to Vercel project settings
2. Add environment variable: `DATABASE_URL`
3. Paste the Prisma Accelerate URL (Option 1)

### 2. Generate Prisma Client

```bash
npm run db:generate
# or
npx prisma generate
```

### 3. Push Schema to Database

```bash
npm run db:push
# or
npx prisma db push
```

This will:
- Create all tables
- Set up relationships
- Create indexes and constraints

### 4. Verify Connection

```bash
npx prisma studio
```

This opens Prisma Studio at `http://localhost:5555` where you can view and edit data.

---

## Prisma Accelerate vs Direct Connection

### Prisma Accelerate (Recommended)
- ✅ Connection pooling
- ✅ Query caching
- ✅ Better performance
- ✅ Use for: Production, Development API calls

### Direct Connection
- ✅ Direct database access
- ✅ Use for: Prisma Studio, Migrations, `prisma db push`

**Note**: You can use both - set `DATABASE_URL` to Accelerate URL, and use direct connection for migrations if needed.

---

## Schema Status

**Current Schema**: MVP1 + Training focused
- ✅ Athlete (core identity)
- ✅ AthleteActivity (Garmin activities)
- ✅ RunCrew models (8 models)
- ✅ Training models (6 models)

**Removed**: Founder, Company, Parent, YoungAthlete, F3 Workout, General Events

---

## Troubleshooting

### Error: "Can't reach database server"
- Check if `DATABASE_URL` is set correctly
- Verify Prisma Accelerate API key is valid
- Try direct connection URL for migrations

### Error: "Schema validation failed"
- Run `npx prisma generate` after schema changes
- Ensure schema.prisma matches database structure

### Error: "Relation does not exist"
- Run `npx prisma db push` to sync schema
- Check that all foreign key relationships are correct

---

**End of Database Setup Documentation**

