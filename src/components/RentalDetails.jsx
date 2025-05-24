import TitledDualInputSection from "./TitledDualInputSection"

const RentalDetails = () => {
  return (
    <>
      <h3 className='text-xl font-medium'>Currently are Renting a property or you home owner?</h3>
      <TitledDualInputSection title="Home Owner:" labelLeft="How much is the mortgage?" labelRight="How much is the CPV?" />
      <TitledDualInputSection title="Tenant:" labelLeft="Private Rent" labelRight="Council/HA Rent" />
    </>
  )
}

export default RentalDetails;