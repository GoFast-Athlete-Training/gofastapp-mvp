-- AlterTable: Add updatedAt to run_crew_messages
-- Set default to CURRENT_TIMESTAMP for existing rows, then make it auto-update
ALTER TABLE "run_crew_messages" 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create trigger to auto-update updatedAt on row update (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_run_crew_messages_updated_at ON "run_crew_messages";
CREATE TRIGGER update_run_crew_messages_updated_at
    BEFORE UPDATE ON "run_crew_messages"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

