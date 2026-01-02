# Database Scripts

Scripts for managing GoFastCompany and athlete data in the database.

## Company Management Scripts

### `setup-company.ts` (Recommended)
**Comprehensive setup script** that handles everything in one go:
- Initializes/ensures GoFastCompany exists
- Backfills companyId for any athletes missing it
- Verifies the setup

```bash
npm run db:setup-company
```

### `init-company.ts`
Creates or updates the GoFastCompany record with default values.

```bash
npm run db:init-company
```

### `upsert-company.ts`
Upserts (create or update) the GoFastCompany record.

```bash
npm run db:upsert-company
```

### `backfill-athlete-company.ts`
Backfills `companyId` for existing athletes that don't have one or have an invalid one.

```bash
npm run db:backfill-athletes
```

## Utility Scripts

### `check-athletes.ts`
Displays information about athletes in the database, including their company association.

```bash
npm run db:check-athletes
```

### `verify-schema.ts`
Verifies that all database tables exist and relations work correctly.

```bash
npm run db:verify-schema
```

## Quick Start

After restoring the GoFastCompany model or when setting up a new database:

```bash
# Step 1: Setup company and backfill existing athletes (recommended)
npm run db:setup-company

# Step 2: Verify everything is working
npm run db:verify-schema

# Step 3: Check athletes to see company associations
npm run db:check-athletes
```

## Script Details

### Default Company Values
- **ID**: `cmhpqe7kl0000nw1uvcfhf2hs` (hardcoded for single-tenant)
- **Slug**: `gofast`
- **Name**: `GoFast`
- **Address**: `2604 N. George Mason Dr., Arlington, VA 22207`
- **Domain**: `gofastcrushgoals.com`

### Important Notes

1. **Company ID is Required**: All athletes must have a `companyId` field that references a valid `GoFastCompany` record.

2. **Single Tenant**: The app uses a single hardcoded company ID for all athletes.

3. **Migration Required**: After adding the `companyId` field to the schema, you'll need to:
   - Run migrations: `npm run db:push` or `npm run prisma:migrate`
   - Run the setup script: `npm run db:setup-company`

4. **Backfilling**: If you have existing athletes without `companyId`, use `backfill-athlete-company.ts` or the comprehensive `setup-company.ts` script.

