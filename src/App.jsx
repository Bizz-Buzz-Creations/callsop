import { useState } from 'react';
import { Route, Switch } from 'wouter';
import './App.css';

import SOP from './pages/SOP';
import DialogBox from './components/DialogBox';
import { MessageSquareText } from 'lucide-react';
import Navbar from './components/Navbar';
import Calculator from './pages/Calculator';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pb-5 relative">
      <Navbar />

      <Switch>
        <Route path="/">
          <>
            <h1 className="text-center text-3xl py-4">Standard Call Procedure</h1>
            <SOP />

            <button
              onClick={() => setIsOpen(true)}
              className="mt-4 mx-auto block p-3 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 fixed top-0 right-5"
            >
              <MessageSquareText />
            </button>

            <DialogBox isOpen={isOpen} onClose={() => setIsOpen(false)} />
          </>
        </Route>

        {/* Uncomment this when you have the calculator page */}
        <Route path="/calculator">
          <Calculator />
        </Route> 
       

        <Route>⚠️ 404 - Page Not Found</Route>
      </Switch>
    </div>
  );
}

export default App;
