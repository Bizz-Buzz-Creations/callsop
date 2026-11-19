import { Component } from "react";

// Pages such as the test list are downloaded on demand. A tab that was opened before a
// new version of the site went live can no longer find those files; without this, React
// would show a blank page. This shows what to do instead.
class ChunkErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn("A page could not be loaded", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="max-w-xl mx-auto mt-8 p-6 border rounded-md shadow bg-gray-100">
        <h1 className="text-2xl font-semibold mb-2">This page could not be loaded</h1>
        <p className="mb-4">The site may have been updated, or the connection dropped. Reload the page to continue.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Reload
        </button>
      </section>
    );
  }
}

export default ChunkErrorBoundary;
