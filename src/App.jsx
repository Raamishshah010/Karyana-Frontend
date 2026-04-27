import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from "react-redux";
import Sidebar from './pages/Sidebar';
import Terms from './pages/Terms';
import Dashboard from './pages/Dashboard';
import Product from './pages/Product';
import Login from './pages/Login';
import Cities from './pages/Cities';
import LoadForm from './pages/LoadForm';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Brands from './pages/Brands';
import Banner from './pages/Banner';
import { GoBell } from "react-icons/go";
import Users from './components/Users/User';
import Sales from './components/Users/Sales';
import Coordinators from './components/Users/Coordinators';
import Retailers from './components/Users/Retailers';
import WarehouseManagers from './components/Users/WarehouseManagers';
import Category from './pages/Category';
import Logs from './pages/Logs';
import ClickOutside from './Hooks/ClickOutside';
import Order from './pages/Order';
import './CSS/Login.css';
import { ROLES } from './utils';
import Ledger from './components/Ledgers/Ledger';
import LedgerSales from './components/Ledgers/LedgerSales';
import Purchase from './components/Ledgers/Purchase';
import Bank from './components/Ledgers/Bank';
import ReportPdf from './components/Ledgers/ReportPdf';
import Report from './components/Report/Report';
import AgingReport from './components/Report/AgingReport';
import Bankpdf from './components/Ledgers/ReceiptModal';
import AgingTemplate from './components/Report/AgingTemplate';
import InvoiceTemplate from './components/Report/InvoiceTemplate';
import Units from './components/units/Units';
import UnitHero from './components/units/UnitHero';
import SalesReport from './components/Report/SalesReport';
import SalesTemplate from './components/Report/SalesTemplate';
import CustomerTargetTemp from './components/Report/CustomerTargetTemp';
import CustomerTargetReport from './components/Report/CustomerTargetReport';
import AttandanceTracking from './pages/attendanceTracking';
import Attandance from './pages/attendance.jsx';
import Tracking from './pages/tracking.jsx';
import Reports from './pages/Reports.jsx';
import Visits from './pages/visits.jsx';
import AttendanceReport from './pages/AttendanceReport.jsx';
import TrackingReport from './pages/TrackingReport.jsx';
import Coupon from './pages/Coupon.jsx';
import Target from './pages/Target.jsx';
import TargetHistory from './pages/TargetHistory.jsx';
import TargetHistoryReport from './pages/TargetHistoryReport.jsx';

// ── Persistent filters context ──
import { FilterProvider } from './context/FilterContext';
import InvoicePage from './pages/InvoicePage.jsx';
import SalesPayments from './pages/SalesPayments.jsx';

