import LabeledInputGroup from "./LabeledInputGroup";
import FallingBehind from "./FallingBehind";
import HighPayment from "./HighPayment";
import LowPayment from "./LowPayment";
import TokenPayment from "./TokenPayement";

const getBadge = (payment) => {
  if (payment === 0) return "Falling Behind";
  if (payment >= 1 && payment <= 10) return "Token Payment";
  if (payment >= 11 && payment <= 150) return "Low Payment";
  if (payment >= 151 && payment <= 300) return "Normal Payment";
  if (payment >= 301) return "High Payment";
  return "";
};

const getBadgeClass = (badge) => {
  switch (badge) {
    case "High Payment":
      return "bg-green-600 text-white";
    case "Normal Payment":
      return "bg-blue-600 text-white";
    case "Low Payment":
      return "bg-yellow-500 text-black";
    case "Token Payment":
      return "bg-orange-500 text-white";
    case "Falling Behind":
      return "bg-red-600 text-white";
    default:
      return "";
  }
};

const DebtConfirmation = ({ value = {}, onChange }) => {
  const { debt = "", payment = "0" } = value;
  const badge = getBadge(Number(payment));

  // Handler for input changes
  const handleInput = (field, val) => {
    const updatedValue = { ...value, [field]: val };

    // If payment is updated, calculate and store the badge
    if (field === "payment") {
      updatedValue.badge = getBadge(Number(val));
    }

    onChange(updatedValue);
  };

  return (
    <div>
      <div>
        <h2 className="text-2xl font-semibold mb-4">Confirmations of debts:</h2>
        <div className="flex items-center gap-5">
          <section className="flex flex-col sm:flex-row gap-5 w-full">
            <div className="mb-4 w-full">
              <label className="block mb-1 font-medium">
                How much your debt?
              </label>
              <input
                min="0"
                type="number"
                value={debt}
                onChange={(e) => handleInput("debt", e.target.value)}
                className="w-full p-1 border rounded indent-1"
                placeholder="Enter your debt amount"
              />
            </div>

            <div className="mb-4 w-full">
              <label className="block mb-1 font-medium">
                How much you pay?
              </label>
              <input
                min="0"
                type="number"
                value={payment}
                onChange={(e) => handleInput("payment", e.target.value)}
                className="w-full p-1 border rounded indent-1"
                placeholder="Enter your payment amount"
              />
            </div>
          </section>

          {badge && (
            <div
              className={`mt-4 inline-block px-3 py-1 rounded-full text-sm font-semibold text-nowrap ${getBadgeClass(badge)}`}
            >
              {badge}
            </div>
          )}
        </div>
        {/* Show components based on badge */}
        {badge === "Falling Behind" && (
          <FallingBehind
            value={value}
            onChange={(updatedSubValues) => {
              onChange({ ...value, ...updatedSubValues });
            }}
          />
        )}
        {badge === "Token Payment" && (
          <TokenPayment
            value={value.delaySince || ""}
            onChange={(val) => handleInput("delaySince", val)}
          />
        )}
        {badge === "High Payment" && (
          <HighPayment
            value={value}
            onChange={(updatedSubValues) => {
              onChange({ ...value, ...updatedSubValues });
            }}
          />
        )}
        {(badge === "Low Payment" || badge === "Normal Payment") && (
          <LowPayment
            value={value}
            onChange={(updatedSubValues) => {
              onChange({ ...value, ...updatedSubValues });
            }}
          />
        )}
      </div>
      <h3 className="text-xl font-medium mt-3">Consumer Debts (CD):</h3>
      <LabeledInputGroup
        label="Credit Card"
        value={value.creditCard || []}
        onChange={(val) => handleInput("creditCard", val)}
      />
      <LabeledInputGroup
        label="Loan"
        value={value.loan || []}
        onChange={(val) => handleInput("loan", val)}
      />
      <LabeledInputGroup
        label="Store Card"
        value={value.storeCard || []}
        onChange={(val) => handleInput("storeCard", val)}
      />
      <LabeledInputGroup
        label="Catalog"
        value={value.catalog || []}
        onChange={(val) => handleInput("catalog", val)}
      />

      <h3 className="text-xl font-medium">
        Priority Bills (PB):{" "}
        <span className="font-normal text-lg">
          Are you upto date with your priority bill like gas, electric, and
          water rent?
        </span>
      </h3>
      <LabeledInputGroup
        label="Gas"
        value={value.gas || []}
        onChange={(val) => handleInput("gas", val)}
        isArrear={true}
      />
      <LabeledInputGroup
        label="Electric"
        value={value.electric || []}
        onChange={(val) => handleInput("electric", val)}
        isArrear={true}
      />
      <LabeledInputGroup
        label="Water"
        value={value.water || []}
        onChange={(val) => handleInput("water", val)}
        isArrear={true}
      />
      <LabeledInputGroup
        label="Mobile Contact"
        value={value.mobileContact || []}
        onChange={(val) => handleInput("mobileContact", val)}
        isArrear={true}
      />

      <h3 className="text-xl font-medium">
        Government Debts (GD):{" "}
        <span className="font-normal text-lg">
          Ask Is there any debts with the Gov. Like Over payment or advance
          payment of any benefits, Any CCJ Or HMRC or any Bailiffs Debts?
        </span>
      </h3>
      <LabeledInputGroup
        label="Over Payment"
        value={value.overPayment || []}
        onChange={(val) => handleInput("overPayment", val)}
        isGD={true}
      />
      <LabeledInputGroup
        label="Advance Payment"
        value={value.advancePayment || []}
        onChange={(val) => handleInput("advancePayment", val)}
        isGD={true}
      />
      <LabeledInputGroup
        label="CCJ"
        value={value.ccj || []}
        onChange={(val) => handleInput("ccj", val)}
        isGD={true}
      />
      <LabeledInputGroup
        label="HMRC"
        value={value.hmrc || []}
        onChange={(val) => handleInput("hmrc", val)}
        isGD={true}
      />
      <LabeledInputGroup
        label="Council Tax"
        value={value.councilTax || []}
        onChange={(val) => handleInput("councilTax", val)}
        isArrear={true}
        isGD={true}
      />
      <LabeledInputGroup
        label="Others"
        value={value.others || []}
        onChange={(val) => handleInput("others", val)}
        isGD={true}
      />
    </div>
  );
};

export default DebtConfirmation;
