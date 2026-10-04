# Private server API core

This layer is hosting-neutral. A Cloudflare Worker, Render service, Vercel server function or another server adapter can call it.

Hard rules:
- authenticate before any RPC;
- v1 permits OWNER only;
- GET only;
- no browser database secret;
- only the bounded Control RPC names are routable;
- UUID route parameters are strict;
- search limit max 20;
- responses are no-store and capped at 160 KiB;
- forbidden sensitive keys are rejected even if the database candidate accidentally returns them;
- backend/RPC errors are normalized and do not expose raw secrets.

Routes:
- GET /api/control/overview
- GET /api/control/search?q=...&limit=...
- GET /api/control/users/:id
- GET /api/control/tasks/:id
- GET /api/control/agreements/:id

The adapter still needs two dependencies:
1. authorize(request) -> {authenticated, role, userId}
2. rpc(name,args,context) -> parsed JSON from canonical Supabase

No concrete hosting/provider credentials are committed.
