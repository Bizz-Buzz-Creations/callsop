import DynamicInputGenerator from "./DynamicInputGenerator";

const LabeledInputGroup = ({ label }) => {
  return (
    <div className=" items-center mb-4 w-full">
      <label className="block mb-1 font-medium">{label}:</label>
      <DynamicInputGenerator />
    </div>
  )
}

export default LabeledInputGroup;