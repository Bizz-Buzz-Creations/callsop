import { useState } from 'react';

const FallingBehind = ({ value = "", onChange }) => {
  // const [delaySince, setDelaySince] = useState('');

  return (
    <div className="bg-white space-y-4 p-4 border rounded-lg shadow-md mx-auto text-gray-800">
      <h2 className="text-xl font-semibold">Payment Delay Details</h2>

      {/* Input Field */}
      <div>
        <label className="block mb-1 font-medium">Since when?</label>
        <input
          type="text"
          placeholder="e.g. January 2024"
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full p-1 indent-1 border border-gray-300 rounded"
        />
      </div>

      {/* Conversational Content */}
      <div className="space-y-3 text-gray-700">
        <p>
          If you are falling behind on your payments, I believe your creditors might be chasing you by sending letters, text messages, or emails to bother you.
          <br />
          <strong>Right?</strong>
        </p>

        <p>
          Don’t worry — we will provide you with <strong>legal protection</strong> against your creditors so they can’t bother you anymore.
        </p>

        <p>
          Also, your credit rating is likely being hampered, which may cause trouble in getting new credit in the future.
          <br />
          <strong>Right?</strong>
        </p>

        <p>
          The program we’re discussing will help improve your credibility and make repayment easier. All your debts will be <strong>consolidated into one</strong>, and you’ll only need to make a single payment — based on your realistic affordability.
          <br />
          <strong>Right?</strong>
        </p>

        <p>
          Alright! So to give you a clear picture of what program you qualify for and what minimum payment plan suits you best, I’m going to process your application. I’ll also explain the benefits and drawbacks of the solution so you can make an informed decision.
        </p>
        <p>
          So, talking about these debts — what sort of debts are these? Are these credit cards, loans, or a bit of both?
        </p>
        <p>
          Now in order to give you a clear picture what best we can do for you, I'm going to connect this call to one of my senior advisor and he'll/She'll assist you further, So just bare with me on the line.
        </p>
      </div>
    </div>
  );
};

export default FallingBehind;
