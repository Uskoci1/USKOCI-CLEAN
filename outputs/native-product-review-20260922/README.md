# Native presentation review

This builds the actual TSX presentation components with React Native Web. It is a developer review,
not a replacement app or a proof of backend flows. Explicit local fixtures are never submitted.
Media, inbox and voice boundaries are isolated; no session, provider or backend is used.

From the repository root, with the existing locked dependencies:

    node outputs/native-product-review-20260922/build.cjs
    node outputs/native-product-review-20260922/serve.cjs

Open http://127.0.0.1:8882. The server exposes only the viewer, bundle and five bundled Inter fonts.
It binds to localhost. The production Metro config and package manifest are not modified.
Generated bundles, tests' full reports, APKs and phone screenshots are excluded from Git.

Screenshots of an explicitly authorized USB device can be captured with:

    python outputs/native-product-review-20260922/capture-phone.py SERIAL CAPTURE_NAME

This only runs adb exec-out screencap. It never clears or resets device/app data.

Scope, decisions and evidence: ../../docs/implementation/DESIGN_NATIVE_CONNECTED_SLICES_20260922.md.
