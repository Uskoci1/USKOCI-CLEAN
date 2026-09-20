#!/usr/bin/env node
/**
 * Provider-wire diagnostics, offline. No provider call, no API key, no private data.
 *
 * Loads the deployed Edge sources the way the repository's own proof runtimes do, rebuilds
 * the exact body each function sends to Gemini, runs it through the shared converter, and
 * prints the final wire structure so the accepted worker request can be compared with the
 * rejected need request. Nothing here changes any contract; it only observes.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const ROOT = process.cwd();
const EXPORT_NEED_BUILDERS = '\nmodule.exports.v2ProviderSchema = v2ProviderSchema;\nmodule.exports.legacyProviderSchema = legacyProviderSchema;\n';

/** Transpile one .ts file and run it in a sandbox whose require resolves sibling .ts files. */
function loadModule(file, extra = '') {
  const path = resolve(ROOT, file);
  const source = readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText + extra;
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports, console, TextEncoder, TextDecoder, crypto, Intl, Date, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Set, Map, Error,
    URL, Request, Response, Headers, AbortController, fetch: () => { throw new Error('no network in the wire diff'); },
    Deno: { env: { get: () => '' }, serve: () => {} },
    require: (specifier) => loadModule(resolve(dirname(path), specifier).replace(ROOT + '\\', '').replace(ROOT + '/', '')),
  });
  vm.runInContext(code, context);
  return module.exports;
}

const { geminiRequestBody } = loadModule('supabase/functions/_shared/geminiTaskStream.ts');
const workerModule = loadModule('supabase/functions/uskoci-worker-interview/index.ts');
const needModule = loadModule('supabase/functions/uskoci-ai-interview/index.ts', EXPORT_NEED_BUILDERS);

const MODEL = 'gemini-3.8-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const keywords = (node, found = new Map()) => {
  if (Array.isArray(node)) { node.forEach(item => keywords(item, found)); return found; }
  if (!node || typeof node !== 'object') return found;
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'properties' && key !== 'items') found.set(key, (found.get(key) ?? 0) + 1);
    keywords(key === 'properties' ? Object.values(value) : value, found);
  }
  return found;
};

function wire(label, schema, instructionBytes) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: 'x'.repeat(instructionBytes) }] },
    contents: [{ role: 'user', parts: [{ text: 'sample user message' }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: schema },
  });
  const converted = geminiRequestBody(body);
  return { label, json: JSON.parse(converted), bytes: Buffer.byteLength(converted) };
}

const worker = wire('WORKER_PROFILE (provider accepts)', workerModule.workerProviderSchema(), 2200);
const need = wire('NEED_FACT_V2 (provider rejects with 400 INVALID_ARGUMENT)', needModule.v2ProviderSchema(), 6400);

for (const item of [worker, need]) {
  const generation = item.json.generationConfig;
  const schema = generation.responseFormat?.text?.schema;
  console.log('='.repeat(78));
  console.log(item.label);
  console.log('  endpoint            :', ENDPOINT);
  console.log('  api version / model : v1beta /', MODEL);
  console.log('  body bytes          :', item.bytes);
  console.log('  generationConfig    :', Object.keys(generation).join(', '));
  console.log('  thinkingConfig      :', JSON.stringify(generation.thinkingConfig));
  console.log('  responseFormat      :', JSON.stringify(Object.keys(generation.responseFormat ?? {})),
              '-> text:', JSON.stringify(Object.keys(generation.responseFormat?.text ?? {})));
  console.log('  mimeType            :', generation.responseFormat?.text?.mimeType);
  console.log('  schema root         :', JSON.stringify({ type: schema?.type, keys: Object.keys(schema ?? {}) }));
  console.log('  schema keyword use  :', JSON.stringify(Object.fromEntries(keywords(schema))));
  console.log('  schema (truncated)  :', JSON.stringify(schema).slice(0, 700));
}

const workerKeys = keywords(worker.json.generationConfig.responseFormat.text.schema);
const needKeys = keywords(need.json.generationConfig.responseFormat.text.schema);
console.log('='.repeat(78));
console.log('keywords only in NEED   :', [...needKeys.keys()].filter(k => !workerKeys.has(k)).join(', ') || '(none)');
console.log('keywords only in WORKER :', [...workerKeys.keys()].filter(k => !needKeys.has(k)).join(', ') || '(none)');
console.log('type values NEED        :', JSON.stringify([...new Set((JSON.stringify(need.json).match(/"type":"[A-Za-z]+"/g) ?? []))]));
console.log('type values WORKER      :', JSON.stringify([...new Set((JSON.stringify(worker.json).match(/"type":"[A-Za-z]+"/g) ?? []))]));
