import DualInputRow from "./DualInputRow"

const TitledDualInputSection = ({title, labelLeft, labelRight}) => {
  return (
    <div className="">
      <h4 className="text-lg font-medium">{title}</h4>
      <DualInputRow labelLeft={labelLeft} labelRight={labelRight} />
    </div>
  )
}

export default TitledDualInputSection;