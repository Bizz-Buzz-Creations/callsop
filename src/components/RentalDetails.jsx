import DualInputRow from "./DualInputRow";
import TitledDualInputSection from "./TitledDualInputSection";

const RentalDetails = ({ value = {}, onChange }) => {
  // Helper to update a field
  const handleChange = (field, val) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <>
      <h3 className='text-xl font-medium'>Currently are Renting a property or you home owner?</h3>
      <TitledDualInputSection
        title="Home Owner:"
        labelLeft="Total mortgage outstanding?"
        labelRight="How much is the CPV?"
        valueLeft={value.mortgage || ""}
        valueRight={value.cpv || ""}
        onChangeLeft={val => handleChange("mortgage", val)}
        onChangeRight={val => handleChange("cpv", val)}
        type="text"
      />
      <DualInputRow
        labelLeft="How much mortgage you pay?"
        valueLeft={value.mortgagePay || ""}
        onChangeLeft={val => handleChange("mortgagePay", val)}
        type="number"
      />

      <TitledDualInputSection
        title="Tenant:"
        labelLeft="Private Rent"
        labelRight="Council/HA Rent"
        valueLeft={value.privateRent || ""}
        valueRight={value.councilRent || ""}
        onChangeLeft={val => handleChange("privateRent", val)}
        onChangeRight={val => handleChange("councilRent", val)}
        type="number"
      />
    </>
  );
};

export default RentalDetails;