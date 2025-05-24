import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const DynamicInputGenerator = () => {
  const [number, setNumber] = useState(0);
  const [inputs, setInputs] = useState([]);

  const handleChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setNumber(value);

    // Create an array of empty strings of length `value`
    const newInputs = Array(value).fill('');
    setInputs(newInputs);
  };

  const handleInputChange = (index, value) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  const handleIncrement = () => {
    const newNumber = number + 1;
    setNumber(newNumber);
    setInputs(Array(newNumber).fill(''));
  };

  const handleDecrement = () => {
    if (number > 0) {
      const confirmRemove = window.confirm("⚠️ Warning:\nAre you sure you want to remove the input field?\n\nYou may lose the entered data.");
      if (confirmRemove) {
        const newNumber = number - 1;
        setNumber(newNumber);
        setInputs(Array(newNumber).fill(''));
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
          className="bg-indigo-600 hover:hover:bg-indigo-700 text-white p-2 rounded-full"
        ><Plus width={16} height={16} /></button>
        <button
          onClick={handleDecrement}
          className="bg-indigo-600 hover:hover:bg-indigo-700 text-white p-2 rounded-full"
        ><Minus width={16} height={16} /></button>
      </div>

      <div className="mt-4 space-y-2">
        {inputs.map((input, index) => (
          <div key={index} className='flex gap-5'>
            <input
              type="text"
              value={input}
              onChange={(e) => handleInputChange(index, e.target.value)}
              placeholder={`Name`}
              className="border rounded w-full indent-1 p-1"
            />
            <input
              type="number"
              value={input}
              onChange={(e) => handleInputChange(index, e.target.value)}
              placeholder={`Amount`}
              className="border rounded w-full indent-1 p-1"
            />
            <input
              type="number"
              value={input}
              onChange={(e) => handleInputChange(index, e.target.value)}
              placeholder={`Payment`}
              className="border rounded w-full indent-1 p-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicInputGenerator;
