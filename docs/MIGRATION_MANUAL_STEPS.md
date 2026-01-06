# Manual Migration Steps for updatedAt Column

**Migration:** `20250103130000_add_message_updated_at`

## When to Run

Run this migration when you have a stable database connection (not on restricted WiFi).

## SQL to Execute

Copy and paste this SQL directly into your database console (e.g., Neon console, pgAdmin, or psql):

```sql
-- Add updatedAt column to run_crew_messages table
ALTER TABLE "run_crew_messages" 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create function to auto-update updatedAt on row updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_run_crew_messages_updated_at ON "run_crew_messages";

-- Create trigger to auto-update updatedAt before any UPDATE
CREATE TRIGGER update_run_crew_messages_updated_at
    BEFORE UPDATE ON "run_crew_messages"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Verification

After running, verify the column exists:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'run_crew_messages' 
AND column_name = 'updatedAt';
```

Should return:
- `column_name`: `updatedAt`
- `data_type`: `timestamp without time zone`
- `column_default`: `CURRENT_TIMESTAMP`

## Alternative: Using Prisma Migrate

Once you have a stable connection, you can also run:

```bash
cd /Users/adamcole/Documents/GoFast/gofastapp-mvp
npx prisma migrate deploy --schema=packages/shared-db/prisma/schema.prisma
```

**Note:** There's a failed migration in the database (`20241214220000_add_planning_days_to_weeks`). You may need to resolve that first or mark it as applied if it's already been manually fixed.


