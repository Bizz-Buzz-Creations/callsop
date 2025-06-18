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
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(getStoredData());

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
          <EmployementInfo value={formData.employementInfo || {}} onChange={(v) => handleUpdate("employementInfo", v)} />
        );
      case 3:
        return (
          <>
            <UserDetails value={formData.userDetails || {}} onChange={(v) => handleUpdate("userDetails", v)} />
            <SummaryReport />
          </>
        );
      default:
        return null;
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



// import { Suspense, lazy, useEffect, useState } from "react";
// const DebtConfirmation = lazy(() => import("../components/DebtConfirmation"));
// const EmployementInfo = lazy(() => import("../components/EmployementInfo"));
// const MaritalStatus = lazy(() => import("../components/MaritalStatus"));
// const RentalDetails = lazy(() => import("../components/RentalDetails"));
// const SummaryReport = lazy(() => import("../components/SummaryReport"));
// const UserDetails = lazy(() => import("../components/UserDetails"));
// const ScrollToTopButton = lazy(() => import("../components/ScrollToTopButton"));
// import { ListRestart } from "lucide-react";
// import { Tooltip } from "react-tooltip";
// import 'react-tooltip/dist/react-tooltip.css';

// // Utility functions for localStorage
// const STORAGE_KEY = "sopFormData";
// const getStoredData = () => {
//   try {
//     const data = localStorage.getItem(STORAGE_KEY);
//     return data ? JSON.parse(data) : {};
//   } catch {
//     return {};
//   }
// };
// const setStoredData = (data) => {
//   localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
// };
// const clearStoredData = () => {
//   localStorage.removeItem(STORAGE_KEY);
// };

// const SOP = () => {
//   const [formData, setFormData] = useState(getStoredData());

//   // Save to localStorage on change
//   useEffect(() => {
//     setStoredData(formData);
//   }, [formData]);

//   // Handler to update form data from children
//   const handleUpdate = (section, values) => {
//     setFormData((prev) => ({
//       ...prev,
//       [section]: values,
//     }));
//   };

//   // Reset all data
//   const handleReset = () => {
//     const confirmMessage = window.confirm("⚠️ Warning:\nAre you sure you want to refresh this window?\n\nYou'll lose the entire data.")
//     if (confirmMessage) {
//       clearStoredData();
//       setFormData({});
//     }
//   };

//   return (
//     <section className="w-3xl mx-auto p-4 border rounded-md shadow bg-gray-100 relative">

//       <Suspense fallback={<div className="text-center py-10">Loading sections...</div>}>

//         <button
//           data-tooltip-id="my-tooltip"
//           data-tooltip-content="Reset Data"
//           onClick={handleReset}
//           className="p-2 bg-slate-400 text-white rounded-full hover:bg-indigo-600 transition absolute right-2 top-2"
//         >
//           <ListRestart />
//         </button>

//         <Tooltip id="my-tooltip" place="top" effect="solid" className="!bg-indigo-500 !font-semibold" />

//         <DebtConfirmation
//           value={formData.debtConfirmation || {}}
//           onChange={(v) => handleUpdate("debtConfirmation", v)}
//         />
//         <RentalDetails
//           value={formData.rentalDetails || {}}
//           onChange={(v) => handleUpdate("rentalDetails", v)}
//         />
//         <MaritalStatus
//           value={formData.maritalStatus || {}}
//           onChange={(v) => handleUpdate("maritalStatus", v)}
//         />
//         <EmployementInfo
//           value={formData.employementInfo || {}}
//           onChange={(v) => handleUpdate("employementInfo", v)}
//         />

//         <UserDetails
//           value={formData.userDetails || {}}
//           onChange={(v) => handleUpdate("userDetails", v)}
//         />

//         <div className="mt-8 p-1 bg-white rounded shadow">
//           {/* <h2 className="text-xl font-bold mb-2">All Entered Values</h2>
//         <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
//           {JSON.stringify(formData, null, 2)}
//         </pre> */}
//           <SummaryReport />
//         </div>

//         <ScrollToTopButton />

//       </Suspense>

//     </section>
//   );
// };

// export default SOP;
