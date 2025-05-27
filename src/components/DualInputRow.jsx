const DualInputRow = ({
  labelLeft,
  labelRight,
  valueLeft,
  valueRight,
  onChangeLeft,
  onChangeRight,
  type
}) => {
  return (
    <section className="flex gap-5">
      {labelLeft && (
        <div className="mb-1 w-1/2">
          <label className="block mb-1 font-medium">{labelLeft}</label>
          <input
            type={type}
            className="w-full p-1 border rounded indent-1"
            placeholder={labelLeft}
            value={valueLeft}
            onChange={e => onChangeLeft && onChangeLeft(e.target.value)}
          />
        </div>
      )}

      {labelRight && (
        <div className="mb-1 w-1/2">
          <label className="block mb-1 font-medium">{labelRight}</label>
          <input
            type={type}
            className="w-full p-1 border rounded indent-1"
            placeholder={labelRight}
            value={valueRight}
            onChange={e => onChangeRight && onChangeRight(e.target.value)}
          />
        </div>
      )}
    </section>
  );
};

export default DualInputRow;
