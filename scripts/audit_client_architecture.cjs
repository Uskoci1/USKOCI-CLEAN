'use strict';
// Read-only AST audit. Never include source literals or environment values in output.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const [rootArg, output] = process.argv.slice(2);
if (!rootArg || !output) throw new Error('Pass the repository root and evidence JSON path.');
const root = path.resolve(rootArg);
const ts = require(path.join(root, 'node_modules/typescript'));
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const names = git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'src/app', 'src/ui', 'src/hooks', 'src/contracts', 'src/data', 'src/store')
  .split('\n').filter(name => /\.tsx?$/.test(name) && !name.includes('__tests__/'));
const findings = [], files = [];
const secretNames = /^(?:OPENAI_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY)$/;
const directSdk = value => /(?:^@supabase\/|supabaseClient(?:\.[cm]?[jt]s)?$|^openai(?:\/|$)|^@google\/(?:genai|generative-ai)(?:\/|$)|^axios(?:\/|$))/.test(value);
for (const name of [...new Set(names)]) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  const presentation = name.startsWith('src/app/') || name.startsWith('src/ui/');
  const imports = [];
  const record = (node, rule) => {
    const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    if (!findings.some(item => item.file === name && item.line === line + 1 && item.rule === rule)) findings.push({ file: name, line: line + 1, rule });
  };
  function moduleRef(node, value) {
    imports.push(value);
    if (presentation && directSdk(value)) record(node, 'PRESENTATION_RAW_SDK_IMPORT');
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      moduleRef(node, node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      const call = node.expression;
      if ((ts.isIdentifier(call) && call.text === 'require') || call.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) moduleRef(node, node.arguments[0].text);
        else if (presentation) record(node, 'PRESENTATION_DYNAMIC_MODULE_REQUIRES_REVIEW');
      }
      if (presentation && ts.isIdentifier(call) && ['fetch', 'XMLHttpRequest', 'WebSocket'].includes(call.text)) record(node, 'PRESENTATION_DIRECT_NETWORK');
      if (presentation && ts.isPropertyAccessExpression(call)) {
        if (call.name.text === 'rpc' || (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'auth')) record(node, 'PRESENTATION_RAW_BACKEND_CALL');
      }
    }
    if (ts.isNewExpression(node) && presentation && ts.isIdentifier(node.expression) && ['XMLHttpRequest', 'WebSocket'].includes(node.expression.text)) record(node, 'PRESENTATION_DIRECT_NETWORK');
    if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'process'
      && node.expression.name.text === 'env' && secretNames.test(node.name.text)) record(node, 'CLIENT_PRIVILEGED_SECRET_REFERENCE');
    if (ts.isElementAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'env' && node.argumentExpression && ts.isStringLiteral(node.argumentExpression)
      && secretNames.test(node.argumentExpression.text)) record(node, 'CLIENT_PRIVILEGED_SECRET_REFERENCE');
    if (ts.isStringLiteralLike(node) && (/^sk-(?:proj-|svcacct-)[A-Za-z0-9_-]{20,}$/.test(node.text)
      || /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(node.text))) record(node, 'CLIENT_PRIVATE_CREDENTIAL_LITERAL');
    ts.forEachChild(node, visit);
  }
  visit(tree);
  files.push({ file: name, layer: presentation ? 'presentation' : name.split('/')[1],
    sha256: crypto.createHash('sha256').update(Buffer.from(source)).digest('hex'), imports: [...new Set(imports)] });
}
const report = { observedAt: new Date().toISOString(), repository: path.basename(root), head: git('rev-parse', 'HEAD'),
  branch: git('branch', '--show-current'), workingTreeDirty: !!git('status', '--porcelain'),
  scope: 'All current client presentation/hooks/contracts/data/store TS/TSX source; tests and server code excluded.',
  method: 'TypeScript AST import/call/secret-reference inspection with per-file content fingerprints. Domain-authority review and runtime proof are separate evidence.',
  scannedFiles: files.length, presentationFiles: files.filter(file => file.layer === 'presentation').length,
  findings, files, result: findings.length ? 'REVIEW_REQUIRED' : 'STATIC_BOUNDARY_PASS' };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ repository: report.repository, head: report.head, scannedFiles: report.scannedFiles,
  presentationFiles: report.presentationFiles, findings, result: report.result }));
