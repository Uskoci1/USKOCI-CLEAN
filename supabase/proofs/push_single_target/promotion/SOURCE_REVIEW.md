# Bounded source review and isolated execution status

Current candidate SHA256: `f069ba97a2ce3d6b459404dcb74593cdc54b6d651a2869e70a789d22271f227c`.

The earlier independent review by `/root/review_ci` covered the generator, candidate/preflight/postflight/revert, isolated current99 proof and workflow. It identified the encoded inverse-probe GUC defect, which was corrected before encoding. That source review was not DEV application acceptance.

Run37084601034 at882f3cbb completed the separate source-bound current99 local-catalog fixture assembly: all17 AI receipt function checks and13 full-definition/portable-metadata checks passed. This is not execution of the original historical DEV ledger bytes. The report explicitly records historicalLedgerApplied=false. All15 report source hashes were independently matched to committed Git blobs; report SHA256 is5193b0ec13c47fb4a6ad4c4b45a4ac03b4beacf31bd1ff667f899fd611787df9.

The run then stopped at the first promotion install because four frozen predecessor regprocedure signatures relied on public search_path while the new wrapper intentionally sets pg_catalog. The current generator fully qualifies those four signatures using unique exact tuple anchors, retaining every expected body hash. The generated candidate differs only in those four strings. Historical installer, seven function bodies, revert, preflight, postflight and Edge assets are unchanged. Root independently reviewed this bounded correction. JavaScript parsing and pure source generation passed; the corrected SQL still requires isolated execution.

The full current99 install/postflight/revert/reapply proof and existing13 behavioral groups must pass before promotion. Existing trusted service_role direct DML limitation remains explicit. No live mutation, certificate update, Edge deployment, admission or sending occurred in this correction.
