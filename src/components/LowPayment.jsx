const LowPayment = ({ value = {}, onChange }) => {
  const handleChange = (field, val) => {
    if (onChange) {
      onChange({ ...value, [field]: val });
    }
  };

  return (
    <div className="bg-white space-y-4 p-4 border rounded-lg shadow-md mx-auto">
      <h2 className="text-xl font-semibold text-gray-800">Are you dealing with a debt management company or managing it yourself?</h2>

      {/* Primary Selection */}
      <div className="flex flex-col gap-2">
        <label className="font-medium">Select area:</label>
        <div className="flex gap-4">
          <label>
            <input
              type="radio"
              name="handlingMethod"
              value="company"
              checked={value.handlingMethod === 'company'}
              onChange={() => handleChange('handlingMethod', 'company')}
              className="mr-2"
            />
            Dealing with a company
          </label>
          <label>
            <input
              type="radio"
              name="handlingMethod"
              value="myself"
              checked={value.handlingMethod === 'myself'}
              onChange={() => handleChange('handlingMethod', 'myself')}
              className="mr-2"
            />
            Paying by myself
          </label>
        </div>
      </div>

      {/* If dealing with a company */}
      {value.handlingMethod === 'company' && (
        <div className="space-y-3">
          <label className="font-medium">Which company is it — a private company or a charity org like StepChange?</label>
          <div className="flex gap-4">
            <label>
              <input
                type="radio"
                name="companyType"
                value="private"
                checked={value.companyType === 'private'}
                onChange={() => handleChange('companyType', 'private')}
                className="mr-2"
              />
              Private
            </label>
            <label>
              <input
                type="radio"
                name="companyType"
                value="charity"
                checked={value.companyType === 'charity'}
                onChange={() => handleChange('companyType', 'charity')}
                className="mr-2"
              />
              Charity
            </label>
          </div>

          {/* Conditional content */}
          {value.companyType === 'private' &&
            <>
              <p className="text-blue-600 font-medium">You're using a private DMP (Debt Management Plan).</p>
              <div className="text-gray-800 mx-auto space-y-4 leading-relaxed">
                <p>
                  Well, if you're dealing with a <strong>debt management company</strong>, then I do believe that there's some <strong>management fees</strong> or <strong>set-up costs</strong> imposed on top of the payments you make towards your debts.
                </p>
                <p>
                  Also, you would have to pay all your debts back with them — or even more than you actually owe — as there are fees included as well. And there's <strong>no guarantee of freezing your interests and charges</strong> on a DMP because it's an <strong>informal agreement</strong> between you and your creditors, not a formal one.
                </p>
                <p>
                  There's also an impact on your <strong>credit score</strong> — unlike the solution we’re discussing, which is a <strong>government-backed, completely free</strong> scheme.
                </p>
                <p>
                  This government solution is designed to help you knock off a significant portion of your <strong>credit cards, loans</strong>, and other debts — restoring your credit rating, removing all <strong>black marks and defaults</strong> from your credit file.
                </p>
                <p>
                  It will allow you to seek more credit in the future, but with <strong>lower interest rates and charges</strong>, once you are <strong>debt free</strong> in a shorter span of time.
                </p>
                <p>
                  Your <strong>interest and charges will be frozen at 0%</strong>, helping you save more money — especially in these times of high inflation, which has gone up to <strong>9.5%</strong>, the highest in the last 40 years.
                </p>
                <p>
                  This inflation has caused utilities and fuel prices to spike — so saving through this program means more money <strong>back in your pocket</strong>.
                </p>
                <p>
                  Now in order to give you a clear picture what best we can do for you, I'm going to connect this call to one of my senior advisor and he'll/She'll assist you further, So just bare with me on the line.
                  <br />
                  OR
                  <br />
                  Now, in order to see what best we can do for you, I’m going to process the application. We’ll also explain all the benefits and drawbacks of the solution you qualify for, so that you can make an informed decision. So, talking about these debts—what sort of debts are these? Are they credit cards, loans, or a bit of both?
                </p>
              </div>
            </>}
          {value.companyType === 'charity' &&
            <>
              <p className="text-green-600 font-medium">You're using StepChange or a similar charity DMP.</p>
              <div className="text-gray-800 mx-auto space-y-4 leading-relaxed">
                <p>
                  I’m talking about a solution that might actually sound <strong>better than what you’ve got at the moment</strong>... Okay?
                </p>
                <p>
                  So, if you're dealing with <strong>StepChange</strong>, I do believe that they <strong>haven’t given you a specific time frame</strong> in which you’ll be completely debt-free —
                  <br />
                  <strong>Have they?</strong>
                </p>
                <p>
                  However, let me tell you that the solution we’re talking about will help <strong>write off a majority of your debts</strong> — getting you <strong>debt-free in a much shorter time span</strong> compared to their approach.
                </p>
                <p>
                  On top of that, you've already opted for a solution that’s likely had a <strong>negative impact on your credit score</strong>. That's why our solution is designed to <strong>remove black marks and defaults</strong> from your credit file.
                </p>
                <p>
                  It will allow you to <strong>seek new credit at lower APRs (Annual Percentage Rates)</strong> — that too in a shorter span of time, <strong>once your debts are written off</strong>.
                </p>
                <p>
                  Moreover, this is a <strong>completely free-of-cost solution</strong>.
                </p>
                <p>
                  Now in order to give you a clear picture what best we can do for you, I'm going to connect this call to one of my senior advisor and he'll/She'll assist you further, So just bare with me on the line.
                  <br />
                  OR
                  <br />
                  Now, in order to see what best we can do for you, I’m going to process the application. We’ll also explain all the benefits and drawbacks of the solution you qualify for, so that you can make an informed decision. So, talking about these debts—what sort of debts are these? Are they credit cards, loans, or a bit of both?
                </p>
              </div>
            </>}

        </div>
      )}

      {/* If managing by self */}
      {value.handlingMethod === 'myself' && (
        <div className="space-y-4 text-gray-700">
          <p>
            As I can see, the majority portion of your payments are going towards interest and charges. That's why your principal amount is coming down, but very slowly.
          </p>
          <p>Have you ever noticed that?</p>
          <p>
            Don’t worry, sir — we're going to drop your high interest and charges completely to 0%, so whatever amount you pay will directly deduct your principal. You’ll be debt-free in a shorter period. We’ll also look at possibilities to write off some of your debt.
          </p>
          <p>
            Alright! So to give you a clear picture of what program you qualify for and what minimum payment plan suits you best, I’m going to process your application. I’ll also explain the benefits and drawbacks of the solution so you can make an informed decision.
          </p>
          <p>
            So, talking about these debts — what sort of debts are these? Are these credit cards, loans, or a bit of both?
          </p>
          <p>
            Now in order to give you a clear picture what best we can do for you, I'm going to connect this call to one of my senior advisor and he'll/She'll assist you further, So just bare with me on the line.
            <br />
            OR
            <br />
            Now, in order to see what best we can do for you, I’m going to process the application. We’ll also explain all the benefits and drawbacks of the solution you qualify for, so that you can make an informed decision. So, talking about these debts—what sort of debts are these? Are they credit cards, loans, or a bit of both?
          </p>
        </div>
      )}
    </div>
  );
};

export default LowPayment;
