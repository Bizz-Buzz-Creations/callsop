import { useState, useEffect, Suspense, lazy } from "react";
const DebtConfirmation = lazy(() => import("../components/DebtConfirmation"));
const RentalDetails = lazy(() => import("../components/RentalDetails"));
const MaritalStatus = lazy(() => import("../components/MaritalStatus"));
const EmployementInfo = lazy(() => import("../components/EmployementInfo"));
const UserDetails = lazy(() => import("../components/UserDetails"));
const SummaryReport = lazy(() => import("../components/SummaryReport"));
const ScrollToTopButton = lazy(() => import("../components/ScrollToTopButton"));
import { ListRestart } from "lucide-react";
import { Tooltip } from "react-tooltip";
import 'react-tooltip/dist/react-tooltip.css';

const STORAGE_KEY = "sopFormData";
const getStoredData = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Only a plain object is valid form data. `null`, arrays, numbers or
    // strings in storage would otherwise crash the page on every load.
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
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
  const [step, setStep] = useState(0);
  // Pass the function itself so localStorage is read once, not on every render.
  const [formData, setFormData] = useState(getStoredData);

  useEffect(() => {
    setStoredData(formData);
  }, [formData]);

  const handleUpdate = (section, values) => {
    setFormData((prev) => ({ ...prev, [section]: values }));
  };

  const handleReset = () => {
    const confirmMessage = window.confirm("⚠️ Are you sure you want to refresh this window?\nYou'll lose the entire data.");
    if (confirmMessage) {
      clearStoredData();
      setFormData({});
    }
  };

  const stepLabels = [
    "Debt Confirmation",
    "Rental + Marital Info",
    "Employment Info",
    "User Details + Summary"
  ];

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <DebtConfirmation value={formData.debtConfirmation || {}} onChange={(v) => handleUpdate("debtConfirmation", v)} />
        );
      case 1:
        return (
          <>
            <RentalDetails value={formData.rentalDetails || {}} onChange={(v) => handleUpdate("rentalDetails", v)} />
            <MaritalStatus value={formData.maritalStatus || {}} onChange={(v) => handleUpdate("maritalStatus", v)} />
          </>
        );
      case 2:
        return (
          <EmployementInfo
            value={formData.employementInfo || {}}
            onChange={(v) => handleUpdate("employementInfo", v)}
            haveKids={formData.maritalStatus?.haveKids === "yes"}
          />
        );
      case 3:
        return (
          <>
            <UserDetails value={formData.userDetails || {}} onChange={(v) => handleUpdate("userDetails", v)} />
            <SummaryReport data={formData} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <section className="max-w-3xl mx-auto p-4 border rounded-md shadow bg-gray-100 relative">
      <button
        data-tooltip-id="my-tooltip"
        data-tooltip-content="Reset Data"
        onClick={handleReset}
        className="p-2 bg-slate-400 text-white rounded-full hover:bg-indigo-600 transition absolute right-2 top-2"
      >
        <ListRestart />
      </button>

      <Tooltip id="my-tooltip" place="top" effect="solid" className="!bg-indigo-500 !font-semibold" />

      {/* Step Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {stepLabels.map((label, index) => (
          <button
            key={index}
            onClick={() => setStep(index)}
            className={`px-3 py-1 text-sm rounded-md font-medium transition ${
              step === index
                ? "bg-indigo-500 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-indigo-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
        {renderStep()}

        {/* Prev/Next Buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
            disabled={step === 0}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setStep((prev) => Math.min(prev + 1, 3))}
            disabled={step === 3}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <ScrollToTopButton />
      </Suspense>
    </section>
  );
};

export default SOP;
