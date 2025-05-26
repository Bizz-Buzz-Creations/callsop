import { useEffect } from "react";
import DynamicInputGenerator from "./DynamicInputGenerator";

const LabeledInputGroup = ({ label, value = "", onChange }) => {
  // Handler for input change
  // const handleInput = (e) => {
  //   onChange && onChange(e.target.value);
  // };
  
  return (
    <div className=" items-center mb-4 w-full">
      <label className="block mb-1 font-medium">{label}:</label>
      <DynamicInputGenerator value={value} onChange={onChange} />
    </div>
  )
}

export default LabeledInputGroup;