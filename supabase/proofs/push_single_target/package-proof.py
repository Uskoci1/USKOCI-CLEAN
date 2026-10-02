"""Source-only packaging. Does not execute SQL, tests, GitHub, Docker, or providers."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
repo=next((p for p in root.parents if (p/'package.json').is_file() and (p/'.github/workflows/ex05-s01-chat-reproof.yml').is_file()),Path('C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN/.claude/worktrees/uskoci-kompletan-audit-2e715e'))
original=(repo/'.github/workflows/ex05-s01-chat-reproof.yml').read_text(encoding='utf-8')
chain=original[original.index('  chain:\n'):original.index('      - name: The pin gate')]
chain=chain.replace("    if: ${{ github.event_name != 'workflow_dispatch' || inputs.run_chain }}\n",'')
chain=chain.replace("      EX05_S01_PIN_GATE: ${{ inputs.pin_gate_mode || 'report' }}\n",'')
a=chain.index('      - name: The existing P4 resolver and transport proofs')
b=chain.index('      - name: The packages applied to DEV before B3c',a)
chain=chain[:a]+chain[b:] # Self-restoring historical proof runs do not build the predecessor state.
chain=chain[:chain.index('          stage 28-ex04a')]
chain=chain.replace('The exact Voice B1 DEV application (ledger 215, REQUIRED), then EX-04a-d (ledger 216-219, tolerated as in the D12 workflow)','The exact Voice B1 package on the disposable predecessor')
workflow='''name: Push single-target disposable proof
on:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: push-single-target-disposable-${{ github.ref }}
  cancel-in-progress: false
jobs:
'''+chain+'''      - name: Exact candidate syntax and offline Edge checks
        run: |
          set -euo pipefail
          for file in supabase/proofs/push_single_target/*.mjs; do node --check "$file"; done
          node --test supabase/proofs/push_single_target/edge.test.mjs
      - name: Disposable exact candidate and concurrency proof (never a live/provider target)
        env:
          PUSH_SINGLE_TARGET_DISPOSABLE: SINGLE_TARGET_V1
        run: |
          set -euo pipefail
          node supabase/proofs/push_single_target/proof.mjs
      - name: Always discard disposable database
        if: always()
        run: |
          if [[ -n "${RU5_DEVICE_PROOF_DIR:-}" && -d "$RU5_DEVICE_PROOF_DIR" ]]; then
            cd "$RU5_DEVICE_PROOF_DIR"
            supabase stop --no-backup
          fi
      - name: Upload bounded proof report only (no raw setup logs, keys or rows)
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: push-single-target-${{ github.sha }}-${{ github.run_id }}
          path: |
            /tmp/chat-p4-private/single-target-proof-report.json
            /tmp/ex05-s01-artifacts/source-binding.txt
            /tmp/ex05-s01-artifacts/stages.txt
          if-no-files-found: error
          retention-days: 30
'''
dest=root/'.github/workflows/push-single-target-proof.yml'
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(workflow,encoding='utf-8',newline='\n')
review=root/'REVIEW.md'
t=review.read_text(encoding='utf-8').replace('Two nullable columns are proposed:', 'Three nullable columns are proposed:').replace('and `single_target_claimed_at` (irreversible consumption).', '`single_target_claimed_at` (irreversible consumption), and `single_target_authorization_id` (UUID with a schema-digest-covered UNIQUE constraint).').replace('adds two columns and unique authorization constraint','adds three columns and a unique authorization constraint')
review.write_text(t,encoding='utf-8',newline='\n')
manifest=json.loads((root/'MANIFEST.json').read_text())
for name in ['build.py','certificate-proof.mjs','candidate-runtime.mjs','edge.test.mjs','proof.mjs','package-proof.py']:
 manifest['sourceFiles'][name]=hashlib.sha256((root/name).read_bytes()).hexdigest()
manifest['workflowSha256']=hashlib.sha256(dest.read_bytes()).hexdigest()
(root/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'status':'SOURCE_ONLY_NOT_EXECUTED','workflowSha256':manifest['workflowSha256'],'manifestSha256':hashlib.sha256((root/'MANIFEST.json').read_bytes()).hexdigest()},indent=2))
