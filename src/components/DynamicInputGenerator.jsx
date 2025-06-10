import { Plus, Minus } from 'lucide-react';
import creditors from '../assets/creditors.json';

const ArrearOptions = ({ index, value, onChange }) => (
  <div className="flex items-center gap-4 mb-4">
    <span className="text-lg font-medium">Arrear</span>
    <div className="flex gap-6">
      {["current", "previous"].map((type) => (
        <label key={type} className="flex items-center gap-2">
          <input
            type="radio"
            name={`arrear-${index}`}
            value={type}
            checked={value === type}
            onChange={(e) => onChange(index, "arrear", e.target.value)}
          />
          {type === "current" ? "Current Year" : "Previous Year"}
        </label>
      ))}
    </div>
  </div>
);

const InputRow = ({ index, input, isGD, isArrear, onChange }) => (
  <div>
    <div className="flex gap-5">
      {isGD || input.name === 'Other' ? (
        input.name === 'Other' && !isGD ? (
          <input
            type="text"
            value={input.customName || ''}
            onChange={(e) => onChange(index, "customName", e.target.value)}
            placeholder="Enter Creditor Name"
            className="border rounded w-full p-1"
          />
        ) : (
          <input
            type="text"
            value={input.name}
            onChange={(e) => onChange(index, "name", e.target.value)}
            placeholder="Enter Creditor Name"
            className="border rounded w-full p-1"
          />
        )
      ) : (
        <select
          value={input.name}
          onChange={(e) => onChange(index, "name", e.target.value)}
          className="border rounded w-full p-1"
        >
          <option value="">Select Creditor</option>
          {creditors.map((cred) => (
            <option key={cred.id} value={cred.creditor}>
              {cred.creditor}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
      )}
      <input
        type="number"
        value={input.amount}
        onChange={(e) => onChange(index, "amount", e.target.value)}
        placeholder="Amount"
        className="border rounded w-full indent-1 p-1"
      />
      <input
        type="number"
        value={input.payment}
        onChange={(e) => onChange(index, "payment", e.target.value)}
        placeholder="Payment"
        className="border rounded w-full indent-1 p-1"
      />
    </div>
    {isArrear && (
      <ArrearOptions
        index={index}
        value={input.arrear}
        onChange={onChange}
      />
    )}
  </div>
);

const DynamicInputGenerator = ({ value = [], onChange, isArrear, isGD }) => {
  const handleChange = (e) => {
    const newLength = parseInt(e.target.value) || 0;
    const newInputs = Array.from({ length: newLength }, (_, i) => value[i] || { name: '', amount: '', payment: '' });
    onChange(newInputs);
  };

  // const handleInputChange = (index, field, fieldValue) => {
  //   const updatedInputs = [...value];
  //   updatedInputs[index] = { ...updatedInputs[index], [field]: fieldValue };
  //   onChange(updatedInputs);
  // };

  const handleInputChange = (index, field, fieldValue) => {
    const updatedInputs = [...value];

    if (field === "name") {
      if (fieldValue === "Other") {
        updatedInputs[index] = {
          ...updatedInputs[index],
          name: "Other",
          customName: ""
        };
      } else {
        updatedInputs[index] = {
          ...updatedInputs[index],
          name: fieldValue,
          customName: "" // clear custom if not "Other"
        };
      }
    } else {
      updatedInputs[index] = {
        ...updatedInputs[index],
        [field]: fieldValue
      };
    }

    onChange(updatedInputs);
  };

  const handleIncrement = () => {
    onChange([...value, { name: '', amount: '', payment: '' }]);
  };

  const handleDecrement = () => {
    if (value.length > 0) {
      const confirmRemove = window.confirm("⚠️ Warning:\nAre you sure you want to remove the input field?\n\nYou may lose the entered data.");
      if (confirmRemove) {
        onChange(value.slice(0, value.length - 1));
      }
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          id="numberInput"
          type="number"
          min="0"
          value={value.length}
          onChange={handleChange}
          placeholder="Enter number of inputs"
          className="border rounded indent-2"
        />
        <button
          onClick={handleIncrement}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full"
        >
          <Plus width={16} height={16} />
        </button>
        <button
          onClick={handleDecrement}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full"
        >
          <Minus width={16} height={16} />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {value.map((input, index) => (
          <InputRow
            key={index}
            index={index}
            input={input}
            isGD={isGD}
            isArrear={isArrear}
            onChange={handleInputChange}
          />
        ))}
      </div>
    </div>
  );
};

export default DynamicInputGenerator;
