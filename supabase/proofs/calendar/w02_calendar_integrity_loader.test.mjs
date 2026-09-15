// Setup-only regression: execute the actual proof loader and actual app modules.
// No SDK request, Auth/DB/provider fixture or replacement presentation module.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const path='supabase/proofs/calendar/w02_calendar_integrity_proof.mjs';
const source=readFileSync(path,'utf8');
const ast=ts.createSourceFile(path,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
const connected=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='connectedCalendar');
assert.ok(connected?.body,'ACTUAL_LOADER_NOT_FOUND');
const actualConnected=connected.getText(ast);
const declaration=name=>{
  const statement=connected.body.statements.find(node=>ts.isVariableStatement(node)&&
    node.declarationList.declarations.some(item=>ts.isIdentifier(item.name)&&item.name.text===name));
  assert.ok(statement,'ACTUAL_LOADER_DECLARATION_MISSING');return statement.getText(ast);
};
const expectedFiles=[
  'src/data/workerCalendarClientService.ts','src/data/serverReceipt.ts','src/lib/calendarTime.ts',
  'src/data/agreementClientService.ts','src/data/calendarErrors.ts','src/data/legacyRpcFailure.ts','src/data/needDetailPresentation.ts',
  'src/lib/location.ts','src/lib/market.ts','src/ui/calendar/calendarPresentation.ts',
].sort();
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');

test('actual connected calendar setup loads the complete current graph and hashes every real source file',()=>{
  const report={input_sha256:{}};
  const connect=new Function('assert','readFileSync','createHash','ts','report',actualConnected+';return connectedCalendar;')(
    assert,readFileSync,createHash,ts,report);
  // Undefined SDK is deliberate: setup must not make even a synthetic request.
  const result=connect(undefined,'10000000-0000-4000-8000-000000000001');
  assert.equal(typeof result.service.readRange,'function');
  assert.equal(typeof result.agreements.dogovor,'function');
  assert.deepEqual(Object.keys(report.input_sha256).sort(),expectedFiles);
  for(const file of expectedFiles)assert.equal(report.input_sha256[file],digest(file),file);
});

test('actual loader rejects unlisted, inherited and path-normalized module names without reading a file',()=>{
  const report={input_sha256:{}};
  const load=new Function('assert','readFileSync','createHash','ts','report','cache','client','state',
    declaration('allowed')+'\n'+declaration('load')+'\nreturn load;')(
      assert,readFileSync,createHash,ts,report,new Map(),undefined,undefined);
  for(const name of ['node:fs','./unknown','toString','__proto__','constructor',
    './needDetailPresentation/../agreementClientService','../lib/../lib/calendarTime']){
    assert.throws(()=>load(name),/UNEXPECTED_PROOF_MODULE/,name);
  }
  assert.deepEqual(report.input_sha256,{});
  // Both observed import specifiers resolve to the same real cached module.
  assert.equal(load('../lib/calendarTime'),load('../../lib/calendarTime'));
  assert.deepEqual(report.input_sha256,{'src/lib/calendarTime.ts':digest('src/lib/calendarTime.ts')});
});
