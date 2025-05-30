import AskQuestion from "./AskQuestion";
import DualInputRow from "./DualInputRow";

const UserDetails = ({ value = {}, onChange }) => {

  // Helper to update a field
  const handleChange = (field, val) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div className="mx-auto text-gray-800">
      
      <AskQuestion question="Now I am going to upload these details on to the portal to look for the option so, just for the data security could you help me out with your full name for these." />

      <h2 className="text-2xl font-semibold">User Information</h2>

      {/* <FloatingInput label="Full Name" value={fullName} onChange={setFullName} /> */}
      <DualInputRow
        labelLeft="Customer Full Name"
        valueLeft={value.customerName || ""}
        onChangeLeft={val => handleChange("customerName", val)}
        type="text"
      />

      <AskQuestion question="First line of your address along with your postcode." />

      <DualInputRow
        labelLeft="First line of your address"
        labelRight="Postcode"
        valueLeft={value.address || ""}
        valueRight={value.postcode || ""}
        onChangeLeft={val => handleChange("address", val)}
        onChangeRight={val => handleChange("postcode", val)}
        type="text"
      />

      <DualInputRow
        labelLeft="Contact Number"
        valueLeft={value.contactNumber || ""}
        onChangeLeft={val => handleChange("contactNumber", val)}
        type="text"
      />

      <AskQuestion question="Can you share your email so we can send soft copies of the paperwork?" />

      <DualInputRow
        labelLeft="Email Address"
        labelRight="Date Of Birth"
        valueLeft={value.emailAddress || ""}
        valueRight={value.dob || ""}
        onChangeLeft={val => handleChange("emailAddress", val)}
        onChangeRight={val => handleChange("dob", val)}
        type="text"
      />
    </div>
  );
};

export default UserDetails;
