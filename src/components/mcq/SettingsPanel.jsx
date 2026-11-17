import { useState } from "react";
import { saveConfig } from "../../utils/mcqAdminApi";

const SettingsPanel = ({ config, onSaved }) => {
  const [form, setForm] = useState({
    title: config.title,
    passPercent: String(config.passPercent),
    active: config.active,
  });
  const [message, setMessage] = useState("");

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMessage("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const passPercent = Number(form.passPercent);
    if (!form.title.trim()) return setMessage("Enter a title.");
    if (!Number.isInteger(passPercent) || passPercent < 1 || passPercent > 100) {
      return setMessage("Pass mark must be a whole number from 1 to 100.");
    }
    try {
      await saveConfig({ title: form.title.trim(), passPercent, active: form.active });
      setMessage("Saved.");
      onSaved?.(); // refresh the copy kept by the admin page
    } catch (err) {
      setMessage(`Could not save: ${err.message}`);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-3 max-w-md">
      <div>
        <label className="block mb-1 font-medium" htmlFor="cfg-title">Test title</label>
        <input
          id="cfg-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className="w-full p-1 border rounded indent-1 bg-white"
        />
      </div>
      <div>
        <label className="block mb-1 font-medium" htmlFor="cfg-pass">Pass mark (%)</label>
        <input
          id="cfg-pass"
          type="number"
          min="1"
          max="100"
          value={form.passPercent}
          onChange={(e) => set("passPercent", e.target.value)}
          className="w-full p-1 border rounded indent-1 bg-white"
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
        />
        Test is open (agents can start it)
      </label>
      <div className="flex items-center gap-3">
        <button className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">Save</button>
        {message && <span className="text-sm">{message}</span>}
      </div>
      <p className="text-sm text-gray-600">
        The pass mark applies to tests submitted after you save. Agents need no login and can
        retake the test as often as they like; delete a test in the Attempts tab to remove its
        result.
      </p>
    </form>
  );
};

export default SettingsPanel;
