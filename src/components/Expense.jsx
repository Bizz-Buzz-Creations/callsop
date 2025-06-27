import { useState, useEffect } from "react";

const Expense = ({ setTotalExpenses, setExpensesData }) => {
  const [expensesData, setExpensesDataLocal] = useState({
    homeAndContents: {
      rent: 0,
      groundRent: 0,
      mortgage: 0,
      mortgageEndowment: 0,
      securedLoans: 0,
      councilTax: 0,
      applianceRental: 0,
      tvLicence: 0,
      otherCosts: 0,
    },
    utilities: {
      electricity: 0,
      gas: 0,
      otherCosts: 0,
      otherExpenditure: 0,
    },
    water: {
      waterSupply: 0,
      waterWaste: 0,
    },
    communicationsAndLeisure: {
      phoneInternetTV: 0,
      mobilePhone: 0,
      hobbies: 0,
      gifts: 0,
      pocketMoney: 0,
      newspapers: 0,
      otherCosts: 0,
    },
    transportAndTravel: {
      publicTransport: 0,
      hirePurchase: 0,
      carInsurance: 0,
      roadTax: 0,
      motMaintenance: 0,
      breakdownCover: 0,
      fuelParkingTolls: 0,
      otherCosts: 0,
    },
    foodAndHousekeeping: {
      groceries: 0,
      babyItems: 0,
      schoolMeals: 0,
      laundry: 0,
      alcohol: 0,
      smokingProducts: 0,
      vetBills: 0,
      houseRepairs: 0,
      otherCosts: 0,
    },
    pensionsAndInsurances: {
      pensionPayments: 0,
      lifeInsurance: 0,
      mortgageProtectionInsurance: 0,
      buildingsInsurance: 0,
      healthInsurance: 0,
      otherCosts: 0,
    },
    personalCosts: {
      clothingFootwear: 0,
      hairdressing: 0,
      toiletries: 0,
      otherCosts: 0,
    },
    careAndHealthCosts: {
      childcareCosts: 0,
      adultCareCosts: 0,
      childMaintenance: 0,
      prescriptions: 0,
      dentalOptical: 0,
      otherCosts: 0,
    },
    schoolCosts: {
      schoolUniform: 0,
      afterSchoolClubs: 0,
      otherCosts: 0,
    },
    professionalCosts: {
      professionalCourses: 0,
      unionFees: 0,
      professionalFees: 0,
      other: 0,
    },
    savings: {
      monthlySaving: 0,
    },
    otherEssentialCosts: {
      otherCosts: 0,
      taxNationalInsurance: 0,
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const keys = name.split(".");

    setExpensesDataLocal((prevData) => {
      const newData = { ...prevData }; // Correctly define newData here
      if (keys.length === 2) {
        newData[keys[0]][keys[1]] = Number(value);
      }
      setExpensesData(newData); // Update parent state with newData
      return newData;
    });
  };

  const totalExpenses = Object.values(expensesData).reduce((acc, category) => {
    return acc + Object.values(category).reduce((catAcc, val) => catAcc + val, 0);
  }, 0);

  useEffect(() => {
    setTotalExpenses(totalExpenses);
  }, [totalExpenses, setTotalExpenses]);

  return (
    <div className="max-w-5xl mx-auto relative mt-6 bg-white rounded-lg shadow-md p-6">
      <h3 className="sticky top-0 z-10 text-center bg-[#0dcaf0] text-white py-3 mb-6 rounded font-semibold text-2xl">
        Expenses Calculator
      </h3>

      <div className="space-y-6">
        {[
          "homeAndContents",
          "utilities",
          "water",
          "communicationsAndLeisure",
          "transportAndTravel",
          "foodAndHousekeeping",
          "pensionsAndInsurances",
          "personalCosts",
          "careAndHealthCosts",
          "schoolCosts",
          "professionalCosts",
          "savings",
          "otherEssentialCosts",
        ].map((section) => (
          <div key={section}>
            <h4 className="text-xl font-semibold text-gray-700 mb-4 capitalize border-b pb-1">
              {section.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(expensesData[section]).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    {key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^([a-z])/i, (match) => match.toUpperCase())
                      .trim()}
                  </label>
                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                    <span className="px-3 py-2 bg-gray-100 text-gray-600 text-sm">£</span>
                    <input
                      type="number"
                      className="w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      name={`${section}.${key}`}
                      value={value}
                      onChange={handleChange}
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

export default Expense;