import { useState } from 'react';
import LabeledInputGroup from './LabeledInputGroup';
import FallingBehind from './FallingBehind';
import HighPayment from './HighPayment';
import LowPayment from './LowPayment';

const getBadge = (payment) => {
  if (payment === 0) return 'Falling Behind';
  if (payment >= 1 && payment <= 10) return 'Token Payment';
  if (payment >= 11 && payment <= 150) return 'Low Payment';
  if (payment >= 151 && payment <= 300) return 'Normal payment';
  if (payment >= 301) return 'High Payment';
  return '';
};

const DebtConfirmation = () => {
  const [debt, setDebt] = useState('');
  const [payment, setPayment] = useState('0');

  const badge = getBadge(Number(payment));

  return (
    <div>
      <div>
        <h2 className="text-2xl font-semibold mb-4">Confirmations of debts:</h2>
        <div className="flex items-center gap-5">
          <section className='flex flex-col sm:flex-row gap-5 w-full'>
            <div className="mb-4 w-full">
              <label className="block mb-1 font-medium">How much your debt?</label>
              <input
                type="number"
                value={debt}
                onChange={(e) => setDebt(e.target.value)}
                className="w-full p-1 border rounded indent-1"
                placeholder="Enter your debt amount"
              />
            </div>

            <div className="mb-4 w-full">
              <label className="block mb-1 font-medium">How much you pay?</label>
              <input
                type="number"
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                className="w-full p-1 border rounded indent-1"
                placeholder="Enter your payment amount"
              />
            </div>
          </section>

          {badge && (
            <div
              className={`mt-4 inline-block px-3 py-1 rounded-full text-sm font-semibold text-nowrap
            ${badge === 'High Payment' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}
            ${badge === 'Normal Payment' ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'}
            ${badge === 'Low Payment' ? 'bg-yellow-500 text-black' : 'bg-blue-600 text-white'}
            ${badge === 'Token Payment' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}
            ${badge === 'Falling Behind' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}
            >
              {badge}
            </div>
          )}
        </div>
        {/* Show components based on badge */}
        {badge === 'Falling Behind' && <FallingBehind />}
        {badge === 'High Payment' && <HighPayment />}
        {badge === 'Low Payment' && <LowPayment />}
      </div>
      <h3 className='text-xl font-medium mt-3'>Consumer Debts (CD):</h3>
      <LabeledInputGroup label="Credit Card" />
      <LabeledInputGroup label="Loan" />
      <LabeledInputGroup label="Store Card" />
      <LabeledInputGroup label="Catalog" />

      <h3 className='text-xl font-medium'>Priority Bills (PB): <span className='font-normal text-lg'>Are you upto date with your priority bill like gas,  electric, and water rent?</span></h3>
      <LabeledInputGroup label="Gas" />
      <LabeledInputGroup label="Electric" />
      <LabeledInputGroup label="Water" />
      <LabeledInputGroup label="Mobile Contact" />

      <h3 className='text-xl font-medium'>Government Debts (GD): <span className='font-normal text-lg'>Ask Is there any debts with the Gov. Like Over payment or advance payment of any benefits, Any CCJ Or HRMC or any Bailiffs Debts?</span></h3>
      <LabeledInputGroup label="Over Payment" />
      <LabeledInputGroup label="Advance Payment" />
      <LabeledInputGroup label="CCJ" />
      <LabeledInputGroup label="HRMS" />
      <LabeledInputGroup label="Others" />

    </div>
  );
};

export default DebtConfirmation;
