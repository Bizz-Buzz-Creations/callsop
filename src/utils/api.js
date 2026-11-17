// Tiny fetch wrapper for the MCQ API (netlify/api/routes.js).
// Same-origin by default. Set VITE_API_BASE_URL only if the API is served from
// a different domain than the website (then also set ALLOWED_ORIGIN on the API).
const BASE = `${import.meta.env.VITE_API_BASE_URL || ""}/api`;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const apiFetch = async (path, { method = "GET", body, token } = {}) => {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // not JSON (for example an HTML error page from the host)
  }
  if (!response.ok) {
    const fallback =
      response.status === 404
        ? "The test service is not available (the API is not deployed on this site)."
        : "Something went wrong. Please try again.";
    throw new ApiError(response.status, data?.error || fallback);
  }
  return data;
};
