import { useEffect, useRef, useState } from "react";
import { VIOLATION_LABELS } from "../../utils/mcqApi";
import { fetchAttempts } from "../../utils/mcqAdminApi";

const POLL_MS = 3000;
export const ATTEMPT_LIMIT = 500; // the server sends at most this many (the newest)

const EMPTY = { attempts: [], answerKeys: {}, loaded: false };

// Watches every attempt of every test for as long as the admin is signed in, on EVERY
// tab. A warning that was not there on the previous check becomes a red alert, so the
// admin sees a tab switch no matter which tab or filter they are looking at.
// `tests` is only used to show the current title of a test in the alert.
export const useLiveAttempts = (enabled, tests) => {
  const [data, setData] = useState(EMPTY);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");

  const testsRef = useRef(tests);
  const pollRef = useRef(null);
  useEffect(() => {
    testsRef.current = tests;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let firstPoll = true;
    const seen = new Set();

    const titleOf = (attempt) =>
      testsRef.current?.find((t) => t.id === attempt.testId)?.title || attempt.testTitle || "–";

    const poll = async () => {
      try {
        const { attempts, answerKeys } = await fetchAttempts();
        if (stopped) return;
        setData({ attempts, answerKeys, loaded: true });
        setError("");

        const fresh = [];
        attempts.forEach((attempt) =>
          attempt.violations.forEach((w) => {
            if (seen.has(w.id)) return;
            seen.add(w.id);
            if (!firstPoll) {
              fresh.push({
                key: w.id,
                who: `${attempt.name} (Attempt #${attempt.attemptNo}, ${titleOf(attempt)})`,
                label: VIOLATION_LABELS[w.type] || w.type,
              });
            }
          })
        );
        firstPoll = false; // warnings that existed before the panel opened are not "new"
        if (fresh.length) setAlerts((prev) => [...fresh, ...prev].slice(0, 5));
      } catch (err) {
        if (!stopped) setError(`Live updates paused: ${err.message}`);
      }
    };

    pollRef.current = poll;
    poll();
    const timer = setInterval(poll, POLL_MS);
    // Catch up immediately when the admin returns to this browser tab.
    const onVisible = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      pollRef.current = null;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      setData(EMPTY);
      setAlerts([]);
      setError("");
    };
  }, [enabled]);

  return {
    ...data,
    alerts,
    error,
    // Check right now (used when the admin opens the Attempts tab, so it is never up to 3 seconds old).
    refresh: () => pollRef.current?.(),
    dismissAlert: (key) => setAlerts((prev) => prev.filter((a) => a.key !== key)),
    // An attempt the admin just deleted disappears at once, without waiting for the next check.
    removeAttempt: (id) => setData((prev) => ({ ...prev, attempts: prev.attempts.filter((a) => a.id !== id) })),
  };
};
