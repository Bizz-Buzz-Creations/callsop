import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { friendlyError, loadTests } from "../utils/mcqApi";

// The page agents land on from the navbar: every test they can take.
const McqList = () => {
  const [tests, setTests] = useState(null); // null = still loading
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setTests(null); // show "Loading" while retrying, not a false "no tests" message
    try {
      setTests(await loadTests());
    } catch (err) {
      setError(friendlyError(err));
      setTests([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (tests === null) return <div className="text-center py-10">Loading tests…</div>;

  return (
    <section className="max-w-3xl mx-auto mt-8 p-6 border rounded-md shadow bg-gray-100">
      <h1 className="text-2xl font-semibold mb-1">Tests</h1>
      <p className="text-gray-700 mb-4">
        Choose a test to take. Tests are monitored: switching tabs or opening another application
        while a test is running is recorded and reported to the admin.
      </p>

      {error && (
        <div className="bg-red-600 text-white rounded p-3 mb-4 text-sm flex justify-between items-center gap-3">
          <span>{error}</span>
          <button onClick={load} className="underline shrink-0">Try again</button>
        </div>
      )}

      {!error && tests.length === 0 && (
        <p className="bg-white rounded shadow p-4 text-gray-600">
          No tests are available right now. Please check back later.
        </p>
      )}

      <div className="space-y-3">
        {tests.map((test) => (
          <article key={test.id} aria-label={test.title} className="bg-white rounded shadow p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 break-words">
              <h2 className="text-lg font-semibold">{test.title}</h2>
              {test.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{test.description}</p>}
              <p className="text-sm text-gray-500 mt-1">
                {test.questionCount} question{test.questionCount === 1 ? "" : "s"} · pass mark {test.passPercent}%
              </p>
              <p className="mt-2 text-sm">
                {test.openAttemptId ? (
                  <span className="px-2 py-1 rounded-full bg-yellow-500/30 text-yellow-900 font-semibold">
                    In progress{test.active ? "" : " (closed: you can still finish it)"}
                  </span>
                ) : test.last ? (
                  <span className={`px-2 py-1 rounded-full text-white font-semibold ${test.last.passed ? "bg-green-700" : "bg-red-600"}`}>
                    Last result: {test.last.score}/{test.last.total} ({test.last.percent}%) · {test.last.passed ? "Passed" : "Not passed"}
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-gray-200 text-gray-700">Not attempted yet</span>
                )}
              </p>
            </div>
            <Link
              to={`/test/${test.id}`}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 whitespace-nowrap"
            >
              {test.openAttemptId ? "Resume" : test.last ? "Take again" : "Start test"}
            </Link>
          </article>
        ))}
      </div>

      <Link to="/test/admin" className="block mt-6 text-sm text-gray-500 hover:underline">
        Admin panel
      </Link>
    </section>
  );
};

export default McqList;
