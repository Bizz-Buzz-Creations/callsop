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
        labelLeft="How much is the mortgage?"
        labelRight="How much is the CPV?"
        valueLeft={value.mortgage || ""}
        valueRight={value.cpv || ""}
        onChangeLeft={val => handleChange("mortgage", val)}
        onChangeRight={val => handleChange("cpv", val)}
      />
      <TitledDualInputSection
        title="Tenant:"
        labelLeft="Private Rent"
        labelRight="Council/HA Rent"
        valueLeft={value.privateRent || ""}
        valueRight={value.councilRent || ""}
        onChangeLeft={val => handleChange("privateRent", val)}
        onChangeRight={val => handleChange("councilRent", val)}
      />
    </>
  );
};

export default RentalDetails;