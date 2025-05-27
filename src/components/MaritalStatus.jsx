import { useEffect } from "react";

const MaritalStatus = ({ value = {}, onChange }) => {
  // Use value as the source of truth
  const { status = "", haveKids = "", kidsCount = "", kidsAges = "" } = value;

  // Handler for radio/select changes
  const handleChange = (field, val) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <>
      <h3 className='text-xl font-medium'>Marital Status:</h3>
      <section className='flex flex-col sm:flex-row gap-5'>
        <div className='flex gap-2 items-center'>
          <input type="radio" id="single" name="status" value="single" checked={status === "single"} onChange={() => handleChange("status", "single")} />
          <label htmlFor="single">Single</label>
        </div>
        <div className='flex gap-2 items-center'>
          <input type="radio" id="married" name="status" value="married" checked={status === "married"} onChange={() => handleChange("status", "married")} />
          <label htmlFor="married">Married</label>
        </div>
        <div className='flex gap-2 items-center'>
          <input type="radio" id="partner" name="status" value="partner" checked={status === "partner"} onChange={() => handleChange("status", "partner")} />
          <label htmlFor="partner">Live with a Partner</label>
        </div>
      </section>

      <h4 className="text-lg font-medium">Do you have any kids dependence living with you under the age of 18?</h4>
      <section className='flex flex-col sm:flex-row gap-5'>
        <div className='flex gap-2 items-center'>
          <input
            type="radio"
            id="yes"
            name="haveKids"
            value="yes"
            checked={haveKids === "yes"}
            onChange={() => handleChange("haveKids", "yes")}
          />
          <label htmlFor="yes">Yes</label>
        </div>
        <div className='flex gap-2 items-center'>
          <input
            type="radio"
            id="no"
            name="haveKids"
            value="no"
            checked={haveKids === "no"}
            onChange={() => handleChange("haveKids", "no")}
          />
          <label htmlFor="no">No</label>
        </div>
      </section>
      {haveKids === "yes" && (
        <div className="flex gap-4 mt-2">
          <div>
            <label>How many kids you have?</label>
            <input
              type="number"
              min="1"
              value={kidsCount}
              onChange={e => handleChange("kidsCount", e.target.value)}
              className="border rounded p-1 ml-2"
            />
          </div>
          <div>
            <label>May I ask their age?</label>
            <input
              type="text"
              value={kidsAges}
              onChange={e => handleChange("kidsAges", e.target.value)}
              className="border rounded p-1 ml-2"
              placeholder="e.g. 5, 8"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MaritalStatus;