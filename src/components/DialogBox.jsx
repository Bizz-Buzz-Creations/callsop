// import { useState, useEffect } from 'react';
// import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
// import { ChevronDownIcon } from '@heroicons/react/20/solid';

// // Import your JSON file here
// import rebuttals from '../assets/rebuttals.json';

// const DialogBox = ({ isOpen, onClose }) => {
//   const [activeIndex, setActiveIndex] = useState(null);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [questions, setQuestions] = useState([]);

//   useEffect(() => {
//     // Load the questions from the rebuttals JSON file
//     setQuestions(rebuttals);
//   }, []);

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
//         <DialogPanel className="max-w-2xl w-full max-h-[80%] overflow-y-auto space-y-4 border bg-white p-6 rounded shadow-xl">
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
//                       className={`w-5 h-5 transform transition-transform ${activeIndex === index ? 'rotate-180' : ''}`}
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

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { VariableSizeList as List } from 'react-window';
import debounce from 'lodash.debounce';
import rebuttals from '../assets/rebuttals.json';

const DialogBox = ({ isOpen, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [questions, setQuestions] = useState([]);
  const listRef = useRef();

  useEffect(() => {
    setQuestions(rebuttals);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput.toLowerCase());
      setActiveIndex(null);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const toggleIndex = (index) => {
    setActiveIndex(prev => {
      const next = prev === index ? null : index;
      setTimeout(() => {
        listRef.current?.resetAfterIndex(index); // Recalculate height
      }, 0);
      return next;
    });
  };


  const filteredQuestions = useMemo(() => {
    return questions.filter(q =>
      q.question.toLowerCase().includes(searchTerm)
    );
  }, [questions, searchTerm]);

  const getItemSize = (index) => {
    const baseHeight = 60;
    const lineHeight = 20;
    const answerLines = filteredQuestions[index].answer.split('\n').length;
    return activeIndex === index
      ? baseHeight + (answerLines * lineHeight) + 20 // + extra padding
      : baseHeight;
  };

  const Row = useCallback(({ index, style }) => {
    const item = filteredQuestions[index];
    const isOpen = activeIndex === index;

    return (
      <div key={index} style={style} className="p-4 relative border-b border-gray-200">
        <button
          className="w-full flex justify-between items-center text-left text-sm font-medium text-gray-800 group"
          onClick={() => toggleIndex(index)}
        >
          <span>{item.question}</span>
          <ChevronDownIcon
            className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {isOpen && (
          <div className="absolute left-0 top-10 w-full bg-gray-100 z-50 p-3 text-sm text-gray-700 whitespace-pre-line">
            {item.answer}
          </div>
        )}
      </div>
    );
  }, [activeIndex, filteredQuestions]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="max-w-3xl w-full max-h-[80%] overflow-y-auto space-y-4 border bg-white p-6 rounded shadow-xl">
          <DialogTitle className="font-bold text-lg">Rebuttals</DialogTitle>
          <Description className="text-sm text-gray-600 mb-2">
            The list of rebuttal questions is mentioned below.
          </Description>

          {/* Search */}
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions..."
            className="w-full px-2 py-1 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Virtualized List with original style */}
          <div className="w-full divide-y divide-gray-200 rounded-md bg-gray-100">
            {filteredQuestions.length > 0 ? (
              <List
                height={400}
                itemCount={filteredQuestions.length}
                itemSize={getItemSize}
                width="100%"
                ref={listRef}
              >
                {Row}
              </List>
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
