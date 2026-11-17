import { useCallback, useEffect, useState } from "react";
import { formatTime } from "../../utils/mcqApi";
import {
  addAccessRule,
  deleteAccessRule,
  fetchAccess,
  setAccessEnabled,
} from "../../utils/mcqAdminApi";

const EXPIRY_OPTIONS = [
  { label: "Never", hours: null },
  { label: "1 hour", hours: 1 },
  { label: "8 hours", hours: 8 },
  { label: "1 day", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
];

const AccessPanel = () => {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState("0"); // index into EXPIRY_OPTIONS

  const notify = (text, error = false) => setMessage({ text, error });

  const load = useCallback(async () => {
    try {
      setData(await fetchAccess());
    } catch (err) {
      notify(err.message, true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Runs an action, reloads the list, and shows what happened either way.
  const run = async (action, success) => {
    setBusy(true);
    try {
      const result = await action();
      await load();
      notify(typeof success === "function" ? success(result) : success);
      return true;
    } catch (err) {
      notify(err.message, true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addRule = async (ip, name) => {
    const hours = EXPIRY_OPTIONS[Number(expiry)].hours;
    // Show what was really saved (for example 198.51.100.77/24 is stored as 198.51.100.0/24).
    return run(() => addAccessRule(ip, name, hours), (saved) => `Added ${saved.value}.`);
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (await addRule(value.trim(), label.trim())) {
      setValue("");
      setLabel("");
    }
  };

  const handleToggle = () => {
    const turningOn = !data.enabled;
    if (
      turningOn &&
      !window.confirm("Turn the IP filter ON? Only the IPs listed here (and the always-allowed ones) will be able to open the site.")
    ) {
      return;
    }
    run(() => setAccessEnabled(turningOn), turningOn ? "IP filter is now ON." : "IP filter is now OFF.");
  };

  const handleDelete = (rule) => {
    if (!window.confirm(`Remove ${rule.value}${rule.label ? ` (${rule.label})` : ""} from the list?`)) return;
    run(() => deleteAccessRule(rule.id), `Removed ${rule.value}.`);
  };

  if (!data) return <p>{message.text || "Loading…"}</p>;

  return (
    <div className="space-y-5">
      {message.text && (
        <p className={`rounded p-3 text-sm text-white ${message.error ? "bg-red-600" : "bg-green-600"}`}>
          {message.text}
        </p>
      )}

      {!data.edgeConfigured && (
        <p className="bg-yellow-500/20 border border-yellow-600 rounded p-3 text-sm">
          <strong>Not active yet:</strong> the <code>EDGE_SECRET</code> setting is missing in Netlify, so
          the filter cannot run and everyone can still open the site. You can prepare the list now. See the
          README (IP access).
        </p>
      )}

      <div className="bg-white rounded shadow p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            IP filter:{" "}
            <span className={`px-2 py-1 rounded-full text-white text-sm ${data.enabled ? "bg-green-600" : "bg-gray-500"}`}>
              {data.enabled ? "ON" : "OFF"}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {data.enabled
              ? "Only the IPs below and the always-allowed ones can open the site."
              : "Everyone can open the site. Turn it on to restrict access to the list below."}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={busy}
          className={`px-4 py-2 rounded text-white disabled:opacity-50 ${data.enabled ? "bg-gray-500 hover:bg-gray-600" : "bg-indigo-500 hover:bg-indigo-600"}`}
        >
          {data.enabled ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className="bg-white rounded shadow p-4">
        <p>
          Your current IP: <strong data-testid="my-ip">{data.myIp}</strong>{" "}
          <span className={data.myIpAllowed ? "text-green-600" : "text-red-600"}>
            ({data.myIpAllowed ? "allowed" : "not in the list"})
          </span>
        </p>
        {!data.myIpAllowed && (
          <button
            onClick={() => addRule(data.myIp, label.trim() || "My IP")}
            disabled={busy}
            className="mt-2 px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            Add my IP
          </button>
        )}
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded shadow p-4 space-y-2">
        <h3 className="font-semibold">Add an IP address or range</h3>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="IP address or range"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="203.0.113.7 or 203.0.113.0/24"
            className="flex-1 min-w-48 p-1 border rounded indent-1"
          />
          <input
            aria-label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Ishika home)"
            maxLength={80}
            className="flex-1 min-w-48 p-1 border rounded indent-1"
          />
          <select
            aria-label="Expires"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="p-1 border rounded"
          >
            {EXPIRY_OPTIONS.map((option, index) => (
              <option key={option.label} value={index}>
                Expires: {option.label}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !value.trim()}
            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-gray-600">
          A range like <code>203.0.113.0/24</code> allows 256 addresses. Home and mobile connections change
          IP, so give them a short expiry.
        </p>
      </form>

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-200 text-left">
            <tr>
              <th className="px-3 py-2">IP / range</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Added</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.rules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-gray-500">No IPs added yet.</td>
              </tr>
            )}
            {data.rules.map((rule) => (
              <tr key={rule.id} className={`border-t ${rule.expired ? "text-gray-400" : ""}`}>
                <td className="px-3 py-2 font-mono">{rule.value}</td>
                <td className="px-3 py-2">{rule.label || "–"}</td>
                <td className="px-3 py-2">
                  {formatTime(rule.createdAt)}
                  {rule.createdBy && <span className="text-gray-500"> by {rule.createdBy}</span>}
                </td>
                <td className="px-3 py-2">
                  {rule.expired ? (
                    <span className="px-2 py-1 rounded-full bg-gray-200 text-gray-700">Expired</span>
                  ) : rule.expiresAt ? (
                    formatTime(rule.expiresAt)
                  ) : (
                    "Never"
                  )}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(rule)} disabled={busy} className="underline text-red-600 disabled:opacity-50">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded shadow p-4">
        <h3 className="font-semibold mb-1">Always allowed (built in)</h3>
        <p className="text-sm text-gray-600 mb-2">
          These can always open the site, even if the list is empty or the database is down, so you can
          never be locked out of this panel.
        </p>
        <p className="flex flex-wrap gap-2">
          {data.alwaysAllowed.map((entry) => (
            <span key={entry} className="px-2 py-1 rounded bg-gray-200 font-mono text-xs">
              {entry}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
};

export default AccessPanel;
