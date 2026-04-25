import React, { useRef } from 'react';
import { AiOutlineDownload } from 'react-icons/ai';
import { FaShare } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import html2canvas from 'html2canvas';

const ReceiptModal = ({ transaction, onClose, type = 'bank' }) => {
  const modalRef = useRef(null);

  const drStr = transaction.dr ? String(transaction.dr) : "0";
  const crStr = transaction.cr ? String(transaction.cr) : "0";

  const debit = parseFloat(drStr.replace(/[^0-9.]/g, '')) || 0;
  const credit = parseFloat(crStr.replace(/[^0-9.]/g, '')) || 0;

  let items = [];
  let totalAmount = 0;
  let discount = 0;

  if (type === 'purchase') {
    items = transaction.items || [];
    totalAmount = items.length
      ? items.reduce((t, i) => t + (i.purchaseRate * i.quantity), 0)
      : credit;

    discount = items.length
      ? items.reduce((t, i) => t + ((i.purchaseRate * i.quantity * (i.purchaseDiscount || 0)) / 100), 0)
      : 0;
  } else {
    totalAmount = debit > 0 ? debit : credit;
  }

  const finalTotal = totalAmount - discount;

  const handleShareToWhatsApp = async () => {
    const canvas = await html2canvas(modalRef.current, { scale: 2 });
    const image = canvas.toDataURL("image/png");
    const link = `https://wa.me/?text=${encodeURIComponent("Transaction Receipt")}`;
    window.open(link, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-[340px] bg-white rounded-3xl shadow-2xl overflow-hidden animate-[fadeIn_.25s_ease]"
      >

        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] text-white text-center py-4">
          <h2 className="text-lg font-bold tracking-wide">Karyana</h2>
          <p className="text-[11px] opacity-80">Transaction Receipt</p>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
        >
          <MdClose size={16} />
        </button>

        {/* Content */}
        <div className="p-5 bg-[#FAFAFA]">

          {/* Status */}
          <div className="text-center mb-4">
            <p className="text-sm text-gray-500">Transaction Completed</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(transaction.date).toLocaleString()}
            </p>
          </div>

          {/* Amount */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-4 text-center mb-4">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest">Total Amount</p>
            <p className="text-2xl font-bold text-[#FF5934] mt-1">
              Rs {finalTotal.toLocaleString()}
            </p>
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm space-y-2">
            {type === 'bank' ? (
              <>
                <p><span className="text-gray-400">Account:</span> {transaction.sourceName || '—'}</p>
                <p><span className="text-gray-400">Description:</span> {transaction.details || '—'}</p>
              </>
            ) : (
              <>
                <p><span className="text-gray-400">Paid by:</span> {transaction.details || '—'}</p>

                {items.length > 0 && (
                  <div>
                    <p className="text-gray-400 mb-1">Items:</p>
                    <div className="space-y-1 text-xs">
                      {items.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span>
                            {item.quantity}x {item.product?.englishTitle || 'Item'}
                          </span>
                          <span>
                            Rs {(item.purchaseRate * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-dashed pt-2 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Items Total</span>
                    <span>Rs {totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-red-400">
                    <span>Discount</span>
                    <span>- Rs {discount.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reference */}
          <p className="text-center text-[11px] text-gray-400 mt-4">
            Ref #{transaction.id?.slice(0, 6).toUpperCase() || 'N/A'}
          </p>

          {/* Buttons */}
          <div className="flex gap-2 mt-5">
            <button
              onClick={handleShareToWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-black text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition"
            >
              <FaShare size={14} /> Share
            </button>

            <button
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#FF5934] text-white text-sm font-semibold hover:bg-[#e84d2a] active:scale-[0.98] transition"
            >
              <AiOutlineDownload size={16} /> Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;