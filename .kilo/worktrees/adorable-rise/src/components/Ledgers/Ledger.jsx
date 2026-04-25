import React from 'react'
import { NavLink } from 'react-router-dom';
import '../../CSS/Login.css';
const Ledger = () => {
  return (
     <div className=''>
          <div className="users">
            <ul className='flex text-nowrap gap-4 p-5 bg-[#FFFFFF] rounded-xl md:w-[30%] mr-3'>
              <li className='inner'>
                <NavLink
                  to="/Leders/LedgerSales"
                  className={({ isActive }) =>
                    `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
                  }
                >
                  Sales
                </NavLink>
              </li>
              <li className='inner'>
                <NavLink
                  to="/Ledgers/Purchase"
                  className={({ isActive }) =>
                    `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
                  }
                >
                  Purchase
                </NavLink>
              </li>
              <li className='inner'>
                <NavLink
                  to="/Ledgers/Bank"
                  className={({ isActive }) =>
                    `hover:text-white hover:bg-[#FF5934] p-2 rounded-lg ${isActive ? 'bg-[#FF5934] rounded-lg text-white' : ''}`
                  }
                >
                  Bank
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
  )
}

export default Ledger
