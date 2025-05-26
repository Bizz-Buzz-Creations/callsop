import { useState } from 'react';
import './App.css';
import SOP from './pages/SOP';
import DialogBox from './components/DialogBox';
import { MessageSquareText } from 'lucide-react';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pb-5 relative">
      <h1 className='text-center text-3xl py-4'>Standard Call Procedure</h1>
      <SOP />

      <button
        onClick={() => setIsOpen(true)}
        className="mt-4 mx-auto block p-3 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 fixed top-0 right-5"
      >
        <MessageSquareText />
      </button>

      <DialogBox isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

export default App;
