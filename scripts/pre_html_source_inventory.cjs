#!/usr/bin/env node
'use strict';
// Read-only inventory. Literal callsites are not a proof of dynamic reachability,
// server permissions, successful execution or absence of dynamic API paths.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const listed = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
const files = [...new Set(listed.split('\0').filter(Boolean))].filter(p =>
  /^(src\/|supabase\/functions\/)/.test(p) && /\.[cm]?[jt]sx?$/.test(p) &&
  !/(^|\/)(__tests__|__mocks__)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/.test(p) &&
  !/src\/data\/lazni/.test(p) && fs.existsSync(path.join(root,p))).sort();
const rpc = [], edge = [], tableAccess = [], dynamicRpc = [], imports = [];
const str = n => n && (ts.isStringLiteralLike(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;
for (const file of files) {
  const text = fs.readFileSync(path.join(root,file), 'utf8');
  const source = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function pos(node) { return { file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line+1 }; }
  function walk(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const module = str(node.moduleSpecifier); if(module) imports.push({ ...pos(node),module });
    }
    if(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text, name = str(node.arguments[0]);
      if(method === 'rpc') (name ? rpc : dynamicRpc).push({ ...pos(node),name,kind:'call', expression: name ? undefined : node.arguments[0]?.getText(source) });
      if(method === 'invoke' && name) edge.push({ ...pos(node),name });
      if(method === 'from' && name) {
        let cursor = node, operation = 'unknown';
        while(cursor.parent && (ts.isPropertyAccessExpression(cursor.parent) || ts.isCallExpression(cursor.parent))) {
          cursor = cursor.parent;
          if(ts.isCallExpression(cursor) && ts.isPropertyAccessExpression(cursor.expression) && ['insert','update','upsert','delete','select'].includes(cursor.expression.name.text)) {
            const m = cursor.expression.name.text;
            if(operation === 'unknown' || m !== 'select') operation=m;
          }
        }
        tableAccess.push({...pos(node),name,operation});
      }
    }
    if(ts.isPropertyAssignment(node) && node.name.getText(source).replace(/['"]/g,'') === 'rpc') {
      const name = str(node.initializer); if(name && name.startsWith('rpc_'))rpc.push({...pos(node),name,kind:'receipt-option'});
    }
    ts.forEachChild(node,walk);
  }
  walk(source);
}
const retired = ['rpc_send_agreement_message','rpc_ai_open_conversation','rpc_ai_open_need_conversation_v2'];
const remainingRetiredCallsites = rpc.filter(r=>retired.includes(r.name));
const donors = ['brandSvg','figmaSplashTracks'];
const remainingDonorImports = imports.filter(r=>donors.some(d=>r.module.endsWith('/'+d)));
const report = {
  scope:'literal non-test source callsites; not a transitive reachability or live security proof',
  scannedFiles:files.length,
  counts:{rpcNames:new Set(rpc.map(x=>x.name)).size,rpcCallsites:rpc.length,dynamicRpcCallsites:dynamicRpc.length,edgeNames:new Set(edge.map(x=>x.name)).size,tableAccess:tableAccess.length},
  retiredClientWriters:{names:retired,remainingCallsites:remainingRetiredCallsites,liveRevokeApplied:false},
  retiredDonors:{names:donors,remainingImports:remainingDonorImports},
  rpc,edge,tableAccess,dynamicRpc,
  caveats:['Legacy stubs retain type compatibility but perform no unkeyed write.','Historical SQL/proofs and already-installed old clients are outside this source scan.','Worker generic profile city/radius/available_now writes remain an explicitly open convergence task.','A referenced RPC may be gated, missing or inaccessible live; consult the read-only SQL inventory separately.']
};
const out=process.argv[2];
if(out)fs.writeFileSync(path.resolve(out),JSON.stringify(report,null,2)+'\n');
else process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(remainingRetiredCallsites.length || remainingDonorImports.length)process.exitCode=1;
