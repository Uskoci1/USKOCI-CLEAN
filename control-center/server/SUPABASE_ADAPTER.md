# Supabase server adapter

Environment only; never commit real values:

- CONTROL_SUPABASE_URL
- CONTROL_SUPABASE_PUBLIC_KEY
- CONTROL_SUPABASE_SERVER_KEY
- CONTROL_OWNER_USER_ID

Flow:
1. browser sends its user access token to the private Control API;
2. authorize() validates the token through Supabase Auth using the public key;
3. only the configured owner UUID receives OWNER role;
4. rpc() can call only the five allowlisted Control RPCs using the server key;
5. server key is never serialized into browser HTML or API responses;
6. upstream body is capped at 192 KiB and times out.

This adapter is not connected to canonical DEV yet because the current connector session does not expose leqcwgzvjsxugfgzdmth.
