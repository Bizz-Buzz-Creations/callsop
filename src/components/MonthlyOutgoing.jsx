import React, { useEffect } from "react";

export default function MonthlyOutgoing({ expenseData, setTotalExpense }) {
  let totalHomeExpenses =
    (Number(expenseData?.homeAndContents?.rent) || 0) +
    (Number(expenseData?.homeAndContents?.groundRent) || 0) +
    (Number(expenseData?.homeAndContents?.mortgage) || 0) +
    (Number(expenseData?.homeAndContents?.mortgageEndowment) || 0) +
    (Number(expenseData?.homeAndContents?.securedLoans) || 0) +
    (Number(expenseData?.homeAndContents?.councilTax) || 0) +
    (Number(expenseData?.homeAndContents?.applianceRental) || 0) +
    (Number(expenseData?.homeAndContents?.tvLicence) || 0) +
    (Number(expenseData?.homeAndContents?.otherCosts) || 0);

  let totalWaterExpenses =
    (Number(expenseData?.water?.waterSupply) || 0) +
    (Number(expenseData?.water?.waterWaste) || 0);

  let totalTransport =
    (Number(expenseData?.transportAndTravel?.carInsurance) || 0) +
    (Number(expenseData?.transportAndTravel?.roadTax) || 0) +
    (Number(expenseData?.transportAndTravel?.motMaintenance) || 0) +
    (Number(expenseData?.transportAndTravel?.breakdownCover) || 0) +
    (Number(expenseData?.transportAndTravel?.fuelParkingTolls) || 0) +
    (Number(expenseData?.transportAndTravel?.otherCosts) || 0) +
    (Number(expenseData?.transportAndTravel?.publicTransport) || 0) +
    (Number(expenseData?.transportAndTravel?.hirePurchase) || 0);

  let totalPensions =
    (Number(expenseData?.pensionsAndInsurances?.pensionPayments) || 0) +
    (Number(expenseData?.pensionsAndInsurances?.lifeInsurance) || 0) +
    (Number(expenseData?.pensionsAndInsurances?.mortgageProtectionInsurance) ||
      0) +
    (Number(expenseData?.pensionsAndInsurances?.buildingsInsurance) || 0) +
    (Number(expenseData?.pensionsAndInsurances?.healthInsurance) || 0) +
    (Number(expenseData?.pensionsAndInsurances?.otherCosts) || 0);

  let totalCareAndHealth =
    (Number(expenseData?.careAndHealthCosts?.childcareCosts) || 0) +
    (Number(expenseData?.careAndHealthCosts?.adultCareCosts) || 0) +
    (Number(expenseData?.careAndHealthCosts?.childMaintenance) || 0) +
    (Number(expenseData?.careAndHealthCosts?.prescriptions) || 0) +
    (Number(expenseData?.careAndHealthCosts?.dentalOptical) || 0) +
    (Number(expenseData?.careAndHealthCosts?.otherCosts) || 0);

  let totalCommunicationsAndLeisure =
    (Number(expenseData?.communicationsAndLeisure?.phoneInternetTV) || 0) +
    (Number(expenseData?.communicationsAndLeisure?.mobilePhone) || 0) +
    (Number(expenseData?.communicationsAndLeisure?.hobbies) || 0);

  let totalFoodAndHousekeeping =
    (Number(expenseData?.foodAndHousekeeping?.groceries) || 0) +
    (Number(expenseData?.foodAndHousekeeping?.babyItems) || 0) +
    (Number(expenseData?.foodAndHousekeeping?.smokingProducts) || 0);

  let totalPersonalCosts =
    (Number(expenseData?.personalCosts?.clothingFootwear) || 0) +
    (Number(expenseData?.personalCosts?.hairdressing) || 0) +
    (Number(expenseData?.personalCosts?.toiletries) || 0);

  let totalOutgoings =
    totalHomeExpenses +
    totalWaterExpenses +
    totalTransport +
    totalPensions +
    totalCareAndHealth +
    totalCommunicationsAndLeisure +
    totalFoodAndHousekeeping +
    totalPersonalCosts;

  useEffect(() => {
    setTotalExpense(totalOutgoings);
  }, [totalOutgoings]);

  return (
    <div className="mb-5">
      <h4 className="text-xl font-semibold mb-4">
        Monthly Outgoings: Fixed Costs
      </h4>
      {/* Home and contents */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Home and contents
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Rent </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.rent.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Ground rent & service charges (factor fees if you live in
              Scotland)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.groundRent.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Mortgage </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.mortgage.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Mortgage endowment</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.mortgageEndowment.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Secured loans</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.securedLoans.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Council tax/rates (including water charge if you live in Scotland
              and rates)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.councilTax.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Appliance & furniture rental (including appliance and furniture
              HP, conditi)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.applianceRental.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">TV licence</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.tvLicence.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Other costs</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.homeAndContents?.otherCosts.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total Home and contents
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalHomeExpenses.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/* Water */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Water</th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Water supply </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.water?.waterSupply.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Water waste</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.water?.waterWaste.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>

          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total Water
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalWaterExpenses.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/* Transport and travel */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Transport and travel
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Public transport (e.g. work, school, shopping)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.transportAndTravel?.publicTransport.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Hire purchase or conditional sale vehicle
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.transportAndTravel?.hirePurchase.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Car insurance</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.transportAndTravel?.carInsurance.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Road tax</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.transportAndTravel?.roadTax.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              MOT and ongoing maintenance
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.transportAndTravel?.motMaintenance.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Breakdown cover</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.transportAndTravel?.breakdownCover.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Fuel, parking and toll road charges
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.transportAndTravel?.fuelParkingTolls.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Other costs (including taxis)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.transportAndTravel?.otherCosts.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total Transport and travel
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalTransport.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/* Pensions and insurances */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Pensions and insurances
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Pension payments</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.pensionsAndInsurances?.pensionPayments.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Life insurance </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.pensionsAndInsurances?.lifeInsurance.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Mortgage payment protection insurance
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.pensionsAndInsurances?.mortgageProtectionInsurance.toFixed(
                2
              ) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Buildings and contents insurance
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.pensionsAndInsurances?.buildingsInsurance.toFixed(
                2
              ) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Health insurance (medical or accident or dental)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.pensionsAndInsurances?.healthInsurance.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Other costs</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.pensionsAndInsurances?.otherCosts.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total Pensions and insurances
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalPensions.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/* Care and health costs */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Care and health costs
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Child-care costs</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.careAndHealthCosts?.childcareCosts.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Adult-care costs</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.careAndHealthCosts?.adultCareCosts.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Child maintenance or child support
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.careAndHealthCosts?.childMaintenance.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Prescriptions </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.careAndHealthCosts?.prescriptions.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Dentistry and opticians
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.careAndHealthCosts?.dentalOptical.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Other costs</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.careAndHealthCosts?.otherCosts.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total Pensions and insurances
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalCareAndHealth.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      <h4 className="text-xl font-semibold mb-4">
        Monthly Outgoings: Flexible Costs
      </h4>

      {/* Care and health costs */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Communications and leisure
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Home phone, internet, TV package (including film subscriptions)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.communicationsAndLeisure?.phoneInternetTV.toFixed(
                2
              ) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Mobile phone</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.communicationsAndLeisure?.mobilePhone.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Hobbies, leisure or sport (e.g. socialising, eating out, outings,
              clubs, leisure activities)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.communicationsAndLeisure?.hobbies.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-6 border-b font-semibold">
              Total Communications and leisure
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalCommunicationsAndLeisure.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/* Food and housekeeping */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Food and housekeeping
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Groceries (e.g. food, pet food, non-alcoholic drinks, cleaning)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.foodAndHousekeeping?.groceries.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Nappies and baby items
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.foodAndHousekeeping?.babyItems.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Smoking products</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.foodAndHousekeeping?.smokingProducts.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total Food and housekeeping
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalFoodAndHousekeeping.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/*Personal costs*/}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Personal costs
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Clothing and footwear
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.personalCosts?.clothingFootwear.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Hairdressing </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.personalCosts?.hairdressing.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Toiletries</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {expenseData?.personalCosts?.toiletries.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total Personal costs
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalPersonalCosts.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      <h4 className="text-xl font-semibold mb-4 border-b pb-2">
        Total Monthly Outgoings: (fixed and flexible)
      </h4>

      <h4 className="text-xl text-right font-semibold mb-4 border-b pb-2">
        Total costs per month
      </h4>
      <h4 className="text-xl font-semibold mb-4 border-b pb-2">Savings </h4>
      <p className="text-center border-b pb-2 mb-4">
        Please confirm that a monthly contribution to savings has been
        considered (or discussed with an adviser)
      </p>
      <h4 className="text-xl font-semibold mb-4 border-b pb-2">
        Debt Admin Fee (if applicable)
      </h4>
      <h4 className="text-xl text-right font-semibold mb-4 border-b pb-2">
        Total fee per month
      </h4>
    </div>
  );
}
