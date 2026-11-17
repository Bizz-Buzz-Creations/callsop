// Input validation. Every value that reaches a database query goes through
// here first, and only plain strings/numbers/booleans come out. That is what
// stops NoSQL injection such as {"email": {"$ne": null}}.
import { ObjectId } from "mongodb";
import { HttpError, isPlainObject } from "./http.js";

export const LETTERS = ["A", "B", "C", "D", "E", "F"];
export const VIOLATION_TYPES = ["tab-switch", "window-blur"];

export const object = (value, what = "Request") => {
  if (!isPlainObject(value)) throw new HttpError(400, `${what} must be an object.`);
  return value;
};

export const text = (value, name, { min = 1, max = 200, collapse = true } = {}) => {
  if (typeof value !== "string") throw new HttpError(400, `${name} must be text.`);
  const cleaned = collapse ? value.trim().replace(/\s+/g, " ") : value.trim();
  if (cleaned.length < min) throw new HttpError(400, `${name} is required.`);
  if (cleaned.length > max) throw new HttpError(400, `${name} is too long (max ${max}).`);
  return cleaned;
};

export const letter = (value) => {
  if (typeof value !== "string" || !LETTERS.includes(value)) {
    throw new HttpError(400, "Answer must be one of A-F.");
  }
  return value;
};

const HEX24 = /^[a-f0-9]{24}$/;

export const hexId = (value, name = "id") => {
  if (typeof value !== "string" || !HEX24.test(value)) throw new HttpError(400, `Invalid ${name}.`);
  return value;
};

export const objectId = (value, name = "id") => new ObjectId(hexId(value, name));

export const integer = (value, name, { min, max }) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${name} must be a whole number from ${min} to ${max}.`);
  }
  return value;
};

// A question as the admin submits it. Throws HttpError(400) with the reason.
export const question = (input, label = "Question") => {
  try {
    const q = object(input, label);
    const section =
      q.section == null || q.section === "" ? "" : text(q.section, "Section", { max: 120 });
    const questionText = text(q.question, "Question text", { max: 1000, collapse: false });
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
      throw new HttpError(400, "Needs 2 to 6 options.");
    }
    const options = q.options.map((option, i) =>
      text(option, `Option ${LETTERS[i]}`, { max: 500, collapse: false })
    );
    const answer = typeof q.answer === "string" ? q.answer.trim().toUpperCase() : "";
    const index = LETTERS.indexOf(answer);
    if (index < 0 || index >= options.length) {
      throw new HttpError(400, "The correct answer must be one of the options.");
    }
    return { section, question: questionText, options, answer };
  } catch (err) {
    if (err instanceof HttpError) throw new HttpError(400, `${label}: ${err.message}`);
    throw err;
  }
};
