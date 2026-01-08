import React, { useRef, useState } from "react";
import MonthlyIncome from "./monthlyIncome";
import MonthlyOutgoing from "./MonthlyOutgoing";
import html2pdf from "html2pdf.js";

export default function ClculatorPdf({ incomeData, expensesData, userData }) {
  const [isOpen, setIsOpen] = useState(false);
  const printRef = useRef();
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const balance = totalIncome - totalExpense;

  const handleDownloadPdf = () => {
    if (!printRef.current) return;

    html2pdf()
      .set({
        margin: 10,
        filename: "report.pdf",
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        html2canvas: {
          scale: 2,
          useCORS: true,

          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll("*").forEach((el) => {
              const style = getComputedStyle(el);

              if (style.color?.includes("oklch")) {
                el.style.color = "rgb(0,0,0)";
              }

              if (style.backgroundColor?.includes("oklch")) {
                el.style.backgroundColor = "rgb(255,255,255)";
              }

              if (style.borderColor?.includes("oklch")) {
                el.style.borderColor = "rgb(0,0,0)";
              }
            });
          },
        },
      })
      .from(printRef.current)
      .save();
  };

  return (
    <div
      className="container max-w-5xl mx-auto border border-gray-300 rounded mt-10 mb-32 p-6 bg-white shadow-md"
      id="comparison"
    >
      <div className="w-full flex justify-end">
        <button
          type="button"
          className="flex justify-between items-center gap-2 mb-8 me-2 bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg text-white cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          Generate Report
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
        </button>
        {isOpen && (
          <button
            type="button"
            className="flex justify-between items-center gap-2 mb-8 bg-green-500 hover:bg-green-600 px-3 py-2 rounded-lg text-white cursor-pointer"
            onClick={handleDownloadPdf}
          >
            Download as PDF
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
          </button>
        )}
      </div>
      <h3 className="text-center text-2xl font-bold mb-6">Summary Report</h3>
      {isOpen && (
        <>
          <div ref={printRef}>
            <div className="mb-5 flex flex-col md:flex-row gap-10">
              {/* General Details */}
              <div className="flex-1">
                <h4 className="text-xl font-semibold mb-4 border-b pb-1">
                  General Details
                </h4>

                <div className="flex flex-col gap-3">
                  {Object.values(userData?.["General Details"] ?? {}).map(
                    (field, index) => (
                      <div
                        key={index}
                        className="flex items-center border-b py-2"
                      >
                        <div className="w-1/2 text-sm font-medium text-gray-700">
                          {field?.label}
                        </div>
                        <div className="w-1/2 text-gray-700 text-sm">
                          <div>{field?.value}</div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Contact Details */}
              <div className="flex-1">
                <h4 className="text-xl font-semibold mb-4 border-b pb-1">
                  Contact Details
                </h4>

                <div className="flex flex-col gap-3">
                  {Object.values(userData?.["Contact Details"] ?? {}).map(
                    (field, index) => (
                      <div
                        key={index}
                        className="flex items-center border-b py-2"
                      >
                        <div className="w-1/2 text-sm font-medium text-gray-700">
                          {field?.label}
                        </div>
                        <div className="w-1/2 text-gray-700 text-sm">
                          <div>{field?.value}</div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div class="page-break"></div>

            {/* Income and Expenditure */}
            <h4 className="text-xl font-semibold mb-4">
              Income and Expenditure
            </h4>
            <div className="mb-5 flex flex-col md:flex-row gap-10">
              <div className="flex-1">
                <div className="flex flex-col gap-3">
                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">Name</div>
                    <div className="w-1/2 text-gray-600">
                      {userData?.["General Details"]?.firstName?.value}
                    </div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">D.O.B</div>
                    <div className="w-1/2 text-gray-400">
                      {userData?.["General Details"]?.dob?.value}
                    </div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Application
                    </div>
                    <div className="w-1/2 text-gray-600">
                      {userData?.["General Details"]?.maritalStatus?.value}
                    </div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Partner
                    </div>
                    <div className="w-1/2 text-gray-400">
                      {userData?.["General Details"]?.partnerName?.value}
                    </div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Partner D.O.B
                    </div>
                    <div className="w-1/2 text-gray-400">
                      {userData?.["General Details"]?.partnerDOB?.value}
                    </div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Address
                    </div>
                    <div className="w-1/2 text-gray-400">
                      {userData?.["Contact Details"]?.address1?.value}
                    </div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Dependent Children
                    </div>
                    <div className="w-1/2 text-gray-600">0</div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Other Dependents
                    </div>
                    <div className="w-1/2 text-gray-600">0</div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Number in Household
                    </div>
                    <div className="w-1/2 text-gray-600">1</div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Number of Vehicles in Household
                    </div>
                    <div className="w-1/2 text-gray-600">0</div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Housing Tenure
                    </div>
                    <div className="w-1/2 text-gray-400"></div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Please confirm you have considered (or discussed with an
                      adviser) the use of any assets to make lump sum payments
                      Tick to confirm
                    </div>
                    <div className="w-1/2 text-gray-600">
                      <input type="checkbox" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex flex-col gap-3">
                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Contact / Team Name
                    </div>
                    <div className="w-1/2 text-gray-400"></div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Company Name
                    </div>
                    <div className="w-1/2 text-gray-400"></div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Agency
                    </div>
                    <div className="w-1/2 text-gray-400"></div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Agency Address
                    </div>
                    <div className="w-1/2 text-gray-600">
                      Company Address, Glasgow, Scotland
                    </div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Membership Code Number
                    </div>
                    <div className="w-1/2 text-gray-400"></div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Case Reference Number
                    </div>
                    <div className="w-1/2 text-gray-600">12269</div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Date of Statement
                    </div>
                    <div className="w-1/2 text-gray-600">06/01/2026</div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Date of Review (if applicable)
                    </div>
                    <div className="w-1/2 text-gray-400"></div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Employment
                    </div>
                    <div className="w-1/2 text-gray-400"></div>
                  </div>

                  <div className="flex border-b py-2">
                    <div className="w-1/2 font-medium text-gray-700">
                      Partner Employment
                    </div>
                    <div className="w-1/2 text-gray-400"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="page-break"></div>

            {/* Money Overview */}
            <div className="mb-5">
              <table>
                <thead>
                  <tr>
                    <th className="text-left pe-10 md:pe-40 py-2 border-b">
                      Overview
                    </th>
                    <th className="text-left pe-10 md:pe-40 py-2 border-b">
                      Amount (£)
                    </th>
                    <th className="text-left pe-10 md:pe-40 py-2 border-b">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="pe-10 md:pe-40 py-2 border-b">
                      Total Income
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b">
                      {totalIncome.toFixed(2)}
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b"></td>
                  </tr>
                  <tr>
                    <td className="pe-10 md:pe-40 py-2 border-b">
                      Total outgoings
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b">
                      {totalExpense.toFixed(2)}
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b"></td>
                  </tr>
                  <tr>
                    <td className="pe-10 md:pe-40 py-2 border-b">
                      (Savings contribution)
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b">0.00</td>
                    <td className="pe-10 md:pe-40 py-2 border-b"></td>
                  </tr>
                  <tr>
                    <td className="pe-10 md:pe-40 py-2 border-b">
                      Debt admin fee (if applicable)
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b"></td>
                    <td className="pe-10 md:pe-40 py-2 border-b"></td>
                  </tr>
                  <tr>
                    <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
                      Total available for priority creditors
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b">
                      {balance < 0 ? balance.toFixed(2) : ""}
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b"></td>
                  </tr>
                  <tr>
                    <td className="pe-10 md:pe-40 py-2 border-b font-semibold">
                      Total available for nonpriority creditors
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b">
                      {balance >= 0 ? balance.toFixed(2) : ""}
                    </td>
                    <td className="pe-10 md:pe-40 py-2 border-b"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Monthly Income */}
            <MonthlyIncome
              incomeData={incomeData}
              setTotalIncome={setTotalIncome}
            />

            {/* Monthly Outgoing */}
            <MonthlyOutgoing
              expenseData={expensesData}
              setTotalExpense={setTotalExpense}
            />

            <div class="page-break"></div>

            <h4 className="text-xl mt-10 font-semibold mb-4">
              Living Arrangements
            </h4>
            <p>Occupancy Status:</p>
            <h4 className="text-xl mt-10 font-semibold mb-4">
              Other members of household:
            </h4>

            <table>
              <thead>
                <tr className=" border-b border-t bg-gray-200">
                  <th className="text-left pe-10 md:pe-40">Name</th>
                  <th className="text-left pe-10 md:pe-40">Relationship</th>
                  <th className="text-left pe-10 md:pe-40">Date of Birth</th>
                  <th className="text-left pe-10 md:pe-40">Dependent?</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b h-5">
                  <td></td>
                </tr>
              </tbody>
            </table>

            <h4 className="text-xl mt-5 font-semibold mb-4">
              Employment Details{" "}
            </h4>

            <div class="page-break"></div>

            <h4 className="text-xl mt-5 font-semibold mb-4">Debts</h4>

            <div class="page-break"></div>

            <h4 className="text-xl mt-5 font-semibold mb-4">
              Financial Summary
            </h4>
            <ul className="md:w-md">
              <li className="mb-2 font-semibold flex justify-between">
                Client’s total debt: <span>£0.00</span>
              </li>
              <li className="mb-2 font-semibold flex justify-between">
                Partner’s total debt: <span>£0.00</span>
              </li>
              <li className="mb-2 font-semibold flex justify-between">
                Total household debt: <span>£0.00</span>
              </li>
              <li className="mb-2 font-semibold flex justify-between">
                Client disposable income: <span>£0.00</span>
              </li>
              <li className="mb-2 font-semibold flex justify-between">
                Household disposable income: <span>£0.00</span>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
