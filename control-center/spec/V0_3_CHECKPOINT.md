# USKOČI CONTROL v0.3 checkpoint

This checkpoint adds an evidence-aware Alert Center and Development Inspector without changing canonical app or DEV.

## Implemented

- live canonical branch HEAD read from GitHub
- stale control snapshot detection
- dated DEV snapshot display
- 62-flow evidence ladder and aggregate
- risk radar
- current-HEAD GitHub Actions result
- recent commit timeline
- commit -> CI inspector
- typed Alert Center
- machine-readable alert rules
- read-model contract for future private runtime monitoring
- static CI guard for browser read-only boundary

## Deliberate limits

- no canonical DEV direct connection in the browser
- no Users/Tasks/Agreements private runtime data yet
- no service-role/secret keys
- no admin writes
- no assumption that CI failure equals app failure
- no assumption that stale snapshot equals unhealthy DEV

## Next

1. retain v0.3 as development monitor;
2. regain read-only canonical DEV access;
3. verify exact live schema/ACL/RLS;
4. prepare the smallest owner-only server read-model candidate;
5. prove security + bounded query cost before asking to apply anything.
