const Comparison = ({ incomeData, expensesData, totalIncome, totalExpenses }) => {
  const balance = totalIncome - totalExpenses;

  // Function to filter out entries with zero values
  const filterNonZeroEntries = (data) => {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => { 
        const filteredValues = Object.entries(value).filter(([_, val]) => val > 0);
        return [key, Object.fromEntries(filteredValues)];
      }).filter(([_, value]) => Object.keys(value).length > 0) // Filter out empty sections
    );
  };

  const filteredIncome = filterNonZeroEntries(incomeData);
  const filteredExpenses = filterNonZeroEntries(expensesData);

  return (
    <div className="container max-w-5xl mx-auto border border-gray-300 rounded mt-10 mb-32 p-6 bg-white shadow-md" id="comparison">
      <h3 className="text-center text-2xl font-bold mb-6">Comparison</h3>

      {/* Income Table */}
      <h4 className="text-lg font-semibold mb-2">Income Data:</h4>
      <table className="min-w-full border border-gray-300 mb-8 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2 text-left">Category</th>
            <th className="border px-4 py-2 text-left">Item</th>
            <th className="border px-4 py-2 text-left">Value (£)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(filteredIncome).map(([category, values]) =>
            Object.entries(values).map(([key, value], idx) => (
              <tr key={`${category}-${key}`} className="even:bg-gray-50">
                {idx === 0 && (
                  <td rowSpan={Object.keys(values).length} className="border px-4 py-2 font-medium align-top">
                    {category.charAt(0).toUpperCase() + category.slice(1)} -
                  </td>
                )}
                <td className="border px-4 py-2">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </td>
                <td className="border px-4 py-2">£{value.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Expenses Table */}
      <h4 className="text-lg font-semibold mb-2">Expenses Data:</h4>
      <table className="min-w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2 text-left">Category</th>
            <th className="border px-4 py-2 text-left">Item</th>
            <th className="border px-4 py-2 text-left">Value (£)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(filteredExpenses).map(([category, values]) =>
            Object.entries(values).map(([key, value], idx) => (
              <tr key={`${category}-${key}`} className="even:bg-gray-50">
                {idx === 0 && (
                  <td rowSpan={Object.keys(values).length} className="border px-4 py-2 font-medium align-top">
                    {category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} -
                  </td>
                )}
                <td className="border px-4 py-2">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </td>
                <td className="border px-4 py-2">£{value.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex flex-col md:flex-row justify-evenly text-center mt-6 gap-4">
        <h5 className="text-[#198754] text-lg font-semibold">Total Income: £{totalIncome.toFixed(2)}</h5>
        <h5 className="text-[#dc3545] text-lg font-semibold">Total Expenses: £{totalExpenses.toFixed(2)}</h5>
        <h5 className="text-[#0dcaf0] text-lg font-semibold">Total Balance: £{balance.toFixed(2)}</h5>
      </div>
    </div>
  );
};

export default Comparison;