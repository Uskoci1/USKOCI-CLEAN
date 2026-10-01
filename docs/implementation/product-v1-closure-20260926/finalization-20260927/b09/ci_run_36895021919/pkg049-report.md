# PKG-049 / B09 server price authority: characterization proof (no server change)

**Label: CHAIN == DEV (every pinned price-chain body is byte-equal to the 2026-10-01 DEV readback)**

Source e27e76db0c0be9d62683ff253a7f46d5cb846fe4. Disposable chain only: no DEV, no provider, no device. Nothing here is evidence about DEV unless the label says CHAIN == DEV. Result: **PASS**.

Stages: EX-04D candidate: APPLIED (exact DEV text, sha256 pinned; two new functions, nothing replaced). B24 conversion of the two price-chain functions (in-proof): APPLIED (stale_resolver d37c4f7c -> 96cb9aac, confirm_need_edit dfa1a809 -> 450b6f8d; the derived md5 equalled the DEV md5 before anything was executed).

## Pin gate (price chain)

**CHAIN == DEV (every pinned price-chain body is byte-equal to the 2026-10-01 DEV readback)**

DEV values: leqcwgzvjsxugfgzdmth, ledger 219, read-only on 2026-10-01. md5 = md5(replace(prosrc, chr(13), '')).

Gate verdict: PASS.

| id | group | verdict | DEV md5 | chain md5 | note |
| --- | --- | --- | --- | --- | --- |
| submit | core | equal | c98e5bee7965b0d6ece9b477f94cede9 | c98e5bee7965b0d6ece9b477f94cede9 |  |
| select | core | equal | 7cbb83905c1c983be4a7d92ff505411e | 7cbb83905c1c983be4a7d92ff505411e |  |
| helper | core | equal | bd7ef02925c03d99ff7fd549219214cb | bd7ef02925c03d99ff7fd549219214cb |  |
| stale_resolver | core | equal | 96cb9aac713739bbfa9a9d85df45d22f | 96cb9aac713739bbfa9a9d85df45d22f |  |
| ncs_1 | core | equal | 6d65e304f41f3e130228f58874757f0d | 6d65e304f41f3e130228f58874757f0d |  |
| ncs_2 | core | equal | 08c5c9656576d6c91b6d47e49089b244 | 08c5c9656576d6c91b6d47e49089b244 |  |
| propose | core | equal | cf577eafb406dac9c7ab17042f201749 | cf577eafb406dac9c7ab17042f201749 |  |
| respond | core | equal | a89309f3578c27ba1d9d9007a466c88e | a89309f3578c27ba1d9d9007a466c88e |  |
| selectable_count | adjacent | equal | fe53442f8b661d6f33d22a54e2a468a8 | fe53442f8b661d6f33d22a54e2a468a8 |  |
| guard_need_write | adjacent | equal | 314b93f7f89d3d52dbcf17a2a2552502 | 314b93f7f89d3d52dbcf17a2a2552502 |  |
| confirm_need_edit | adjacent | equal | 450b6f8d932b1c58bcead22b6d29374b | 450b6f8d932b1c58bcead22b6d29374b |  |

## Chain fidelity

The chain is the DEV-equivalent replay source147 -> PKG-050 plus the exact EX-04D text and the in-proof conversion of exactly two PRE-B24 bodies. It does NOT carry the DEV ledger 202-219 items listed in chainLacks; its certified set (76) and needs column ACL differ from DEV (88 functions, column grants after PKG-045b P0), and its certificate is chain-internal only (before = after, never equal to DEV 58447d77).

B24 Part 1 on the pristine chain: absent targets private.platform_price_add_version; site-count drift []; not unique none; already PT409 none; would apply here: false (relaxed mode does not relax existence or the quoted-site count).

The chain does NOT carry: pkg051a (platform price list); A1/P0/P4/P5/B3a-c; PKG-045b P0 (needs column ACL and certificate re-bind: the chain still has table-level SELECT on public.needs); P6 rollout v3; B24 Part 1 (54 functions) and Part 2 (certified, re-bind) except the two price-chain functions converted in-proof; Voice B1 (certificate 58447d77, 12 voice functions); EX-04A-C.

Certificate: chain 7c21f17a, DEV 58447d77; chain-internal only: before = after is provable on the chain, equality with DEV is not
PostgREST header: {"server":"postgrest/16.1","via":"kong/2.8.1"}.

