import React, { useState, useEffect } from 'react';
import { getAllRetailers, getRetailerLedgerById } from '../APIS';
import { Loader } from "../components/common/loader";
import { toast } from 'react-toastify';
import {
  MdSearch, MdClose, MdRefresh, MdExpandMore, MdFilterList,
  MdPictureAsPdf, MdGridOn, MdArrowBack, MdWarning,
  MdPerson, MdPhone, MdStorefront, MdCheckCircle,
  MdReceipt, MdTrendingUp, MdTrendingDown, MdAccountBalance,
} from 'react-icons/md';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

/* ─── helpers ─── */
const formatNumber = (num) => {
  if (typeof num === 'string') num = parseFloat(num.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '0';
  return Math.abs(num).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  try { return new Date(dateString).toLocaleDateString('en-GB'); } catch { return '—'; }
};

/* ─────────────────────────────────────────
   PDF EXPORT — Professional ledger layout
───────────────────────────────────────── */
const exportToPdf = (ledgerData, retailer, totals) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw   = doc.internal.pageSize.getWidth();
  const ph   = doc.internal.pageSize.getHeight();
  const ml   = 10; // margin left
  const mr   = 10; // margin right
  const cw   = pw - ml - mr; // content width = 190mm

  const ORANGE = [255, 89, 52];
  const DARK   = [17, 24, 39];
  const GRAY   = [107, 114, 128];
  const LGRAY  = [243, 244, 246];
  const WHITE  = [255, 255, 255];
  const GREEN  = [5, 150, 105];
  const RED    = [220, 38, 38];

  /* column definitions: x offset, width, label, align */
  const cols = [
    { x: 0,    w: 8,   label: 'Sr.',         align: 'center' },
    { x: 8,    w: 22,  label: 'Date',        align: 'left'   },
    { x: 30,   w: 65,  label: 'Description', align: 'left'   },
    { x: 95,   w: 22,  label: 'Type',        align: 'center' },
    { x: 117,  w: 24,  label: 'Debit (Dr)',  align: 'right'  },
    { x: 141,  w: 24,  label: 'Credit (Cr)', align: 'right'  },
    { x: 165,  w: 25,  label: 'Balance',     align: 'right'  },
  ];

  const drawPageHeader = (pageNum, totalPages) => {
    /* orange header bar */
    doc.setFillColor(...ORANGE);
    doc.rect(0, 0, pw, 22, 'F');

    /* company name */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...WHITE);
    doc.text('Prime Link Distribution', ml, 10);

    /* report title */
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Customer Ledger Report', pw - mr, 10, { align: 'right' });
    doc.text(`Page ${pageNum} of ${totalPages}`, pw - mr, 16, { align: 'right' });

    /* customer info row */
    doc.setFillColor(250, 250, 250);
    doc.rect(0, 22, pw, 16, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.line(0, 22, pw, 22);
    doc.line(0, 38, pw, 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('Customer:', ml, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(retailer.name || '—', ml + 22, 28);

    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', ml + 80, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(retailer.phoneNumber || retailer.phone || 'N/A', ml + 96, 28);

    doc.setFont('helvetica', 'bold');
    doc.text('Shop:', ml, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(retailer.shopName || retailer.name || 'N/A', ml + 22, 34);

    doc.setFont('helvetica', 'bold');
    doc.text('Generated:', ml + 80, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), ml + 103, 34);

    return 42; // y after header
  };

  const drawTableHeader = (y) => {
    doc.setFillColor(255, 240, 236);
    doc.rect(ml, y, cw, 7, 'F');
    doc.setDrawColor(...ORANGE);
    doc.line(ml, y, ml + cw, y);
    doc.line(ml, y + 7, ml + cw, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);

    cols.forEach(col => {
      const xPos = ml + col.x;
      if (col.align === 'right')  doc.text(col.label, xPos + col.w - 1, y + 5, { align: 'right' });
      else if (col.align === 'center') doc.text(col.label, xPos + col.w / 2, y + 5, { align: 'center' });
      else doc.text(col.label, xPos + 1, y + 5);
    });

    /* vertical dividers */
    doc.setDrawColor(255, 160, 122);
    let cx = ml;
    cols.forEach(col => {
      doc.line(cx, y, cx, y + 7);
      cx += col.w;
    });
    doc.line(cx, y, cx, y + 7);

    return y + 7;
  };

  /* ── paginate ── */
  const ROW_H    = 6;
  const FOOTER_H = 22;
  const USABLE   = ph - FOOTER_H;

  // estimate pages
  let tempY = drawPageHeader(1, 1);
  tempY = drawTableHeader(tempY);
  const rowsPerFirstPage = Math.floor((USABLE - tempY) / ROW_H);
  const rowsPerOtherPage = Math.floor((USABLE - 42 - 7) / ROW_H); // 42 header + 7 col header
  const remainingRows = Math.max(0, ledgerData.length - rowsPerFirstPage);
  const extraPages = remainingRows > 0 ? Math.ceil(remainingRows / rowsPerOtherPage) : 0;
  const totalPages = 1 + extraPages;

  let currentPage = 1;
  let y = drawPageHeader(currentPage, totalPages);
  y = drawTableHeader(y);

  doc.setFontSize(7.5);

  ledgerData.forEach((row, idx) => {
    /* new page check */
    if (y + ROW_H > USABLE) {
      /* totals continuation line at page bottom */
      doc.setFillColor(...LGRAY);
      doc.rect(ml, y, cw, 5, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text('Continued on next page…', ml + 2, y + 3.5);

      doc.addPage();
      currentPage++;
      y = drawPageHeader(currentPage, totalPages);
      y = drawTableHeader(y);
      doc.setFontSize(7.5);
    }

    /* alternating row bg */
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(ml, y, cw, ROW_H, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);

    const vals = [
      { v: String(row.sr),    align: 'center' },
      { v: row.date,           align: 'left'   },
      { v: row.details.length > 45 ? row.details.slice(0, 44) + '…' : row.details, align: 'left' },
      { v: row.type,           align: 'center' },
      { v: row.dr !== '0' ? row.dr : '—', align: 'right', color: row.dr !== '0' ? GREEN : GRAY },
      { v: row.cr !== '0' ? row.cr : '—', align: 'right', color: row.cr !== '0' ? RED   : GRAY },
      { v: row.balance,        align: 'right', bold: true  },
    ];

    cols.forEach((col, i) => {
      const xPos = ml + col.x;
      const val  = vals[i];
      doc.setTextColor(...(val.color || DARK));
      if (val.bold) doc.setFont('helvetica', 'bold');
      else          doc.setFont('helvetica', 'normal');

      if (val.align === 'right')       doc.text(String(val.v), xPos + col.w - 1, y + 4, { align: 'right' });
      else if (val.align === 'center') doc.text(String(val.v), xPos + col.w / 2, y + 4, { align: 'center' });
      else                             doc.text(String(val.v), xPos + 1, y + 4);
    });

    /* row bottom border */
    doc.setDrawColor(243, 244, 246);
    doc.line(ml, y + ROW_H, ml + cw, y + ROW_H);

    /* vertical col dividers */
    doc.setDrawColor(229, 231, 235);
    let cx = ml;
    cols.forEach(col => {
      doc.line(cx, y, cx, y + ROW_H);
      cx += col.w;
    });
    doc.line(cx, y, cx, y + ROW_H);

    y += ROW_H;
  });

  /* ── Totals row ── */
  doc.setFillColor(255, 240, 236);
  doc.rect(ml, y, cw, 8, 'F');
  doc.setDrawColor(...ORANGE);
  doc.line(ml, y, ml + cw, y);
  doc.line(ml, y + 8, ml + cw, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text('TOTALS', ml + 2, y + 5.5);

  /* Total Dr */
  const drCol = cols[4];
  doc.setTextColor(...GREEN);
  doc.text(formatNumber(totals.totalDr), ml + drCol.x + drCol.w - 1, y + 5.5, { align: 'right' });

  /* Total Cr */
  const crCol = cols[5];
  doc.setTextColor(...RED);
  doc.text(formatNumber(totals.totalCr), ml + crCol.x + crCol.w - 1, y + 5.5, { align: 'right' });

  /* Final Balance */
  const balCol = cols[6];
  const finalBal = ledgerData[ledgerData.length - 1]?.rawBalance || 0;
  doc.setTextColor(...DARK);
  doc.text(formatNumber(finalBal), ml + balCol.x + balCol.w - 1, y + 5.5, { align: 'right' });

  y += 8;

  /* ── Footer note ── */
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(`This report was generated on ${new Date().toLocaleString('en-GB')} — Prime Link Distribution`, ml, y);
  doc.text('All amounts in PKR (Pakistani Rupees)', pw - mr, y, { align: 'right' });

  doc.save(`Ledger_${(retailer.name || 'customer').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  toast.success('PDF exported successfully');
};

/* ─────────────────────────────────────────
   EXCEL EXPORT — Styled workbook
───────────────────────────────────────── */
const exportToExcel = (ledgerData, retailer, totals) => {
  const wb = XLSX.utils.book_new();

  /* ── build data array ── */
  const rows = [];

  /* title rows */
  rows.push(['PRIME LINK DISTRIBUTION', '', '', '', '', '', '']);
  rows.push(['Customer Ledger Report', '', '', '', '', '', '']);
  rows.push([]);
  rows.push(['Customer:', retailer.name || '—',       '', 'Phone:', retailer.phoneNumber || retailer.phone || 'N/A', '', '']);
  rows.push(['Shop:',     retailer.shopName || '—',   '', 'Generated:', new Date().toLocaleString('en-GB'), '', '']);
  rows.push([]);

  /* column headers */
  rows.push(['Sr.', 'Date', 'Description', 'Type', 'Debit (Dr.)', 'Credit (Cr.)', 'Balance']);

  /* data rows */
  ledgerData.forEach(row => {
    rows.push([
      row.sr,
      row.date,
      row.details,
      row.type,
      row.dr !== '0' ? parseFloat(row.rawDr) : '',
      row.cr !== '0' ? parseFloat(row.rawCr) : '',
      parseFloat(row.rawBalance),
    ]);
  });

  /* blank row + totals */
  rows.push([]);
  rows.push(['', '', '', 'TOTAL', totals.totalDr, totals.totalCr, ledgerData[ledgerData.length - 1]?.rawBalance || 0]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  /* column widths */
  ws['!cols'] = [
    { wch: 6 },   // Sr
    { wch: 14 },  // Date
    { wch: 45 },  // Description
    { wch: 14 },  // Type
    { wch: 18 },  // Dr
    { wch: 18 },  // Cr
    { wch: 18 },  // Balance
  ];

  /* merge title cells */
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // company name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // report title
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Customer Ledger');
  XLSX.writeFile(wb, `Ledger_${(retailer.name || 'customer').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success('Excel exported successfully');
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ReportsCustomerLedger = () => {
  const [view, setView]                     = useState('filter');
  const [loading, setLoading]               = useState(false);
  const [retailers, setRetailers]           = useState([]);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [ledgerData, setLedgerData]         = useState([]);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [searchTerm, setSearchTerm]         = useState('');
  const [error, setError]                   = useState('');

  /* load retailers */
  useEffect(() => {
    setLoading(true);
    getAllRetailers()
      .then(res => setRetailers(res?.data?.data || []))
      .catch(() => toast.error('Failed to load customers'))
      .finally(() => setLoading(false));
  }, []);

  /* generate report */
  const handleGenerateReport = async () => {
    setError('');
    if (!selectedRetailer?._id) { setError('Please select a customer'); return; }
    setLoading(true);
    try {
      const res = await getRetailerLedgerById(selectedRetailer._id);
      if (res?.success && Array.isArray(res?.ledgers)) {
        const data = res.ledgers;
        if (data.length === 0) {
          setError('No transactions found for this customer');
          setLedgerData([]);
        } else {
          setLedgerData(data.map((item, idx) => ({
            sr:         idx + 1,
            id:         item._id,
            details:    item.description || item.details || 'Transaction',
            type:       item.type || 'ORDER',
            date:       formatDate(item.date),
            dr:         item.type !== 'PAYMENT' ? formatNumber(item.amount || 0) : '0',
            cr:         item.type === 'PAYMENT' ? formatNumber(item.amount || 0) : '0',
            balance:    formatNumber(item.balance || 0),
            rawDr:      item.type !== 'PAYMENT' ? parseFloat(item.amount || 0) : 0,
            rawCr:      item.type === 'PAYMENT' ? parseFloat(item.amount || 0) : 0,
            rawBalance: parseFloat(item.balance || 0),
          })));
        }
        setView('report');
      } else {
        setError('No ledger data found');
        setLedgerData([]);
        setView('report');
      }
    } catch {
      setError('Failed to fetch ledger data');
      setLedgerData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedRetailer(null); setLedgerData([]);
    setError(''); setSearchTerm(''); setView('filter');
  };

  const totals = {
    totalDr:  ledgerData.reduce((s, r) => s + r.rawDr, 0),
    totalCr:  ledgerData.reduce((s, r) => s + r.rawCr, 0),
    finalBal: ledgerData[ledgerData.length - 1]?.rawBalance || 0,
  };

  const filteredRetailers = retailers.filter(r =>
    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.shopName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && view === 'filter' && retailers.length === 0) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .rcl { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .rcl .trow { transition: background .13s; }
        .rcl .trow:hover { background: #FFFAF9; }
        .rcl-no-scroll::-webkit-scrollbar { width: 5px; }
        .rcl-no-scroll::-webkit-scrollbar-track { background: #f3f4f6; }
        .rcl-no-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        .fade-up { animation: fadeUp .25s ease both; }
      `}</style>

      <div className="rcl">

        {/* ═══════════════════ FILTER VIEW ═══════════════════ */}
        {view === 'filter' && (
          <div className="fade-up" style={{ maxWidth: 600, margin: '0 auto' }}>

            {/* Header */}
            <div className="mt-6 mb-5">
              <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Customer Ledger Report</h1>
              <p className="text-sm text-[#9CA3AF] mt-0.5">View complete transaction history for any customer</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                <MdWarning size={16} /> {error}
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-5 flex items-center gap-2">
                <MdFilterList size={13} className="text-[#FF5934]" /> Select Customer
              </p>

              {/* Customer dropdown */}
              <div className="mb-5">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdPerson size={12} className="text-[#FF5934]" /> Customer
                  <span className="text-[#FF5934]">*</span>
                </label>
                <div className="relative">
                  <div
                    onClick={() => setDropdownOpen(p => !p)}
                    className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer transition-all
                      ${selectedRetailer ? 'border-[#FF5934] bg-orange-50/30' : 'border-gray-200 bg-[#F9FAFB] hover:border-[#FF5934]'}`}
                  >
                    {selectedRetailer ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#FF5934] text-[11px] font-bold">{(selectedRetailer.name||'?')[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#111827] truncate">{selectedRetailer.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">{selectedRetailer.shopName || selectedRetailer.phoneNumber || ''}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[13px] text-gray-300 flex-1">Select a customer…</span>
                    )}
                    <MdExpandMore size={18} className={`text-[#9CA3AF] flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180 text-[#FF5934]' : ''}`} />
                  </div>

                  {dropdownOpen && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden rcl-no-scroll" style={{ maxHeight: 320, overflowY: 'auto' }}>
                      <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                        <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                          <MdSearch size={14} className="text-[#9CA3AF]" />
                          <input
                            autoFocus value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by name or shop…"
                            className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
                          />
                          {searchTerm && <button onClick={() => setSearchTerm('')}><MdClose size={13} className="text-[#9CA3AF] hover:text-[#FF5934]" /></button>}
                        </div>
                      </div>
                      {filteredRetailers.length > 0 ? filteredRetailers.map(r => (
                        <div key={r._id}
                          onClick={() => { setSelectedRetailer(r); setDropdownOpen(false); setSearchTerm(''); }}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors border-b border-gray-50 ${selectedRetailer?._id === r._id ? 'bg-orange-50' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#FF5934] text-[11px] font-bold">{(r.name||'?')[0].toUpperCase()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-[#111827] truncate">{r.name}</p>
                            <p className="text-[11px] text-[#9CA3AF] truncate">{r.shopName || r.shopCategory || ''} · {r.phoneNumber || r.phone || '—'}</p>
                          </div>
                          {selectedRetailer?._id === r._id && <MdCheckCircle size={15} className="text-[#FF5934] flex-shrink-0" />}
                        </div>
                      )) : (
                        <div className="py-10 text-center text-[13px] text-[#9CA3AF]">No customers found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected customer preview */}
              {selectedRetailer && (
                <div className="mb-5 p-3 bg-[#F9FAFB] rounded-xl border border-gray-100 flex flex-wrap gap-4 text-[12px] text-[#6B7280]">
                  {selectedRetailer.shopName && (
                    <span className="flex items-center gap-1.5"><MdStorefront size={13} className="text-[#FF5934]" />{selectedRetailer.shopName}</span>
                  )}
                  {(selectedRetailer.phoneNumber || selectedRetailer.phone) && (
                    <span className="flex items-center gap-1.5"><MdPhone size={13} className="text-[#FF5934]" />{selectedRetailer.phoneNumber || selectedRetailer.phone}</span>
                  )}
                  {selectedRetailer.shopCategory && (
                    <span className="flex items-center gap-1.5"><MdReceipt size={13} className="text-[#FF5934]" />{selectedRetailer.shopCategory}</span>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                <button onClick={handleReset}
                  className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                  <MdRefresh size={15} /> Reset
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={!selectedRetailer || loading}
                  className="h-10 px-5 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-orange-100 transition-all flex items-center gap-2"
                >
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading…</>
                    : 'Generate Report'
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ REPORT VIEW ═══════════════════ */}
        {view === 'report' && (
          <div className="fade-up">

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between mt-6 mb-5 gap-3">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">{selectedRetailer?.name}</h1>
                <p className="text-sm text-[#9CA3AF] mt-0.5">
                  {selectedRetailer?.shopName && <>{selectedRetailer.shopName} · </>}
                  {selectedRetailer?.phoneNumber || selectedRetailer?.phone || ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => exportToPdf(ledgerData, selectedRetailer, totals)} disabled={!ledgerData.length}
                  className="h-10 px-4 rounded-xl border border-red-100 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
                  <MdPictureAsPdf size={16} /> PDF
                </button>
                <button onClick={() => exportToExcel(ledgerData, selectedRetailer, totals)} disabled={!ledgerData.length}
                  className="h-10 px-4 rounded-xl border border-emerald-100 bg-white text-emerald-600 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
                  <MdGridOn size={16} /> Excel
                </button>
                <button onClick={handleReset}
                  className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                  <MdArrowBack size={16} /> Back
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                <MdWarning size={16} /> {error}
              </div>
            )}

            {loading && <div className="py-20 flex justify-center"><Loader /></div>}

            {!loading && ledgerData.length > 0 && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                  {[
                    { icon: MdReceipt,      label: 'Transactions', value: ledgerData.length,              color: 'text-[#FF5934]', bg: 'bg-[#FF5934]/10' },
                    { icon: MdTrendingUp,   label: 'Total Debit',  value: `Rs. ${formatNumber(totals.totalDr)}`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { icon: MdTrendingDown, label: 'Total Credit', value: `Rs. ${formatNumber(totals.totalCr)}`, color: 'text-red-500',    bg: 'bg-red-50'     },
                    { icon: MdAccountBalance, label: 'Balance',    value: `Rs. ${formatNumber(totals.finalBal)}`, color: totals.finalBal >= 0 ? 'text-[#FF5934]' : 'text-red-600', bg: 'bg-[#FF5934]/10' },
                  ].map(({ icon: Icon, label, value, color, bg }) => (
                    <div key={label} className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 flex items-center gap-4 hover:-translate-y-0.5 transition-transform">
                      <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={20} className={color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                        <p className={`text-[14px] font-bold truncate ${color}`}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ledger table */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FFF4F1] border-b border-orange-100">
                          {['Sr.', 'Date', 'Description', 'Type', 'Debit (Dr.)', 'Credit (Cr.)', 'Balance'].map((h, i) => (
                            <th key={h}
                              className={`text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest py-3 ${i === 0 ? 'px-4 text-left w-14' : i <= 2 ? 'px-4 text-left' : i === 3 ? 'px-4 text-center' : 'px-4 text-right'}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ledgerData.map((row) => (
                          <tr key={row.id || row.sr} className="trow">
                            {/* Sr */}
                            <td className="px-4 py-3">
                              <span className="text-[12px] font-bold text-[#9CA3AF]">{row.sr}</span>
                            </td>
                            {/* Date */}
                            <td className="px-4 py-3">
                              <span className="text-[12px] text-[#6B7280] whitespace-nowrap">{row.date}</span>
                            </td>
                            {/* Description */}
                            <td className="px-4 py-3 max-w-[240px]">
                              <p className="text-[13px] text-[#111827] font-medium truncate">{row.details}</p>
                            </td>
                            {/* Type badge */}
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                row.type === 'PAYMENT'
                                  ? 'bg-blue-50 text-blue-600'
                                  : row.type === 'RETURN'
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-orange-50 text-[#FF5934]'
                              }`}>
                                {row.type}
                              </span>
                            </td>
                            {/* Debit */}
                            <td className="px-4 py-3 text-right">
                              {row.dr !== '0'
                                ? <span className="text-[13px] font-semibold text-emerald-600">Rs. {row.dr}</span>
                                : <span className="text-[12px] text-[#D1D5DB]">—</span>
                              }
                            </td>
                            {/* Credit */}
                            <td className="px-4 py-3 text-right">
                              {row.cr !== '0'
                                ? <span className="text-[13px] font-semibold text-red-500">Rs. {row.cr}</span>
                                : <span className="text-[12px] text-[#D1D5DB]">—</span>
                              }
                            </td>
                            {/* Balance */}
                            <td className="px-4 py-3 text-right">
                              <span className="text-[13px] font-bold text-[#111827]">Rs. {row.balance}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer totals */}
                  <div className="border-t-2 border-orange-100 bg-[#FFF4F1] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                      {ledgerData.length} transaction{ledgerData.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Debit</p>
                        <p className="text-[14px] font-bold text-emerald-600">Rs. {formatNumber(totals.totalDr)}</p>
                      </div>
                      <div className="w-px h-8 bg-gray-200" />
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Credit</p>
                        <p className="text-[14px] font-bold text-red-500">Rs. {formatNumber(totals.totalCr)}</p>
                      </div>
                      <div className="w-px h-8 bg-gray-200" />
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Final Balance</p>
                        <p className={`text-[14px] font-bold ${totals.finalBal >= 0 ? 'text-[#FF5934]' : 'text-red-600'}`}>
                          Rs. {formatNumber(totals.finalBal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!loading && ledgerData.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-20 text-center flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <MdReceipt size={26} className="text-gray-300" />
                </div>
                <p className="text-[#9CA3AF] text-sm font-medium">No transactions found for this customer</p>
                <button onClick={handleReset} className="text-[#FF5934] text-xs hover:underline">Go back</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ReportsCustomerLedger;