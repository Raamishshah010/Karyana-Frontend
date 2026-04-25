import React from 'react';
import { NavLink } from 'react-router-dom';

const Ledger = () => {
  const navItems = [
    { name: "Sales", path: "/Leders/LedgerSales" },
    { name: "Purchase", path: "/Ledgers/Purchase" },
    { name: "Bank", path: "/Ledgers/Bank" },
  ];

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 inline-flex gap-2">

        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 
              ${
                isActive
                  ? "bg-[#FF5934] text-white shadow-md shadow-orange-100"
                  : "text-[#6B7280] hover:bg-[#FF5934]/10 hover:text-[#FF5934]"
              }`
            }
          >
            {item.name}
          </NavLink>
        ))}

      </div>
    </div>
  );
};

export default Ledger;