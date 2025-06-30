import SinceInput from "./SinceInput";

const TokenPayment = ({ value = "", onChange }) => {

  return (
    <div className="bg-white space-y-4 p-4 border rounded-lg shadow-md mx-auto text-gray-800 w-full">
      <h2 className="text-xl font-semibold">Token Payment Details</h2>

      {/* Input Field */}
      <SinceInput
        value={value}
        onChange={onChange}
        label="Since when are you making token payments?"
      />

      {/* Conversational Content */}
      <div className="space-y-3 text-gray-700">
        <p>
          Is like you have made an arrangement with your creditors directly to make this payment or are you taking any help with the debt management company.
        </p>

        <p>
          In any situation whatsoever client says answer is going to be the same, that is:
        </p>

        <p>
          If you keep making the payment in such a way it will take a very long time for you to become a debt free person also till the time you are making such a payment, your credit rating will be badly impacted.
          <br />
        </p>

        <p>
          And as per my calculation based on the figures that you had told me, it could take around 10 to 20 years for you to become a debt free or could be more than that.
          <br />
          Till that time, you can't even go for credit even for an emergency purpose because your creditor will see that you are already making the token payment, so they won't provide you anything.
        </p>

        <p>
          However, that solution that we are offering will make you a debt free person in a much quicker time and once you complete the program you will get a fresh start on your credit rating. So that, moving forward you can apply for some credits and loans as well.
        </p>
        <p>
          Now in order to give you a clear picture what best we can do for you, I'm going to connect this call to one of my senior advisor and he'll/She'll assist you further, So just bare with me on the line.
          <br />
          OR
          <br />
          Now, in order to see what best we can do for you, I’m going to process the application. We’ll also explain all the benefits and drawbacks of the solution you qualify for, so that you can make an informed decision. So, talking about these debts—what sort of debts are these? Are they credit cards, loans, or a bit of both?
        </p>
      </div>
    </div>
  );
};

export default TokenPayment;
