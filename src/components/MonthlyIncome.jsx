import React, { useEffect } from "react";

export default function MonthlyIncome({ incomeData, setTotalIncome }) {
  let totalWages =
    (Number(incomeData?.wages?.salary) || 0) +
    (Number(incomeData?.wages?.partnerSalary) || 0) +
    (Number(incomeData?.wages?.clientEarnings) || 0) +
    (Number(incomeData?.wages?.partnerEarnings) || 0);

  let totalBenefits =
    (Number(incomeData?.benefits?.universalCredit) || 0) +
    (Number(incomeData?.benefits?.jobseekersAllowanceIncome) || 0) +
    (Number(incomeData?.benefits?.jobseekersAllowanceContribution) || 0) +
    (Number(incomeData?.benefits?.incomeSupport) || 0) +
    (Number(incomeData?.benefits?.workingTaxCredit) || 0) +
    (Number(incomeData?.benefits?.childTaxCredit) || 0) +
    (Number(incomeData?.benefits?.childBenefit) || 0) +
    (Number(incomeData?.benefits?.esaOrSsp) || 0) +
    (Number(incomeData?.benefits?.disabilityBenefits) || 0) +
    (Number(incomeData?.benefits?.carersAllowance) || 0) +
    (Number(incomeData?.benefits?.housingAllowance) || 0) +
    (Number(incomeData?.benefits?.councilTaxSupport) || 0) +
    (Number(incomeData?.benefits?.otherBenefits) || 0);

  let totalPensions =
    (Number(incomeData?.pensions?.statePension) || 0) +
    (Number(incomeData?.pensions?.privatePension) || 0) +
    (Number(incomeData?.pensions?.pensionCredit) || 0) +
    (Number(incomeData?.pensions?.otherPensions) || 0);

  let totalOtherIncome =
    (Number(incomeData?.other?.maintenance) || 0) +
    (Number(incomeData?.other?.boarders) || 0) +
    (Number(incomeData?.other?.nonDependants) || 0) +
    (Number(incomeData?.other?.studentLoan) || 0);

  const totalIncome =
    totalBenefits + totalPensions + totalOtherIncome + totalWages;

  useEffect(() => {
    setTotalIncome(totalIncome);
  }, [totalIncome]);

  return (
    <div className="mb-5">
      <h4 className="text-xl font-semibold mb-4">Monthly Income</h4>
      {/* Wages */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Earnings</th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Salary or wages (take home)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.wages?.salary.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Partner salary or wages (take home)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.wages?.partnerSalary.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Client's other earnings (including self-employment)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.wages?.clientEarnings.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Partner's Other earnings (including self-employment)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.wages?.partnerEarnings.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total salary and wages per month
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalWages.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/* Benefits and tax credits */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Benefits and tax credits
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Universal Credit </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.universalCredit.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Jobseeker's Allowance (income based)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.jobseekersAllowanceIncome.toFixed(2) ??
                "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Jobseeker's Allowance (contribution based)
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.jobseekersAllowanceContribution.toFixed(
                2
              ) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Income Support</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.incomeSupport.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">
              Working Tax Credit
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.workingTaxCredit.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">Child Tax Credit</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.childTaxCredit.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">Child benefit</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.childBenefit.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">
              Employment and Support
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {/* {incomeData?.benefits?.esaOrSsp.toFixed(2) ?? "0.00"} */}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">
              Allowance or Statutory Sick Pay
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.esaOrSsp.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">
              Disability benefits
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.disabilityBenefits.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">Carer's Allowance</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.carersAllowance.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">
              Local Housing Allowance / Housing Benefit
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.housingAllowance.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b ">
              Council Tax Support
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.councilTaxSupport.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Other Benefits/tax credits
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.benefits?.otherBenefits.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total benefits and tax credits per month
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalBenefits.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/* Pensions */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Pensions</th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Amount (£)
            </th>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">State Pensions</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.pensions?.statePension.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Private or work pensions
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.pensions?.privatePension.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Pension Credit</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.pensions?.pensionCredit.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Other Pensions</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.pensions?.otherPensions.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total pensions per month
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalPensions.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>

      {/* Other Income */}
      <table className="mb-10">
        <thead>
          <tr>
            <th className="text-left pe-10 md:pe-40 py-2 border-b">
              Other Income
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
              Maintenance or child support
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.other?.maintenance.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Boarders or lodgers
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.other?.boarders.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">
              Non-dependants' contributions
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.other?.nonDependants.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b">Student Loan</td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {incomeData?.other?.studentLoan.toFixed(2) ?? "0.00"}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
          <tr>
            <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
              Total other income per month
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b">
              {totalOtherIncome.toFixed(2)}
            </td>
            <td className="pe-10 md:pe-40 py-2 border-b"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
