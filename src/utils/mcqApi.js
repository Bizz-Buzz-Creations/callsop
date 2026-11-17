// Agent-side access to the MCQ test. The admin side is in mcqAdminApi.js.
// The browser never receives the answer key: scoring happens on the server
// when the attempt is submitted.
import { ApiError, apiFetch } from "./api";

export const LETTERS = ["A", "B", "C", "D", "E", "F"];

export const VIOLATION_LABELS = {
  "tab-switch": "Switched tab or minimised the window",
  "window-blur": "Opened another window or application",
};

export const formatTime = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "–";
};

export const friendlyError = (err) =>
  err instanceof ApiError ? err.message : "Something went wrong. Check your connection and try again.";

// ---- Anonymous agent session -----------------------------------------------------
// The server hands out a signed token; it is kept in localStorage so a reload
// can resume an unfinished test. It contains no personal data.
const TOKEN_KEY = "callsopAgentToken";
let memoryToken = null; // used if localStorage is unavailable
let pending = null;

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
};
const writeToken = (token) => {
  memoryToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // keep the in-memory copy only
  }
};

export const ensureSession = async () => {
  const existing = readToken();
  if (existing) return existing;
  // Share one request between callers that arrive at the same time.
  pending ||= apiFetch("/session", { method: "POST" })
    .then(({ token }) => {
      writeToken(token);
      return token;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
};

const agentCall = async (path, options) => {
  try {
    return await apiFetch(path, { ...options, token: await ensureSession() });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Token expired or rejected: get a fresh session and retry once.
      writeToken(null);
      return apiFetch(path, { ...options, token: await ensureSession() });
    }
    throw err;
  }
};

// ---- Tests -----------------------------------------------------------------------

// Every test this browser can take, with its own progress on each.
export const loadTests = async () => (await agentCall("/tests")).tests;

// One test and its questions (no answers): { test, questions }.
export const loadTest = (testId) => agentCall(`/test/${testId}`);

// This browser's unfinished attempt in one test, or null.
export const findOpenAttempt = async (testId) => (await agentCall(`/attempt/open?testId=${testId}`)).attempt;

export const startAttempt = (name, testId) =>
  agentCall("/attempt/start", { method: "POST", body: { name, testId } });

export const saveAnswer = (attemptId, questionId, letter) =>
  agentCall(`/attempt/${attemptId}/answer`, { method: "PUT", body: { questionId, letter } });

export const logViolation = (attemptId, type) =>
  agentCall(`/attempt/${attemptId}/violation`, { method: "POST", body: { type } });

export const submitAttempt = (attemptId, answers) =>
  agentCall(`/attempt/${attemptId}/submit`, { method: "POST", body: { answers } });

// The agent's name is remembered on this computer, so it is not retyped for each test.
const NAME_KEY = "callsopAgentName";
export const getSavedName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
};
export const saveName = (name) => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
};