## Matrix (modified client, real PostgREST, real JWTs)

142 refusals asserted with exact message, SQLSTATE, HTTP 400 and nothing written; 23 amounts stored verbatim with a content hash that binds them (119 CANON rows, 46 rows PINNED_TO_TODAY under an open owner decision: characterised, not judged).

| case | sent | outcome | message | status |
| --- | --- | --- | --- | --- |
| my_null_n1 c1 MY_PRICE A=3000 | 3001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| my_null_n1 c1 MY_PRICE A=3000 | 2999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| my_null_n1 c1 MY_PRICE A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| my_null_n1 c1 MY_PRICE A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| my_null_n1 c1 MY_PRICE A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| my_null_n1 c1 MY_PRICE A=3000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| my_null_n1 c1 MY_PRICE A=3000 | 3000 (canonical+taskAmount+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | CANON |
| my_null_n3 c1 MY_PRICE A=3000 | 3001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c1 MY_PRICE A=3000 | 2999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c1 MY_PRICE A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c1 MY_PRICE A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c1 MY_PRICE A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c1 MY_PRICE A=3000 | null (null) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c1 MY_PRICE A=3000 | 3000 (canonical+taskAmount+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D1) |
| my_null_n3 c2 MY_PRICE A=3000 | 6000 (taskAmountTimesCovered) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c2 MY_PRICE A=3000 | 3001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c2 MY_PRICE A=3000 | 2999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c2 MY_PRICE A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c2 MY_PRICE A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c2 MY_PRICE A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c2 MY_PRICE A=3000 | null (null) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c2 MY_PRICE A=3000 | 3000 (canonical+taskAmount) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D1) |
| my_null_n3 c3 MY_PRICE A=3000 | 9000 (taskAmountTimesCovered) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c3 MY_PRICE A=3000 | 3001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c3 MY_PRICE A=3000 | 2999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c3 MY_PRICE A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D1) |
| my_null_n3 c3 MY_PRICE A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c3 MY_PRICE A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c3 MY_PRICE A=3000 | null (null) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D1) |
| my_null_n3 c3 MY_PRICE A=3000 | 3000 (canonical+taskAmount) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D1) |
| per_person_n1 c1 MY_PRICE/PER_PERSON A=3000 | 3001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D6) |
| per_person_n1 c1 MY_PRICE/PER_PERSON A=3000 | 2999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D6) |
| per_person_n1 c1 MY_PRICE/PER_PERSON A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D6) |
| per_person_n1 c1 MY_PRICE/PER_PERSON A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D6) |
| per_person_n1 c1 MY_PRICE/PER_PERSON A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D6) |
| per_person_n1 c1 MY_PRICE/PER_PERSON A=3000 | null (null) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D6) |
| per_person_n1 c1 MY_PRICE/PER_PERSON A=3000 | 3000 (canonical+taskAmount+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D6) |
| per_person_n3 c1 MY_PRICE/PER_PERSON A=3000 | 3001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c1 MY_PRICE/PER_PERSON A=3000 | 2999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c1 MY_PRICE/PER_PERSON A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c1 MY_PRICE/PER_PERSON A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c1 MY_PRICE/PER_PERSON A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c1 MY_PRICE/PER_PERSON A=3000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c1 MY_PRICE/PER_PERSON A=3000 | 3000 (canonical+taskAmount+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | 3000 (taskAmount) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | 3001 (taskAmountPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | 2999 (taskAmountMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | 6001 (canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | 5999 (canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c2 MY_PRICE/PER_PERSON A=3000 | 6000 (canonical+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | 3000 (taskAmount) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | 3001 (taskAmountPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | 2999 (taskAmountMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | 9001 (canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | 8999 (canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| per_person_n3 c3 MY_PRICE/PER_PERSON A=3000 | 9000 (canonical+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | CANON |
| per_person_n6 c1 MY_PRICE/PER_PERSON A=3000 | 3001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c1 MY_PRICE/PER_PERSON A=3000 | 2999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c1 MY_PRICE/PER_PERSON A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c1 MY_PRICE/PER_PERSON A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c1 MY_PRICE/PER_PERSON A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c1 MY_PRICE/PER_PERSON A=3000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c1 MY_PRICE/PER_PERSON A=3000 | 3000 (canonical+taskAmount+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | 3000 (taskAmount) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | 3001 (taskAmountPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | 2999 (taskAmountMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | 6001 (canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | 5999 (canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c2 MY_PRICE/PER_PERSON A=3000 | 6000 (canonical+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | 3000 (taskAmount) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | 3001 (taskAmountPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | 2999 (taskAmountMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | 18001 (canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | 17999 (canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| per_person_n6 c6 MY_PRICE/PER_PERSON A=3000 | 18000 (canonical+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | 100000000 (taskAmount) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | 100000001 (taskAmountPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | 99999999 (taskAmountMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | 2100000001 (canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | 2099999999 (canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| per_person_int4 c21 MY_PRICE/PER_PERSON A=100000000 | 2100000000 (canonical+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | CANON |
| per_person_int4 c22 MY_PRICE/PER_PERSON A=100000000 | 100000000 (taskAmount) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c22 MY_PRICE/PER_PERSON A=100000000 | 100000001 (taskAmountPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c22 MY_PRICE/PER_PERSON A=100000000 | 99999999 (taskAmountMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c22 MY_PRICE/PER_PERSON A=100000000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| per_person_int4 c22 MY_PRICE/PER_PERSON A=100000000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| per_person_int4 c22 MY_PRICE/PER_PERSON A=100000000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| per_person_int4 c22 MY_PRICE/PER_PERSON A=100000000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c1 MY_PRICE/TOTAL A=9000 | 9000 (taskAmount+taskAmountTimesCovered) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c1 MY_PRICE/TOTAL A=9000 | 9001 (taskAmountPlusOne) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c1 MY_PRICE/TOTAL A=9000 | 8999 (taskAmountMinusOne) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c1 MY_PRICE/TOTAL A=9000 | 3000 (barePerPersonShare) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c1 MY_PRICE/TOTAL A=9000 | 2147483647 (int4Max) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c1 MY_PRICE/TOTAL A=9000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c1 MY_PRICE/TOTAL A=9000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c1 MY_PRICE/TOTAL A=9000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | 9000 (taskAmount) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | 18000 (taskAmountTimesCovered) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | 9001 (taskAmountPlusOne) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | 8999 (taskAmountMinusOne) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | 3000 (barePerPersonShare) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | 2147483647 (int4Max) | REFUSED | TOTAL_PRICE_REQUIRES_ALL_SLOTS | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c2 MY_PRICE/TOTAL A=9000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | 27000 (taskAmountTimesCovered) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | 9001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | 8999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | 3000 (barePerPersonShare) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | null (null) | REFUSED | INVALID_PRICE | CANON |
| total_n3 c3 MY_PRICE/TOTAL A=9000 | 9000 (canonical+taskAmount) | ACCEPTED_VERBATIM |  | CANON |
| total_n1 c1 MY_PRICE/TOTAL A=4000 | 4001 (taskAmountPlusOne+canonicalPlusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D6) |
| total_n1 c1 MY_PRICE/TOTAL A=4000 | 3999 (taskAmountMinusOne+canonicalMinusOne) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D6) |
| total_n1 c1 MY_PRICE/TOTAL A=4000 | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_MISMATCH | PINNED_TO_TODAY (open D6) |
| total_n1 c1 MY_PRICE/TOTAL A=4000 | 0 (zero) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D6) |
| total_n1 c1 MY_PRICE/TOTAL A=4000 | -1 (negative) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D6) |
| total_n1 c1 MY_PRICE/TOTAL A=4000 | null (null) | REFUSED | INVALID_PRICE | PINNED_TO_TODAY (open D6) |
| total_n1 c1 MY_PRICE/TOTAL A=4000 | 4000 (canonical+taskAmount+taskAmountTimesCovered) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D6) |
| my_no_price c1 MY_PRICE A=- | 3000 (anyPositive) | REFUSED | FIXED_PRICE_NOT_READY | CANON |
| my_no_price c1 MY_PRICE A=- | 1 (one) | REFUSED | FIXED_PRICE_NOT_READY | CANON |
| my_no_price c1 MY_PRICE A=- | 2147483647 (int4Max) | REFUSED | FIXED_PRICE_NOT_READY | CANON |
| my_no_price c1 MY_PRICE A=- | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| my_no_price c1 MY_PRICE A=- | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| my_no_price c1 MY_PRICE A=- | null (null) | REFUSED | INVALID_PRICE | CANON |
| offers_n1 c1 OFFERS A=- | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| offers_n1 c1 OFFERS A=- | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| offers_n1 c1 OFFERS A=- | null (null) | REFUSED | INVALID_PRICE | CANON |
| offers_n1 c1 OFFERS A=- | 1 (one) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |
| offers_n1 c1 OFFERS A=- | 7777 (typical) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |
| offers_n1 c1 OFFERS A=- | 2147483647 (int4Max) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |
| offers_n3 c1 OFFERS A=- | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| offers_n3 c1 OFFERS A=- | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| offers_n3 c1 OFFERS A=- | null (null) | REFUSED | INVALID_PRICE | CANON |
| offers_n3 c1 OFFERS A=- | 1 (one) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |
| offers_n3 c1 OFFERS A=- | 7777 (typical) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |
| offers_n3 c1 OFFERS A=- | 2147483647 (int4Max) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |
| offers_n3 c3 OFFERS A=- | 0 (zero) | REFUSED | INVALID_PRICE | CANON |
| offers_n3 c3 OFFERS A=- | -1 (negative) | REFUSED | INVALID_PRICE | CANON |
| offers_n3 c3 OFFERS A=- | null (null) | REFUSED | INVALID_PRICE | CANON |
| offers_n3 c3 OFFERS A=- | 1 (one) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |
| offers_n3 c3 OFFERS A=- | 7777 (typical) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |
| offers_n3 c3 OFFERS A=- | 2147483647 (int4Max) | ACCEPTED_VERBATIM |  | PINNED_TO_TODAY (open D4) |

## Agreement change (OPEN OWNER DECISION D3: characterised, not judged)

This block pins the behaviour of today (bilateral consent, no tie to the task price, basis or mode; the offer card keeps the application price while the Dogovor shows the amended one). An owner-selected D3 lock turns exactly this block RED; update it deliberately in that candidate. Cell status: PINNED_TO_TODAY (open D3).

| task basis | task price | covered | v1 | accepted by consent | final readback | status |
| --- | --- | --- | --- | --- | --- | --- |
| null | 3000 | 1 | 3000 | 1, 2147483647, 3000 | 3000 | PINNED_TO_TODAY (open D3) |
| PER_PERSON | 3000 | 2 | 6000 | 1, 2147483647, 3000 | 3000 | PINNED_TO_TODAY (open D3) |
| TOTAL | 9000 | 3 | 9000 | 1, 2147483647, 9000 | 9000 | PINNED_TO_TODAY (open D3) |

The accept call: p_proposal_id uuid, p_accept boolean.
Offer card (my applications) versus Dogovor after an accepted amendment: {"basis":null,"offerCardPrice":3000,"dogovorPrice":1,"diverges":true,"label":"PINNED_TO_TODAY (open D3)"}.

## Weakening probes (non-vacuity)

A probe is DETECTED only when each primary door is OBSERVED to give the outcome the weakened rule gives (not merely "the predicate failed"), and, for a single-door probe, every other door still holds.

| weakening | detected | expected outcome | observed (weakened) | restored: all doors hold |
| --- | --- | --- | --- | --- |
| helper_is_a_no_op | true | submit:ACCEPTED, keep:ACCEPTED, select:AGREEMENT_CREATED, candidates:SELECTABLE, page:SELECTABLE | submit=ACCEPTED, keep=ACCEPTED, select=AGREEMENT_CREATED, candidates=SELECTABLE, page=SELECTABLE | true |
| submit_stops_calling_the_helper | true | submit:ACCEPTED | submit=ACCEPTED, keep=FIXED_PRICE_MISMATCH, select=TOTAL_PRICE_REQUIRES_ALL_SLOTS, candidates=STALE, page=STALE | true |
| stale_resolver_stops_calling_the_helper | true | keep:ACCEPTED | submit=FIXED_PRICE_MISMATCH, keep=ACCEPTED, select=TOTAL_PRICE_REQUIRES_ALL_SLOTS, candidates=STALE, page=STALE | true |
| select_stops_calling_the_helper | true | select:AGREEMENT_CREATED | submit=FIXED_PRICE_MISMATCH, keep=FIXED_PRICE_MISMATCH, select=AGREEMENT_CREATED, candidates=STALE, page=STALE | true |
| candidate_reader_stops_calling_the_helper | true | candidates:SELECTABLE | submit=FIXED_PRICE_MISMATCH, keep=FIXED_PRICE_MISMATCH, select=TOTAL_PRICE_REQUIRES_ALL_SLOTS, candidates=SELECTABLE, page=STALE | true |
| page_reader_stops_calling_the_helper | true | page:SELECTABLE | submit=FIXED_PRICE_MISMATCH, keep=FIXED_PRICE_MISMATCH, select=TOTAL_PRICE_REQUIRES_ALL_SLOTS, candidates=STALE, page=SELECTABLE | true |
| unlisted_helper_message_breaks_the_candidate_reads | true | a new helper message needs BOTH need_candidate_states_v5 overloads patched in the same package; it reaches the list, the page and the task read (selectable_application_count) | {"rpc_list_need_candidates":"PKG049_UNLISTED_PROBE","rpc_list_need_candidates_page":"PKG049_UNLISTED_PROBE","rpc_read_task":"PKG049_UNLISTED_PROBE"} | true |

## Checks

- PASS P0_CHAIN_STAGES_EX04D_AND_B24_PRICE_CHAIN_RECORDED_CERTIFICATE_BEFORE_RECORDED
- PASS P1_PIN_GATE_PASSED_VOCABULARY_AND_SWALLOW_LISTS_EQUAL_AND_AUTHORITY_RECORDED (CHAIN == DEV (every pinned price-chain body is byte-equal to the 2026-10-01 DEV readback))
- PASS P1_PEOPLE_CREATED_THROUGH_THE_REAL_AUTH_PATH
- PASS P1_HISTORICAL_APPLICATIONS_AND_AGREEMENTS_SEEDED_THROUGH_THE_RPCS
- PASS P2_MATRIX_CANON_CELLS_110_REFUSALS_WITH_EXACT_MESSAGE_SQLSTATE_HTTP_400_AND_DETAIL_9_AMOUNTS_STORED_VERBATIM_WITH_A_HASH_THAT_BINDS_THEM_AND_THE_ELEVEN_KEY_RECEIPT
- PASS P2_MATRIX_PINNED_TO_TODAY_CELLS_32_REFUSALS_AND_14_ACCEPTED_AMOUNTS_UNDER_OPEN_OWNER_DECISIONS_D1_D4_D6_CHARACTERISED_NOT_JUDGED (142 refusals and 23 accepted amounts in all)
- PASS P2_PRECEDENCE_OVERFLOW_TEAM_CAPACITY_AND_EXACT_AUTHORITY_NEGATIVES
- PASS P3_SAME_KEY_SAME_COMMAND_RETURNS_THE_STORED_RESULT_AND_WRITES_NOTHING
- PASS P3_SAME_KEY_WITH_ANOTHER_PRICE_IS_THE_IDEMPOTENCY_MISMATCH_NOT_A_PRICE_REFUSAL
- PASS P3_A_REFUSED_KEY_CAN_BE_RETRIED_AND_THE_STORED_PRICE_IS_NEVER_TOUCHED_BY_A_REFUSAL
- PASS P3_REPLAY_PRECEDES_THE_REVISION_AND_PRICE_CHECKS_AND_A_NEW_KEY_IS_JUDGED_AGAINST_THE_CURRENT_TASK
- PASS P3_A_DOUBLE_TAP_PRODUCES_ONE_VERSION
- PASS P4_STALE_RECONFIRM_KEEP_AND_UPDATE_ARE_JUDGED_AGAINST_THE_CURRENT_TASK_EXACT_REFUSALS_STILL_STALE_NOTHING_WRITTEN_REAL_CLIENT_AND_CAPACITY_BEFORE_PRICE (4 KEEP, 8 UPDATE, 3 via the client, 3 capacity)
- PASS P5_SELECTION_COPIES_THE_STORED_VERSION_PRICE_REPLAYS_AND_COSTS_THE_PLATFORM_NOTHING
- PASS P5_TWO_PARTIAL_APPLICATIONS_ON_ONE_TASK_EACH_BECOME_THEIR_OWN_AGREEMENT_AT_THEIR_OWN_PRICE_PER_PERSON_AND_OFFERS
- PASS P5_NO_PRICE_ARGUMENT_AND_ONLY_THE_REQUESTER_SELECTS_EXACT_OUTCOMES
- PASS P5_SELECTION_IS_BOUND_TO_THE_PINNED_REVISION_VERSION_AND_CONTENT_HASH_A_HASH_THAT_BINDS_ANOTHER_PRICE_IS_REFUSED
- PASS P5_SELECTION_AND_BOTH_CANDIDATE_READERS_RE_ASSERT_THE_RULE_AGAINST_THE_CURRENT_TASK (triggers disabled, no revision bump (defence in depth, R10): a fixture-level state, not a reachable one)
- PASS P5_THE_GUARDS_THAT_PRECEDE_THE_PRICE_RULE_REFUSE_A_STALE_PIN_AND_THE_RECONFIRMED_APPLICATION_IS_SELECTED_AT_THE_NEW_PRICE
- PASS P6_THE_TASK_DECODED_BY_THE_REAL_CLIENT_GIVES_THE_PRICE_THE_SERVER_ACCEPTS_AND_EVERY_READBACK_SHOWS_THE_SERVER_PRICE (null_basis D1 and offers D4 pinned to today)
- PASS P6_PRICE_REFUSALS_ARE_THE_CLIENTS_OWN_LITERAL_SENTENCES_A_ZERO_PRICE_NEVER_LEAVES_THE_CLIENT_AND_SELECTION_REFUSES_THE_SAME_WAY (selection flip: triggers disabled, no revision bump (defence in depth, R10): a fixture-level state, not a reachable one)
- PASS P7_AGREEMENT_CHANGE_CHARACTERISED_ANY_WHOLE_NUMBER_BY_CONSENT_NO_AMOUNT_IN_THE_ACCEPT_CALL_READBACKS_SHOW_THE_LAST_ACCEPTED_AMOUNT_OPEN_OWNER_DECISION_D3
- PASS P8_THE_PROOF_TURNS_RED_WHEN_THE_RULE_IS_WEAKENED (7 of 7 probes detected by the OBSERVED weakened outcome; every body restored exactly)
- PASS P9_EXISTING_AND_SEEDED_PRICE_TUPLES_CERTIFICATE_AND_WHOLE_CATALOG_ARE_UNCHANGED_BY_THE_RUN (the certificate is chain-internal: before = after)

## Not verified

- DEV: nothing here ran against DEV (DEV has 0 open MY_PRICE tasks); the verdicts hold for the disposable chain and carry the label of the pin gate (CHAIN == DEV (every pinned price-chain body is byte-equal to the 2026-10-01 DEV readback))
- the chain is not DEV: it lacks pkg051a, A1/P0/P4/P5/B3a-c, PKG-045b P0 (needs column ACL), P6 rollout v3, B24 Part 1/2 (except the two price-chain functions converted in-proof), Voice B1 and EX-04A-C; its certified set (76) and certificate are chain-internal (before = after only)
- PostgREST version: the disposable supabase CLI stack does not pin it (header recorded in the report); DEV runs 14.5; the 40001 retry hazard is avoided (or, with the in-proof conversion, replaced by an observed PT409 -> HTTP 409), not reproduced
- native device behaviour: the real client TypeScript ran under a transpile-only VM with the live Auth session; no React Native screen, no APK, no phone
- installed APKs older than 2026-09-21 (bare per-person amount): their server-side refusals are covered by the matrix, their on-screen behaviour is not
- OFFERS lower/upper bound (D4), reject-versus-derive (D2), NULL basis for new multi-person tasks (D1), the Agreement price lock (D3) and one-person PER_PERSON / TOTAL tasks (D6) are OPEN owner decisions: characterised (rows labelled PINNED_TO_TODAY), not judged
- a price patch spelled 100.0 in an Agreement change (stored as text) cannot be produced through JSON.stringify
- the task edit is a fixture (the guard's CONFIRM_EDIT token plus an untriggered republish) and the basis/price flips are fixtures with triggers disabled (defence in depth, R10): the real rpc_confirm_need_edit_from_review needs AI review artifacts
- a refused RPC rolls its own transaction back, so "nothing written" is a transactional invariant, not independent evidence; the exact outcome (message, SQLSTATE, HTTP status) is the evidence
- the SQLSTATE of an amount above int4 (22003) is observed here for the first time; the proof tolerates 22003 and 22P02 and rejects PGRST202
