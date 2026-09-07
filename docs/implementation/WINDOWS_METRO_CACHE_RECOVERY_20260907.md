# Windows Metro cache concurrency — 2026-09-07

Status: **IMPLEMENTED / LOCAL SOURCE AND DISK PROVEN / PR REVIEW PENDING**. This development-tooling unit is based on canonical `7c83a1bf09faad1edb7fd0bc2e9199bee645dd41`, freshly confirmed by the coordinating agent at 17:05:42 UTC. It makes no new claim about live backend state, provider success, application journeys or release readiness.

The owner session encountered repeated Windows Metro `EMFILE` failures during development reloads even with one transform worker. That observation motivated the existing candidate. Transform worker count does not itself bound the concurrent cache reads issued by Metro. This change limits the installed Expo cache's outstanding `get` and `set` operations to 32 across all configured stores on Windows.

## Source and architecture boundary

- `metro.config.cjs` obtains and returns Expo's default configuration. A shared queue delegates to the original stores with their original receiver. It preserves values, misses, errors, clear behavior and diagnostic names. Linux and macOS retain the exact default store array and objects.
- `scripts/metro-cache-concurrency.test.cjs` exercises the actual configuration with controlled stores and with the installed Expo binary store. Its temporary disk fixture is created and removed exclusively beneath the worktree's ignored `.expo` directory. It does not touch the owner's active cache or environment.
- `.github/workflows/pre-p4-integrity.yml` runs the seven Node tests after installing the lockfile, because the disk/config-loader tests use the installed Expo runtime.

There are no changes to application presentation, hooks, contracts, client services, business authority, Auth, database/Edge source, application identity, packages or lockfile. No backend connection, provider call, account operation, remote environment change or UI action is part of this unit. Existing proof artifacts retain their original source boundaries.

The installed runtime was inspected directly: Expo `57.0.18`, Metro config `0.84.5`, Node `24.18.0`, Windows. Expo's default store is `BinaryFileStore`; its own serializer, CSS skip behavior, writes/renames, cache misses and clearing remain responsible for storage semantics. The project follows Expo's documented default-config extension point and Metro's get/set/clear cache contract. [Expo Metro configuration](https://docs.expo.dev/versions/v57.0.0/config/metro/), [Metro cache contract](https://metrobundler.dev/docs/caching/).

## Local proof

The exact reviewed source blobs are `0868f820a84f426f568044897c6ad883d7faca7f` (configuration), `baecdafe62b2021c39b4a819a7cb72ab14544895` (tests), and `deb0f583056b55e399fda193f1600e575074251b` (workflow).

| Check | Observed result |
| --- | --- |
| Seven focused Node tests | PASS; shared queue across two stores, original object/Buffer identity, synchronous throw and async rejection recovery, diagnostic name/clear semantics, Linux/macOS exact default identities |
| Installed Metro resolution | PASS; automatic discovery of `metro.config.cjs`, actual module/default Expo configuration loaded |
| Installed Expo binary disk workload | PASS; 1,200 writes plus 3,600 warm reads; decoded structures and Buffer bytes unchanged; peak 32 operations |
| Controlled descriptor-pressure comparison | Unwrapped store: 1,136 injected `EMFILE` refusals at a synthetic limit of 64 concurrent disk operations. Wrapped store: 0 refusals, peak 32, all warm values verified |
| Store compatibility after workload | Missing key returns null, CSS `skipCache` stays uncached, clear removes the value, and rewrite/read works |
| Full Jest regression | 49 suites / 395 tests PASS |
| TypeScript | `npx tsc --noEmit` PASS |
| Migration integrity | PASS: source 87 / recorded live snapshot 87 / pending 0; inherited provenance, no new live observation |
| Client AST boundary | 64 client files / 25 presentation files / 0 findings; unchanged source, bounded static check |
| Workflow YAML / order / whitespace | PASS; installed-runtime test follows `npm ci`; `git diff --check` PASS |
| Isolated cold/warm Expo export smoke | PARTIAL: each transformed 4,546 server-render modules without `EMFILE` (131,339 ms cold; 5,356 ms warm), then exited 1 at the existing missing-Supabase-configuration guard during static rendering |

Run focused proof with `node --test scripts/metro-cache-concurrency.test.cjs`. The pressure test intercepts only reads/writes beneath its exclusive fixture path, restores both filesystem methods in `finally`, and admits real disk operations through the unchanged installed Expo store. The synthetic descriptor threshold is intentional and is **not** an observed Windows OS limit or actual OS exhaustion reproduction.

The two export attempts used the existing read-only dependency junction, separate task scratch cache/output directories, and `EXPO_OFFLINE=1`, `EXPO_NO_DOTENV=1`, `EXPO_NO_CLIENT_ENV_VARS=1`. The command was `expo export --platform web --dev --no-minify --max-workers 1`. Public backend configuration was deliberately unavailable; no fake source was enabled to bypass the existing guard. The initial `--no-ssg` attempt was rejected by Expo because the unchanged app uses `web.output: static`; it was removed without changing application configuration. No full export, browser reload or native app acceptance is claimed. [Sanitized source and local-result manifest](evidence/metro-cache-20260907/local-proof.json).

## Precise limits and next action

This queue bounds cache operations, not every file descriptor in Metro. File-map crawling, watchers, Expo shard preparation, background cleanup, another process and system resource pressure are outside its bound. It preserves upstream synchronous `clear()` behavior and does not invent new ordering between a clear and already queued operations. Other platforms' identity preservation is exercised with the actual configuration source under a simulated platform; that is not a physical macOS run.

Local source/disk success is not a new native Android or owner-browser acceptance run. Review the exact PR head, pass CI/CodeQL, then merge only after the coordinating reviewer accepts. Do not reapply any backend migration or relabel earlier app/provider proof as this tooling proof.
