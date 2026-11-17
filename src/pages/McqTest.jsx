import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { TriangleAlert } from "lucide-react";
import {
  LETTERS,
  findOpenAttempt,
  friendlyError,
  getSavedName,
  loadTest,
  logViolation,
  saveAnswer,
  saveName,
  startAttempt,
  submitAttempt,
} from "../utils/mcqApi";

// Fisher-Yates shuffle (returns a new array).
const shuffled = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// One test, chosen by the id in the address (/test/<id>).
const McqTest = ({ testId }) => {
  // loading | missing | start | test | result
  const [stage, setStage] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false); // in-page "submit?" box

  const [name, setName] = useState(getSavedName);
  const [config, setConfig] = useState(null); // the test: { id, title, description, passPercent, active }
  const [bank, setBank] = useState([]); // every question currently in the bank
  const [attempt, setAttempt] = useState(null); // { id, questionIds }
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  // The questions of THIS attempt, in a fresh random order every time the page
  // loads (so a refresh reshuffles). Answers are stored per question, not per
  // position, so shuffling never affects saved answers or the score.
  const questions = useMemo(() => {
    if (!attempt) return [];
    const byId = Object.fromEntries(bank.map((q) => [q.id, q]));
    return shuffled(attempt.questionIds.map((id) => byId[id]).filter(Boolean));
  }, [attempt, bank]);
  // One group, no section headings: sections are meaningless once questions are mixed.
  const sections = useMemo(() => [{ name: "", items: questions }], [questions]);
  const answeredCount = questions.filter((q) => answers[q.id]).length;

  // Load the test, and resume an unfinished attempt (e.g. after a page reload).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ test: loadedTest, questions: loadedQuestions }, open] = await Promise.all([
          loadTest(testId),
          findOpenAttempt(testId),
        ]);
        if (cancelled) return;
        setConfig(loadedTest);
        setBank(loadedQuestions);
        if (open) {
          setName(open.name || "");
          setAttempt({ id: open.id, questionIds: open.questionIds });
          setAnswers(open.answers || {});
          setStage("test");
        } else {
          setStage("start");
        }
      } catch (err) {
        if (cancelled) return;
        setError(friendlyError(err));
        // A test that does not exist (or a bad link) gets its own page; other errors
        // (for example no connection) keep the start screen so the agent can retry.
        setStage(err?.status === 404 || err?.status === 400 ? "missing" : "start");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  // Proctoring: while the test runs, leaving the tab or window is reported to
  // the admin. The test itself carries on.
  const attemptId = attempt?.id;
  useEffect(() => {
    if (stage !== "test" || !attemptId) return;

    let lastRecorded = 0;
    // Refreshing, closing or navigating away fires "hidden" events too. Those
    // are not tab switches, so ignore anything right after the page starts leaving.
    let leaving = false;
    const markLeaving = () => {
      leaving = true;
      // If the agent cancels the "leave this page?" prompt, the page stays: resume
      // watching shortly afterwards. (When the page really unloads, this never runs.)
      setTimeout(() => {
        leaving = false;
      }, 2000);
    };
    const record = (type) => {
      if (leaving) return;
      const now = Date.now();
      // Switching tabs fires both events; count it once.
      if (now - lastRecorded < 1000) return;
      lastRecorded = now;
      logViolation(attemptId, type).catch((err) => console.warn("Could not report warning", err));
      setViolationCount((count) => count + 1);
      setShowWarning(true);
    };

    const onVisibility = () => document.hidden && record("tab-switch");
    const onBlur = () => record("window-blur");
    const block = (event) => event.preventDefault();
    const onBeforeUnload = (event) => {
      markLeaving();
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", markLeaving);
    document.addEventListener("copy", block);
    document.addEventListener("contextmenu", block);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", markLeaving);
      document.removeEventListener("copy", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [stage, attemptId]);

  const handleStart = async (event) => {
    event.preventDefault();
    if (!name.trim()) return; // a name is required
    setBusy(true);
    setError("");
    try {
      saveName(name.trim());
      const started = await startAttempt(name.trim(), testId);
      // Re-read the bank so the attempt uses the latest questions.
      const fresh = await loadTest(testId);
      setConfig(fresh.test);
      setBank(fresh.questions);
      setAttempt({ id: started.attemptId, questionIds: started.questionIds });
      setAnswers(started.answers || {});
      setViolationCount(0);
      setShowWarning(false);
      setStage("test");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = (questionId, letter) => {
    setAnswers((prev) => ({ ...prev, [questionId]: letter }));
    saveAnswer(attempt.id, questionId, letter).catch((err) =>
      console.warn("Could not save answer (it is still sent on submit)", err)
    );
  };

  // The confirmation is drawn inside the page on purpose. A browser pop-up
  // (window.confirm) takes focus from the page, which looks exactly like the
  // agent switching to another application and would be recorded as a warning.
  const handleSubmit = async () => {
    setConfirming(false);
    setBusy(true);
    setError("");
    try {
      setResult(await submitAttempt(attempt.id, answers));
      setShowWarning(false);
      setStage("result");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRestart = () => {
    setAttempt(null);
    setAnswers({});
    setResult(null);
    setError("");
    setStage("start");
  };

  if (stage === "loading") {
    return <div className="text-center py-10">Loading test…</div>;
  }

  if (stage === "missing") {
    return (
      <section className="max-w-xl mx-auto mt-8 p-6 border rounded-md shadow bg-gray-100">
        <h1 className="text-2xl font-semibold mb-2">Test not found</h1>
        <p className="mb-4">{error || "This test does not exist any more."}</p>
        <Link to="/test" className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 inline-block">
          See all tests
        </Link>
      </section>
    );
  }

  if (stage === "start") {
    const title = config?.title || "MCQ Test";
    return (
      <section className="max-w-xl mx-auto mt-8 p-6 border rounded-md shadow bg-gray-100">
        <Link to="/test" className="text-sm text-gray-500 hover:underline">← All tests</Link>
        <h1 className="text-2xl font-semibold mb-1 mt-2">{title}</h1>
        {config?.description && <p className="text-gray-600 mb-2 whitespace-pre-line">{config.description}</p>}
        {config && (
          <p className="text-gray-700 mb-4">
            {bank.length} multiple-choice question{bank.length === 1 ? "" : "s"}. Pass mark: {config.passPercent}%.
          </p>
        )}

        <div className="bg-yellow-500/20 border border-yellow-600 rounded p-3 mb-4 text-sm">
          <p className="font-semibold flex items-center gap-2">
            <TriangleAlert className="w-4" /> This test is monitored
          </p>
          <p>
            Stay on this tab until you submit. Switching tabs or opening another application is
            recorded and reported to the admin. The test will continue, but every switch is
            counted.
          </p>
        </div>

        {error && <p className="bg-red-600 text-white rounded p-3 mb-3 text-sm">{error}</p>}
        {config && !config.active && (
          <p className="bg-red-600 text-white rounded p-3 mb-3 text-sm">
            This test is not open right now.
          </p>
        )}

        <form onSubmit={handleStart} className="space-y-3">
          <div>
            <label className="block mb-1 font-medium" htmlFor="mcq-name">Your name</label>
            <input
              id="mcq-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-1 border rounded indent-1 bg-white"
              placeholder="Enter your full name to start"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim() || (config && !config.active)}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start Test"}
          </button>
        </form>

        <Link to="/test/admin" className="block mt-6 text-sm text-gray-500 hover:underline">
          Admin panel
        </Link>
      </section>
    );
  }

  if (stage === "result") {
    // Only questions that were actually scored have a correct answer.
    const reviewed = questions.filter((q) => result.correct?.[q.id]);
    return (
      <section className="max-w-3xl mx-auto mt-8 p-4 border rounded-md shadow bg-gray-100">
        <h1 className="text-2xl font-semibold mb-1">Your Result</h1>
        <p className="text-gray-600 mb-3">{config?.title}</p>

        <div className={`rounded p-4 text-white mb-4 ${result.passed ? "bg-green-600" : "bg-red-600"}`}>
          <p className="text-3xl font-bold">
            {result.score} / {result.total} ({result.percent}%)
          </p>
          <p className="font-semibold">
            {result.passed ? "Passed" : "Not passed"} · pass mark {result.passPercent}%
          </p>
          <p className="text-sm mt-1">
            {name} · {violationCount} tab/window switch{violationCount === 1 ? "" : "es"} recorded
          </p>
        </div>

        <h2 className="text-xl font-semibold mb-2">Review</h2>
        <div className="space-y-3">
          {reviewed.map((q, number) => {
            const chosen = answers[q.id];
            const correctLetter = result.correct[q.id];
            const isCorrect = chosen === correctLetter;
            return (
              <div key={q.id} className="bg-white rounded shadow p-3">
                <p className="font-medium">
                  {number + 1}. {q.question}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {q.options.map((option, index) => {
                    const letter = LETTERS[index];
                    const isAnswer = letter === correctLetter;
                    const isChosen = letter === chosen;
                    return (
                      <li
                        key={letter}
                        className={`px-2 py-1 rounded ${
                          isAnswer ? "bg-green-600 text-white" : isChosen ? "bg-red-600 text-white" : ""
                        }`}
                      >
                        {letter}. {option}
                        {isAnswer && " (correct answer)"}
                        {isChosen && !isAnswer && " (your answer)"}
                      </li>
                    );
                  })}
                </ul>
                <p className={`mt-2 text-sm font-semibold ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                  {isCorrect ? "Correct" : chosen ? "Incorrect" : "Not answered"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/test" className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            Back to all tests
          </Link>
          <button
            onClick={handleRestart}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Retake this test
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto mt-4 p-4 border rounded-md shadow bg-gray-100 select-none">
      <div className="sticky top-0 z-10 bg-gray-800 text-white rounded p-3 mb-4 flex flex-wrap justify-between gap-2 text-sm">
        <span className="font-semibold">{config?.title}</span>
        <span>
          Answered {answeredCount} / {questions.length}
        </span>
        <span className={violationCount ? "text-yellow-500 font-semibold" : ""}>
          Switches recorded: {violationCount}
        </span>
      </div>

      {error && <p className="bg-red-600 text-white rounded p-3 mb-4 text-sm">{error}</p>}

      {showWarning && (
        <div className="bg-red-600 text-white rounded p-3 mb-4 flex justify-between items-start gap-3">
          <p className="flex gap-2">
            <TriangleAlert className="w-5 shrink-0" />
            <span>
              <strong>Warning:</strong> you left the test window. This has been recorded and
              reported to the admin ({violationCount} so far). Please stay on this tab.
            </span>
          </p>
          <button onClick={() => setShowWarning(false)} className="underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {sections.map((section, sectionIndex) => (
        <div key={`${section.name}-${sectionIndex}`} className="mb-6">
          {section.name && <h2 className="text-xl font-semibold mb-3">{section.name}</h2>}
          <div className="space-y-3">
            {section.items.map((q) => {
              const number = questions.indexOf(q) + 1;
              return (
                <fieldset key={q.id} className="bg-white rounded shadow p-3">
                  <legend className="sr-only">Question {number}</legend>
                  <p className="font-medium mb-2">
                    {number}. {q.question}
                  </p>
                  <div className="space-y-1">
                    {q.options.map((option, index) => {
                      const letter = LETTERS[index];
                      return (
                        <label
                          key={letter}
                          className={`flex gap-2 items-start px-2 py-1 rounded cursor-pointer hover:bg-indigo-100 ${
                            answers[q.id] === letter ? "bg-indigo-100" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            className="mt-1"
                            checked={answers[q.id] === letter}
                            onChange={() => handleSelect(q.id, letter)}
                          />
                          <span>
                            {letter}. {option}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit Test"}
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <div className="bg-white rounded shadow-xl p-5 max-w-md w-full">
            <h2 id="submit-title" className="text-lg font-semibold mb-2">Submit your test?</h2>
            <p className="mb-4 text-sm">
              {questions.length - answeredCount > 0
                ? `You have ${questions.length - answeredCount} unanswered question(s). Submit anyway?`
                : "You cannot change your answers after submitting."}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirming(false)} className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600">
                Go back
              </button>
              <button onClick={handleSubmit} className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
                Yes, submit
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default McqTest;
