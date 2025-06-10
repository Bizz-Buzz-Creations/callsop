// import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
// import { ChevronDownIcon } from '@heroicons/react/20/solid';
// import { useState } from 'react';
// import rebuttals from '../assets/rebuttals.json'

// const questions = [
//   {
//     "question": "Who is housing disrepair team?",
//     "answer": `A Housing disrepair team is a group of people who works for an organisation that works for the tenants and they have certain damages on the rental property they are living in.
//               We make sure that anyone living in the UK is happy with the residential accomodation they have been provided by the council or housing authorities.
//               In case your complain is not getting adressed then we will try to contact your landlord on your behalf because they can ignore you but they can't igrore us as we got a team of 10 different solicitors 
//               Incase they have any property damage related issues unaddressed by their landlords as per the tenancy act { section 11 } 1985 tenants you can also file a complaint against landlord, to resolve the problem quicker.`
//   },
//   {
//     "question": "From where did you got my contact information?",
//     "answer": `We got your contact details through Housing Resolution Forum. It is an online web portol for the tenants  who are residing in the UK on the properties provided by Council or Housing Association.
//               Incase you have recently raised any complaints regarding the dissatisfaction in the living space against your landlord and its been unaddressed by them, we follow up with those people who are in need 
//               of help to improve their standard of living. 
//               And also you don't really have to worry about any thing because we are going to provide you leagal protection as well because the major question that you might be coming in your mind it could be is it going to affect my tenency agreement.`
//   }
// ]

// const DialogBox = ({ isOpen, onClose }) => {
//   const [activeIndex, setActiveIndex] = useState(null);
//   const [searchTerm, setSearchTerm] = useState("");

//   const toggleIndex = (index) => {
//     setActiveIndex(prev => (prev === index ? null : index));
//   };

//   const filteredQuestions = questions.filter(q =>
//     q.question.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   return (
//     <Dialog open={isOpen} onClose={onClose} className="relative z-50">
//       <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
//       <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
//         <DialogPanel className="max-w-xl w-full space-y-4 border bg-white p-6 rounded shadow-xl">
//           <DialogTitle className="font-bold text-lg">Rebuttals</DialogTitle>
//           <Description className="text-sm text-gray-600 mb-2">
//             The list of rebuttal questions is mentioned below.
//           </Description>

//           {/* Search Input */}
//           <input
//             type="text"
//             value={searchTerm}
//             onChange={(e) => {
//               setSearchTerm(e.target.value);
//               setActiveIndex(null); // reset open item on search
//             }}
//             placeholder="Search questions..."
//             className="w-full px-2 py-1 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
//           />

//           <div className="w-full divide-y divide-gray-200 rounded-md bg-gray-100">
//             {filteredQuestions.length > 0 ? (
//               filteredQuestions.map((item, index) => (
//                 <div key={index} className="p-4">
//                   <button
//                     className="w-full flex justify-between items-center text-left text-sm font-medium text-gray-800 group"
//                     onClick={() => toggleIndex(index)}
//                   >
//                     <span>{item.question}</span>
//                     <ChevronDownIcon
//                       className={`w-5 h-5 transform transition-transform ${
//                         activeIndex === index ? 'rotate-180' : ''
//                       }`}
//                     />
//                   </button>
//                   {activeIndex === index && (
//                     <div className="mt-2 text-sm text-gray-600 whitespace-pre-line">
//                       {item.answer}
//                     </div>
//                   )}
//                 </div>
//               ))
//             ) : (
//               <p className="text-sm text-gray-500 p-4">No matching questions found.</p>
//             )}
//           </div>

//           <div className="flex justify-end gap-3 mt-6">
//             <button
//               onClick={onClose}
//               className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
//             >
//               Close
//             </button>
//           </div>
//         </DialogPanel>
//       </div>
//     </Dialog>
//   );
// };

// export default DialogBox;

import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

// Import your JSON file here
import rebuttals from '../assets/rebuttals.json';

const DialogBox = ({ isOpen, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    // Load the questions from the rebuttals JSON file
    setQuestions(rebuttals);
  }, []);

  const toggleIndex = (index) => {
    setActiveIndex(prev => (prev === index ? null : index));
  };

  const filteredQuestions = questions.filter(q =>
    q.question.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="max-w-xl w-full max-h-[50%] overflow-y-auto space-y-4 border bg-white p-6 rounded shadow-xl">
          <DialogTitle className="font-bold text-lg">Rebuttals</DialogTitle>
          <Description className="text-sm text-gray-600 mb-2">
            The list of rebuttal questions is mentioned below.
          </Description>

          {/* Search Input */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setActiveIndex(null); // reset open item on search
            }}
            placeholder="Search questions..."
            className="w-full px-2 py-1 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="w-full divide-y divide-gray-200 rounded-md bg-gray-100">
            {filteredQuestions.length > 0 ? (
              filteredQuestions.map((item, index) => (
                <div key={index} className="p-4">
                  <button
                    className="w-full flex justify-between items-center text-left text-sm font-medium text-gray-800 group"
                    onClick={() => toggleIndex(index)}
                  >
                    <span>{item.question}</span>
                    <ChevronDownIcon
                      className={`w-5 h-5 transform transition-transform ${activeIndex === index ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {activeIndex === index && (
                    <div className="mt-2 text-sm text-gray-600 whitespace-pre-line">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 p-4">No matching questions found.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DialogBox;
