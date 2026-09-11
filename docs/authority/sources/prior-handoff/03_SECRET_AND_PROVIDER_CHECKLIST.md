# SECRETS / PROVIDERS — ask the owner only when actually needed

Codex should first inspect existing configuration and secret references. Ask only for a missing external prerequisite that cannot be derived safely.

Potential external prerequisites:

- OpenAI server-side API key for production AI turn. Never expose in React Native or Git.
- Expo/FCM/APNs credentials/tokens for real push transport/device proof.
- Approved geocoder / map tile provider configuration if current source does not already contain an approved production provider. Keep provider-neutral boundaries and manual/remote location working while provider activation is blocked.
- Store signing / EAS / Apple / Google credentials only at release stage.
- Operator/legal identity values only where truly required for public launch; do not invent them.

When a secret is missing:
1. Finish all provider-neutral/server/client work that does not require the secret.
2. Mark only activation/proof as BLOCKED.
3. Continue independent work.
4. Ask the owner one concise question stating exactly what value/decision is required and where it must be configured.
