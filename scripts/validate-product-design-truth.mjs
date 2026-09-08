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

const navigation = matrixDocument.navigation_decision;
const exact = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
if (
  !navigation ||
  !exact(navigation.requester, ["Zadaci", "U / Novi", "Dogovori"]) ||
  !exact(navigation.worker, ["Prijave", "U / Zadaci", "Dogovori"]) ||
  navigation.bell !== "Notifications / Inbox" ||
  navigation.avatar !== "Profile" ||
  navigation.permanent_home_tab !== false ||
  navigation.permanent_profile_tab !== false ||
  navigation.shared_discovery?.container !== "Zadaci" ||
  !exact(navigation.shared_discovery?.modes, ["LIST", "MAP"]) ||
  !exact(navigation.shared_discovery?.roles, ["NARUČILAC", "USKOČER"])
) {
  throw new Error("Navigation must match the owner-confirmed three-zone decision");
}

const activeSurfaces = matrix.filter((surface) => surface.canon_status !== "SUPERSEDED");
for (const surface of activeSurfaces) {
  const navigationText = [...surface.entry_points, ...surface.next_navigation].join(" ");
  if (/\b(?:R01|W01|R-HOME|W-HOME|Home|Početna)\b|Profil tab/.test(navigationText)) {
    throw new Error(`Active surface ${surface.id} still routes through a superseded Home/Profile tab`);
  }
}
for (const id of ["W03", "W04", "M01", "M02", "Q01", "Q02"]) {
  if (matrix.find((surface) => surface.id === id)?.role !== "BOTH") {
    throw new Error(`Shared discovery surface ${id} must be accessible in both intents`);
  }
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

const csvText = fs.readFileSync(path.join(root, "USKOCI_SCREEN_STATE_MATRIX.csv"), "utf8")
  .replace(/\r\n/g, "\n").trimEnd();
const csvHeader = csvText.split("\n")[0];
const csvColumns = csvHeader.split(",").map((column) => JSON.parse(column));
const csvQuote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const expectedCsv = [csvHeader, ...matrix.map((surface) => csvColumns
  .map((field) => csvQuote(Array.isArray(surface[field]) ? surface[field].join(" | ") : surface[field]))
  .join(","))].join("\n");
if (csvText !== expectedCsv) throw new Error("CSV content differs from the JSON source matrix");

console.log(
  JSON.stringify({
    artifacts: requiredArtifacts.length,
    surfaces: matrix.length,
    activeSurfaces: activeSurfaces.length,
    supersededSurfaces: matrix.length - activeSurfaces.length,
    navigation: "owner-confirmed three-zone",
    fieldsPerSurface: requiredFields.length,
    csvRows: csvRows - 1,
    secrets: "none detected",
  }),
);
