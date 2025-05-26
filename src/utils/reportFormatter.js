export function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "£0.00";
  return `£${num.toFixed(2)}`;
}

export function generateReportFromLocalStorage() {
  const data = JSON.parse(localStorage.getItem('sopFormData'));
  if (!data) return 'No data found in localStorage.';

  const lines = [];
  lines.push("DEBTS LEVEL");

  const debtSections = [
    "loan", "creditCard", "storeCard", "catalog", "gas", "electric", "water",
    "mobileContact", "others", "overPayment", "advancePayment", "ccj", "hrms"
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
        lines.push(`- ${item.name} – ${formatCurrency(amount)} – ${formatCurrency(payment)}/month`);
      });
    }
  });
  lines.push("");

  // lines.push(`\n**Total Debt:** ${formatCurrency(totalDebt)}`);
  // lines.push(`**Total Payment:** ${formatCurrency(totalPayment)}/month\n`);

  lines.push("RENTAL DETAILS");
  if (data.rentalDetails) {
    Object.entries(data.rentalDetails).forEach(([key, value]) => {
      lines.push(`- ${capitalize(key)} – ${formatCurrency(value)}/month`);
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
  Object.entries(data.employmentInfo || {}).forEach(([key, value]) => {
    if (key.startsWith("individual") && parseFloat(value) > 0) {
      const label = labelFromKey(key, "individual");
      lines.push(`- ${label} – ${formatCurrency(value)}/month`);
    }
  });

  lines.push("");

  lines.push("Partner");
  Object.entries(data.employmentInfo || {}).forEach(([key, value]) => {
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
