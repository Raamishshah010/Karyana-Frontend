import React, { useRef } from 'react';
import { AiOutlineDownload } from 'react-icons/ai';
import { FaShare } from 'react-icons/fa';
import html2canvas from 'html2canvas'; // Ensure html2canvas is installed

const ReceiptModal = ({ transaction, onClose, type = 'bank' }) => {
  const modalRef = useRef(null); // Ref to capture the modal content

  // Ensure transaction.dr and transaction.cr are strings, with fallback for null/undefined
  const drStr = transaction.dr !== null && transaction.dr !== undefined 
    ? String(transaction.dr) 
    : "0";
  const crStr = transaction.cr !== null && transaction.cr !== undefined 
    ? String(transaction.cr) 
    : "0";

  // Parse transaction amounts (removing commas and 'PKR', converting to numbers)
  const debit = drStr !== "0" ? parseFloat(drStr.replace(/[^0-9.]/g, '')) : 0;
  const credit = crStr !== "0" ? parseFloat(crStr.replace(/[^0-9.]/g, '')) : 0;

  // Handle different types of transactions (bank or purchase)
  let items = [];
  let totalAmount = 0;
  let discount = 0;

  if (type === 'purchase') {
    // For purchase transactions, assume items are available
    items = transaction.items || [];
    totalAmount = items.length > 0 
      ? items.reduce((total, item) => total + (item.purchaseRate * item.quantity), 0) 
      : credit; // Use credit for purchases if no items
    discount = items.length > 0 
      ? items.reduce((total, item) => total + ((item.purchaseRate * item.quantity * (item.purchaseDiscount || 0)) / 100), 0) 
      : 0; // Calculate discount if items exist
  } else {
    // For bank transactions, no items, use debit/credit directly
    totalAmount = debit > 0 ? debit : credit; // Use debit for withdrawals, credit for deposits
    discount = 0; // No discount for bank transactions
  }

  const finalTotal = totalAmount - discount;

  // Function to share as image to WhatsApp
  const handleShareToWhatsApp = async () => {
    try {
      // Use html2canvas to capture the modal content as an image
      const canvas = await html2canvas(modalRef.current, { scale: 2, useCORS: true });
      const imageDataUrl = canvas.toDataURL('image/png');

      // Create a Blob from the image data
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();

      // Create a temporary URL for the Blob
      const imageUrl = URL.createObjectURL(blob);

      // WhatsApp share URL with image (note: WhatsApp Web or mobile app may handle this differently)
      const whatsappUrl = `https://wa.me/?text=Check%20this%20transaction%20receipt:%20${encodeURIComponent(imageUrl)}`;
      
      // Open WhatsApp in a new window/tab
      window.open(whatsappUrl, '_blank');

      // Clean up: revoke the object URL to free memory
      URL.revokeObjectURL(imageUrl);
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
      toast.error('Failed to share to WhatsApp. Please try again or use another method.');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-[300px] p-4 relative pt-14" style={{ borderRadius: '20px', minHeight: '400px' }}>
        {/* Orange Header with Karyana Logo */}
        <div className="bg-[#FF5934] rounded-t-lg p-2 flex justify-center items-center text-white font-bold text-xl">
          Karyana
        </div>

        {/* Receipt Content with Padding and Gray Background */}
        <div className="p-6 bg-gray-100 rounded-b-lg"> {/* Increased padding to p-6 and added bg-gray-100 */}
          <h2 className="text-center text-lg font-semibold mb-4">Transaction Completed</h2>
          <p className="text-center text-sm mb-2">
            {new Date(transaction.date).toLocaleString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </p>

          {/* Total Amount */}
          <div className="bg-gray-100 p-4 rounded-lg mb-4 text-center">
            <p className="text-2xl font-bold text-[#FF5934]">Rs {finalTotal.toLocaleString()}</p>
          </div>

          {/* Details */}
          <div className="space-y-2 flex flex-col justify-between h-full">
            {type === 'bank' ? (
              <>
                <p><strong>Account:</strong> {transaction.sourceName || 'Unknown Account'}</p>
                <p><strong>Description:</strong> {transaction.details || 'No details provided'}</p>
                {/* Placeholder divs to maintain height, styled to match the original spacing */}
                <div className="h-6"></div> {/* Spacer for Debit */}
                <div className="h-6"></div> {/* Spacer for Credit */}
                <div className="h-6"></div> {/* Spacer for Account Balance */}
              </>
            ) : (
              <>
                <p><strong>Paid by:</strong> {transaction.details || 'Unknown Payer'}</p>
                <p>
                  <strong>Items:</strong>
                  {items.length > 0 ? (
                    items.map((item, index) => (
                      <span key={index} className="block">
                        {item.quantity}x {item.product?.englishTitle || item.product?.urduTitle || 'Unnamed Product'} @ Rs {item.purchaseRate.toLocaleString()} each
                      </span>
                    ))
                  ) : (
                    <span className="block">No items available for this transaction</span>
                  )}
                </p>
                <p><strong>Items Price:</strong> Rs {totalAmount.toLocaleString()}</p>
                <p><strong>Discount:</strong> -Rs {discount.toLocaleString()}</p>
              </>
            )}
          </div>

          {/* Reference */}
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>Reference: #{transaction.id?.slice(0, 6).toUpperCase() || 'Unknown'}</p>
          </div>

          {/* Dashed Line */}
          <div className="mt-4 border-t border-dashed border-gray-300"></div>

          {/* Buttons */}
          <div className="mt-4 flex justify-between">
            <button
              className="bg-black text-white px-4 py-2 rounded-full flex items-center gap-2"
              onClick={handleShareToWhatsApp} // Updated to use the share function
            >
              <FaShare /> Share
            </button>
            <button
              className="bg-[#FF5934] text-white px-4 py-2 rounded-full flex items-center gap-2"
              onClick={() => {
                console.log('Download clicked');
              }}
            >
              <AiOutlineDownload /> Download
            </button>
          </div>
        </div>

        {/* Close Button - Moved to right side, larger size */}
        <button
          className="absolute top-2 right-2 text-xl p-2 bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-300 w-10" 
          onClick={onClose}
        >
          x
        </button>
      </div>
    </div>
  );
};

export default ReceiptModal;