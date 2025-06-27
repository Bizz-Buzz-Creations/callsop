import { useState, useEffect } from 'react';

const Income = ({ setTotalIncome, setIncomeData }) => {
  const [incomeData, setIncomeDataLocal] = useState({
    wages: { salary: 0, partnerSalary: 0, clientEarnings: 0, partnerEarnings: 0 },
    benefits: {
      universalCredit: 0,
      jobseekersAllowanceIncome: 0,
      jobseekersAllowanceContribution: 0,
      incomeSupport: 0,
      workingTaxCredit: 0,
      childTaxCredit: 0,
      childBenefit: 0,
      esaOrSsp: 0,
      disabilityBenefits: 0,
      carersAllowance: 0,
      housingAllowance: 0,
      councilTaxSupport: 0,
      otherBenefits: 0,
    },
    pensions: { statePension: 0, privatePension: 0, pensionCredit: 0, otherPensions: 0 },
    other: { maintenance: 0, boarders: 0, nonDependants: 0, studentLoan: 0 },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const keys = name.split('.');

    setIncomeDataLocal((prevData) => {
      const newData = { ...prevData };
      if (keys.length === 2) {
        newData[keys[0]][keys[1]] = Number(value);
      }
      setIncomeData(newData);
      return newData;
    });
  };

  const totalIncome = Object.values(incomeData).reduce((acc, category) => {
    return acc + Object.values(category).reduce((catAcc, val) => catAcc + val, 0);
  }, 0);

  useEffect(() => {
    setTotalIncome(totalIncome);
  }, [totalIncome, setTotalIncome]);

  return (
    <div className="max-w-5xl mx-auto relative mt-6 bg-white rounded-lg shadow-md p-6">
      <h3 className="sticky top-0 z-10 text-center bg-[#0dcaf0] text-white py-3 mb-6 rounded font-semibold text-2xl">
        Income Calculator
      </h3>
      <div className="space-y-6">
        {['wages', 'benefits', 'pensions', 'other'].map((section) => (
          <div key={section}>
            <h4 className="text-xl font-semibold text-gray-700 mb-4 capitalize border-b pb-1">
              {section}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(incomeData[section]).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (match) => match.toUpperCase())}
                  </label>
                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                    <span className="px-3 py-2 font-semibold bg-gray-100 text-gray-600 text-sm h-full">£</span>
                    <input
                      type="number"
                      name={`${section}.${key}`}
                      value={value}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Income;
