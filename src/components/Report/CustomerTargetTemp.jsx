import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { GrFormPrevious } from 'react-icons/gr';
import logok from '../../../src/assets/logokaryana.png';

const CustomerTargetTemp = () => {
  const reportRef = useRef(null);
  const navigate = useNavigate();

  // Dummy data from the screenshot
  const salesData = [
    { sr: 101, customer: "HAFIZA MAH-102", salesperson: "Faisal MAH-102", previousSale: 100, target: 50, recovery: 0, qty: 0, openingBalance: 124130, netSales: 0, payment: 0, currentBalance: 124130 },
    { sr: 102, customer: "RANA NAWAZ-102", salesperson: "Faisal MAH-102", previousSale: 100, target: 50, recovery: 0, qty: 0, openingBalance: 104250, netSales: 0, payment: 0, currentBalance: 104250 },
    { sr: 103, customer: "FIDA-102", salesperson: "Faisal MAH-102", previousSale: 100, target: 70, recovery: 0, qty: 0, openingBalance: 145146, netSales: 0, payment: 0, currentBalance: 145146 },
    { sr: 104, customer: "G.B. TRADER OLIGHT", salesperson: "Faisal MAH-102", previousSale: 70, target: 30, recovery: 0, qty: 0, openingBalance: 127105, netSales: 0, payment: 0, currentBalance: 127105 },
    { sr: 105, customer: "G.B. TRADER OLIGHT", salesperson: "Faisal MAH-102", previousSale: 70, target: 30, recovery: 0, qty: 0, openingBalance: 127105, netSales: 0, payment: 0, currentBalance: 127105 },
    { sr: 106, customer: "GULAMAT NAGAR", salesperson: "Faisal MAH-102", previousSale: 0, target: 0, recovery: 0, qty: 0, openingBalance: 0, netSales: 0, payment: 0, currentBalance: 0 },
    { sr: 107, customer: "KHIZRA TRADER", salesperson: "Faisal MAH-110", previousSale: 0, target: 0, recovery: 0, qty: 0, openingBalance: 263132, netSales: 0, payment: 0, currentBalance: 263132 },
    { sr: 108, customer: "SHAMI MAH-110", salesperson: "Faisal MAH-110", previousSale: 0, target: 0, recovery: 0, qty: 0, openingBalance: 294159, netSales: 0, payment: 0, currentBalance: 294159 },
    { sr: 109, customer: "HAYELVAN MAH-117", salesperson: "Faisal MAH-117", previousSale: 0, target: 0, recovery: 0, qty: 0, openingBalance: 291509, netSales: 0, payment: 0, currentBalance: 291509 },
    { sr: 110, customer: "MARKETING", salesperson: "Faisal MAH-117", previousSale: 0, target: 0, recovery: 0, qty: 0, openingBalance: 0, netSales: 0, payment: 0, currentBalance: 0 },
    { sr: 111, customer: "MAH-112", salesperson: "ISSAR TRADER", previousSale: 80, target: 0, recovery: 0, qty: 0, openingBalance: 149925, netSales: 0, payment: 0, currentBalance: 149925 },
    { sr: 112, customer: "TOWN MAH-112", salesperson: "ISSAR TRADER", previousSale: 0, target: 0, recovery: 0, qty: 0, openingBalance: 0, netSales: 0, payment: 0, currentBalance: 0 },
    { sr: 113, customer: "ENTERPRISES", salesperson: "Faisal MAH-117", previousSale: 175, target: 150, recovery: 0, qty: 0, openingBalance: 2913263, netSales: 0, payment: 0, currentBalance: 2913263 },
    { sr: 114, customer: "MAH-116", salesperson: "Faisal MAH-116", previousSale: 0, target: 0, recovery: 0, qty: 0, openingBalance: 187042, netSales: 0, payment: 0, currentBalance: 187042 },
    { sr: 115, customer: "MAH-116", salesperson: "ZAHAR TRADER", previousSale: 30, target: 30, recovery: 0, qty: 0, openingBalance: 391419, netSales: 0, payment: 0, currentBalance: 391419 },
    { sr: 116, customer: "MAH-116", salesperson: "ZAHAR TRADER", previousSale: 0, target: 0, recovery: 0, qty: 0, openingBalance: 194159, netSales: 0, payment: 0, currentBalance: 194159 },
    { sr: 117, customer: "QASIM TRADER", salesperson: "Faisal MAH-116", previousSale: 250, target: 250, recovery: 0, qty: 0, openingBalance: 1500, netSales: 0, payment: 0, currentBalance: 1500 },
    { sr: 118, customer: "TANKWALA MAH-116", salesperson: "Faisal MAH-116", previousSale: 200, target: 100, recovery: 0, qty: 0, openingBalance: 0, netSales: 0, payment: 0, currentBalance: 0 },
    { sr: 119, customer: "MAH-116", salesperson: "TRADER", previousSale: 100, target: 100, recovery: 0, qty: 0, openingBalance: 0, netSales: 0, payment: 0, currentBalance: 0 },
  ];

  // Calculate totals
  const calculateTotals = () => {
    const totalQty = salesData.reduce((sum, item) => sum + (item.qty || 0), 0);
    const totalOpeningBalance = salesData.reduce((sum, item) => sum + (item.openingBalance || 0), 0);
    const totalNetSales = salesData.reduce((sum, item) => sum + (item.netSales || 0), 0);
    const totalPayment = salesData.reduce((sum, item) => sum + (item.payment || 0), 0);
    const totalCurrentBalance = salesData.reduce((sum, item) => sum + (item.currentBalance || 0), 0);

    return {
      totalQty,
      totalOpeningBalance,
      totalNetSales,
      totalPayment,
      totalCurrentBalance,
    };
  };

  const downloadPDF = async () => {
    const element = reportRef.current;

    // Temporarily hide the download button and elements with pdf-hidden class
    const downloadButton = element.querySelector('button.flex.items-center.gap-2.px-3.py-1.font-semibold.text-black.bg-white.rounded-md.hover\\:bg-\\[\\#FF5934\\]');
    const hiddenElements = element.querySelectorAll('.pdf-hidden');

    if (downloadButton) {
      downloadButton.style.display = 'none';
    }
    hiddenElements.forEach(el => {
      el.style.display = 'none';
    });

    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const data = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(data, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position += pdfHeight;
        pdf.addPage();
        pdf.addImage(data, 'PNG', 0, -heightLeft, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Customer-Target-Recovery-Report-${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } finally {
      if (downloadButton) {
        downloadButton.style.display = 'flex';
      }
      hiddenElements.forEach(el => {
        el.style.display = 'block';
      });
    }
  };

  if (!salesData || salesData.length === 0) {
    return <div>No data available for report</div>;
  }

  const { totalQty, totalOpeningBalance, totalNetSales, totalPayment, totalCurrentBalance } = calculateTotals();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div ref={reportRef} className="min-h-screen flex flex-col m-0 p-0">
      <div className="text-white">
        {/* Back Icon - Only visible on web, not in PDF */}
        <div className="pdf-hidden">
          <button
            onClick={handleBack}
            className="text-white text-2xl hover:text-gray-300 bg-[#FF5934] mr-4 p-1 rounded-lg"
            aria-label="Go back"
          >
            <GrFormPrevious />
          </button>
        </div>

        {/* Header with Content */}
        <div className="flex justify-between items-center px-4 py-6 bg-[#FF5934] mt-0">
          <div>
            <p className="text-xl font-semibold">
            Karyana Sales Report
            </p>
            <p>
              Customer Target/Recovery Achievement Report
            </p>
          </div>
          <div className="flex items-center gap-2">
            <img src={logok} alt="logo" className="w-30 h-16" />
            <div className="flex mt-2">
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-3 py-1 font-semibold text-black bg-white rounded-md hover:bg-[#FF5934]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 pt-16 pb-6">
          <p className="text-xl font-semibold text-black">
            Customer Target/Recovery Achievement Report
          </p>
          <p className="text-black">
            Date From: 01/01/2023 - Date To: 30/04/2023
          </p>
          <p className="text-black">
            Salesperson: Ali
          </p>
        </div>
      </div>

      <div className="w-full px-4 py-6 flex-grow">
        <div className="py-6 font-medium text-black">
          <p>No. of Entries: {salesData.length} (All)</p>
        </div>
        <div className="overflow-x-auto flex-grow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-3 text-left border border-gray-300">S#</th>
                <th className="p-3 text-left border border-gray-300">Customer</th>
                <th className="p-3 text-left border border-gray-300">Salesperson</th>
                <th className="p-3 text-right border border-gray-300">Prev. Sales</th>
                <th className="p-3 text-right border border-gray-300">Target</th>
                <th className="p-3 text-right border border-gray-300">Recovery</th>
                <th className="p-3 text-right border border-gray-300">Qty</th>
                <th className="p-3 text-right border border-gray-300">Opening Balance</th>
                <th className="p-3 text-right border border-gray-300">Net Sales</th>
                <th className="p-3 text-right border border-gray-300">Payment</th>
                <th className="p-3 text-right border border-gray-300">Current Balance</th>
              </tr>
            </thead>
            <tbody>
              {salesData.map((detail, index) => (
                <tr key={index} className="border-b border-gray-300">
                  <td className="p-3 border border-gray-300">{detail.sr}</td>
                  <td className="p-3 border border-gray-300">{detail.customer}</td>
                  <td className="p-3 border border-gray-300">{detail.salesperson}</td>
                  <td className="p-3 text-right border border-gray-300">{detail.previousSale}</td>
                  <td className="p-3 text-right border border-gray-300">{detail.target}</td>
                  <td className="p-3 text-right border border-gray-300">{detail.recovery}</td>
                  <td className="p-3 text-right border border-gray-300">{detail.qty}</td>
                  <td className="p-3 text-right border border-gray-300">
                    Rs. {detail.openingBalance.toLocaleString()}
                  </td>
                  <td className="p-3 text-right border border-gray-300">
                    Rs. {detail.netSales.toLocaleString()}
                  </td>
                  <td className="p-3 text-right border border-gray-300">
                    Rs. {detail.payment.toLocaleString()}
                  </td>
                  <td className="p-3 text-right border border-gray-300">
                    Rs. {detail.currentBalance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-full px-4 py-6">
        <table className="w-full">
          <tr className="bg-gray-300">
            <td colSpan="6" className="p-3 text-left">Grand Total</td>
            <td className="p-3 text-right text-black">{totalQty.toLocaleString()}</td>
            <td className="p-3 text-right text-black">Rs. {totalOpeningBalance.toLocaleString()}</td>
            <td className="p-3 text-right text-black">Rs. {totalNetSales.toLocaleString()}</td>
            <td className="p-3 text-right text-black">Rs. {totalPayment.toLocaleString()}</td>
            <td className="p-3 text-right text-black">Rs. {totalCurrentBalance.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <div className="flex flex-col items-center px-4 py-6 bg-[#FF5934] w-full">
        <img src={logok} alt="logo" className="w-30 h-16" />
        <p className="text-white text-sm pt-3">www.primelinkdistribution.com</p>
        <div className="flex justify-between w-full text-white text-sm">
          <p>Email: office@primelinkdistribution.com</p>
          <p>Phone: +92 341 9527440</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerTargetTemp;