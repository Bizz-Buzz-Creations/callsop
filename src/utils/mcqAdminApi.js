// Admin-side access to the MCQ test. Every call here needs an admin token; the
// server checks it (and that the admin still exists) on every request.
import { ApiError, apiFetch } from "./api";

// sessionStorage: closing the browser or tab logs the admin out.
const TOKEN_KEY = "callsopAdminToken";
export const ADMIN_EXPIRED_EVENT = "mcq-admin-expired";

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const writeToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
};

export const hasAdminToken = () => Boolean(readToken());

const adminCall = async (path, options) => {
  const token = readToken();
  if (!token) throw new ApiError(401, "Please sign in again.");
  try {
    return await apiFetch(path, { ...options, token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      writeToken(null);
      window.dispatchEvent(new Event(ADMIN_EXPIRED_EVENT)); // send the panel back to login
    }
    throw err;
  }
};

export const adminSignIn = async (email, password) => {
  const { token, email: confirmed } = await apiFetch("/admin/login", {
    method: "POST",
    body: { email, password },
  });
  writeToken(token);
  return confirmed;
};

export const adminSignOut = () => writeToken(null);

export const adminMe = async () => (await adminCall("/admin/me")).email;

// ---- Validation (mirrors the server so mistakes show up before saving) ------------

// Returns a list of problems; an empty list means the question is valid.
export const validateQuestion = (q) => {
  const problems = [];
  if (!q.question?.trim()) problems.push("question text is empty");
  const options = Array.isArray(q.options) ? q.options : [];
  if (options.length < 2 || options.length > 6) problems.push("needs 2 to 6 options");
  if (options.some((o) => typeof o !== "string" || !o.trim())) problems.push("an option is empty");
  const index = "ABCDEF".indexOf(q.answer);
  if (index < 0 || index >= options.length) problems.push("correct answer must be one of the options");
  return problems;
};

// Accepts `[...]` or `{ "questions": [...] }` (the format of src/assets/mcqTest.json).
// Throws an Error listing every problem, so nothing is half-imported.
export const parseQuestionJson = (text) => {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That is not valid JSON.");
  }
  const list = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Expected a list of questions, or an object with a "questions" list.');
  }
  const problems = [];
  const questions = list.map((q, i) => {
    const cleaned = {
      section: String(q.section ?? "").trim(),
      question: String(q.question ?? "").trim(),
      options: Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [],
      answer: String(q.answer ?? "").trim().toUpperCase(),
    };
    validateQuestion(cleaned).forEach((p) => problems.push(`Question ${i + 1}: ${p}`));
    return cleaned;
  });
  if (problems.length) throw new Error(problems.slice(0, 8).join("\n"));
  return questions;
};

// ---- Questions --------------------------------------------------------------------

export const fetchQuestions = async () => (await adminCall("/admin/questions")).questions;

// id = null creates a new question (appended); otherwise updates in place.
export const saveQuestion = (id, q) =>
  id
    ? adminCall(`/admin/questions/${id}`, { method: "PUT", body: q })
    : adminCall("/admin/questions", { method: "POST", body: q });

export const deleteQuestion = (id) => adminCall(`/admin/questions/${id}`, { method: "DELETE" });

export const swapQuestionOrder = (a, b) =>
  adminCall("/admin/questions/swap", { method: "POST", body: { a: a.id, b: b.id } });

// mode "replace" removes every existing question first; "append" adds after them.
export const importQuestions = (questions, mode) =>
  adminCall("/admin/questions/import", { method: "POST", body: { mode, questions } });

// ---- Settings and attempts --------------------------------------------------------

export const fetchConfig = async () => (await adminCall("/admin/config")).config;

export const saveConfig = (config) => adminCall("/admin/config", { method: "PUT", body: config });

export const fetchAttempts = async () => (await adminCall("/admin/attempts")).attempts;

// Deleting an attempt also frees that employee ID's attempt allowance.
export const deleteAttempt = (attemptId) =>
  adminCall(`/admin/attempts/${attemptId}`, { method: "DELETE" });
