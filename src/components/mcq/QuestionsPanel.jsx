import { useState } from "react";
import defaultTest from "../../assets/mcqTest.json";
import { LETTERS } from "../../utils/mcqApi";
import {
  deleteQuestion,
  importQuestions,
  parseQuestionJson,
  saveQuestion,
  swapQuestionOrder,
  validateQuestion,
} from "../../utils/mcqAdminApi";

const EMPTY = { id: null, section: "", question: "", options: ["", "", "", ""], answer: "A" };

// The questions of ONE test (testId). `questions` and `onChanged` come from the editor.
const QuestionsPanel = ({ testId, questions, onChanged }) => {
  const [editing, setEditing] = useState(null); // form state, or null
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);

  const notify = (text, error = false) => setMessage({ text, error });

  // Runs an action with a busy flag and a visible result either way.
  const run = async (action, success) => {
    setBusy(true);
    try {
      await action();
      await onChanged(); // reload the list from the server
      notify(success);
      return true;
    } catch (err) {
      notify(err.message || String(err), true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (q) =>
    setEditing({
      id: q.id,
      section: q.section || "",
      question: q.question,
      options: [...q.options],
      answer: q.answer || "A",
    });

  const setOption = (index, value) =>
    setEditing((prev) => ({ ...prev, options: prev.options.map((o, i) => (i === index ? value : o)) }));

  const removeOption = (index) =>
    setEditing((prev) => {
      const options = prev.options.filter((_, i) => i !== index);
      // Keep the correct answer pointing at the same option where possible.
      const current = LETTERS.indexOf(prev.answer);
      const next = current === index ? 0 : current > index ? current - 1 : current;
      return { ...prev, options, answer: LETTERS[next] };
    });

  const handleSave = async (event) => {
    event.preventDefault();
    const draft = {
      section: editing.section.trim(),
      question: editing.question.trim(),
      options: editing.options.map((o) => o.trim()),
      answer: editing.answer,
    };
    const problems = validateQuestion(draft);
    if (problems.length) return notify(`Cannot save: ${problems.join(", ")}.`, true);

    const isNew = !editing.id;
    const ok = await run(
      () => saveQuestion(testId, editing.id, draft),
      isNew ? "Question added." : "Question updated."
    );
    if (ok) setEditing(null);
  };

  const handleDelete = (q) => {
    if (!window.confirm("Delete this question? Tests already in progress will skip it.")) return;
    run(() => deleteQuestion(q.id), "Question deleted.");
  };

  const handleMove = (index, direction) => {
    const other = questions[index + direction];
    if (other) run(() => swapQuestionOrder(testId, questions[index], other), "Order updated.");
  };

  const handleImport = async (mode) => {
    let parsed;
    try {
      parsed = parseQuestionJson(importText);
    } catch (err) {
      return notify(err.message, true);
    }
    const warning =
      mode === "replace"
        ? `Replace all ${questions.length} existing question(s) with these ${parsed.length}?`
        : `Add ${parsed.length} question(s) after the existing ones?`;
    if (!window.confirm(warning)) return;
    const ok = await run(() => importQuestions(testId, parsed, mode), `Imported ${parsed.length} question(s).`);
    if (ok) {
      setImportText("");
      setShowImport(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (file) setImportText(await file.text());
    event.target.value = "";
  };

  const loadDefaults = () => {
    setImportText(JSON.stringify(defaultTest.questions, null, 2));
    setShowImport(true);
    notify("The built-in 30 questions are loaded below. Choose Replace or Append to import them.");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => setEditing({ ...EMPTY, options: [...EMPTY.options] })}
          className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Add question
        </button>
        <button
          onClick={() => setShowImport(!showImport)}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Import from JSON
        </button>
        <button
          onClick={loadDefaults}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Load built-in 30 questions
        </button>
        <span className="text-sm text-gray-600">{questions.length} question(s)</span>
      </div>

      {message.text && (
        <p className={`rounded p-3 mb-3 text-sm whitespace-pre-line text-white ${message.error ? "bg-red-600" : "bg-green-600"}`}>
          {message.text}
        </p>
      )}

      {showImport && (
        <div className="bg-white rounded shadow p-3 mb-4 space-y-2">
          <p className="text-sm text-gray-700">
            Paste JSON or choose a file. Format:{" "}
            <code>{`{"questions":[{"section":"…","question":"…","options":["…","…"],"answer":"B"}]}`}</code>
          </p>
          <input type="file" accept=".json,application/json" onChange={handleFile} className="text-sm" />
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            className="w-full p-2 border rounded font-mono text-xs"
            placeholder="Paste questions JSON here"
          />
          <div className="flex gap-2">
            <button
              disabled={busy || !importText.trim()}
              onClick={() => handleImport("append")}
              className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
            >
              Append to existing
            </button>
            <button
              disabled={busy || !importText.trim()}
              onClick={() => handleImport("replace")}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              Replace all
            </button>
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="bg-white rounded shadow p-3 mb-4 space-y-2">
          <h3 className="font-semibold">{editing.id ? "Edit question" : "New question"}</h3>
          <input
            value={editing.section}
            onChange={(e) => setEditing({ ...editing, section: e.target.value })}
            placeholder="Section (optional), e.g. Section 2: Callbacks"
            className="w-full p-1 border rounded indent-1"
          />
          <textarea
            value={editing.question}
            onChange={(e) => setEditing({ ...editing, question: e.target.value })}
            placeholder="Question text"
            rows={3}
            className="w-full p-1 border rounded indent-1"
          />
          <p className="text-sm text-gray-600">Options (select the correct one):</p>
          {editing.options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                aria-label={`Option ${LETTERS[index]} is correct`}
                checked={editing.answer === LETTERS[index]}
                onChange={() => setEditing({ ...editing, answer: LETTERS[index] })}
              />
              <span className="w-5 font-semibold">{LETTERS[index]}</span>
              <input
                value={option}
                onChange={(e) => setOption(index, e.target.value)}
                className="flex-1 p-1 border rounded indent-1"
              />
              {editing.options.length > 2 && (
                <button type="button" onClick={() => removeOption(index)} className="text-red-600 underline text-sm">
                  Remove
                </button>
              )}
            </div>
          ))}
          {editing.options.length < 6 && (
            <button
              type="button"
              onClick={() => setEditing({ ...editing, options: [...editing.options, ""] })}
              className="text-indigo-600 underline text-sm"
            >
              Add option
            </button>
          )}
          <div className="flex gap-2 pt-1">
            <button
              disabled={busy}
              className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {questions.length === 0 && (
          <p className="text-gray-600">
            No questions in this test yet. Use “Load built-in 30 questions” or add your own.
          </p>
        )}
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white rounded shadow p-3 text-sm">
            {q.section && <p className="text-xs text-gray-500 mb-1">{q.section}</p>}
            <p className="font-medium">
              {index + 1}. {q.question}
            </p>
            <ul className="mt-1">
              {q.options.map((option, i) => (
                <li key={i} className={LETTERS[i] === q.answer ? "text-green-600 font-semibold" : ""}>
                  {LETTERS[i]}. {option}
                </li>
              ))}
            </ul>
            {!q.answer && (
              <p className="text-red-600 font-semibold mt-1">No correct answer set. Edit and save this question.</p>
            )}
            <div className="mt-2 flex gap-3">
              <button disabled={busy || index === 0} onClick={() => handleMove(index, -1)} className="underline text-indigo-600 disabled:opacity-40">
                Move up
              </button>
              <button disabled={busy || index === questions.length - 1} onClick={() => handleMove(index, 1)} className="underline text-indigo-600 disabled:opacity-40">
                Move down
              </button>
              <button onClick={() => startEdit(q)} className="underline text-indigo-600">Edit</button>
              <button onClick={() => handleDelete(q)} className="underline text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestionsPanel;
