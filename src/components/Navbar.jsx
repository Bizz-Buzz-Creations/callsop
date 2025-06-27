import { Link, useLocation } from 'wouter';

const Navbar = () => {
  const [location] = useLocation();

  const linkClass = (path) =>
    `px-4 py-2 rounded transition ${
      location === path
        ? 'bg-indigo-500 text-white'
        : 'hover:underline hover:text-indigo-300'
    }`;

  return (
    <nav className="bg-gray-800 text-white p-3 flex gap-4 items-center justify-evenly shadow">
      <Link to="/" className={linkClass('/')}>
        Standard Call Procedure
      </Link>

      <Link to="/calculator" className={linkClass('/calculator')}>
        Income & Expenditure Calculator
      </Link>
    </nav>
  );
};

export default Navbar;
