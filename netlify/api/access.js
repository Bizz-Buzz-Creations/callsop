// The IPs that are ALWAYS allowed, whatever the admin list says. They are the
// safety net: even if the database is empty or unreachable, these still get in,
// so the admin panel can always be opened to fix the list.
// More can be added without code through the ALWAYS_ALLOWED_IPS environment
// variable (comma-separated IPs or ranges).
import { parseRule } from "./ip.js";

export const BUILT_IN_ALLOWED = [
  "103.217.245.94",
  "103.148.144.47",
  "111.235.67.0/24",
  "202.89.70.6",
  "103.148.144.22",
  "103.217.247.145",
  "122.179.140.142", // DMP Pune
  "14.102.43.26", // ITS Praj office
  "171.78.155.25", // Airtel Praj office
];

export const splitList = (csv) =>
  String(csv ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const parseList = (entries) => entries.map(parseRule).filter(Boolean);

// extraCsv = the ALWAYS_ALLOWED_IPS value (may be empty/undefined).
export const alwaysAllowedEntries = (extraCsv) => [...BUILT_IN_ALLOWED, ...splitList(extraCsv)];

export const alwaysAllowedRules = (extraCsv) => parseList(alwaysAllowedEntries(extraCsv));

// Allowed by default when the IP filter is switched on. Unlike the always-allowed
// list above, these live in the database: they are saved there the first time the
// list is used, shown in the admin panel, and an admin can delete them (they do
// not come back). They depend on the database being reachable.
export const DEFAULT_RULES = [
  { value: "103.86.180.158", label: "Default" },
  { value: "106.215.115.85", label: "Default" },
  { value: "106.219.172.24", label: "Default" },
  { value: "122.172.83.107", label: "Default" },
  { value: "14.96.246.106", label: "Default" },
  { value: "192.168.0.0/16", label: "Default (private network range)" },
];
