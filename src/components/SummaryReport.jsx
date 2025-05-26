import { useState } from "react";
import { generateReportFromLocalStorage } from "../utils/reportFormatter";
import { FileText, ClipboardCopy } from "lucide-react";

const SummaryReport = () => {
  const [report, setReport] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerateReport = () => {
    const formatted = generateReportFromLocalStorage();
    setReport(formatted);
    setCopied(false); // Reset copied state on new generation
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="p-2 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-2xl font-bold">Report Summary</h2>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateReport}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow flex gap-1 items-center"
          >
            <FileText className="w-4" />
            Generate Report
          </button>
          {report && (
            <button
              onClick={handleCopyToClipboard}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded shadow flex gap-1 items-center"
            >
              <ClipboardCopy className="w-4" />
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {report && (
        <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded border border-gray-300">
          {report}
        </pre>
      )}
    </div>
  );
};

export default SummaryReport;

