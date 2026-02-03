const HighPayment = ({ value = {}, onChange }) => {
  const handleChange = (field, val) => {
    if (onChange) {
      onChange({ ...value, [field]: val });
    }
  };

  const paymentMessages = {
    fine: `That's great! You're managing it well. However, even if you continue paying this way, it will still take a longer time to clear these debts.`,
    struggling: `Due to interest and charges added on top of your payments, your principal amount is reducing at a much slower rate.`,
  };

  const noticeMessages = {
    Yes: `So these solution is going  to freeze down all the  high interest and charges completely to 0%, so whatever amount you pay will directly burn the principal amount. This way you can clear your debts off in a much more quicker time as compared to the time taken by yourself. Also you can save some more because you no longer have to make payments with high int and chargers. Moreover, we will explore the possibility of writing off some part of your debts as well. Alright! So to give you a clear picture on what program you qualify for and what minimum payment plan suits you best, I’m going to process your application. I’ll also explain the benefits and drawbacks of the solution so you can make an informed decision`,
    No: `You might have not noticed but whenever you take any credit card or loan it comes with An APR until you are in any sort of arrangement with the creditors and on an avg it is around 24% so if you have got a debt level round about 7 grand then around 140 is simply going towards the int and charges.  and these solution is going  to freeze down all the  high interest and charges completely to 0%, so whatever amount you pay will directly burn the principal amount. This way you can clear your debts off in a much more quicker time as compared to the time taken by yourself. Also you can save some more because you no longer have to make payments with high int and chargers. Right ? 
    Moreover, we will explore the possibility of writing off some part of your debts as well, ok? 
    So to give you a clear picture of what program you qualify for and what minimum payment plan suits you best, I’m going to process your application. I’ll also explain the benefits and drawbacks of the solution so you can make an informed decision.`,
  };

  return (
    <div className="bg-white border p-4 rounded-lg shadow-md text-gray-800 mx-auto space-y-4 w-full">

      {/* Question 1 */}
      <p className="text-base leading-relaxed">
        How do you find these payments? Are they manageable, or do you sometimes compromise on other expenses?
      </p>

      <div className="flex gap-10">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="paymentStatus"
            value="fine"
            checked={value.paymentStatus === "fine"}
            onChange={(e) => handleChange("paymentStatus", e.target.value)}
          />
          Ok with the payment
        </label>

        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="paymentStatus"
            value="struggling"
            checked={value.paymentStatus === "struggling"}
            onChange={(e) => handleChange("paymentStatus", e.target.value)}
          />
          Struggling
        </label>
      </div>

      {value.paymentStatus && (
        <p className="text-base leading-relaxed">
          {paymentMessages[value.paymentStatus]}
        </p>
      )}

      {/* Question 2 */}
      <p className="text-base leading-relaxed">
        As I can see, a portion of these repayments goes toward high interest and charges, which is why your principal amount is reducing very slowly.
        <br />
        <strong>Have you ever noticed that?</strong>
      </p>

      <div className="flex gap-10">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="interestNotice"
            value="Yes"
            checked={value.interestNotice === "Yes"}
            onChange={(e) => handleChange("interestNotice", e.target.value)}
          />
          Yes
        </label>

        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="interestNotice"
            value="No"
            checked={value.interestNotice === "No"}
            onChange={(e) => handleChange("interestNotice", e.target.value)}
          />
          No
        </label>
      </div>

      {value.interestNotice && (
        <p className="text-base leading-relaxed">
          {noticeMessages[value.interestNotice]}
        </p>
      )}

      {/* Closing Text */}
      <p className="text-base leading-relaxed">
        Don’t worry — we’re going to reduce your high interest and charges to <strong>0%</strong>, so whatever amount you pay will directly go toward your principal. This will help you become debt-free faster.
      </p>

      <p className="text-base leading-relaxed">
        We will also explore the possibility of writing off a portion of your debts.
      </p>

      <p className="text-base leading-relaxed">
        To give you a clear picture of the program you qualify for and the minimum payment plan that suits you best, I’ll process your application and explain all the benefits and drawbacks so you can make an informed decision.
      </p>

    </div>
  );
};

export default HighPayment;
