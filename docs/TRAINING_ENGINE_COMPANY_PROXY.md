# Training engine API (Company → Product)

GoFastCompany’s dashboard (`/dashboard/training-engine/*`) calls **this app** over HTTP for all prompt/rule CRUD. The product database is the single source of truth (`training_gen_prompts`, `rule_sets`, etc.).

## Auth

Company verifies the caller is a `company_staff` row (`requireCompanyStaff`), then forwards:

- `Authorization: Bearer <Firebase ID token>` (from the logged-in user)
- `x-gofast-staff-id: <company_staff.id>`

The product app verifies the JWT and requires both headers (`lib/training/training-engine-auth.ts`).

## Routes (gofastapp-mvp)

- `GET|POST /api/training/config/ai-roles`
- `GET|POST /api/training/config/must-haves`
- `GET|POST /api/training/config/rule-sets`
- `GET|POST|DELETE /api/training/config/return-formats` (DELETE uses `?id=`)
- `PUT /api/training/config/return-formats/[id]`
- `GET|POST /api/training/config/instructions`
- `GET|PUT|DELETE /api/training/config/instructions/[id]`
- `GET|POST|DELETE /api/training/prompts` (DELETE uses `?id=`)
- `GET|PUT /api/training/prompts/[id]`
- `POST /api/training/prompts/[id]/assemble`
- `GET|POST /api/training/prompts/[id]/instructions`
- `PUT|DELETE /api/training/prompts/[id]/instructions/[instructionId]`
- `GET|PUT|DELETE /api/rulesets/[id]`
- `POST /api/rulesets/cluster` (OpenAI clustering; needs `OPENAI_API_KEY` on product)
- `GET|POST /api/training/catalogue` (workout catalogue CRUD)
- `PUT|DELETE /api/training/catalogue/[id]`
- `POST /api/training/catalogue/bulk` — body `{ items: [...] }`. Each item mirrors writable `workout_catalogue` fields; **`name`** and **`workoutType`** required; other keys optional / `null`. Upsert by `(name, workoutType)`.

Plan generation for athletes uses `lib/training/prompt-resolver.ts` (no Company hop).
