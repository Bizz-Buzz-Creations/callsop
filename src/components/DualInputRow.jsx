const DualInputRow = ({
  labelLeft,
  labelRight,
  valueLeft,
  valueRight,
  onChangeLeft,
  onChangeRight
}) => {
  return (
    <section className="flex gap-5">
      <div className="mb-1 w-full">
        <label className="block mb-1 font-medium">{labelLeft}</label>
        <input
          type="number"
          className="w-full p-1 border rounded indent-1"
          placeholder={labelLeft}
          value={valueLeft}
          onChange={e => onChangeLeft && onChangeLeft(e.target.value)}
        />
      </div>

      <div className="mb-1 w-full">
        <label className="block mb-1 font-medium">{labelRight}</label>
        <input
          type="number"
          className="w-full p-1 border rounded indent-1"
          placeholder={labelRight}
          value={valueRight}
          onChange={e => onChangeRight && onChangeRight(e.target.value)}
        />
      </div>
    </section>
  );
};

export default DualInputRow;
