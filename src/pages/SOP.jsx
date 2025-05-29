import { useEffect, useState } from "react";
import DebtConfirmation from "../components/DebtConfirmation";
import EmployementInfo from "../components/EmploymentInfo";
import MaritalStatus from "../components/MaritalStatus";
import RentalDetails from "../components/RentalDetails";
import { ListRestart } from "lucide-react";
import { Tooltip } from "react-tooltip";
import 'react-tooltip/dist/react-tooltip.css';
import SummaryReport from "../components/SummaryReport";
import ScrollToTopButton from "../components/ScrollToTopButton";

// Utility functions for localStorage
const STORAGE_KEY = "sopFormData";
const getStoredData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};
const setStoredData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
const clearStoredData = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const SOP = () => {
  const [formData, setFormData] = useState(getStoredData());

  // Save to localStorage on change
  useEffect(() => {
    setStoredData(formData);
  }, [formData]);

  // Handler to update form data from children
  const handleUpdate = (section, values) => {
    setFormData((prev) => ({
      ...prev,
      [section]: values,
    }));
  };

  // Reset all data
  const handleReset = () => {
    const confirmMessage = window.confirm("⚠️ Warning:\nAre you sure you want to refresh this window?\n\nYou'll lose the entire data.")
    if(confirmMessage) {
      clearStoredData();
      setFormData({});
    }
  };

  return (
    <section className="w-3xl mx-auto p-4 border rounded-md shadow bg-gray-100 relative">

      <button
        data-tooltip-id="my-tooltip"
        data-tooltip-content="Reset Data"
        onClick={handleReset}
        className="p-2 bg-slate-400 text-white rounded-full hover:bg-indigo-600 transition absolute right-2 top-2"
      >
        <ListRestart />
      </button>

      <Tooltip id="my-tooltip" place="top" effect="solid" className="!bg-indigo-500 !font-semibold" />

      <DebtConfirmation
        value={formData.debtConfirmation || {}}
        onChange={(v) => handleUpdate("debtConfirmation", v)}
      />
      <RentalDetails
        value={formData.rentalDetails || {}}
        onChange={(v) => handleUpdate("rentalDetails", v)}
      />
      <MaritalStatus
        value={formData.maritalStatus || {}}
        onChange={(v) => handleUpdate("maritalStatus", v)}
      />
      <EmployementInfo
        value={formData.employmentInfo || {}}
        onChange={(v) => handleUpdate("employmentInfo", v)}
      />

      <div className="mt-8 p-1 bg-white rounded shadow">
        {/* <h2 className="text-xl font-bold mb-2">All Entered Values</h2>
        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
          {JSON.stringify(formData, null, 2)}
        </pre> */}
        <SummaryReport />
      </div>

      <ScrollToTopButton />
    </section>
  );
};

export default SOP;