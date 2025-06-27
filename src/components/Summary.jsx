const Summary = ({ totalIncome, totalExpenses }) => {
  const balance = totalIncome - totalExpenses;

  return (
    <div className="w-full flex flex-col md:flex-row justify-center gap-4 fixed bottom-0 bg-white py-4 px-2 shadow-md z-50">
      <div className="flex-1 bg-[#198754] text-white text-center py-4 px-2 rounded-lg text-xl font-semibold">
        Total Household Income:
        <br />
        £{totalIncome.toFixed(2)}
      </div>
      <div className="flex-1 bg-[#dc3545] text-white text-center py-4 px-2 rounded-lg text-xl font-semibold">
        Total Expenditure:
        <br />
        £{totalExpenses.toFixed(2)}
      </div>
      <div className="flex-1 bg-[#0dcaf0] text-white text-center py-4 px-2 rounded-lg text-xl font-semibold">
        Total Balance:
        <br />
        £{balance.toFixed(2)}
      </div>
    </div>
  );
};

export default Summary;
