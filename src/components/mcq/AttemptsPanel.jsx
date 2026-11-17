import { Fragment, useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { VIOLATION_LABELS, formatTime } from "../../utils/mcqApi";
import { deleteAttempt, fetchAttempts } from "../../utils/mcqAdminApi";

const POLL_MS = 3000;

const AttemptsPanel = ({ questions, answerKeys }) => {
  const [attempts, setAttempts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");

  // Live updates: ask the server for everything every few seconds. Warnings
  // that were not there on the previous poll become red alerts.
  useEffect(() => {
    let stopped = false;
    let firstPoll = true;
    const seen = new Set();

    const poll = async () => {
      try {
        const list = await fetchAttempts();
        if (stopped) return;
        setAttempts(list);
        setError("");

        const fresh = [];
        list.forEach((attempt) =>
          attempt.violations.forEach((w) => {
            if (seen.has(w.id)) return;
            seen.add(w.id);
            if (!firstPoll) {
              fresh.push({
                key: w.id,
                who: `${attempt.name} (Test #${attempt.attemptNo})`,
                type: w.type,
              });
            }
          })
        );
        firstPoll = false; // warnings that existed before this page opened are not "new"
        if (fresh.length) setAlerts((prev) => [...fresh, ...prev].slice(0, 5));
      } catch (err) {
        if (!stopped) setError(`Live updates paused: ${err.message}`);
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    // Catch up immediately when the admin returns to this tab.
    const onVisible = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const totalWarnings = attempts.reduce((sum, a) => sum + a.violations.length, 0);

  const handleDelete = async (attempt) => {
    if (!window.confirm(`Delete ${attempt.name}'s test (#${attempt.attemptNo}) and its results?`)) return;
    try {
      await deleteAttempt(attempt.id);
      setAttempts((prev) => prev.filter((a) => a.id !== attempt.id));
    } catch (err) {
      setError(`Could not delete: ${err.message}`);
    }
  };

  return (
    <div>
      {alerts.map((alert) => (
        <div
          key={alert.key}
          className="bg-red-600 text-white rounded p-3 mb-2 flex justify-between items-center gap-3"
        >
          <p className="flex gap-2 items-center">
            <TriangleAlert className="w-5 shrink-0" />
            <span>
              <strong>{alert.who}</strong>: {VIOLATION_LABELS[alert.type] || alert.type}
            </span>
          </p>
          <button
            onClick={() => setAlerts((prev) => prev.filter((a) => a.key !== alert.key))}
            className="underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      ))}

      {error && <p className="bg-red-600 text-white rounded p-3 mb-3 text-sm">{error}</p>}

      <p className="mb-2 font-medium">
        {attempts.length} attempt(s) · {totalWarnings} tab/window switch warning(s) · updates every few seconds
      </p>

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-200 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Warnings</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-500">No attempts yet.</td>
              </tr>
            )}
            {attempts.map((a) => {
              const warnings = a.violations;
              const done = a.status === "completed";
              const answered = Object.keys(a.answers || {}).length;
              return (
                <Fragment key={a.id}>
                  <tr className="border-t">
                    <td className="px-3 py-2 font-semibold">{a.name || "–"}</td>
                    <td className="px-3 py-2">#{a.attemptNo}</td>
                    <td className="px-3 py-2">{formatTime(a.startedAt)}</td>
                    <td className="px-3 py-2">
                      {done ? "Completed" : `In progress (${answered}/${a.total} answered)`}
                    </td>
                    <td className="px-3 py-2">
                      {done ? (
                        <span className={a.passed ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                          {a.score} / {a.total} ({a.percent}%)
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded-full font-semibold ${
                          warnings.length ? "bg-red-600 text-white" : "bg-gray-200"
                        }`}
                      >
                        {warnings.length}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        onClick={() => setOpenId(openId === a.id ? null : a.id)}
                        className="underline text-indigo-600 mr-3"
                      >
                        {openId === a.id ? "Hide" : "Details"}
                      </button>
                      <button onClick={() => handleDelete(a)} className="underline text-red-600">
                        Delete
                      </button>
                    </td>
                  </tr>
                  {openId === a.id && (
                    <tr className="bg-gray-100">
                      <td colSpan={7} className="px-3 py-3">
                        <p className="font-semibold">Warnings</p>
                        {warnings.length === 0 ? (
                          <p className="text-gray-500">None. The candidate stayed on the test.</p>
                        ) : (
                          <ul className="list-disc ml-5">
                            {warnings.map((v) => (
                              <li key={v.id}>
                                {formatTime(v.at)}: {VIOLATION_LABELS[v.type] || v.type}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="font-semibold mt-2">Answers</p>
                        <p className="flex flex-wrap gap-1 mt-1">
                          {(a.questionIds || []).map((id, index) => {
                            const chosen = a.answers?.[id];
                            const key = answerKeys[id];
                            const exists = questions.some((q) => q.id === id);
                            const color = !exists
                              ? "bg-gray-200 line-through"
                              : !chosen
                                ? "bg-gray-200"
                                : chosen === key
                                  ? "bg-green-600 text-white"
                                  : "bg-red-600 text-white";
                            return (
                              <span key={id} className={`px-2 py-1 rounded text-xs ${color}`}>
                                {index + 1}: {chosen || "–"}
                              </span>
                            );
                          })}
                        </p>
                        {done && <p className="mt-2">Finished: {formatTime(a.finishedAt)}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttemptsPanel;
