import { NavLink } from 'react-router-dom';
import { CiLogout } from 'react-icons/ci';
import { SlDiamond } from "react-icons/sl";
import { FaBook } from "react-icons/fa";
import { FaRegUser } from "react-icons/fa";
import { MdCalendarMonth } from 'react-icons/md';
import { RiCoupon3Line } from 'react-icons/ri';
import { FaBullseye } from 'react-icons/fa';
import {
  MdDashboard,
  MdInventory2,
  MdLocationOn,
  MdShoppingCart,
  MdPrivacyTip,
  MdArticle,
  MdCategory,
  MdChevronLeft,
  MdImage,
  MdPeople,
  MdReceipt,
  MdPayment,
  MdPointOfSale,
  MdExpandMore,
  MdAutorenew,
  MdAddCircleOutline,
  MdFingerprint,
  MdHistory,
  MdMap,
  MdBarChart,
  MdAssessment,
  MdPerson,
  MdListAlt,
  MdSettings,
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import { ROLES } from '../utils';
import { useMemo, useState } from 'react';

/* ─────────────────────────────────────────
   Reusable nav item
───────────────────────────────────────── */
const NavItem = ({ to, icon: Icon, label, badge, collapsed }) => (
  <NavLink
    to={to}
    title={collapsed ? label : undefined}
    className={({ isActive }) =>
      `group flex items-center gap-3 px-3 py-[9px] rounded-xl mx-2 my-[2px] transition-all duration-200 text-sm font-medium
      ${isActive
        ? 'bg-[#FF5934]/10 text-[#FF5934]'
        : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#111827]'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon
          size={18}
          className={`flex-shrink-0 transition-colors duration-200
            ${isActive ? 'text-[#FF5934]' : 'text-[#9CA3AF] group-hover:text-[#111827]'}`}
        />
        {!collapsed && (
          <span className="flex-1 truncate leading-none">{label}</span>
        )}
        {!collapsed && badge && (
          <span className="flex-shrink-0 bg-[#FF5934] text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center">
            {badge}
          </span>
        )}
      </>
    )}
  </NavLink>
);

/* ─────────────────────────────────────────
   Collapsible group nav item
───────────────────────────────────────── */
const NavGroup = ({ icon: Icon, label, children, collapsed, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed) {
    return (
      <div className="relative group/grp mx-2 my-[2px]">
        <button
          className="w-full flex items-center justify-center px-3 py-[9px] rounded-xl text-[#9CA3AF] hover:bg-gray-100 hover:text-[#111827] transition-all duration-200"
          title={label}
        >
          <Icon size={18} className="flex-shrink-0" />
        </button>
        <div className="absolute left-full top-0 ml-2 hidden group-hover/grp:flex flex-col bg-white border border-gray-100 rounded-2xl shadow-xl z-50 min-w-[190px] py-2 overflow-hidden">
          <div className="px-3 pb-2 pt-1 border-b border-gray-100 mb-1">
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-2 my-[2px]">
      <button
        onClick={() => setOpen(p => !p)}
        className={`group w-full flex items-center gap-3 px-3 py-[9px] rounded-xl transition-all duration-200 text-sm font-medium
          ${open ? 'text-[#FF5934] bg-[#FF5934]/5' : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#111827]'}`}
      >
        <Icon
          size={18}
          className={`flex-shrink-0 transition-colors duration-200 ${open ? 'text-[#FF5934]' : 'text-[#9CA3AF] group-hover:text-[#111827]'}`}
        />
        <span className="flex-1 truncate leading-none text-left">{label}</span>
        <MdExpandMore
          size={16}
          className={`flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-[#FF5934]' : 'text-[#9CA3AF]'}`}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? '600px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="relative ml-[22px] mt-1 mb-1">
          <div className="absolute left-[10px] top-0 bottom-0 w-px bg-gray-100" />
          <div className="flex flex-col gap-[2px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/* Sub-item used inside NavGroup */
const SubNavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `group flex items-center gap-2.5 pl-5 pr-3 py-[7px] rounded-xl transition-all duration-200 text-[13px] font-medium
      ${isActive
        ? 'bg-[#FF5934]/10 text-[#FF5934]'
        : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#111827]'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon
          size={14}
          className={`flex-shrink-0 ${isActive ? 'text-[#FF5934]' : 'text-[#9CA3AF] group-hover:text-[#111827]'}`}
        />
        <span className="truncate leading-none">{label}</span>
      </>
    )}
  </NavLink>
);

/* ─────────────────────────────────────────
   Section label
───────────────────────────────────────── */
const SectionLabel = ({ children, collapsed }) => {
  if (collapsed) {
    return <div className="my-2 mx-3 border-t border-gray-100" />;
  }
  return (
    <div className="flex items-center gap-2 px-5 pt-5 pb-[6px]">
      <span className="text-[10px] font-bold tracking-[0.12em] text-[#B0B7C3] uppercase whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
};

/* ─────────────────────────────────────────
   Main Sidebar
───────────────────────────────────────── */
const Sidebar = () => {
  const user = useSelector(st => st.admin);
  const [collapsed, setCollapsed] = useState(false);

  const logoutHandler = () => {
    if (window.confirm("Are you sure to logout?")) {
      sessionStorage.removeItem("karyana-admin");
      window.location.replace("/login");
    }
  };

  const isWM = useMemo(() => user?.role?.includes(ROLES[2]), [user]);
  const isCoordinator = useMemo(() => user?.role?.includes(ROLES[1]), [user]);

  const initials = useMemo(() => {
    const name = user?.name || "Admin";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }, [user]);

  const roleName = useMemo(() => {
    if (isWM) return "Warehouse Manager";
    if (isCoordinator) return "Coordinator";
    return "Administrator";
  }, [isWM, isCoordinator]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .karyana-sidebar { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .karyana-sidebar .nav-scroll { scrollbar-width: none; }
        .karyana-sidebar .nav-scroll::-webkit-scrollbar { display: none; }
        .karyana-sidebar .sidebar-toggle {
          position: absolute;
          right: -12px;
          top: 24px;
          z-index: 10;
          width: 24px;
          height: 24px;
          background: #ffffff;
          border: 1.5px solid #E5E7EB;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          transition: box-shadow 0.2s, background 0.2s;
        }
        .karyana-sidebar .sidebar-toggle:hover {
          background: #FFF5F2;
          box-shadow: 0 2px 8px rgba(255,89,52,0.15);
        }
      `}</style>

      <div
        className={`karyana-sidebar relative flex flex-col h-screen bg-white border-r border-gray-100 transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[68px]' : 'w-[230px]'}`}
      >
        {/* ── Collapse Toggle ── */}
        <button
          onClick={() => setCollapsed(p => !p)}
          className="sidebar-toggle"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <MdChevronLeft
            size={14}
            color="#9CA3AF"
            style={{
              transition: 'transform 0.3s',
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>

        {/* ── Brand Header ── */}
        <div
          className={`flex items-center gap-3 border-b border-gray-50 transition-all duration-300
            ${collapsed ? 'px-3 py-4 justify-center' : 'px-4 py-4'}`}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#FF5934] flex items-center justify-center shadow-md shadow-orange-100">
            <span className="text-white font-bold text-base select-none">K</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-[#111827] font-bold text-[15px] leading-tight tracking-tight">Karyana</p>
              <p className="text-[10px] font-semibold text-[#B0B7C3] tracking-[0.12em] uppercase">Dashboard</p>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 nav-scroll overflow-y-auto py-2">

          {/* ════ WAREHOUSE MANAGER ════ */}
          {isWM && (
            <>
              <SectionLabel collapsed={collapsed}>Warehouse</SectionLabel>
              <NavItem to="/Product" icon={MdInventory2}   label="Product" collapsed={collapsed} />
              <NavItem to="/Order"   icon={MdShoppingCart} label="Orders"  collapsed={collapsed} />
            </>
          )}

          {/* ════ COORDINATOR ════ */}
          {!isWM && isCoordinator && (
            <>
              <SectionLabel collapsed={collapsed}>People</SectionLabel>
              <NavItem to="/Users/Sales"         icon={FaRegUser}       label="Users"                 collapsed={collapsed} />
              <NavItem to="/attendance-tracking" icon={MdCalendarMonth} label="Attendance & Tracking" collapsed={collapsed} />

              <SectionLabel collapsed={collapsed}>Catalog</SectionLabel>
              <NavItem to="/Product"    icon={MdInventory2} label="Product"    collapsed={collapsed} />
              <NavItem to="/Categories" icon={MdCategory}   label="Categories" collapsed={collapsed} />
              <NavItem to="/Brands"     icon={SlDiamond}    label="Brands"     collapsed={collapsed} />

              <SectionLabel collapsed={collapsed}>Operations</SectionLabel>
              <NavItem to="/Order"  icon={MdShoppingCart} label="Orders" collapsed={collapsed} />
              <NavItem to="/Banner" icon={MdImage}        label="Banner" collapsed={collapsed} />
            </>
          )}

          {/* ════ SUPER ADMIN ════ */}
          {!isWM && !isCoordinator && (
            <>
              <SectionLabel collapsed={collapsed}>Overview</SectionLabel>
              <NavItem to="/Dashboard" icon={MdDashboard} label="Dashboard" collapsed={collapsed} />

              {/* ── Sales Module ── */}
              <NavGroup icon={MdPointOfSale} label="Sales Module" collapsed={collapsed}>
                <SubNavItem to="/Users/Coordinators" icon={MdPeople}       label="Customers" />
                <SubNavItem to="/Order"              icon={MdShoppingCart} label="Orders"    />
                <SubNavItem to="/Sales/Invoices"     icon={MdReceipt}      label="Invoices"  />
                <SubNavItem to="/Sales/Payments"     icon={MdPayment}      label="Payments"  />
              </NavGroup>

              {/* ── Recovery ── */}
              <NavGroup icon={MdAutorenew} label="Recovery" collapsed={collapsed}>
                <SubNavItem to="/Recovery"     icon={MdListAlt}          label="Recovery Listing" />
                <SubNavItem to="/Recovery/Add" icon={MdAddCircleOutline} label="Add Recovery"     />
              </NavGroup>

              {/* ── Attendance ── */}
              <NavGroup icon={MdFingerprint} label="Attendance" collapsed={collapsed}>
                <SubNavItem to="/attendance-tracking" icon={MdCalendarMonth} label="Check-In/Out"       />
                <SubNavItem to="/Attendance/History"  icon={MdHistory}       label="Attendance History" />
              </NavGroup>

              {/* ── Tracking ── */}
              <NavGroup icon={MdMap} label="Tracking" collapsed={collapsed}>
                <SubNavItem to="/Tracking/Location" icon={MdLocationOn} label="Location Tracking" />
                <SubNavItem to="/Tracking/Reports"  icon={MdBarChart}   label="Tracking Reports"  />
              </NavGroup>

              {/* ── Ledger ── */}
              <NavGroup icon={FaBook} label="Ledger" collapsed={collapsed}>
                <SubNavItem to="/Leders/LedgerSales" icon={MdPeople}     label="Customer Ledger" />
                <SubNavItem to="/Ledger/Reports"     icon={MdAssessment} label="Ledger Reports"  />
              </NavGroup>

              {/* ── Reports ── */}
              <NavGroup icon={MdAssessment} label="Reports" collapsed={collapsed}>
                <SubNavItem to="/Reports/Sales"           icon={MdPointOfSale}  label="Sales"                 />
                <SubNavItem to="/Product"       icon={MdInventory2}   label="Inventory"             />
                <SubNavItem to="/Reports/Recovery"        icon={MdAutorenew}    label="Recovery"              />
                <SubNavItem to="/Reports/Attendance"      icon={MdFingerprint}  label="Attendance"            />
                <SubNavItem to="/Reports/CustomerLedger"  icon={MdReceipt}      label="Customer Ledger"       />
                <SubNavItem to="/Reports/TargetVsAchieve" icon={FaBullseye}     label="Target vs Achievement" />
              </NavGroup>

              <SectionLabel collapsed={collapsed}>Catalog</SectionLabel>
              {/* <NavItem to="/Product"    icon={MdInventory2}  label="Inventory"   collapsed={collapsed} /> */}
              <NavItem to="/Brands"     icon={MdCategory}    label="Categories"  collapsed={collapsed} />
              <NavItem to="/Categories" icon={SlDiamond}     label="Brands"      collapsed={collapsed} />
              <NavItem to="/coupon"     icon={RiCoupon3Line} label="Coupon"      collapsed={collapsed} />

              <SectionLabel collapsed={collapsed}>Operations</SectionLabel>
              <NavItem to="/Cities" icon={MdLocationOn} label="Locations" collapsed={collapsed} />
              <NavItem to="/target" icon={FaBullseye}   label="Target"    collapsed={collapsed} />

              {/* ── Settings ── */}
              <SectionLabel collapsed={collapsed}>Settings</SectionLabel>
              <NavGroup icon={MdSettings} label="Settings" collapsed={collapsed}>
                <SubNavItem to="/Settings/Profile" icon={MdPerson}  label="Profile" />
                <SubNavItem to="/login"            icon={CiLogout}  label="Logout"  />
              </NavGroup>

              <SectionLabel collapsed={collapsed}>Legal</SectionLabel>
              <NavItem to="/PrivacyPolicy" icon={MdPrivacyTip} label="Privacy Policy"     collapsed={collapsed} />
              <NavItem to="/Terms"         icon={MdArticle}    label="Terms & Conditions" collapsed={collapsed} />
            </>
          )}
        </nav>

        {/* ── User Footer ── */}
        <div className="border-t border-gray-100 p-3">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center flex-col' : ''}`}>
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,89,52,0.12)', border: '1px solid rgba(255,89,52,0.2)' }}
            >
              <span className="text-[#FF5934] font-bold text-xs select-none">{initials}</span>
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[#111827] text-[13px] font-semibold truncate leading-tight">
                  {user?.name || "Admin"}
                </p>
                <p className="text-[#9CA3AF] text-[10px] truncate capitalize">{roleName}</p>
              </div>
            )}

            <button
              onClick={logoutHandler}
              title="Logout"
              className={`flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-[#9CA3AF] hover:text-[#FF5934] transition-colors duration-200
                ${collapsed ? 'mt-1' : ''}`}
            >
              <CiLogout size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;