import { useState } from 'react'
import Income from '../components/Income';
import Expense from '../components/Expense';
import Summary from '../components/Summary';
import Comparison from '../components/Comparison';

const Calculator = () => {
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // State for income and expenses data
  const [incomeData, setIncomeData] = useState({});
  const [expensesData, setExpensesData] = useState({});


  return (
    <>
    <div className='mx-5'>
        <Income setTotalIncome={setTotalIncome} setIncomeData={setIncomeData} />
        <Expense setTotalExpenses={setTotalExpenses} setExpensesData={setExpensesData} />
        <Comparison 
          incomeData={incomeData} 
          expensesData={expensesData} 
          totalIncome={totalIncome} 
          totalExpenses={totalExpenses} 
        />
    </div>
        <Summary totalIncome={totalIncome} totalExpenses={totalExpenses} />
    </>
  )
}

export default Calculator