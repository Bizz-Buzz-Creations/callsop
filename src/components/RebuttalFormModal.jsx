import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import ghost from '/ghost-loader.gif'

const RebuttalFormModal = ({ isOpen, onClose }) => {
  const [isLoadingForm, setIsLoadingForm] = useState(true);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-60">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="relative max-w-3xl w-full max-h-[90%] overflow-y-auto border bg-white p-6 rounded shadow-xl">
          <DialogTitle className="font-bold text-lg mb-4 hidden">Submit New Rebuttal</DialogTitle>

          {/* Plain Loader */}
          {/* {isLoadingForm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
              <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          )} */}

          {/* Funny Loader */}
          {isLoadingForm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
              <img src={ghost} alt="Loading..." className="w-16 h-16" />
            </div>
          )}

          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLSe2DWxvWJTt4XaigeJSPIfYLe8F7g7gGCgObT1-v_cGw-ignw/viewform?embedded=true"
            width="100%"
            height="700"
            frameBorder="0"
            marginHeight="0"
            marginWidth="0"
            onLoad={() => setIsLoadingForm(false)}
          >
            Loading…
          </iframe>

          <div className="flex justify-end mt-4 absolute bottom-5 right-5">
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

export default RebuttalFormModal;
