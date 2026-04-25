import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import '../../CSS/Login.css';

const Report = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/Reports') {
      navigate('/Reports/AgingReport');
    }
  }, [location, navigate]);

  return (
    <div>
      <div className="users">
        <ul className='flex text-nowrap gap-4 p-5 bg-[#FFFFFF] rounded-xl md:w-[98%] mr-3'>
          <li className='inner'>
            <NavLink
              to="/Reports/AgingReport"
              className={({ isActive }) =>
                `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
              }
            >
              Aging Report
            </NavLink>
          </li>

          <li className='inner'>
            <NavLink
              to="/Reports/SalesReport"
              className={({ isActive }) =>
                `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
              }
            >
              Sales Report
            </NavLink>
          </li>
        </ul>
      </div>
      <Outlet />
    </div>
  );
};

export default Report;
