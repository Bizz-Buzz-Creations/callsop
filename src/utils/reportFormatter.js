export function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "£0.00";
  return `£${num.toFixed(2)}`;
}

export function generateReportFromLocalStorage() {
  const data = JSON.parse(localStorage.getItem('sopFormData'));
  if (!data) return 'No data found in localStorage.';

  const lines = [];

  const userInfo = [
    "customerName", "address", "postcode", "contactNumber", "emailAddress", "dob"
  ];

  if (data.userDetails) {
    userInfo.forEach((key) => {
      const value = data.userDetails[key];
      if (value !== undefined && value !== "") {
        lines.push(`${value}`);
      }
    });
  }
  lines.push("");

  lines.push("DEBTS LEVEL");

  const overallDebt = parseFloat(data.debtConfirmation?.debt || 0);
  const overallPayment = parseFloat(data.debtConfirmation?.payment || 0);
  const delaySince = data.debtConfirmation?.delaySince;
  // const handlingMethod = data.debtConfirmation?.handlingMethod;
  // const companyType = data.debtConfirmation?.companyType;
  const badge = data.debtConfirmation?.badge;

  if (overallDebt > 0 || overallPayment > 0 || badge === "Falling Behind" || badge === "Token Payment") {
    lines.push(`${formatCurrency(overallDebt)} - ${formatCurrency(overallPayment)}/month ${overallPayment <= 10 ? `(Since ${delaySince === "" ? `when?` : `${delaySince}`})` : ''}`);
    // if (badge) {
    //   lines.push(badge);
    // }
  }

  // if (handlingMethod === "myself") {
  //   lines.push(`${handlingMethod}`)
  // } else {
  //   lines.push(`${handlingMethod} - ${companyType}`)
  // }

  const debtSections = [
    "loan", "creditCard", "storeCard", "catalog", "gas", "electric", "water",
    "mobileContact", "others", "overPayment", "advancePayment", "ccj", "hmrc", "councilTax"
  ];

  let totalDebt = 0;
  let totalPayment = 0;

  debtSections.forEach((key) => {
    const section = data.debtConfirmation?.[key];
    if (Array.isArray(section)) {
      section.forEach((item) => {
        const amount = parseFloat(item.amount || 0);
        const payment = parseFloat(item.payment || 0);
        totalDebt += amount;
        totalPayment += payment;

        const displayName = item.name === "Other" ? item.customName : item.name;
        const baseLine = `- ${displayName} – ${formatCurrency(amount)} – ${formatCurrency(payment)}/month`;

        // Add arrear note for specific keys
        const needsArrearInfo = ["gas", "electric", "water", "mobileContact", "councilTax"].includes(key);
        const arrearInfo = needsArrearInfo && item.arrear
          ? ` (${item.arrear === "current" ? "Current Year" : "Previous Year"})`
          : "";

        lines.push(baseLine + arrearInfo);
        // lines.push(`- ${item.name} – ${formatCurrency(amount)} – ${formatCurrency(payment)}/month`);
      });
    }
  });
  lines.push("");

  // lines.push(`\n**Total Debt:** ${formatCurrency(totalDebt)}`);
  // lines.push(`**Total Payment:** ${formatCurrency(totalPayment)}/month\n`);

  lines.push("RENTAL DETAILS");
  const rentalOrder = ["mortgage", "mortgagePay", "cpv", "private", "privateRent", "council", "councilRent"];

  if (data.rentalDetails) {
    rentalOrder.forEach((key) => {
      const value = data.rentalDetails[key];
      if (value !== undefined && value !== "") {
        if (key === "mortgage" || key === "cpv") {
          lines.push(`- ${capitalize(key)} – ${value}`);
        } else {
          lines.push(`- ${capitalize(key)} – ${formatCurrency(value)}/month`);
        }
      }
    });
  }

  lines.push("");

  lines.push("MARITAL STATUS");
  const status = data.maritalStatus?.status || "Unknown";
  lines.push(`- Status – ${status}`);
  if (data.maritalStatus?.haveKids === "yes") {
    lines.push(`- Kids – ${data.maritalStatus.kidsCount} (${data.maritalStatus.kidsAges})`);
  } else {
    lines.push(`- Kids – No`);
  }
  lines.push("");

  lines.push("INCOME\n");

  lines.push("Individual");
  Object.entries(data.employementInfo || {}).forEach(([key, value]) => {
    if (key.startsWith("individual") && parseFloat(value) > 0) {
      const label = labelFromKey(key, "individual");
      lines.push(`- ${label} – ${formatCurrency(value)}/month`);
    }
  });

  lines.push("");

  lines.push("Partner");
  Object.entries(data.employementInfo || {}).forEach(([key, value]) => {
    if (key.startsWith("partner") && parseFloat(value) > 0) {
      const label = labelFromKey(key, "partner");
      lines.push(`- ${label} – ${formatCurrency(value)}/month`);
    }
  });

  return lines.join("\n");
}

// function labelFromKey(key, prefix) {
//   return key.replace(prefix, "").replace(/([A-Z])/g, " $1").trim();
// }

// function capitalize(str) {
//   return str.charAt(0).toUpperCase() + str.slice(1);
// }


function labelFromKey(key, prefix) {
  const cleanedKey = key.replace(prefix, "");
  const withSpaces = cleanedKey.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return withSpaces.trim();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
