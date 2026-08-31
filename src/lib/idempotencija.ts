
/**
 * Kanonska generacija klijentskog identifikatora zahteva (clientRequestId).
 * Obezbedjuje idempotenciju komandi bez ad-hoc Math.random().
 */
export function noviZahtevId(prefiks: string = "req"): string {
  const timestamp = Date.now().toString(36);
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").substring(0, 16)
      : Math.floor(Math.random() * 1e16).toString(36).padStart(12, "0");

  return `${prefiks}_${timestamp}_${randomPart}`;
}