const App = () => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const admin = useSelector((state) => state.admin);

  const MainLayout = () => {
    const location = useLocation();
    const isAgingTemplate = location.pathname === '/aging-template';
    const isSalesTemplate = location.pathname === '/sales-report-template';
    const isCustomerTargetTemplate = location.pathname === '/customer-target-template';
    const isInvoiceTemplate = location.pathname === '/invoice-template';

    if (isCustomerTargetTemplate) {
      return (
        <Routes>
          <Route path='/customer-target-template' element={<CustomerTargetTemp />} />
        </Routes>
      );
    }

    if (isAgingTemplate || isSalesTemplate || isInvoiceTemplate) {
      return (
        <Routes>
          <Route path='/aging-template' element={<AgingTemplate />} />
          <Route path='/sales-report-template' element={<SalesTemplate />} />
          <Route path='/invoice-template' element={<InvoiceTemplate />} />
        </Routes>
      );
    }

    return (
      <div className='flex'>
        <Sidebar className='rounded-r-xl' />
        <div className="flex-1 flex flex-col bg-[#F8F8F8]">
          <div className='nav flex justify-between items-center h-[60px] w-full p-4 shadow'>
            <div className="left">
              <h1 className='font-bold text-sm md:text-xl'>
                Welcome <span className='capitalize'>{admin?.role}</span>!
              </h1>
              <p className='text-gray-500'>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })}
              </p>
            </div>
            {admin?.role?.includes(ROLES[0]) && (
              <div className="right flex items-center space-x-4 relative">
                {notificationsOpen && (
                  <ClickOutside onClick={toggleNotifications}>
                    <div className="absolute right-0 top-full mt-2 md:w-64 w-48 bg-white shadow-lg rounded p-4 z-50">
                      <p>No new notifications</p>
                    </div>
                  </ClickOutside>
                )}
                <GoBell
                  size={25}
                  onClick={() => setNotificationsOpen(true)}
                  className="cursor-pointer border border-gray-400 rounded-lg p-1"
                />
                <h2 className='font-bold'>Admin</h2>
              </div>
            )}
          </div>
          <div className="main-content flex-1 p-4 overflow-y-hidden">
            <Routes>
              <Route path="/" element={<Navigate to="/Dashboard" />} />
              <Route path="/Dashboard" element={<Dashboard />} />
              <Route path="/Users/*" element={<Users />} />
              <Route path="/Users/Sales" element={<Sales />} />
              <Route path="/Users/Warehousemanagers" element={<WarehouseManagers />} />
              <Route path="/Users/Coordinators" element={<Coordinators />} />
              <Route path="/Users/Retailers" element={<Retailers />} />
              <Route path="/Product" element={<Product />} />
              <Route path="/Sales/Invoices" element={<InvoicePage />} />
              <Route path="/Sales/Payments" element={<SalesPayments />} />
              <Route path="/attendance-tracking" element={<AttandanceTracking />} />
              <Route path="/attendance-tracking/attendance" element={<Attandance />} />
              <Route path="/attendance-tracking/tracking" element={<Tracking />} />
              <Route path="/attendance-tracking/tracking-report" element={<TrackingReport />} />
              <Route path="/attendance-tracking/reports" element={<Reports />} />
              <Route path="/attendance-tracking/visits" element={<Visits />} />
              <Route path="/attendance-report" element={<AttendanceReport />} />
              <Route path="/coupon" element={<Coupon />} />
              <Route path='/target' element={<Target />} />
              <Route path='/target-history/:salesId' element={<TargetHistory />} />
              <Route path='/target-history/report' element={<TargetHistoryReport />} />
              <Route path="/Categories" element={<Category />} />
              <Route path="/Ledgers/*" element={<Ledger />} />
              <Route path="/Leders/LedgerSales" element={<LedgerSales />} />
              <Route path="/Ledgers/Purchase" element={<Purchase />} />
              <Route path="/Ledgers/Bank" element={<Bank />} />
              <Route path="/Brands" element={<Brands />} />
              <Route path="/Cities" element={<Cities />} />
              <Route path="/Banner" element={<Banner />} />
              <Route path="/Logs" element={<Logs />} />
              <Route path="/Order" element={<Order />} />
              <Route path="/load-form" element={<LoadForm />} />
              <Route path='/reportpdf' element={<ReportPdf />} />
              <Route path='/bankpdf' element={<Bankpdf />} />
              <Route path='/Units' element={<Units />} />
              <Route path='/UnitHero' element={<UnitHero />} />
              <Route path="/Reports" element={<Report />}>
                <Route path="AgingReport" element={<AgingReport />} />
                <Route path='SalesReport' element={<SalesReport />} />
              </Route>
              <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
              <Route path="/Terms" element={<Terms />} />
            </Routes>
          </div>
        </div>
      </div>
    );
  };

  const toggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen);
  };

  // ── Unauthenticated: just the login route, no FilterProvider needed ──
  if (!admin?.isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Router>
    );
  }

  // ── Authenticated: FilterProvider wraps the entire app so all pages
  //    share the same filter context and state persists across navigation ──
  return (
    <div className='overall'>
      <FilterProvider>
        <Router>
          <Routes>
            <Route path="/aging-template" element={<AgingTemplate />} />
            <Route path="/invoice-template" element={<InvoiceTemplate />} />
            <Route path='/customer-target-report' element={<CustomerTargetReport />} />
            <Route path="/*" element={<MainLayout />} />
          </Routes>
        </Router>
      </FilterProvider>
    </div>
  );
};

export default App;