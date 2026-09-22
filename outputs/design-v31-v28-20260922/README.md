# V28/V31 review and independent card proposal

## Connected flow (owner correction, 2026-09-22)

`TOK.html` extends the review to task detail, application, candidate selection, Agreement and messages.
Start `python outputs/design-v31-v28-20260922/serve_flow.py` and open
http://127.0.0.1:8880/TOK.html. The map is an explicitly labeled composition diagram, not a live map.
All data/commands are local examples. Native integration work and the verified missing relationship
are documented in `../../docs/implementation/DESIGN_CONNECTED_TASK_FLOW_20260922.md`.

Edit `flow.template.html`, then run `build_flow.py`. The builder embeds the static vector inventory
and, when present, the existing Inter font assets with their OFL license; it downloads nothing.
The older card-only study remains available below. Native visual work is owned by the concurrent
Claude implementation; this deliverable does not replace or overwrite it.

## Original card study

Open PREDLOG.html locally or run from the canonical repository:

    python outputs/design-v31-v28-20260922/serve_preview.py

Then open http://127.0.0.1:8879/PREDLOG.html. The server exposes only this new proposal.
It does not expose the original HTML or the repository. No packages or provider calls are required.

The original reference pages were statically inspected, not browser-executed. The proposal has a
network-blocking CSP, local illustrative data, the supplied original logo and validated static V28 vectors.
It is a design study, not the native app or a backend proof. The three layouts vary composition while
preserving the owner's V28 icon/color/navigation direction. CSS/SVG motion samples are not a Lottie runtime.

The detailed R5 report is ../../docs/implementation/DESIGN_V31_V28_EXECUTION_20260922.md.
evidence.json records source hashes and style/Lottie inventory; v28-vector-assets.json contains the
static extracted illustrations. Source provenance is the owner's supplied V28 HTML, not a claim that
an external asset library was licensed or installed. Release licensing review remains required.

inspect_references.py and summarize_evidence.py read the supplied Downloads files to reproduce static
analysis. extract_v28_art.py reconstructs only whitelisted literal vector expressions from that analysis,
validates SVG tags/attributes and never executes the reference JavaScript.

Browser checks: three variants at four card widths with long title/enlarged text, matching second-card
application detail, local error recovery, 14 planned screen families and motion-tab rendering. No console
warnings/errors observed. These checks do not establish native accessibility, performance or device parity.
