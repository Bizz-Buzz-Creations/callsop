import DualInputRow from "./DualInputRow"

const TitledDualInputSection = ({
  title,
  labelLeft,
  labelRight,
  valueLeft,
  valueRight,
  onChangeLeft,
  onChangeRight,
  type
}) => {
  return (
    <div>
      <h4 className="text-lg font-medium">{title}</h4>
      <DualInputRow
        labelLeft={labelLeft}
        labelRight={labelRight}
        valueLeft={valueLeft}
        valueRight={valueRight}
        onChangeLeft={onChangeLeft}
        onChangeRight={onChangeRight}
        type={type}
      />
    </div>
  )
}

export default TitledDualInputSection;