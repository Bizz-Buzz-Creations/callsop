import { useEffect, useState } from "react";
import AskQuestion from "./AskQuestion";
import DualInputRow from "./DualInputRow";
import TitledDualInputSection from "./TitledDualInputSection";

const EmployementInfo = ({ value = {}, onChange }) => {
  const [haveKids, setHaveKids] = useState(false);

  useEffect(() => {
    const updateHaveKidsFromStorage = () => {
      const storedData = localStorage.getItem('sopFormData');
      try {
        const parsed = JSON.parse(storedData);
        setHaveKids(parsed?.maritalStatus?.haveKids === "yes");
      } catch (err) {
        console.error("Error parsing localStorage data", err);
      }
    };

    // Polling
    const interval = setInterval(updateHaveKidsFromStorage, 1000);

    // Listen for cross-tab changes
    window.addEventListener("storage", updateHaveKidsFromStorage);

    // Initial check
    updateHaveKidsFromStorage();

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", updateHaveKidsFromStorage);
    };
  }, [])

  // Helper to update a field
  const handleChange = (field, val) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <>
      <h2 className="text-2xl font-semibold my-4">
        Employment Information:{" "}
        <span className='font-normal text-lg'>
          Are you working anywhere as a Full-time, Part-time, Self Employed or are you on benefits.
        </span>
      </h2>
      <AskQuestion tag="Ask" question={<><strong>In-case of Full & Part-Time Income:</strong> How much you bring back after taxes and deductions every month.</>} />
      <AskQuestion tag="Ask" question={<><strong>In-case of Sole Trader & Director Income:</strong> Are you up-to-date with your tax and returns of previous year.</>} />
      <h3 className='text-xl font-medium'>Individual Income:</h3>
      <DualInputRow
        labelLeft="Full-time (FT)"
        labelRight="Part-time (PT)"
        valueLeft={value.individualFT || ""}
        valueRight={value.individualPT || ""}
        onChangeLeft={val => handleChange("individualFT", val)}
        onChangeRight={val => handleChange("individualPT", val)}
      />
      <TitledDualInputSection
        title="Self Employed (SE):"
        labelLeft="Sole Trader"
        labelRight="Director"
        valueLeft={value.individualSoleTrader || ""}
        valueRight={value.individualDirector || ""}
        onChangeLeft={val => handleChange("individualSoleTrader", val)}
        onChangeRight={val => handleChange("individualDirector", val)}
      />
      <h4 className="text-lg font-medium">Benefits</h4>
      <DualInputRow
        labelLeft="Universal Credit (UC)"
        labelRight="Personal Ind. Payment (PIP)"
        valueLeft={value.individualUC || ""}
        valueRight={value.individualPIP || ""}
        onChangeLeft={val => handleChange("individualUC", val)}
        onChangeRight={val => handleChange("individualPIP", val)}
      />
      <DualInputRow
        labelLeft="State Pension"
        labelRight="Private Pension"
        valueLeft={value.individualStatePension || ""}
        valueRight={value.individualPrivatePension || ""}
        onChangeLeft={val => handleChange("individualStatePension", val)}
        onChangeRight={val => handleChange("individualPrivatePension", val)}
      />
      {haveKids && (
        <>
          <AskQuestion tag="Ask" question="Are you claiming any child benefit for you kids?" />
          <DualInputRow
            labelLeft="Child Benefits"
            valueLeft={value.individualCB || ""}
            onChangeLeft={val => handleChange("individualCB", val)}
          />
        </>
      )}

      <h3 className='text-xl font-medium'>Partner Income:</h3>
      <DualInputRow
        labelLeft="Full-time (FT)"
        labelRight="Part-time (PT)"
        valueLeft={value.partnerFT || ""}
        valueRight={value.partnerPT || ""}
        onChangeLeft={val => handleChange("partnerFT", val)}
        onChangeRight={val => handleChange("partnerPT", val)}
      />
      <TitledDualInputSection
        title="Self Employed (SE):"
        labelLeft="Sole Trader"
        labelRight="Director"
        valueLeft={value.partnerSoleTrader || ""}
        valueRight={value.partnerDirector || ""}
        onChangeLeft={val => handleChange("partnerSoleTrader", val)}
        onChangeRight={val => handleChange("partnerDirector", val)}
      />
      <h4 className="text-lg font-medium">Benefits</h4>
      <DualInputRow
        labelLeft="Universal Credit (UC)"
        labelRight="Personal Ind. Payment (PIP)"
        valueLeft={value.partnerUC || ""}
        valueRight={value.partnerPIP || ""}
        onChangeLeft={val => handleChange("partnerUC", val)}
        onChangeRight={val => handleChange("partnerPIP", val)}
      />
      <DualInputRow
        labelLeft="State Pension"
        labelRight="Private Pension"
        valueLeft={value.partnerStatePension || ""}
        valueRight={value.partnerPrivatePension || ""}
        onChangeLeft={val => handleChange("partnerStatePension", val)}
        onChangeRight={val => handleChange("partnerPrivatePension", val)}
      />
      {haveKids && (
        <>
          <AskQuestion tag="Ask" question="Are you claiming any child benefit for you kids?" />
          <DualInputRow
            labelLeft="Child Benefits"
            valueLeft={value.partnerCB || ""}
            onChangeLeft={val => handleChange("partnerCB", val)}
          />
        </>
      )}
    </>
  );
};

export default EmployementInfo;