const SinceInput = ({ value, onChange, label = "Since when?" }) => {
  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder="e.g. January 2024"
        className="w-full p-1 border rounded indent-1"
      />
    </div>
  );
};

export default SinceInput;
