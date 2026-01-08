import { useEffect, useState } from "react";

export default function UserDetails({ setUserData }) {
  const [data, setData] = useState({
    "General Details": {
      firstName: {
        label: "First name",
        value: "",
        placeholder: "Enter first name",
      },
      lastName: {
        label: "Last name",
        value: "",
        placeholder: "Enter last name",
      },
      ohterName: {
        label: "Other name",
        value: "",
        placeholder: "Enter Other name",
      },
      birthPlace: {
        label: "Place of birth",
        value: "",
        placeholder: "Enter place of birth",
      },
      dob: {
        label: "Date of Birth",
        value: "",
        placeholder: "DD / MM / YYYY",
      },
      gender: {
        label: "Gender",
        value: "",
        placeholder: "Enter gender",
      },
      maritalStatus: {
        label: "Marital Status",
        value: "",
        placeholder: "Enter marital status",
      },
      livingWith: {
        label: "Living With",
        value: "",
        placeholder: "Enter living with how many people",
      },
      partner: {
        label: "Partner",
        value: "",
        placeholder: "Enter partner",
      },
      partnerName: {
        label: "Partner Name",
        value: "",
        placeholder: "Enter partner name",
      },
      partnerDOB: {
        label: "Partner DOB",
        value: "",
        placeholder: "Enter partner DOB",
      },
    },
    "Contact Details": {
      homePhone: {
        label: "Home phone number",
        value: "",
        placeholder: "+91 XXXXX XXXXX",
      },
      mobile: {
        label: "Mobile phone number",
        value: "",
        placeholder: "+91 XXXXX XXXXX",
      },
      workPhone: {
        label: "Work phone number",
        value: "",
        placeholder: "+91 XXXXX XXXXX",
      },
      email: {
        label: "Email",
        value: "",
        placeholder: "example@email.com",
      },
      address1: {
        label: "Address Line 1",
        value: "",
        placeholder: "House / Flat number, Street",
      },
      address2: {
        label: "Address Line 2",
        value: "",
        placeholder: "House / Flat number, Street",
      },
      address3: {
        label: "Address Line 3",
        value: "",
        placeholder: "House / Flat number, Street",
      },
      town: {
        label: "Town / City",
        value: "",
        placeholder: "Enter city",
      },
      county: {
        label: "County",
        value: "",
        placeholder: "Enter county",
      },
      postcode: {
        label: "Postcode",
        value: "",
        placeholder: "Postal / ZIP code",
      },
      country: {
        label: "Country",
        value: "",
        placeholder: "Enter country",
      },
      prevAddress: {
        label: "Previous Address",
        value: "",
        placeholder: "Enter previous address",
      },
    },
  });

  const handleChange = (section, key, value) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: {
          ...prev[section][key],
          value,
        },
      },
    }));
  };

  useEffect(() => {
    setUserData(data);
  }, [data, setUserData]);

  return (
    <div className="max-w-5xl mx-auto relative mt-6 bg-white rounded-lg shadow-md p-6">
      {/* Sticky Header */}
      <h3 className="sticky top-0 z-10 text-center bg-[#0dcaf0] text-white py-3 mb-6 rounded font-semibold text-2xl">
        User Details
      </h3>

      {/* Two Column Layout */}
      <div className="flex flex-col md:flex-row gap-10">
        {Object.entries(data).map(([sectionTitle, fields]) => (
          <div key={sectionTitle} className="flex-1 p-6 bg-white">
            <h4 className="text-xl font-semibold mb-6 border-b pb-1">
              {sectionTitle}
            </h4>

            <div className="flex flex-col gap-4">
              {Object.entries(fields).map(([key, field]) => (
                <div key={key} className="flex flex-col">
                  <label className="text-sm font-medium text-gray-600 mb-1">
                    {field.label}
                  </label>

                  <input
                    type="text"
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(e) =>
                      handleChange(sectionTitle, key, e.target.value)
                    }
                    className="border border-gray-300 rounded-md px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
