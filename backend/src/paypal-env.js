// Normalize deployment-provided PayPal environment values without accidentally
// routing an explicitly configured live account to Sandbox.
export function normalizePayPalEnvironment(primary, alias) {
  const primaryValue = String(primary == null ? "" : primary).trim().toLowerCase();
  const aliasValue = String(alias == null ? "" : alias).trim().toLowerCase();
  const raw = primaryValue || aliasValue || "sandbox";
  if (["live", "production", "prod"].includes(raw)) return { raw, environment: "live" };
  if (["sandbox", "test", "testing"].includes(raw)) return { raw, environment: "sandbox" };
  return { raw, environment: "invalid" };
}
