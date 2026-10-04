# Application / Offer Inspector v1

SOURCE ONLY. No DEV apply.

Input: marketplace response UUID.

Shows:
- response kind/status/current version and lifecycle timestamps;
- submitted Need revision vs current Need revision, including a stale flag;
- safe Task context;
- safe Worker profile summary;
- current response terms: price, covered slots, proposed time, Need revision;
- scope-note presence only, never its body;
- Selection and resulting Agreement metadata when present;
- last 25 RESPONSE event metadata rows, without payload.

It never returns email, phone, exact address/coordinates, chat body or scope-note body.
