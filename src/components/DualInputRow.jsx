const DualInputRow = ({ labelLeft, labelRight }) => {
  return (
    <section className="flex gap-5">
      <div className="mb-1 w-full">
        <label className="block mb-1 font-medium">{labelLeft}</label>
        <input
          type="number"
          className="w-full p-1 border rounded indent-1"
          placeholder={labelLeft}
        />
      </div>

      <div className="mb-1 w-full">
        <label className="block mb-1 font-medium">{labelRight}</label>
        <input
          type="number"
          className="w-full p-1 border rounded indent-1"
          placeholder={labelRight}
        />
      </div>
    </section>
  );
};

export default DualInputRow;
