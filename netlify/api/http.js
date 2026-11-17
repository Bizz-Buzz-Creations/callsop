// Small HTTP helpers shared by the API handlers.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Server is missing required configuration (env vars). Safe to show to the operator.
export class ConfigError extends Error {}

export const json = (status, data, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });

// Reads a JSON body with a hard size limit. Returns {} for an empty body.
export const readJson = async (req, maxBytes = 100_000) => {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "Request is too large.");
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new HttpError(413, "Request is too large.");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }
};

export const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
