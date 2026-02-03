import SinceInput from "./SinceInput";

const FallingBehind = ({ value = {}, onChange }) => {
  // const [delaySince, setDelaySince] = useState('');
  const handleChange = (field, val) => {
    if (onChange) {
      onChange({ ...value, [field]: val });
    }
  };

  const isSixMonthsBehind = (input) => {
    if (!input) return false;

    const startDate = new Date(input + " 1"); // "January 2024 1"
    if (isNaN(startDate)) return false;

    const now = new Date();

    const totalMonths =
      (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth());

    if (totalMonths < 0) return false;
    return totalMonths <= 6;
  };

  const isBehind6Months = isSixMonthsBehind(value.delaySince);

  return (
    <div className="bg-white space-y-4 p-4 border rounded-lg shadow-md mx-auto text-gray-800 w-full">
      <h2 className="text-xl font-semibold">Payment Delay Details</h2>

      {/* Input Field */}
      <SinceInput
        value={value.delaySince || ""}
        onChange={(val) => handleChange("delaySince", val)}
        label="Since when are you falling behind?"
      />

      {/* breathing period */}
      {isBehind6Months && (
        <div className="flex flex-col gap-2">
          <label className="font-medium">
            Is it a payment holiday or breathing period that you took from your
            creditors ?
          </label>
          <div className="flex gap-4">
            <label>
              <input
                type="radio"
                name="breathingPeriod"
                value="true"
                checked={value.breathingPeriod === "true"}
                onChange={() => handleChange("breathingPeriod", "true")}
                className="mr-2"
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="breathingPeriod"
                value="false"
                checked={value.breathingPeriod === "false"}
                onChange={() => handleChange("breathingPeriod", "false")}
                className="mr-2"
              />
              No
            </label>
          </div>
        </div>
      )}
      {/* breathing period content*/}
      {isBehind6Months && value.breathingPeriod === "true" && (
        <div className="space-y-3 text-gray-700">
          <p>
            if you took a payment holiday from your creditor then it will ruin
            your credit rating in a longer run, also after that period (6 months
            or 3 months) you have to pay full amount back not just the full
            amount but an amount that will be much more than what you had
            actually owned because end of the day you will make the payment with
            high int and chargers, however we have few options available where
            in you just have to pay what you can actually afford to pay every
            month and that too not the entire amount back because it can right
            off major portion of your debts and once you are debt free, all the
            black mark and defaults will be removed so you can apply for loan
            and credit card but it will happen after the completion of this
            program.
          </p>
        </div>
      )}

      {isBehind6Months && value.breathingPeriod === "false" && (
        <div className="flex flex-col gap-2">
          <label className="font-medium">
            have you ever been chased from your creditor ? Have they tried
            contacting you through calls or by sending letters or emails ?
          </label>
          <div className="flex gap-4">
            <label>
              <input
                type="radio"
                name="chasingCreditors"
                value="true"
                checked={value.chasingCreditors === "true"}
                onChange={() => handleChange("chasingCreditors", "true")}
                className="mr-2"
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="chasingCreditors"
                value="false"
                checked={value.chasingCreditors === "false"}
                onChange={() => handleChange("chasingCreditors", "false")}
                className="mr-2"
              />
              No
            </label>
          </div>
        </div>
      )}

      {isBehind6Months &&
        value.breathingPeriod === "false" &&
        value.chasingCreditors === "true" && (
          <div className="space-y-3 text-gray-700">
            <p>
              then don’t worry because the solution we are talking about is
              going to provide you legal protections against all of your
              creditors so by law none of these creditors will ever be allowed
              to chase or bother you, if by any chance they try to do so we can
              take legal action against them we will make sure that they are
              aware of your situation that you are not running away or hiding
              from these debts its just that you current situation is as such
              that you are compromising with your basic expenses so they won’t
              bother you any more.
            </p>
          </div>
        )}

      {isBehind6Months &&
        value.breathingPeriod === "false" &&
        value.chasingCreditors === "false" && (
          <>
            <div className="space-y-3 text-gray-700">
              <p>
                Then possibility are that they are not chasing but your debts
                could pass on over to a debt collector they will contact you and
                since you are falling behind then obviously your credit rating
                will get hampered and it will become very hard for you to apply
                for more credit or loans even for emergency purpose, however the
                solution that we are talking about will increase your
                credibility once these debts are paid, also any point of time
                your creditor tried to contact you then too this will give you a
                leagal protection so they can’t chase or bother you any further.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium">
                So are you not making payment because you can’t afford anything
                or is it like you can’t pay what the creditor are asking you to
                pay?
              </label>
              <div className="flex gap-4">
                <label>
                  <input
                    type="radio"
                    name="affordingPayment"
                    value="one"
                    checked={value.affordingPayment === "one"}
                    onChange={() => handleChange("affordingPayment", "one")}
                    className="mr-2"
                  />
                  I don't want to pay
                </label>
                <label>
                  <input
                    type="radio"
                    name="affordingPayment"
                    value="two"
                    checked={value.affordingPayment === "two"}
                    onChange={() => handleChange("affordingPayment", "two")}
                    className="mr-2"
                  />
                  I can’t afford what they are asking.
                </label>
                <label>
                  <input
                    type="radio"
                    name="affordingPayment"
                    value="three"
                    checked={value.affordingPayment === "three"}
                    onChange={() => handleChange("affordingPayment", "three")}
                    className="mr-2"
                  />
                  I can’t afford anything.
                </label>
              </div>
            </div>
          </>
        )}

      {isBehind6Months &&
        value.breathingPeriod === "false" &&
        value.chasingCreditors === "false" &&
        value.affordingPayment === "one" && (
          <div className="space-y-3 text-gray-700">
            <p>
              🚩<strong>( could be a hoax ask more questions)</strong>
            </p>
            <p>
              <strong>Q1: </strong>Is there any specific reason that you don’t
              want to pay anything ?
            </p>
            <p>
              <strong>Q2: </strong> Are these debts only under your name?
            </p>
            <p>
              <strong>Q3: </strong> Carry on the way you are dealing with your
              debts then.
            </p>
          </div>
        )}

      {isBehind6Months &&
        value.breathingPeriod === "false" &&
        value.chasingCreditors === "false" &&
        value.affordingPayment === "two" && (
          <div className="space-y-3 text-gray-700">
            <p>
              <strong> I can’t afford what they are asking:</strong> <br />
              Lot of client we came across feel the same way so don’t worry you
              are not alone, we had helped individuals who were really
              compromising with their basic necessities like food , so surely we
              will try to help you out the best way possible so that you could
              have atleast one less thing to worry about that is your debts and
              finances.
            </p>
          </div>
        )}

      {isBehind6Months &&
        value.breathingPeriod === "false" &&
        value.chasingCreditors === "false" &&
        value.affordingPayment === "three" && (
          <div className="space-y-3 text-gray-700">
            <p>
              <strong> I can’t afford anything:</strong> <br />
              Lot of client we came across feel the same way so don’t worry you
              are not alone, we had helped individuals who were really
              compromising with their basic necessities like food , so surely we
              will try to help you out the best way possible so that you could
              have atleast one less thing to worry about that is your debts and
              finances.
            </p>
            <p>
              So let me just check what best we can do, for that I just need to
              confirm what sort of debts these are, are these only the consumer
              debts like credit card, loan or are you behind with your priority
              bills like gas electric, water or council?
            </p>
          </div>
        )}

      {/* Conversational Content */}
      <div className="space-y-3 text-gray-700">
        <p>
          If you are falling behind on your payments, I believe your creditors
          might be chasing you by sending letters, text messages, or emails to
          bother you.
          <br />
          <strong>Right?</strong>
        </p>

        <p>
          Don’t worry — we will provide you with{" "}
          <strong>legal protection</strong> against your creditors so they can’t
          bother you anymore.
        </p>

        <p>
          Also, your credit rating is likely being hampered, which may cause
          trouble in getting new credit in the future.
          <br />
          <strong>Right?</strong>
        </p>

        <p>
          The program we’re discussing will help improve your credibility and
          make repayment easier. All your debts will be{" "}
          <strong>consolidated into one</strong>, and you’ll only need to make a
          single payment — based on your realistic affordability.
          <br />
          <strong>Right?</strong>
        </p>

        <p>
          Alright! So to give you a clear picture of what program you qualify
          for and what minimum payment plan suits you best, I’m going to process
          your application. I’ll also explain the benefits and drawbacks of the
          solution so you can make an informed decision.
        </p>
        <p>
          So, talking about these debts — what sort of debts are these? Are
          these credit cards, loans, or a bit of both?
        </p>
        <p>
          Now in order to give you a clear picture what best we can do for you,
          I'm going to connect this call to one of my senior advisor and
          he'll/She'll assist you further, So just bare with me on the line.
          <br />
          OR
          <br />
          Now, in order to see what best we can do for you, I’m going to process
          the application. We’ll also explain all the benefits and drawbacks of
          the solution you qualify for, so that you can make an informed
          decision. So, talking about these debts—what sort of debts are these?
          Are they credit cards, loans, or a bit of both?
        </p>
      </div>
    </div>
  );
};

export default FallingBehind;
