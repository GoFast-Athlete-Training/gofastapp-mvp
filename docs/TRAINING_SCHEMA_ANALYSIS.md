# ⚠️ DEPRECATED - TrainingSchema Analysis - Product App vs Company App

**NOTE: This document is deprecated. All Prompt Engine models have been moved to GoFastCompany.**
**See GoFastCompany README.md for current Plan Tuner documentation.**

---

# TrainingSchema Analysis - Product App vs Company App

## 🎯 KEY INSIGHT: TrainingSchema → PlantunerTrainingSchema = "Schema Snap"

**PlantunerTrainingSchema** is a **"schema snap"** - a snapshot/catalog of available Prisma schema fields that **MustHaves** uses to know which fields from the Prisma schema can be referenced in training plan generation.

**Relationship:**
- **PlantunerTrainingSchema** (schema snap) → Contains catalog of available Prisma fields (e.g., `training_plans: ["preferredDays", "currentWeeklyMileage"]`)
- **PlantunerMustHaves** → Uses TrainingSchema snaps as reference/templates to select which fields are required for a specific prompt
- **PlantunerTrainingGenPrompt** → Uses MustHaves to define required fields for plan generation

## Current State

### Product App (gofastapp-mvp)
- **Schema**: `TrainingSchema` model **REMOVED** (marked as "Removed (deprecated)" in schema comments)
- **Reason**: TrainingSchema functionality moved to Company app as **PlantunerTrainingSchema**
- **Code**: Legacy code still trying to use `prisma.trainingSchema` (build fails):
  - ❌ `app/api/training-schema/route.ts` - GET/POST routes (deleted)
  - ❌ `app/api/training-schema/[id]/route.ts` - GET/PUT/DELETE routes (deleted)
  - ❌ `app/api/training-schema/upsert-default/route.ts` - Upsert route (deleted)
  - ❌ `app/admin/training-schema/page.tsx` - Admin UI page (deleted)
  - ❌ `lib/training-schema.ts` - Utility functions (deleted)
  - ❌ `scripts/upsert-training-schema.ts` - Setup script (deleted)
- **Build Issue**: Code references `prisma.trainingSchema` but model doesn't exist → Build fails

