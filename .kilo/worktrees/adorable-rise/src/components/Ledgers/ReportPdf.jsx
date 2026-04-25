import React, { useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Import useNavigate
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { GrFormPrevious } from 'react-icons/gr'; // Import back arrow icon
import logok from '../../../src/assets/logokaryana.png';

export const Report = () => {
  const reportRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate(); // Hook for navigation
  
  // Extract data passed from Purchase, Bank, or Sales component
  const { selectedUser, transactionData, type = 'purchase' } = location.state || {};

  // Function to format date as MMM/DD/YYYY (e.g., Feb/02/2023)
  const formatDate = (dateString) => {
    const date = dateString ? new Date(dateString) : new Date();
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const month = monthNames[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Calculate the date range: first transaction date to today
  const getDateRange = () => {
    if (!transactionData || transactionData.length === 0) {
      return {
        startDate: new Date(),
        endDate: new Date(),
      };
    }

    // Sort transactions by date to find the earliest (first) date
    const sortedTransactions = [...transactionData].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    const firstTransactionDate = new Date(sortedTransactions[0].date); // Earliest transaction date
    const today = new Date('2025-02-24'); // Current date (February 24, 2025, as per your provided date)

    return {
      startDate: firstTransactionDate,
      endDate: today,
    };
  };

  const { startDate, endDate } = getDateRange();

  // Calculate totals based on transaction type
  const calculateTotals = () => {
    let totalDebit = 0;
    let totalCredit = 0;
    let runningBalance = 0;

    const transactions = transactionData?.map((transaction) => {
      // Ensure dr and cr are strings and handle numeric values
      const drStr = transaction.dr !== null && transaction.dr !== undefined 
        ? String(transaction.dr) 
        : "0";
      const crStr = transaction.cr !== null && transaction.cr !== undefined 
        ? String(transaction.cr) 
        : "0";

      const debit = drStr !== "0" ? parseFloat(drStr.replace(/[^0-9.]/g, '')) : 0;
      const credit = crStr !== "0" ? parseFloat(crStr.replace(/[^0-9.]/g, '')) : 0;

      totalDebit += debit;
      totalCredit += credit;
      runningBalance = runningBalance + credit - debit;

      if (type === 'purchase') {
        return {
          date: transaction.date,
          details: transaction.details,
          refNo: transaction.refNo ?? '-',
          voucherNo: transaction.voucherNo ?? '-',
          purchase: credit > 0 ? credit : null,
          payment: debit > 0 ? debit : null,
          balance: runningBalance,
        };
      } else if (type === 'sales') {
        return {
          date: transaction.date,
          details: transaction.details,
          refNo: transaction.refNo ?? '-',
          voucherNo: transaction.voucherNo ?? '-',
          debit: debit > 0 ? debit : null, // Use debit for payments
          credit: credit > 0 ? credit : null, // Use credit for sales
          balance: runningBalance,
        };
      } else {
        return {
          date: transaction.date,
          details: transaction.details || transaction.sourceName,
          refNo: transaction.refNo ?? '-',
          voucherNo: transaction.voucherNo ?? '-',
          debit: debit > 0 ? debit : null,
          credit: credit > 0 ? credit : null,
          balance: runningBalance,
        };
      }
    }) || [];

    return {
      transactions,
      totalDebit,
      totalCredit,
      netBalance: totalCredit - totalDebit,
      runningBalance,
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

      // Calculate the height of the content
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

      pdf.save(`KAR-${selectedUser?.companyName || selectedUser?.bankName || selectedUser?.name || 'report'}-${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } finally {
      // Restore the download button and hidden elements
      if (downloadButton) {
        downloadButton.style.display = 'flex';
      }
      hiddenElements.forEach(el => {
        el.style.display = 'block';
      });
    }
  };

  if (!selectedUser || !transactionData) {
    return <div>No data available for report</div>;
  }

  const { transactions, totalDebit, totalCredit, netBalance, runningBalance } = calculateTotals();

  // Handle back navigation
  const handleBack = () => {
    navigate(-1); // Navigate back to the previous page
  };

  return (
    <div ref={reportRef} className="min-h-screen flex flex-col m-0 p-0"> {/* Removed default margins and padding */}
      <div className="text-white">
        {/* Back Icon - Only visible on web, not in PDF */}
        <div className="pdf-hidden"> {/* Using pdf-hidden class for dynamic hiding in PDF */}
          <button
            onClick={handleBack}
            className="text-white text-2xl hover:text-gray-300 bg-[#FF5934] mr-4 p-1 rounded-lg"
            aria-label="Go back"
          >
            <GrFormPrevious />
          </button>
        </div>

        {/* Header with Content - Adjusted to start at top */}
        <div className="flex justify-between items-center px-4 py-6 bg-[#FF5934] mt-0"> {/* Removed margin-top */}
          <div>
            <p className="text-xl font-semibold">
              {type === 'purchase' ? selectedUser.companyName : 
               type === 'sales' ? selectedUser.name || selectedUser.shopName || 'Unknown Retailer' : 
               selectedUser.bankName}
            </p>
            <p>
              {type === 'purchase' ? selectedUser.phone : 
               type === 'sales' ? selectedUser.phone || 'N/A' : 
               selectedUser.accountNumber}
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
            {type === 'purchase' ? `${selectedUser.companyName} Statement` : 
             type === 'sales' ? `${selectedUser.name || selectedUser.shopName || 'Retailer'} Statement` : 
             `${selectedUser.bankName} Statement`}
          </p>
          <p className="text-lg text-black">
            {type === 'purchase' ? `Phone Number: ${selectedUser.phone}` : 
             type === 'sales' ? `Phone Number: ${selectedUser.phone || 'N/A'}` : 
             `Account Number: ${selectedUser.accountNumber}`}
          </p>
          <p className="text-black">
            {formatDate(startDate)} - {formatDate(endDate)}
          </p>
        </div>
      </div>

      {/* Balance Summary Table */}
      <div className="w-full px-4 py-6 flex-grow">
        <table className="w-full border border-black text-sm mb-6">
          <tbody>
            <tr>
              <td className="p-4 border-r border-black">Opening Balance</td>
              <td className="p-4 border-r border-black">Total Debit</td>
              <td className="p-4 border-r border-black">Total Credit</td>
              <td className="p-4">Running Balance</td>
            </tr>
            <tr className="text-right">
              <td className="p-4 border-r border-black">Rs. 0</td>
              <td className="p-4 border-r border-black">Rs. {totalDebit.toLocaleString()}</td>
              <td className="p-4 border-r border-black">Rs. {totalCredit.toLocaleString()}</td>
              <td className="p-4">Rs. {runningBalance.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="w-full px-4 py-6 flex-grow">
        <div className="py-6 font-medium text-black">
          <p>No. of Entries: {transactions.length} (All)</p>
        </div>
        <div className="overflow-x-auto flex-grow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-3 text-left border border-gray-300">Date</th>
                <th className="p-3 text-left border border-gray-300">Details</th>
                <th className="p-3 text-left border border-gray-300">Ref no.</th>
                <th className="p-3 text-left border border-gray-300">V. no.</th>
                <th className="p-3 text-left border border-gray-300">Debit</th>
                <th className="p-3 text-left border border-gray-300">Credit</th>
                <th className="p-3 text-left border border-gray-300">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => (
                <tr key={index} className="border-b border-gray-300">
                  <td className="p-3 border border-gray-300 ">{transaction.date}</td>
                  <td className="p-3 border border-gray-300">{transaction.details}</td>
                  <td className="p-3 border border-gray-300">{transaction.refNo || '-'}</td>
                  <td className="p-3 border border-gray-300">{transaction.voucherNo || '-'}</td>
                  <td className="p-3 border border-gray-300">
                    {type === 'purchase' ? (
                      transaction.payment && (
                        <span className="text-black">
                          Rs {transaction.payment.toLocaleString()}
                        </span>
                      )
                    ) : (
                      transaction.debit && (
                        <span className="text-black">
                          Rs {transaction.debit.toLocaleString()}
                        </span>
                      )
                    )}
                  </td>
                  <td className="p-3 border border-gray-300">
                    {type === 'purchase' ? (
                      transaction.purchase && (
                        <span className="text-black">
                          Rs {transaction.purchase.toLocaleString()}
                        </span>
                      )
                    ) : (
                      transaction.credit && (
                        <span className="text-black">
                          Rs {transaction.credit.toLocaleString()}
                        </span>
                      )
                    )}
                  </td>
                  <td className="p-3 border border-gray-300">
                    <span className={transaction.balance >= 0 ? "text-black" : "text-black"}>
                      Rs {Math.abs(transaction.balance).toLocaleString()}
                    </span>
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
            <td className="w-2/5 p-3">Grand Total</td>
            <td className="p-3 text-left text-black">Rs {totalDebit.toLocaleString()}</td>
            <td className="p-3 text-left text-black">Rs {totalCredit.toLocaleString()}</td>
            <td className="p-3 text-left text-black">Rs {runningBalance.toLocaleString()}</td>
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

export default Report;