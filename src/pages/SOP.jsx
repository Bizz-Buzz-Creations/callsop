import DebtConfirmation from "../components/DebtConfirmation";  
import EmployementInfo from "../components/EmploymentInfo";
import MaritalStatus from "../components/MaritalStatus";
import RentalDetails from "../components/RentalDetails";

const SOP = () => {
  return (
    <section className="w-3xl mx-auto p-4 border rounded-md shadow bg-gray-100">
      <DebtConfirmation />
      <RentalDetails />
      <MaritalStatus />
      <EmployementInfo />
    </section>
  )
}

export default SOP;