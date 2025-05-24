import DualInputRow from "./DualInputRow";
import TitledDualInputSection from "./TitledDualInputSection";

const EmployementInfo = () => {
  return (
    <>
      <h2 className="text-2xl font-semibold my-4">Employment Information: <span className='font-normal text-lg'>Are you working any where as a Full-time, Part-time, Self Employed or are you on benefits.</span></h2>
      <h3 className='text-xl font-medium'>Individual Income:</h3>
      <DualInputRow labelLeft="Full-time (FT)" labelRight="Part-time (PT)" />
      <TitledDualInputSection title="Self Employed (SE):" labelLeft="Sole Trader" labelRight="Director" />
      <h4 className="text-lg font-medium">Benefits</h4>
      <DualInputRow labelLeft="Universal Credit (UC)" labelRight="Personal Ind. Payment (PIP)" />
      <DualInputRow labelLeft="State Pension" labelRight="Private Pension" />
      <h3 className='text-xl font-medium'>Partner Income:</h3>
      <DualInputRow labelLeft="Full-time (FT)" labelRight="Part-time (PT)" />
      <TitledDualInputSection title="Self Employed (SE):" labelLeft="Sole Trader" labelRight="Director" />
      <h4 className="text-lg font-medium">Benefits</h4>
      <DualInputRow labelLeft="Universal Credit (UC)" labelRight="Personal Ind. Payment (PIP)" />
      <DualInputRow labelLeft="State Pension" labelRight="Private Pension" />
    </>
  )
}

export default EmployementInfo;