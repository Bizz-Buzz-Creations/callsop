import { useState } from "react";
import { generateReportFromLocalStorage } from "../utils/reportFormatter";
import { downloadReport } from "../utils/downloadReport";
import {
  FileText,
  ClipboardCopy,
  Download,
  ClipboardSignature
} from "lucide-react"; // Added ClipboardSignature for combined action
import { Tooltip } from "react-tooltip";

const SummaryReport = () => {
  const [report, setReport] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerateReport = () => {
    const formatted = generateReportFromLocalStorage();
    setReport(formatted);
    setCopied(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownload = () => {
    if (report) downloadReport(report);
  };

  const handleCopyAndDownload = async () => {
    await handleCopyToClipboard();
    handleDownload();
  };

  return (
    <div className="p-2 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-2xl font-bold">Report Summary</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleGenerateReport}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow flex gap-1 items-center"
          >
            <FileText className="w-4" />
            Generate Report
          </button>

          {report && (
            <>
              <button
                data-tooltip-id="copy"
                data-tooltip-content="Copy to clipboard"
                onClick={handleCopyToClipboard}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow flex gap-1 items-center"
              >
                <ClipboardCopy className="w-4" />
                {copied ? "Copied!" : "Copy"}
              </button>

              <Tooltip id="copy" place="top" effect="solid" className="!bg-emerald-500 !font-semibold" />

              <button
                data-tooltip-id="export"
                data-tooltip-content="Copy & Download"
                onClick={handleCopyAndDownload}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded shadow flex gap-1 items-center"
              >
                <ClipboardSignature className="w-4" />
                Export
              </button>

              <Tooltip id="export" place="top" effect="solid" className="!bg-sky-500 !font-semibold" />

              <button
                data-tooltip-id="download"
                data-tooltip-content="Download"
                onClick={handleDownload}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded shadow flex gap-1 items-center"
              >
                <Download className="w-4" />
              </button>

              <Tooltip id="download" place="top" effect="solid" className="!bg-blue-500 !font-semibold" />
            </>
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
