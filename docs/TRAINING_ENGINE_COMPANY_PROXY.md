# Training engine API (Company → Product)

GoFastCompany’s dashboard (`/dashboard/training-engine/*`) calls **this app** over HTTP for all prompt/rule CRUD. The product database is the single source of truth (`training_gen_prompts`, `rule_sets`, etc.).

## Auth

Set the same value in both apps:

- **gofastapp-mvp:** `GOFAST_TRAINING_ENGINE_SECRET`
- **GoFastCompany:** `GOFAST_TRAINING_ENGINE_SECRET`

Company forwards `Authorization` from the logged-in user and adds:

`x-gofast-training-engine-secret: <secret>`

**Development:** If the secret is unset on gofastapp-mvp, non-production allows requests (see `lib/training/training-engine-auth.ts`). Production requires the secret.

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

Plan generation for athletes uses `lib/training/prompt-resolver.ts` (no Company hop).
