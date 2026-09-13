# PR102 source-check review

Reviewed source:6850b126bb38ee22edfdfe054ea342a9b7680a2f,
treefd874e1a60de05565232c446fda52c247ba2d344. Draft
[PR102](https://github.com/Uskoci1/USKOCI-CLEAN/pull/102) targets unchanged
canonical916ffb498ba5ad47a307a3c66477757b6753095a. No merge or live operation.

## Jest teardown failure

[PRE-P4 run34735642488](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34735642488)
passed all185 suites/3711 tests, but Jest exited1 after a late console warning:
the optional ExpoModulesCoreJSLogger lookup attempted to read an absent
TurboModuleRegistry.get. Jest resetModules enumerates globals and touches Expo's
lazy fetch getter; that can load Expo Modules Core during environment teardown.

The speech adapter test supplied a partial React Native mock with Platform and
PermissionsAndroid only. Adding TurboModuleRegistry.get returning null models
the absent optional native logger correctly. Installed Expo sources confirm
this nullable lookup. No console suppression, global fetch override, forceExit,
production code or workflow change is involved. The original warning reproduced
in that isolated test; speech plus account-closure then passed51 tests without
the warning. A second reviewer confirmed the installed-source diagnosis.
The subsequent full unsilenced Jest run passed185 suites/3711 tests with exit0
in304.517s while Android compilation was also running. The late logger warning
did not recur. Existing in-test Expo Go splash/push warnings remain visible;
they were not suppressed. The exact saved-source PR rerun is still pending.

## CodeQL findings and disposition

[CodeQL run34735641305](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34735641305)
completed all three language analyses, but its aggregate check failed on nine
new findings. No scanner setting, severity, rule or path exclusion was changed.

| Alerts | Finding | Disposition |
| --- | --- | --- |
|20–23|Substring matches for provider URLs in pre_v3_provider_selection.test.mjs|Corrected locally to parsed exact HTTPS origins and endpoint paths, rejecting credentials, query and fragment. A negative case covers lookalike hosts, userinfo, insecure scheme, alternate port and wrong endpoint.|
|24|Substring provider test in qa_classifier_edge.test.mjs|Corrected locally to parsed hostname and RPC pathname assertions.|
|25|Unescaped hostname regular expression in speechEdge.test.ts|Corrected locally to exact parsed WSS origin and complete Bidi endpoint path with no URL credentials.|
|17–18|Identity replacement in archived V2 JavaScript and HTML|Valid redundant code retained in the frozen original reference; individually dismissed as `won't fix`, with comments.|
|19|MD5 in v5_retention_compatibility.test.mjs|Individually dismissed as `used in tests`, with the narrow historical-compatibility rationale below.|

The three test-file URL changes passed74 Node tests and23 Jest tests in the
focused author verification; root independently reran all74 Node tests and the
full Jest suite successfully. Their next exact-source CodeQL result is pending;
they have not been marked fixed merely because a local edit exists.

Alerts17/18 refer to the identical no-op replacement of a layout tag in the
owner-supplied historical V2 donor. It is not a sanitizer. Source and Edge import
searches found no runtime importer; the sole native reference is a token-source
comment. Original bytes match PACKAGE_MANIFEST.json:

- source/spoj-v2.js: SHA25644c7a35274bbbe5180c38198f05de3945aa43c1e462a3091c1c6de17f68e187c.
- prototype/USKOCI_SPOJ_V2.html: SHA2566240f4ffbbd0f5b196c8feed18fd61c7593801c5286170bde80f5588fe9110f6,
  also recorded in AUTHORITY_INDEX.md. That index explicitly distinguishes
  prototype function status from native/backend completion.

Preserving an original reference does not claim its redundant expression is
good implementation. Current V5 uses native components, with no HTML runtime.

Alert19's readFileSync inputs are fixed versioned SQL files105/121/140. The test
recomputes the existing PostgreSQL prosrc MD5 constants to guard exact historical
compatibility. No user input, passwords, tokens or personal data enter this hash.
It is not an authentication or encryption mechanism. Replacing MD5 with SHA256
here would stop testing the historical MD5 contract; production SQL and applied
migration history remain unchanged.

GitHub confirmed all three scoped dispositions at2026-09-13T03:48:10–14Z.
The first PATCH attempt exceeded GitHub's280-character comment limit and was
rejected with422; shorter explanatory comments succeeded. Full evidence is kept
here. These are visible review decisions, not a claim that CodeQL found zero
issues or that security testing has finished.