### Company App (GoFastCompany)
- **Schema**: `PlantunerTrainingSchema` model **EXISTS** (it's the schema snap!)
  - ✅ Database table exists: `training_schemas` (created in migration)
  - ⚠️ Model may not be in schema.prisma file (needs to be added)
- **Code**: Has working API routes:
  - ✅ `app/api/training-schema/route.ts` - Uses `prisma.plantunerTrainingSchema`
  - ✅ `app/api/training-schema/[id]/route.ts` - Uses `prisma.plantunerTrainingSchema`
- **Purpose**: **Schema Snap** - Catalog of available Prisma schema fields for MustHaves to reference
- **Usage**: When creating MustHaves, staff can copy/paste from existing TrainingSchema snaps
- **Structure** (from migration):
  ```sql
  CREATE TABLE "training_schemas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schemaJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_schemas_pkey" PRIMARY KEY ("id")
  );
  ```
- **Should be in schema.prisma as:**
  ```prisma
  model PlantunerTrainingSchema {
    id          String   @id @default(uuid())
    name        String   @unique
    description String?
    schemaJson  Json     // Snapshot of available Prisma fields (the "snap")
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    
    @@map("training_schemas")
  }
  ```

## Schema Comment Analysis

From `packages/shared-db/prisma/schema.prisma`:
```
// NOTE: All Prompt Engine models moved to GoFastCompany as Plantuner* models
// - RuleSet, RuleSetTopic, RuleSetItem → Removed (not needed in product app)
// - MustHaves → PlantunerMustHaves (in GoFastCompany)
// - ReturnJsonFormat → Removed (not needed in product app)
// - PromptInstruction → Removed (not needed in product app)
// - TrainingSchema → Removed (deprecated)
// - AIRole → PlantunerAIRole (in GoFastCompany)
// - TrainingGenPrompt → PlantunerTrainingGenPrompt (in GoFastCompany)
```

**Key Points:**
1. TrainingSchema was explicitly **removed** from product app
2. It was **moved** to GoFastCompany as `PlantunerTrainingSchema`
3. The comment says it's "deprecated" in product app

## What Is PlantunerTrainingSchema (Schema Snap)?

### Purpose: Schema Snap / Field Catalog
**PlantunerTrainingSchema** is a **"schema snap"** - a snapshot/catalog of available Prisma schema fields that defines which fields from the product app's Prisma models can be used in training plan generation.

### Structure:
```json
{
  "training_plans": ["preferredDays", "currentWeeklyMileage", "startDate", "totalWeeks"],
  "race_registry": ["miles", "date"]
}
```

Each TrainingSchema snap contains:
- **Model names** (e.g., `training_plans`, `race_registry`)
- **Field arrays** listing which fields from those models are available for use

### How It's Used:
1. **Staff creates TrainingSchema snaps** - Defines catalog of available Prisma fields
2. **When creating MustHaves** - Staff can:
   - View existing TrainingSchema snaps as reference
   - Copy/paste from schema snaps to select which fields are required
   - See which fields are available from each Prisma model
3. **MustHaves uses the snap** - Selects specific fields from the catalog to define required fields for a prompt
4. **Prompt generation** - Uses MustHaves to know which fields to include in the prompt

### Example Flow:
```
TrainingSchema Snap:
{
  "training_plans": ["preferredDays", "currentWeeklyMileage", "startDate", "totalWeeks"],
  "race_registry": ["miles", "date"]
}
         ↓
Staff creates MustHaves, copies from snap:
{
  "preferredDays": "...",
  "currentWeeklyMileage": "...",
  "miles": "..."
}
         ↓
MustHaves defines which fields are required for prompt
         ↓
Prompt generation validates user inputs against MustHaves.fields
```

### Key Difference:
- **TrainingSchema (Snap)**: Catalog of **available** Prisma fields (like a menu)
- **MustHaves**: Selection of **required** fields from the catalog (like ordering from the menu)

## Architecture Separation

**GoFastCompany Responsibilities:**
- Company identity
- Staff access
- **Training Pipeline Configuration** (Training Tuner) - Configure how training plans are generated
- Plan Tuner models (all prefixed with `plantuner_`)

**Product App Responsibilities:**
- Athlete identity
- RunCrews
- Activities
- **Training plan execution data** (plans live in product app)

**From GoFastCompany README:**
> **What it does NOT do:**
> - Store actual training plans (those live in gofastapp-mvp)
> - Store athlete training data
> - Execute training plan generation (that happens in product app)

## Migration Status

### ✅ Completed:
- Schema updated - TrainingSchema removed from product app
- Schema updated - PlantunerTrainingSchema exists in company app
- Company app has working API routes for PlantunerTrainingSchema

### ❌ Not Completed (Legacy Code):
- Product app still has API routes trying to use removed TrainingSchema model
- Product app still has admin UI for TrainingSchema
- Product app still has utility functions for TrainingSchema
- npm script references deleted script

## ⚠️ ACTION REQUIRED

### Product App (gofastapp-mvp):
**TrainingSchema code should be removed because:**

1. **Schema explicitly removed it** - The model doesn't exist, so code will fail
2. **Functionality moved to Company app** - PlantunerTrainingSchema handles this now
3. **Architectural separation** - Product app doesn't manage training pipeline config
4. **Build is failing** - Code references non-existent model

**However, verify:**
- Is there any code in product app that actually CALLS these TrainingSchema routes?
- Is there any runtime dependency on TrainingSchema in the product app?
- Was this migration intentionally left incomplete?

## Files to Remove/Update

### Already Deleted:
- ✅ `lib/training-schema.ts`
- ✅ `scripts/upsert-training-schema.ts`
- ✅ API route files (deleted but directories may remain)

### Still Need to Check:
- ❓ Any imports or references to deleted files
- ❓ npm script in package.json (`db:upsert-training-schema`)
- ❓ Empty directory structure under `app/api/training-schema/`
- ❓ Admin page route `app/admin/training-schema/page.tsx` (if not deleted)

## Conclusion

**Product App:** TrainingSchema code should be removed - it's legacy orphaned code referencing a non-existent model.

**Company App:** PlantunerTrainingSchema exists in the database and is actively used as a "schema snap" - it should be:
1. ✅ **Added to schema.prisma** - Model is missing from schema file (table exists in DB)
2. ✅ **Preserved** - It's actively used by MustHaves for field selection
3. ✅ **Documented** - It's the "snap" that MustHaves uses to select available Prisma fields

**Key Insight:** TrainingSchema wasn't just "deprecated" - it was **repurposed** as a **"schema snap"** that serves as a catalog/reference for MustHaves to know which Prisma fields are available for use in training plan generation.

**Actions:**
1. Remove all TrainingSchema references from product app (fix build)
2. Add PlantunerTrainingSchema model to Company app's schema.prisma
3. Document the relationship: Schema Snap → MustHaves → Prompt Generation

