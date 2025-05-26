import { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';

const DynamicInputGenerator = ({ value = [], onChange }) => {
  const [number, setNumber] = useState(0);
  // Each input row is an object: { name: '', amount: '', payment: '' }
  const [inputs, setInputs] = useState(value);

  useEffect(() => {
    onChange && onChange(inputs);
  }, [inputs]);

  const handleChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setNumber(value);

    // Create an array of empty objects of length `value`
    const newInputs = Array.from({ length: value }, (_, i) => inputs[i] || { name: '', amount: '', payment: '' });
    setInputs(newInputs);
  };

  const handleInputChange = (index, field, value) => {
    const newInputs = [...inputs];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setInputs(newInputs);
  };

  const handleIncrement = () => {
    const newNumber = number + 1;
    setNumber(newNumber);
    setInputs([...inputs, { name: '', amount: '', payment: '' }]);
  };

  const handleDecrement = () => {
    if (number > 0) {
      const confirmRemove = window.confirm("⚠️ Warning:\nAre you sure you want to remove the input field?\n\nYou may lose the entered data.");
      if (confirmRemove) {
        const newNumber = number - 1;
        setNumber(newNumber);
        setInputs(inputs.slice(0, newNumber));
      }
      // If not confirmed, do nothing
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          id="numberInput"
          type="number"
          min="0"
          value={number}
          onChange={handleChange}
          placeholder="Enter number of inputs"
          className="border rounded indent-2"
        />
        <button
          onClick={handleIncrement}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full"
        ><Plus width={16} height={16} /></button>
        <button
          onClick={handleDecrement}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full"
        ><Minus width={16} height={16} /></button>
      </div>

      <div className="mt-4 space-y-2">
        {inputs.map((input, index) => (
          <div key={index} className='flex gap-5'>
            <input
              type="text"
              value={input.name}
              onChange={(e) => handleInputChange(index, 'name', e.target.value)}
              placeholder="Name"
              className="border rounded w-full indent-1 p-1"
            />
            <input
              type="number"
              value={input.amount}
              onChange={(e) => handleInputChange(index, 'amount', e.target.value)}
              placeholder="Amount"
              className="border rounded w-full indent-1 p-1"
            />
            <input
              type="number"
              value={input.payment}
              onChange={(e) => handleInputChange(index, 'payment', e.target.value)}
              placeholder="Payment"
              className="border rounded w-full indent-1 p-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicInputGenerator;
