import React, { useEffect, useState } from 'react';
import { getAllRetailers, getInvoicesByRange } from '../../APIS';
import placeholder from '../../../public/placeholder.png';
import { Loader } from '../common/loader';

const AgingReport = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    const fetchRetailers = async () => {
      try {
        const retailersResponse = await getAllRetailers();
        if (retailersResponse?.data?.data && Array.isArray(retailersResponse.data.data)) {
          setReportData(retailersResponse.data.data);
        } else {
          throw new Error('Invalid retailers response format');
        }
      } catch (err) {
        setError(err.message || 'An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchRetailers();
  }, []);

  const fetchInvoicesForRetailer = async (retailerId) => {
    setDetailsLoading(true);
    try {
      const ranges = ['1to7', '8to14', '15to30', '31to50', 'over50'];
      let allInvoiceDetails = [];

      for (const range of ranges) {
        try {
          const invoicesResponse = await getInvoicesByRange(retailerId, range);
          if (invoicesResponse && invoicesResponse.invoices) {
            allInvoiceDetails = allInvoiceDetails.concat(invoicesResponse.invoices);
          }
        } catch (invoiceError) {
          console.error(`Error fetching ${range} invoices for retailer ${retailerId}:`, invoiceError);
        }
      }

      const uniqueInvoices = Array.from(new Set(allInvoiceDetails.map(JSON.stringify)))
        .map(JSON.parse)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const selectedRetailerData = reportData.find(retailer => retailer._id === retailerId);
      if (selectedRetailerData) {
        const totalAmount = uniqueInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);

        const selectedDetail = {
          retailer: selectedRetailerData,
          range: 'all',
          amount: totalAmount,
          balance: selectedRetailerData.balance,
          details: uniqueInvoices.map((invoice, index) => ({
            sr: index + 1,
            date: new Date(invoice.createdAt).toLocaleDateString(),
            shopName: selectedRetailerData.shopName || 'N/A',
            invoiceId: invoice._id,
            total: invoice.totalAmount || 0,
            balance: invoice.balance || 0,
            agingDays: calculateAgingDays(invoice.createdAt, getRangeForAgingDays(calculateAgingDays(invoice.createdAt, 'all')))
          }))
        };

        // Store the selectedDetail in localStorage to pass to the new tab
        localStorage.setItem('agingTemplateData', JSON.stringify(selectedDetail));
        
        // Open the new route in a new tab
        window.open('/aging-template', '_blank');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching invoice details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const calculateAgingDays = (invoiceDate, range) => {
    const today = new Date();
    const invoiceCreatedAt = new Date(invoiceDate);
    const timeDiff = today - invoiceCreatedAt;
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    switch (range) {
      case '1to7':
        return Math.max(0, 7 - daysDiff);
      case '8to14':
        return Math.max(0, 14 - daysDiff);
      case '15to30':
        return Math.max(0, 30 - daysDiff);
      case '31to50':
        return Math.max(0, 50 - daysDiff);
      case 'over50':
        return Math.max(0, daysDiff - 50);
      default:
        return daysDiff;
    }
  };

  const getRangeForAgingDays = (days) => {
    if (days <= 7) return '1to7';
    if (days <= 14) return '8to14';
    if (days <= 30) return '15to30';
    if (days <= 50) return '31to50';
    return 'over50';
  };

  const handleRunReport = () => {
    if (selectedRetailer) {
      fetchInvoicesForRetailer(selectedRetailer);
    } else {
      setError('Please select a retailer');
    }
  };

  if (loading) return <Loader />;
  if (error) return <div className="p-6 max-w-6xl mx-auto text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 mx-auto max-w-[1400px]">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          {/* Filter Section */}
          <div className="mb-6 flex flex-wrap gap-4">
            <select
              value={selectedRetailer}
              onChange={(e) => setSelectedRetailer(e.target.value)}
              className="p-2 border rounded-lg flex-grow md:flex-grow-0"
            >
              <option value="">Select Retailer</option>
              {reportData.map((retailer) => (
                <option key={retailer._id} value={retailer._id}>
                  {retailer.name} - {retailer.shopName}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 border rounded-lg flex-grow md:flex-grow-0"
            />
            <button
              onClick={handleRunReport}
              className="p-2 bg-[#FF5934] text-white rounded-lg hover:bg-[#e04a28] transition-colors flex-grow md:flex-grow-0"
            >
              Run report
            </button>
          </div>

          {detailsLoading && <Loader />}
        </div>
      </div>
    </div>
  );
};

export default AgingReport;