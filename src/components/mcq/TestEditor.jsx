import { useCallback, useEffect, useState } from "react";
import { fetchTest, updateTest } from "../../utils/mcqAdminApi";
import { friendlyError } from "../../utils/mcqApi";
import QuestionsPanel from "./QuestionsPanel";

// Edit one test: its details (title, description, pass mark, open/closed) and its questions.
const TestEditor = ({ testId, onBack, onChanged }) => {
  const [data, setData] = useState(null); // { test, questions }
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchTest(testId));
      setLoadError("");
    } catch (err) {
      setLoadError(friendlyError(err));
    }
  }, [testId]);

  useEffect(() => {
    load();
  }, [load]);

  // The question list changed: reload it here and refresh the counts in the test list.
  const questionsChanged = useCallback(async () => {
    await load();
    await onChanged?.();
  }, [load, onChanged]);

  if (loadError) {
    return (
      <div>
        <p className="bg-red-600 text-white rounded p-3 mb-3 text-sm">{loadError}</p>
        <button onClick={onBack} className="underline text-indigo-600">← All tests</button>
      </div>
    );
  }
  if (!data) return <p>Loading test…</p>;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="underline text-indigo-600">← All tests</button>
      {/* keyed by test: switching tests starts from a fresh form */}
      <DetailsForm key={data.test.id} test={data.test} onSaved={() => { load(); onChanged?.(); }} />
      <div>
        <h3 className="text-xl font-semibold mb-2">Questions</h3>
        <QuestionsPanel testId={testId} questions={data.questions} onChanged={questionsChanged} />
      </div>
    </div>
  );
};

const DetailsForm = ({ test, onSaved }) => {
  const [form, setForm] = useState({
    title: test.title,
    description: test.description,
    passPercent: String(test.passPercent),
    active: test.active,
  });
  const [message, setMessage] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMessage({ text: "", error: false });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const passPercent = Number(form.passPercent);
    if (!form.title.trim()) return setMessage({ text: "Enter a title.", error: true });
    if (!Number.isInteger(passPercent) || passPercent < 1 || passPercent > 100) {
      return setMessage({ text: "Pass mark must be a whole number from 1 to 100.", error: true });
    }
    setBusy(true);
    try {
      await updateTest(test.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        passPercent,
        active: form.active,
      });
      setMessage({ text: "Saved.", error: false });
      onSaved?.();
    } catch (err) {
      setMessage({ text: `Could not save: ${err.message}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-white rounded shadow p-4 space-y-3">
      <h3 className="text-xl font-semibold">Test details</h3>
      <div>
        <label className="block mb-1 font-medium" htmlFor="test-title">Title</label>
        <input
          id="test-title"
          value={form.title}
          maxLength={120}
          onChange={(e) => set("title", e.target.value)}
          className="w-full p-1 border rounded indent-1 bg-white"
        />
      </div>
      <div>
        <label className="block mb-1 font-medium" htmlFor="test-description">Description (shown to agents, optional)</label>
        <textarea
          id="test-description"
          value={form.description}
          maxLength={500}
          rows={2}
          onChange={(e) => set("description", e.target.value)}
          className="w-full p-1 border rounded indent-1 bg-white"
        />
      </div>
      <div>
        <label className="block mb-1 font-medium" htmlFor="test-pass">Pass mark (%)</label>
        <input
          id="test-pass"
          type="number"
          min="1"
          max="100"
          value={form.passPercent}
          onChange={(e) => set("passPercent", e.target.value)}
          className="w-32 p-1 border rounded indent-1 bg-white"
        />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
        Test is open (agents can start it)
      </label>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50">
          Save details
        </button>
        {message.text && (
          <span className={`text-sm ${message.error ? "text-red-600" : "text-green-600"}`}>{message.text}</span>
        )}
      </div>
      <p className="text-sm text-gray-600">
        The pass mark applies to attempts submitted after you save. A closed test cannot be started, but
        agents who already started it can still finish it. Agents only see a test once it is open and has questions.
      </p>
    </form>
  );
};

export default TestEditor;
