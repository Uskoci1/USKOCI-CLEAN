# Open the confirmed application

The person must immediately recognise the offer they just sent and its real status.
This completes the named-navigation seam of F10 / B09-B10. It follows UX_NACRT
section 5 step 3 and the existing receipt contract, without a new server capability.

Three compositions considered: scroll to a variable-height row (can fail before
virtualized rows are measured), duplicate a dedicated detail route (another state
owner), or place the explicitly requested real row first in the current list.
Choose the third: the requested row is visible immediately, never duplicated, and
the person's selected status filter remains authoritative.

The submit route passes the confirmed receipt's application ID to the existing
My Applications route. Owner/focus/read guards and the one-shot navigation fence
are unchanged. Missing named rows get a refresh action after a successful read;
loading and failed reads keep their own existing states. No unrelated row is opened.

An expanded normal offer previously exposed controls intended for changed tasks.
Those controls now render only for STALE_REVIEW_REQUIRED. Business validation,
pending-command reconciliation and recovery are unchanged.

Validation: types pass; all 242 suites / 4709 tests pass. The three targeted
regressions fail before the patch and pass after it. Additional tests reject
retained receipt navigation after blur/account change and duplicate activation.
The known Jest worker teardown warning remains. Exact files and reports are in
OFFER_LANDING_RECEIPT.json. Native flow acceptance and independent review remain
separate from these source checks.

The owner's physical phone reconnected. The prior verified offer-review APK
(50178e6b, run 35762585376) was installed with replacement successfully. It is not
this navigation patch. Another app was foreground during screenshot capture, so
no internal USKOCI screen or authenticated flow is claimed from that installation.
