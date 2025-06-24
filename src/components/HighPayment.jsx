const HighPayment = ({ value = {}, onChange }) => {
  const handleChange = (field, val) => {
    if (onChange) {
      onChange({ ...value, [field]: val });
    }
  };

  const messages = {
    fine: `That's great! That you are managing it well. However, in case you keep making the payment in such a way, it will still take a longer time to clear these debts off.`,
    struggling: `So if you're struggling or compromising with any expenses, then our basic job is to firstly draw down the monthly payment according to your realistic affordability so that you don't have to compromise with the payment that you are making currently. Also, we will freeze down the interest and charges.`,
  };

  return (
    <div className="bg-white border p-4 rounded-lg shadow-md text-gray-800 max-w-3xl mx-auto space-y-4">
      <p className="text-base leading-relaxed">
        <strong>Right!</strong> You are making such high payments. Are you compromising with your expenses or are you fine with these payments?
      </p>

      <div className="flex gap-10">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="handlingMethod"
            value="fine"
            checked={value.handlingMethod === "fine"}
            onChange={(e) => handleChange("handlingMethod", e.target.value)}
          />
          Fine with the payment
        </label>

        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="handlingMethod"
            value="struggling"
            checked={value.handlingMethod === "struggling"}
            onChange={(e) => handleChange("handlingMethod", e.target.value)}
          />
          Struggling
        </label>
      </div>

      {value.handlingMethod && (
        <div>
          {messages[value.handlingMethod]}
        </div>
      )}

      <p className="text-base leading-relaxed">
        Because as I can see, some part of these repayments is simply going toward the high interest and charges. That’s the only reason your principal amount is coming down but very slowly.
        <br />
        <strong>Have you ever noticed that?</strong>
      </p>

      <p className="text-base leading-relaxed">
        Don’t worry sir — we’re going to drop your high interest and charges completely to <strong>0%</strong>, so whatever amount you pay will directly deduct from your principal amount. This will help you become debt-free in a shorter period of time.
      </p>

      <p className="text-base leading-relaxed">
        Also, we will explore the possibility of writing off some part of your debts as well.
      </p>

      <p className="text-base leading-relaxed">
        Alright! So to give you a clear picture of what program you qualify for and what minimum payment plan suits you best, I’m going to process your application. I’ll also explain the benefits and drawbacks of the solution so you can make an informed decision.
      </p>
      <p className="text-base leading-relaxed">
        So, talking about these debts — what sort of debts are these? Are these credit cards, loans, or a bit of both?
      </p>
      <p className="text-base leading-relaxed">
        Now in order to give you a clear picture what best we can do for you, I'm going to connect this call to one of my senior advisor and he'll/She'll assist you further, So just bare with me on the line.
      </p>
    </div>
  );
};

export default HighPayment;
