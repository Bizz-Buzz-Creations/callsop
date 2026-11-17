import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { friendlyError } from "../utils/mcqApi";
import {
  ADMIN_EXPIRED_EVENT,
  adminMe,
  adminSignIn,
  adminSignOut,
  fetchConfig,
  fetchQuestions,
  hasAdminToken,
} from "../utils/mcqAdminApi";
import AccessPanel from "../components/mcq/AccessPanel";
import AttemptsPanel from "../components/mcq/AttemptsPanel";
import QuestionsPanel from "../components/mcq/QuestionsPanel";
import SettingsPanel from "../components/mcq/SettingsPanel";

const TABS = ["Attempts", "Questions", "Settings", "Access"];

const McqAdmin = () => {
  // checking | login | ready
  const [status, setStatus] = useState(hasAdminToken() ? "checking" : "login");
  const [tab, setTab] = useState("Attempts");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState("");

  // Resume an existing admin session, if the token is still valid.
  useEffect(() => {
    if (status !== "checking") return;
    adminMe()
      .then(() => setStatus("ready"))
      .catch(() => setStatus("login"));
  }, [status]);

  // The API tells us when the token expires or the admin was removed.
  useEffect(() => {
    const expired = () => setStatus("login");
    window.addEventListener(ADMIN_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(ADMIN_EXPIRED_EVENT, expired);
  }, []);

  // Questions and settings change only when an admin edits them, so they are
  // loaded once and again after each change (the attempts list polls instead).
  const loadData = useCallback(async () => {
    try {
      const [loadedQuestions, loadedConfig] = await Promise.all([fetchQuestions(), fetchConfig()]);
      setQuestions(loadedQuestions);
      setConfig(loadedConfig);
      setLoadError("");
    } catch (err) {
      setLoadError(friendlyError(err));
    }
  }, []);

  const ready = status === "ready";
  useEffect(() => {
    if (ready) loadData();
  }, [ready, loadData]);

  const answerKeys = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q.answer])),
    [questions]
  );

  const handleLogin = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminSignIn(email.trim(), password);
      setStatus("ready");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPassword("");
      setBusy(false);
    }
  };

  const handleLogout = () => {
    adminSignOut();
    setQuestions([]);
    setConfig(null);
    setStatus("login");
  };

  if (status === "checking") return <div className="text-center py-10">Loading…</div>;

  if (status === "login") {
    return (
      <section className="max-w-md mx-auto mt-8 p-6 border rounded-md shadow bg-gray-100">
        <h1 className="text-2xl font-semibold mb-4">Test Admin Panel</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block mb-1 font-medium" htmlFor="admin-email">Username</label>
            <input
              id="admin-email"
              type="text"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-1 border rounded indent-1 bg-white"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-1 border rounded indent-1 bg-white"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            disabled={busy}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Log in"}
          </button>
        </form>
        <Link to="/test" className="block mt-6 text-sm text-gray-500 hover:underline">
          Back to test
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto mt-4 p-4 border rounded-md shadow bg-gray-100">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <h1 className="text-2xl font-semibold">Test Admin Panel</h1>
        <button
          onClick={handleLogout}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Log out
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={`px-3 py-1 text-sm rounded-md font-medium transition ${
              tab === name ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-800 hover:bg-indigo-100"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {loadError && <p className="bg-red-600 text-white rounded p-3 mb-3 text-sm">{loadError}</p>}

      {tab === "Attempts" && <AttemptsPanel questions={questions} answerKeys={answerKeys} />}
      {tab === "Questions" && <QuestionsPanel questions={questions} onChanged={loadData} />}
      {tab === "Access" && <AccessPanel />}
      {tab === "Settings" &&
        (config ? <SettingsPanel config={config} onSaved={loadData} /> : <p>Loading settings…</p>)}
    </section>
  );
};

export default McqAdmin;
