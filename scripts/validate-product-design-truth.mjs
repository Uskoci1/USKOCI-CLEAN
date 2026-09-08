import fs from "node:fs";
import path from "node:path";

const root = path.resolve("docs/product-design-truth");
const requiredArtifacts = [
  "USKOCI_PRODUCT_CANON.md",
  "USKOCI_SCREEN_INVENTORY.md",
  "USKOCI_SCREEN_STATE_MATRIX.csv",
  "USKOCI_SCREEN_STATE_MATRIX.json",
  "USKOCI_USER_FLOWS.md",
  "USKOCI_INFORMATION_ARCHITECTURE.md",
  "USKOCI_FIGMA_DESIGN_BRIEF.md",
  "DESIGN.md",
  "USKOCI_FIGMA_MAKE_MASTER_PROMPT.md",
  "USKOCI_COMPONENT_INVENTORY.md",
  "USKOCI_DESIGN_IMPLEMENTATION_GAP.md",
];

const missing = requiredArtifacts.filter((name) => !fs.existsSync(path.join(root, name)));
if (missing.length) throw new Error(`Missing artifacts: ${missing.join(", ")}`);

const matrixDocument = JSON.parse(
  fs.readFileSync(path.join(root, "USKOCI_SCREEN_STATE_MATRIX.json"), "utf8"),
);
const matrix = matrixDocument.screens;
if (!Array.isArray(matrix) || matrix.length < 40) {
  throw new Error("Screen matrix must contain at least 40 product surfaces");
}

const requiredFields = [
  "id",
  "name",
  "purpose",
  "role",
  "entry_points",
  "displayed_data",
  "actions",
  "primary_cta",
  "secondary_actions",
  "backend_objects",
  "permissions",
  "statuses",
  "loading_state",
  "empty_state",
  "validation_state",
  "error_state",
  "offline_state",
  "success_state",
  "destructive_state",
  "next_navigation",
  "notification_implications",
  "edge_cases",
  "canon_status",
  "current_status",
];
for (const [index, surface] of matrix.entries()) {
  const absent = requiredFields.filter((field) => !(field in surface));
  if (absent.length) {
    throw new Error(`Surface ${index + 1} misses: ${absent.join(", ")}`);
  }
}

const allText = requiredArtifacts
  .map((name) => fs.readFileSync(path.join(root, name), "utf8"))
  .join("\n");
for (const forbidden of [/sk-proj-[A-Za-z0-9_-]+/g, /service_role\s*[:=]\s*\S+/gi]) {
  if (forbidden.test(allText)) throw new Error("Potential secret found in handoff");
}

const csvRows = fs
  .readFileSync(path.join(root, "USKOCI_SCREEN_STATE_MATRIX.csv"), "utf8")
  .trim()
  .split(/\r?\n/).length;
if (csvRows !== matrix.length + 1) {
  throw new Error(`CSV/JSON row mismatch: ${csvRows - 1} vs ${matrix.length}`);
}

console.log(
  JSON.stringify({
    artifacts: requiredArtifacts.length,
    surfaces: matrix.length,
    fieldsPerSurface: requiredFields.length,
    csvRows: csvRows - 1,
    secrets: "none detected",
  }),
);
