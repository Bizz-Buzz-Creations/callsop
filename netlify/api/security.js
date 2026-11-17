// Password hashing and signed session tokens, using only node:crypto.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ConfigError } from "./http.js";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
};

export const verifyPassword = async (password, stored) => {
  const [scheme, saltHex, hashHex] = String(stored).split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length, SCRYPT);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// Used when the email is unknown so the response time does not reveal which
// emails exist.
let dummyHash;
export const burnPasswordCheck = async (password) => {
  dummyHash ||= await hashPassword("not-a-real-password");
  await verifyPassword(password, dummyHash);
};

const getSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConfigError("SESSION_SECRET is missing or shorter than 32 characters.");
  }
  return secret;
};

const b64 = (buffer) => Buffer.from(buffer).toString("base64url");

// token = base64url(JSON claims) + "." + base64url(HMAC-SHA256)
export const signToken = (claims, ttlSeconds) => {
  const body = b64(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = b64(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
};

// Returns the claims, or null if the token is malformed, forged or expired.
export const verifyToken = (token) => {
  if (typeof token !== "string") return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof claims.exp !== "number" || claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
};

// Constant-time string comparison (for shared secrets).
export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const newSessionId = () => randomBytes(16).toString("hex");
