import { useState } from "react";
import { createTest, deleteTest, duplicateTest, fetchTests } from "../../utils/mcqAdminApi";
import TestEditor from "./TestEditor";

// All tests: create, open (to edit), duplicate and delete.
const TestsPanel = ({ tests, onChanged }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", passPercent: "70" });
  const [message, setMessage] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);

  const notify = (text, error = false) => setMessage({ text, error });

  const run = async (action, success) => {
    setBusy(true);
    try {
      const result = await action();
      await onChanged();
      if (success) notify(typeof success === "function" ? success(result) : success);
      return result;
    } catch (err) {
      notify(err.message || String(err), true);
      // The action may have failed because the list on screen is out of date (for example
      // the test was already deleted by someone else): show the real list again.
      await onChanged().catch(() => {});
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const passPercent = Number(form.passPercent);
    if (!form.title.trim()) return notify("Enter a title for the test.", true);
    if (!Number.isInteger(passPercent) || passPercent < 1 || passPercent > 100) {
      return notify("Pass mark must be a whole number from 1 to 100.", true);
    }
    const created = await run(
      () => createTest({ title: form.title.trim(), description: form.description.trim(), passPercent, active: true }),
      "Test created. Add its questions below."
    );
    if (created) {
      setForm({ title: "", description: "", passPercent: "70" });
      setShowNew(false);
      setSelectedId(created.id); // go straight to adding questions
    }
  };

  const handleDelete = async (test) => {
    // The counts in the table can be minutes old; the warning must show the real ones.
    let current = test;
    try {
      current = (await fetchTests()).find((t) => t.id === test.id) || test;
    } catch {
      // keep the counts on screen
    }
    const detail = `${current.questionCount} question(s) and ${current.attemptCount} attempt(s)`;
    if (!window.confirm(`Delete "${current.title}" together with its ${detail}? This cannot be undone.`)) return;
    await run(() => deleteTest(test.id), `Deleted "${current.title}".`);
  };

  const handleDuplicate = async (test) => {
    const copy = await run(() => duplicateTest(test.id), (r) => `Copied "${test.title}" (${r.questions} questions). The copy is closed until you open it.`);
    if (copy) setSelectedId(copy.id);
  };

  if (selectedId) {
    return (
      <TestEditor
        testId={selectedId}
        onBack={() => {
          setSelectedId(null);
          setMessage({ text: "", error: false }); // messages from before the editor are out of date
          onChanged();
        }}
        onChanged={onChanged}
      />
    );
  }

  return (
    <div className="space-y-4">
      {message.text && (
        <p className={`rounded p-3 text-sm text-white ${message.error ? "bg-red-600" : "bg-green-600"}`}>{message.text}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowNew(!showNew)}
          className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          {showNew ? "Cancel" : "New test"}
        </button>
        <span className="text-sm text-gray-600">{tests.length} test(s)</span>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="bg-white rounded shadow p-4 space-y-3">
          <h3 className="font-semibold">New test</h3>
          <div>
            <label className="block mb-1 font-medium" htmlFor="new-test-title">Title</label>
            <input
              id="new-test-title"
              value={form.title}
              maxLength={120}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Product knowledge"
              className="w-full p-1 border rounded indent-1"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium" htmlFor="new-test-description">Description (optional)</label>
            <textarea
              id="new-test-description"
              value={form.description}
              maxLength={500}
              rows={2}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full p-1 border rounded indent-1"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium" htmlFor="new-test-pass">Pass mark (%)</label>
            <input
              id="new-test-pass"
              type="number"
              min="1"
              max="100"
              value={form.passPercent}
              onChange={(e) => setForm({ ...form, passPercent: e.target.value })}
              className="w-32 p-1 border rounded indent-1"
            />
          </div>
          <button disabled={busy} className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50">
            Create test
          </button>
        </form>
      )}

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-200 text-left">
            <tr>
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2">Questions</th>
              <th className="px-3 py-2">Pass mark</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-gray-500">
                  No tests yet. Click “New test” to create the first one.
                </td>
              </tr>
            )}
            {tests.map((test) => (
              <tr key={test.id} className="border-t">
                <td className="px-3 py-2">
                  <p className="font-semibold">{test.title}</p>
                  {test.description && <p className="text-gray-500 text-xs">{test.description}</p>}
                </td>
                <td className="px-3 py-2">{test.questionCount}</td>
                <td className="px-3 py-2">{test.passPercent}%</td>
                <td className="px-3 py-2">{test.attemptCount}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-white ${test.active ? "bg-green-600" : "bg-gray-500"}`}>
                    {test.active ? "Open" : "Closed"}
                  </span>
                  {test.active && test.questionCount === 0 && (
                    <span className="block text-xs text-yellow-700 mt-1">No questions: agents can't see it yet</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => setSelectedId(test.id)} className="underline text-indigo-600 mr-3">Edit</button>
                  <button onClick={() => handleDuplicate(test)} disabled={busy} className="underline text-indigo-600 mr-3 disabled:opacity-50">Duplicate</button>
                  <button onClick={() => handleDelete(test)} disabled={busy} className="underline text-red-600 disabled:opacity-50">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TestsPanel;
