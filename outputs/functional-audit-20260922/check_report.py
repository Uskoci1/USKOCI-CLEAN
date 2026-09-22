import hashlib, json, pathlib, re, subprocess
from html.parser import HTMLParser
root = pathlib.Path(__file__).resolve().parents[2]
out = root / "outputs/functional-audit-20260922"
docs = root / "docs/implementation/functional-audit-20260922"
rows = json.loads((out / "matrix.sr.json").read_text(encoding="utf-8-sig"))
assert len(rows) == 48 and len({r["id"] for r in rows}) == 48
required = ["job","has","gap","place","kind","server"]
for row in rows:
    assert all(row[k].strip() for k in required), row["id"]
    assert all(row["draft"][k].strip() for k in ["section","matches","missing","different"])
    assert all((root / "src/app" / p).is_file() for p in row["paths"])
routes = {str(p.relative_to(root / "src/app")).replace(chr(92), "/") for p in (root / "src/app").rglob("*.tsx")}
routes |= {str(p.relative_to(root / "src/app")).replace(chr(92), "/") for p in (root / "src/app").rglob("*.ts")}
covered = {p for r in rows for p in r["paths"]}
tracked = {p.removeprefix('src/app/') for p in subprocess.check_output(['git','ls-files','src/app'],cwd=root,text=True).splitlines() if p.endswith(('.ts','.tsx'))}
assert tracked == covered, (sorted(tracked-covered), sorted(covered-tracked))
local_gallery = {'dizajn-pregled.tsx'}
assert routes == covered | local_gallery, (sorted(routes-covered-local_gallery), sorted(covered-routes))
subprocess.run(['git','check-ignore','-q','src/app/dizajn-pregled.tsx'],cwd=root,check=True)
class Check(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.links=[]; self.images=[]; self.matrix=False; self.trs=0; self.cells=[]; self.cell=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if "id" in a: self.ids.append(a["id"])
        if tag=="a": self.links.append(a.get("href",""))
        if tag=="img": self.images.append(a)
        if tag=="tbody" and a.get("id")=="rows": self.matrix=True
        if self.matrix and tag=="tr": self.trs+=1; self.cell=0
        if self.matrix and tag in ["th","td"]: self.cell+=1
    def handle_endtag(self,tag):
        if self.matrix and tag=="tr": self.cells.append(self.cell)
        if tag=="tbody": self.matrix=False
html=(out/"ANALIZA.html").read_text(encoding="utf-8-sig")
check=Check(); check.feed(html)
assert check.trs==48 and set(check.cells)=={6}
assert len(set(check.ids))==len(check.ids)
assert all(h[1:] in check.ids for h in check.links if h.startswith("#"))
assert all(i.get("alt") and (out/i["src"]).is_file() for i in check.images)
assert html.count("Slaže se:")==48 and html.count("Još fali:")==48
catalog=0
for name in ["SAFETY_URGENT_LIVE.json","DISCOVERY_LIVE.json","AGREEMENT_PROFILE_LIVE.json","REVIEWS_LIVE.json"]:
    for row in json.loads((docs/name).read_text(encoding="utf-8-sig")):
        actual=hashlib.md5(row["body"].encode("utf-8")).hexdigest()
        expected = row["md5"] if name == "AGREEMENT_PROFILE_LIVE.json" else row["body_md5"]
        assert actual==expected, (name,row.get("proname",row.get("name")),actual,expected)
        catalog+=1
assert catalog==15
draft=root/"docs/implementation/v5-ai-first/UX_NACRT_20260922.md"
draft_hash=hashlib.sha256(draft.read_bytes()).hexdigest()
assert draft_hash=="dc3a87b85f17e4906382e2f8a72db9f5dd621cd28f6e8632ff08d7b1020d98e5"
control = json.loads((root/"docs/control/redovi.json").read_text(encoding="utf-8-sig"))
assert len(control["redovi"]) == 62
assert {i for r in control["redovi"] for i in r["funkcionalni_audit"]["matrica"]} == {r["id"] for r in rows}
assert all(r["funkcionalni_audit"]["status"]=="ANALIZA_ZA_ODOBRENJE" for r in control["redovi"])
result={"result":"PASS","matrixSections":len(rows),"coveredTrackedRouteFiles":len(tracked),"additionalReviewedLocalGallery":sorted(local_gallery),"localRouteFiles":len(routes),"draftComparisons":48,"columnsPerRow":6,"capturedBodiesMd5Verified":catalog,"localImages":len(check.images),"draftSha256":draft_hash,"htmlSha256":hashlib.sha256((out/"ANALIZA.html").read_bytes()).hexdigest(),"browserVerification":"NOT_RUN_URL_POLICY_BLOCKED","appTestRerun":"NOT_RUN_DOCS_ONLY","device":"See DEVICE_CHECK.json; partial"}
(docs/"ARTIFACT_CHECK.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result))
