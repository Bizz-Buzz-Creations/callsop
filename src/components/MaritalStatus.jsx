import { useState } from "react";
import DualInputRow from "./DualInputRow";

const MaritalStatus = () => {
  const [haveKids, setHaveKids] = useState("yes");

  return (
    <>
      <h3 className='text-xl font-medium'>Marital Status:</h3>
      <section className='flex flex-col sm:flex-row gap-5'>
        <div className='flex gap-2 items-center'>
          <input type="radio" id="single" name="status" value="single" />
          <label htmlFor="single">Single</label>
        </div>
        <div className='flex gap-2 items-center'>
          <input type="radio" id="married" name="status" value="married" />
          <label htmlFor="married">Married</label>
        </div>
        <div className='flex gap-2 items-center'>
          <input type="radio" id="partner" name="status" value="partner" />
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
            onChange={() => setHaveKids("yes")}
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
            onChange={() => setHaveKids("no")}
          />
          <label htmlFor="no">No</label>
        </div>
      </section>
      {haveKids === "yes" && (
        <DualInputRow labelLeft="How many kids you have?" labelRight="May I ask their age?" />
      )}
    </>
  );
};

export default MaritalStatus;