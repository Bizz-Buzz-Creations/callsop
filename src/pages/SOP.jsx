import { useEffect, useState } from "react";
import DebtConfirmation from "../components/DebtConfirmation";  
import EmployementInfo from "../components/EmploymentInfo";
import MaritalStatus from "../components/MaritalStatus";
import RentalDetails from "../components/RentalDetails";

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

  return (
    <section className="w-3xl mx-auto p-4 border rounded-md shadow bg-gray-100">
      <DebtConfirmation value={formData.debtConfirmation || {}} onChange={(v) => handleUpdate("debtConfirmation", v)} />
      <RentalDetails value={formData.rentalDetails || {}} onChange={(v) => handleUpdate("rentalDetails", v)} />
      <MaritalStatus value={formData.maritalStatus || {}} onChange={(v) => handleUpdate("maritalStatus", v)} />
      <EmployementInfo value={formData.employmentInfo || {}} onChange={(v) => handleUpdate("employmentInfo", v)} />

      <div className="mt-8 p-4 bg-white rounded shadow">
        <h2 className="text-xl font-bold mb-2">All Entered Values</h2>
        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(formData, null, 2)}</pre>
      </div>
    </section>
  );
};

export default SOP;