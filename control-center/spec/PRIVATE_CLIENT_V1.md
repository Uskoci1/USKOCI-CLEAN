# Private runtime browser client v1

The browser talks only to same-origin `/api/control/*`.

- GET only.
- `credentials: same-origin`.
- no database URL, public key, server key or bearer token is accepted by this client;
- responses are bounded;
- ID routes require UUIDs;
- ordinary search rejects email-like and phone-like queries; private identity lookup requires a future elevated support flow;
- the server remains responsible for OWNER authentication and route-specific schema validation.

This client does not make the current static/public-source build live. It is a deployment-ready boundary for a future private host adapter.
