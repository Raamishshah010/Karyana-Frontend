import { NavLink } from 'react-router-dom';
import '../../CSS/Login.css';

const User = () => {
  const userDetails = JSON.parse(sessionStorage.getItem("karyana-admin"));
  const isCoordinator = userDetails?.role === "coordinator";

  return (
    <div className=''>
      <div className="users">
        <ul className='flex text-nowrap gap-4 p-5 bg-[#FFFFFF] rounded-xl md:w-[60%] mr-3'>
        {!isCoordinator && (
            <li className='inner'>
              <NavLink
                to="/Users/Coordinators"
                className={({ isActive }) =>
                  `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
                }
              >
                Coordinators
              </NavLink>
            </li>
          )}
          <li className='inner'>
            <NavLink
              to="/Users/WarehouseManagers"
              className={({ isActive }) =>
                `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
              }
            >
              Warehouse Managers
            </NavLink>
          </li>
          <li className='inner'>
            <NavLink
              to="/Users/Sales"
              className={({ isActive }) =>
                `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
              }
            >
              Sales Person
            </NavLink>
          </li>
          
          <li className='inner'>
            <NavLink
              to="/Users/Retailers"
              className={({ isActive }) =>
                `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
              }
            >
              Customer
            </NavLink>
          </li>
          
        </ul>
      </div>
    </div>
  );
};

export default User;