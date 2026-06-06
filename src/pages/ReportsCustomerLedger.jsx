import React, { useState, useEffect } from 'react';
import { getAllRetailers, getRetailerLedgerById } from '../APIS';
import { Loader } from "../components/common/loader";
import { toast } from 'react-toastify';
import {
  MdSearch, MdClose, MdRefresh, MdExpandMore, MdFilterList,
  MdPictureAsPdf, MdGridOn, MdArrowBack, MdWarning,
  MdPerson, MdPhone, MdStorefront, MdCheckCircle,
  MdReceipt, MdTrendingUp, MdTrendingDown, MdAccountBalance,
  MdCalendarToday,
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

const parseToDate = (str) => {
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return new Date(str);
};

const isoToDisplay = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/* ─────────────────────────────────────────
   NORMALISE a single ledger entry from any
   API response shape into a consistent row.
   Handles: { amount, type } and { dr, cr }
   and { debit, credit } field names.
───────────────────────────────────────── */
const normaliseEntry = (item, idx) => {
  /* ── Determine raw debit / credit ──
     Priority: explicit dr/cr fields → type-based amount → debit/credit fields */
  let rawDr = 0;
  let rawCr = 0;

 if (item.dr != null || item.cr != null) {
  // API has dr/cr swapped relative to our convention — swap them
  rawDr = parseFloat(item.cr || 0);   // was: item.dr
  rawCr = parseFloat(item.dr || 0);   // was: item.cr
} else if (item.debit != null || item.credit != null) {
    rawDr = parseFloat(item.debit  || 0);
    rawCr = parseFloat(item.credit || 0);
  } else if (item.amount != null) {
    // Determine direction from type field
    const t = (item.type || '').toUpperCase();
  const isCredit = t === 'PAYMENT' || t === 'CREDIT' || t === 'RETURN';
    if (isCredit) rawCr = parseFloat(item.amount || 0);
    else          rawDr = parseFloat(item.amount || 0);
  }

  /* ── Determine type label ── */
  const typeRaw = item.type || item.transactionType || item.txnType || '';
  const type    = typeRaw.toUpperCase() || (rawCr > 0 ? 'PAYMENT' : 'PURCHASE');

  /* ── Determine running balance ── */
  const rawBalance = parseFloat(
    item.balance ?? item.runningBalance ?? item.closingBalance ?? 0
  );

  return {
    sr:         idx + 1,
    id:         item._id || item.id || `row-${idx}`,
    details:    item.details || item.description || item.narration || item.remarks || 'Transaction',
    type,
    date:       formatDate(item.date || item.createdAt || item.transactionDate),
    rawDate:    item.date || item.createdAt || item.transactionDate || '',
    bankName:   item.bankId?.name || item.bankName || item.bank || '',
    refNo:      item.refNo || item.referenceNo || item.reference || '',
    vNo:        item.voucherNo || item.vNo || item.v || item.invoiceNo || '',
    bilty:      item.biltyNumber || item.bilty || '',
    quantity:   item.quantity ?? item.qty ?? 0,
    /* formatted strings for display */
    dr:         rawDr > 0 ? formatNumber(rawDr) : '0',
    cr:         rawCr > 0 ? formatNumber(rawCr) : '0',
    balance:    formatNumber(rawBalance),
    /* raw numbers for calculations */
    rawDr,
    rawCr,
    rawBalance,
  };
};

/* ─────────────────────────────────────────
   Extract the ledger array from ANY response
   shape the API might return:
   - { success, ledgers: [...] }
   - { success, data: [...] }
   - { ledgers: [...] }
   - { data: [...] }
   - [...]  (bare array)
───────────────────────────────────────── */
const extractLedgerArray = (res) => {
  if (!res) return [];
  if (Array.isArray(res))             return res;
  if (Array.isArray(res.ledgers))     return res.ledgers;
  if (Array.isArray(res.data))        return res.data;
  if (Array.isArray(res.transactions)) return res.transactions;
  if (Array.isArray(res.entries))     return res.entries;
  /* Last resort: look for any array-valued key */
  for (const key of Object.keys(res)) {
    if (Array.isArray(res[key]) && res[key].length > 0) return res[key];
  }
  return [];
};

/* ─────────────────────────────────────────
   PDF EXPORT
───────────────────────────────────────── */
const exportToPdf = (ledgerData, retailer, totals, dateFrom, dateTo) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 10, mr = 10, cw = pw - ml - mr;

  const BLACK = [0, 0, 0], DARK = [17, 24, 39], GRAY = [100, 100, 100], LGRAY = [220, 220, 220];

  const cols = [
    { x: 0,   w: 22, label: 'Date',      align: 'left'   },
    { x: 22,  w: 28, label: 'Details',   align: 'left'   },
    { x: 50,  w: 25, label: 'Bank Name', align: 'left'   },
    { x: 75,  w: 28, label: 'Ref No.',   align: 'left'   },
    { x: 103, w: 14, label: 'V. No.',    align: 'center' },
    { x: 117, w: 15, label: 'Quantity',  align: 'right'  },
    { x: 132, w: 20, label: 'Debit',     align: 'right'  },
    { x: 152, w: 20, label: 'Credit',    align: 'right'  },
    { x: 172, w: 18, label: 'Balance',   align: 'right'  },
  ];

  const drawPageHeader = (pageNum, totalPages) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...BLACK);
    doc.text('Karyana', pw / 2, 12, { align: 'center' });
    doc.setFontSize(13);
    doc.text('Customer Ledger', pw / 2, 20, { align: 'center' });
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
    doc.line(ml, 23, pw - mr, 23);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
    doc.text(`Account No :${retailer.accountNo || ''}`, ml, 29);
    doc.text(retailer.name || '', ml, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(`Mobile: ${retailer.phoneNumber || retailer.phone || ''}`, ml, 39);
    doc.text(retailer.city || '', ml, 44);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
    doc.text(`Salesperson: ${retailer.salesperson || ''}`, pw / 2, 32, { align: 'center' });

    const fromLabel = dateFrom ? isoToDisplay(dateFrom) : 'All';
    const toLabel   = dateTo   ? isoToDisplay(dateTo)   : new Date().toLocaleDateString('en-GB');
    doc.setFont('helvetica', 'normal');
    doc.text(`Date From: ${fromLabel}  to: ${toLabel}`, pw - mr, 29, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Due :Rs. ${formatNumber(totals.finalBal)}`, pw - mr, 34, { align: 'right' });

    if (pageNum > 1) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...GRAY);
      doc.text(`Page ${pageNum} of ${totalPages}`, pw - mr, 52, { align: 'right' });
    }
    doc.setDrawColor(...BLACK); doc.setLineWidth(0.4);
    doc.line(ml, 53, pw - mr, 53);
    return 53;
  };

  const drawTableHeader = (y) => {
    doc.setFillColor(240, 240, 240); doc.rect(ml, y, cw, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...BLACK);
    cols.forEach(col => {
      const xPos = ml + col.x;
      if      (col.align === 'right')  doc.text(col.label, xPos + col.w - 1, y + 5, { align: 'right' });
      else if (col.align === 'center') doc.text(col.label, xPos + col.w / 2, y + 5, { align: 'center' });
      else                             doc.text(col.label, xPos + 1, y + 5);
    });
    doc.setDrawColor(...BLACK); doc.setLineWidth(0.3);
    doc.line(ml, y, ml + cw, y); doc.line(ml, y + 7, ml + cw, y + 7);
    return y + 7;
  };

  const ROW_H = 7, FOOTER_H = 16, USABLE = ph - FOOTER_H;
  let tempY = drawPageHeader(1, 1); tempY = drawTableHeader(tempY);
  const rowsPerFirstPage  = Math.floor((USABLE - tempY - 10) / ROW_H);
  const rowsPerOtherPage  = Math.floor((USABLE - 53 - 7 - 10) / ROW_H);
  const remainingRows     = Math.max(0, ledgerData.length + 1 - rowsPerFirstPage);
  const totalPages        = 1 + (remainingRows > 0 ? Math.ceil(remainingRows / rowsPerOtherPage) : 0);

  let currentPage = 1;
  let y = drawPageHeader(currentPage, totalPages);
  y = drawTableHeader(y);
  doc.setFontSize(7.5);

  doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK);
  doc.text('Brought Forward', ml + cols[1].x + 1, y + 5);
  doc.text('0', ml + cols[5].x + cols[5].w - 1, y + 5, { align: 'right' });
  if (retailer.openingBalance != null)
    doc.text(formatNumber(retailer.openingBalance), ml + cols[8].x + cols[8].w - 1, y + 5, { align: 'right' });
  doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
  doc.line(ml, y + ROW_H, ml + cw, y + ROW_H);
  y += ROW_H;

  ledgerData.forEach((row) => {
    if (y + ROW_H > USABLE) {
      doc.addPage(); currentPage++;
      y = drawPageHeader(currentPage, totalPages);
      y = drawTableHeader(y);
      doc.setFontSize(7.5);
    }
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK);
    [
      { col: 0, v: row.date },
      { col: 1, v: row.details.length > 18 ? row.details.slice(0, 17) + '…' : row.details },
      { col: 2, v: row.bankName || '' },
      { col: 3, v: row.refNo    || '' },
      { col: 4, v: String(row.vNo || '') },
      { col: 5, v: String(row.quantity ?? 0) },
      { col: 6, v: row.rawDr > 0 ? formatNumber(row.rawDr) : '' },
      { col: 7, v: row.rawCr > 0 ? formatNumber(row.rawCr) : '' },
      { col: 8, v: formatNumber(row.rawBalance) },
    ].forEach(({ col, v }) => {
      if (!v) return;
      const c = cols[col], xPos = ml + c.x;
      if      (c.align === 'right')  doc.text(v, xPos + c.w - 1, y + 5, { align: 'right' });
      else if (c.align === 'center') doc.text(v, xPos + c.w / 2, y + 5, { align: 'center' });
      else                           doc.text(v, xPos + 1, y + 5);
    });
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
    doc.line(ml, y + ROW_H, ml + cw, y + ROW_H);
    y += ROW_H;
  });

  doc.setDrawColor(...BLACK); doc.setLineWidth(0.4); doc.line(ml, y, ml + cw, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...BLACK);
  const totalQty = ledgerData.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  doc.text(String(totalQty),             ml + cols[5].x + cols[5].w - 1, y + 5, { align: 'right' });
  doc.text(formatNumber(totals.totalDr), ml + cols[6].x + cols[6].w - 1, y + 5, { align: 'right' });
  doc.text(formatNumber(totals.totalCr), ml + cols[7].x + cols[7].w - 1, y + 5, { align: 'right' });
  doc.line(ml, y + 7, ml + cw, y + 7);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAY);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — Karyana`, ml, ph - 8);
  doc.text('All amounts in PKR', pw - mr, ph - 8, { align: 'right' });

  doc.save(`Ledger_${(retailer.name || 'customer').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  toast.success('PDF exported successfully');
};

/* ─────────────────────────────────────────
   EXCEL EXPORT
───────────────────────────────────────── */
const exportToExcel = (ledgerData, retailer, totals, dateFrom, dateTo) => {
  const wb = XLSX.utils.book_new();
  const rows = [];
  rows.push(['Karyana', '', '', '', '', '', '', '', '']);
  rows.push(['Customer Ledger Report', '', '', '', '', '', '', '', '']);
  rows.push([]);
  rows.push(['Account No:', retailer.accountNo || '', '', 'Salesperson:', retailer.salesperson || '']);
  rows.push(['Customer:', retailer.name || '', '', 'Phone:', retailer.phoneNumber || retailer.phone || '']);
  rows.push(['Date From:', dateFrom ? isoToDisplay(dateFrom) : 'All', 'to:', dateTo ? isoToDisplay(dateTo) : new Date().toLocaleDateString('en-GB'), '', 'Total Due:', totals.finalBal]);
  rows.push([]);
  rows.push(['Date', 'Details', 'Bank Name', 'Ref No.', 'V. No.', 'Quantity', 'Debit (Dr.)', 'Credit (Cr.)', 'Balance']);
  rows.push(['', 'Brought Forward', '', '', '', 0, '', '', retailer.openingBalance || '']);
  ledgerData.forEach(row => {
    rows.push([row.date, row.details, row.bankName || '', row.refNo || '', row.vNo || '',
      row.quantity ?? 0, row.rawDr > 0 ? row.rawDr : '', row.rawCr > 0 ? row.rawCr : '', row.rawBalance]);
  });
  rows.push([]);
  const totalQty = ledgerData.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  rows.push(['', '', '', '', 'TOTAL', totalQty, totals.totalDr, totals.totalCr, ledgerData[ledgerData.length - 1]?.rawBalance || 0]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch:14 },{ wch:28 },{ wch:20 },{ wch:28 },{ wch:10 },{ wch:10 },{ wch:16 },{ wch:16 },{ wch:16 }];
  ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:8} }, { s:{r:1,c:0}, e:{r:1,c:8} }];
  XLSX.utils.book_append_sheet(wb, ws, 'Customer Ledger');
  XLSX.writeFile(wb, `Ledger_${(retailer.name || 'customer').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success('Excel exported successfully');
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ReportsCustomerLedger = () => {
  const [view, setView]                         = useState('filter');
  const [loading, setLoading]                   = useState(false);
  const [retailers, setRetailers]               = useState([]);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [allLedgerData, setAllLedgerData]       = useState([]); // full unfiltered dataset
  const [ledgerData, setLedgerData]             = useState([]); // date-filtered view
  const [dropdownOpen, setDropdownOpen]         = useState(false);
  const [searchTerm, setSearchTerm]             = useState('');
  const [error, setError]                       = useState('');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  /* Load retailers on mount */
  useEffect(() => {
    setLoading(true);
    getAllRetailers()
      .then(res => {
        /* getAllRetailers returns response directly (axios); data is in res.data.data */
        const list = res?.data?.data || res?.data || [];
        setRetailers(Array.isArray(list) ? list : []);
      })
      .catch(() => toast.error('Failed to load customers'))
      .finally(() => setLoading(false));
  }, []);

  /* ── FIX: show ALL data by default.
     Only filter when at least one date bound is set.
     When neither bound is set, ledgerData === allLedgerData. ── */
  useEffect(() => {
    if (!allLedgerData.length) {
      setLedgerData([]);
      return;
    }

    /* No dates set → show everything */
    if (!dateFrom && !dateTo) {
      setLedgerData(allLedgerData.map((r, i) => ({ ...r, sr: i + 1 })));
      return;
    }

    const from = parseToDate(dateFrom);
    const to   = parseToDate(dateTo);
    if (to) to.setHours(23, 59, 59, 999);

    const filtered = allLedgerData.filter(row => {
      const rowDate = parseToDate(row.rawDate);
      if (!rowDate) return true; // no date → always include
      if (from && rowDate < from) return false;
      if (to   && rowDate > to)   return false;
      return true;
    });

    setLedgerData(filtered.map((r, i) => ({ ...r, sr: i + 1 })));
  }, [allLedgerData, dateFrom, dateTo]);

  const handleGenerateReport = async () => {
    setError('');
    if (!selectedRetailer?._id) { setError('Please select a customer'); return; }
    setLoading(true);
    try {
      /* getRetailerLedgerById in APIS.js returns response.data already
         (it does: return response.data inside try/catch).
         So res here IS the parsed body, not the axios envelope. */
      const res = await getRetailerLedgerById(selectedRetailer._id);

      /* Log what we got so you can inspect in DevTools */
      console.log('[CustomerLedger] raw API response:', res);

      /* Extract the array from whatever shape the API returned */
      const rawArray = extractLedgerArray(res);

      console.log(`[CustomerLedger] extracted ${rawArray.length} entries`);

      if (rawArray.length === 0) {
        setError('No transactions found for this customer');
        setAllLedgerData([]);
      } else {
        /* Normalise every entry to a consistent row shape */
        const normalised = rawArray.map((item, idx) => normaliseEntry(item, idx));
        setAllLedgerData(normalised);
        setError('');
      }

      setView('report');
    } catch (err) {
      console.error('[CustomerLedger] fetch error:', err);
      setError(err?.message || 'Failed to fetch ledger data');
      setAllLedgerData([]);
      setView('report');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedRetailer(null); setAllLedgerData([]); setLedgerData([]);
    setError(''); setSearchTerm(''); setDateFrom(''); setDateTo(''); setView('filter');
  };

  const handleClearDates = () => { setDateFrom(''); setDateTo(''); };

  const totals = {
    totalDr:  ledgerData.reduce((s, r) => s + r.rawDr, 0),
    totalCr:  ledgerData.reduce((s, r) => s + r.rawCr, 0),
    totalQty: ledgerData.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
    finalBal: ledgerData.length ? ledgerData[ledgerData.length - 1].rawBalance : 0,
  };

  const filteredRetailers = retailers.filter(r =>
    (r.name      || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.shopName  || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.phoneNumber|| '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isDateFiltered = !!(dateFrom || dateTo);

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
        .date-inp { border:1px solid #e5e7eb; border-radius:12px; padding:0 12px; height:36px; font-size:13px; color:#111827; outline:none; background:#F9FAFB; transition:border-color .15s, background .15s; font-family:inherit; }
        .date-inp:focus { border-color:#FF5934; background:#fff; }
        .date-inp::-webkit-calendar-picker-indicator { opacity:.5; cursor:pointer; }
        .date-inp::-webkit-calendar-picker-indicator:hover { opacity:1; }
      `}</style>

      <div className="rcl">

        {/* ═══════════════════ FILTER VIEW ═══════════════════ */}
        {view === 'filter' && (
          <div className="fade-up" style={{ maxWidth: 600, margin: '0 auto' }}>
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
                <MdFilterList size={13} className="text-[#FF5934]" /> Filters
              </p>

              {/* Customer dropdown */}
              <div className="mb-5">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdPerson size={12} className="text-[#FF5934]" /> Customer <span className="text-[#FF5934]">*</span>
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
                          <input autoFocus value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by name, shop or phone…"
                            className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                          {searchTerm && <button onClick={() => setSearchTerm('')}><MdClose size={13} className="text-[#9CA3AF] hover:text-[#FF5934]" /></button>}
                        </div>
                      </div>
                      {filteredRetailers.length > 0 ? filteredRetailers.map(r => (
                        <div key={r._id}
                          onClick={() => { setSelectedRetailer(r); setDropdownOpen(false); setSearchTerm(''); }}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors border-b border-gray-50 ${selectedRetailer?._id === r._id ? 'bg-orange-50' : ''}`}>
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

              {/* Customer preview chip */}
              {selectedRetailer && (
                <div className="mb-5 p-3 bg-[#F9FAFB] rounded-xl border border-gray-100 flex flex-wrap gap-4 text-[12px] text-[#6B7280]">
                  {selectedRetailer.shopName && <span className="flex items-center gap-1.5"><MdStorefront size={13} className="text-[#FF5934]" />{selectedRetailer.shopName}</span>}
                  {(selectedRetailer.phoneNumber || selectedRetailer.phone) && <span className="flex items-center gap-1.5"><MdPhone size={13} className="text-[#FF5934]" />{selectedRetailer.phoneNumber || selectedRetailer.phone}</span>}
                  {selectedRetailer.shopCategory && <span className="flex items-center gap-1.5"><MdReceipt size={13} className="text-[#FF5934]" />{selectedRetailer.shopCategory}</span>}
                </div>
              )}

              {/* Date Range — optional pre-filter */}
              <div className="mb-6">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">
                  <MdCalendarToday size={12} className="text-[#FF5934]" /> Date Range
                  <span className="text-[#9CA3AF] font-normal normal-case tracking-normal ml-1">(optional — leave blank to show all)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] text-[#9CA3AF] mb-1.5 font-semibold uppercase tracking-wide">From</p>
                    <input type="date" value={dateFrom} max={dateTo || undefined}
                      onChange={e => setDateFrom(e.target.value)}
                      className="date-inp w-full" />
                  </div>
                  <span className="mt-5 text-[#9CA3AF] text-sm font-medium flex-shrink-0">→</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-[#9CA3AF] mb-1.5 font-semibold uppercase tracking-wide">To</p>
                    <input type="date" value={dateTo} min={dateFrom || undefined}
                      onChange={e => setDateTo(e.target.value)}
                      className="date-inp w-full" />
                  </div>
                  {(dateFrom || dateTo) && (
                    <button onClick={handleClearDates}
                      className="mt-5 w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-[#9CA3AF] hover:text-[#FF5934] hover:border-orange-200 hover:bg-orange-50 transition-colors flex-shrink-0"
                      title="Clear dates">
                      <MdClose size={15} />
                    </button>
                  )}
                </div>
                {dateFrom && dateTo && (
                  <p className="text-[11px] text-[#FF5934] mt-2 font-semibold">
                    📅 {isoToDisplay(dateFrom)} → {isoToDisplay(dateTo)}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button onClick={handleReset}
                  className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                  <MdRefresh size={15} /> Reset
                </button>
                <button onClick={handleGenerateReport} disabled={!selectedRetailer || loading}
                  className="h-10 px-5 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-orange-100 transition-all flex items-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading…</>
                    : 'Generate Report'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ REPORT VIEW ═══════════════════ */}
        {view === 'report' && (
          <div className="fade-up">

            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between mt-6 mb-4 gap-3">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">{selectedRetailer?.name}</h1>
                <p className="text-sm text-[#9CA3AF] mt-0.5">
                  {selectedRetailer?.shopName && <>{selectedRetailer.shopName} · </>}
                  {selectedRetailer?.phoneNumber || selectedRetailer?.phone || ''}
                  {allLedgerData.length > 0 && (
                    <span className="ml-2 text-[#FF5934] font-semibold">
                      {allLedgerData.length} total transaction{allLedgerData.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => exportToPdf(ledgerData, selectedRetailer, totals, dateFrom, dateTo)} disabled={!ledgerData.length}
                  className="h-10 px-4 rounded-xl border border-red-100 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
                  <MdPictureAsPdf size={16} /> PDF
                </button>
                <button onClick={() => exportToExcel(ledgerData, selectedRetailer, totals, dateFrom, dateTo)} disabled={!ledgerData.length}
                  className="h-10 px-4 rounded-xl border border-emerald-100 bg-white text-emerald-600 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
                  <MdGridOn size={16} /> Excel
                </button>
                <button onClick={handleReset}
                  className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                  <MdArrowBack size={16} /> Back
                </button>
              </div>
            </div>

            {/* Inline date range controls */}
            <div className="flex flex-wrap items-center gap-2 mb-5 bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3">
              <MdCalendarToday size={14} className="text-[#FF5934] flex-shrink-0" />
              <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mr-1">Filter by Date:</span>
              <input type="date" value={dateFrom} max={dateTo || undefined}
                onChange={e => setDateFrom(e.target.value)}
                className="date-inp" />
              <span className="text-[#9CA3AF] text-sm">→</span>
              <input type="date" value={dateTo} min={dateFrom || undefined}
                onChange={e => setDateTo(e.target.value)}
                className="date-inp" />
              {isDateFiltered ? (
                <>
                  <span className="text-[11px] font-semibold text-[#FF5934] bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-lg ml-1">
                    {ledgerData.length} / {allLedgerData.length} rows
                  </span>
                  <button onClick={handleClearDates}
                    className="h-8 px-3 rounded-xl border border-gray-200 text-[#9CA3AF] text-[12px] font-semibold hover:text-[#FF5934] hover:border-orange-200 flex items-center gap-1.5 transition-colors">
                    <MdClose size={12} /> Show All
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-[#9CA3AF] ml-1">
                  Showing all {allLedgerData.length} transaction{allLedgerData.length !== 1 ? 's' : ''}
                </span>
              )}
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
                    { icon: MdReceipt,        label: 'Transactions', value: ledgerData.length,                     color: 'text-[#FF5934]',   bg: 'bg-[#FF5934]/10' },
                    { icon: MdTrendingUp,     label: 'Total Debit',  value: `Rs. ${formatNumber(totals.totalDr)}`,  color: 'text-emerald-600', bg: 'bg-emerald-50'   },
                    { icon: MdTrendingDown,   label: 'Total Credit', value: `Rs. ${formatNumber(totals.totalCr)}`,  color: 'text-red-500',     bg: 'bg-red-50'       },
                    { icon: MdAccountBalance, label: 'Balance',      value: `Rs. ${formatNumber(totals.finalBal)}`, color: totals.finalBal >= 0 ? 'text-[#FF5934]' : 'text-red-600', bg: 'bg-[#FF5934]/10' },
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
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="bg-[#FFF4F1] border-b border-orange-100">
                          {[
                            { label: '#',            cls: 'text-center px-3 w-12'   },
                            { label: 'Date',         cls: 'text-left   px-3 w-24'   },
                            { label: 'Details',      cls: 'text-left   px-3'        },
                            { label: 'Bank Name',    cls: 'text-left   px-3 w-32'   },
                            { label: 'Ref No.',      cls: 'text-left   px-3 w-36'   },
                            { label: 'V. No.',       cls: 'text-center px-3 w-20'   },
                            { label: 'Quantity',     cls: 'text-right  px-3 w-20'   },
                            { label: 'Credit (Cr.)', cls: 'text-right  px-3 w-28'   },
                            { label: 'Debit (Dr.)',  cls: 'text-right  px-3 w-28'   },
                            { label: 'Balance',      cls: 'text-right  px-3 w-28'   },
                          ].map(h => (
                            <th key={h.label} className={`text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest py-3 ${h.cls}`}>
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {/* Brought Forward */}
                        <tr className="trow bg-gray-50/50">
                          <td className="px-3 py-2.5 text-center"><span className="text-[11px] text-[#D1D5DB]">—</span></td>
                          <td className="px-3 py-2.5" />
                          <td className="px-3 py-2.5"><span className="text-[12px] italic text-[#6B7280]">Brought Forward</span></td>
                          <td className="px-3 py-2.5" /><td className="px-3 py-2.5" />
                          <td className="px-3 py-2.5 text-center"><span className="text-[12px] text-[#6B7280]">—</span></td>
                          <td className="px-3 py-2.5 text-right"><span className="text-[12px] text-[#6B7280]">0</span></td>
                          <td className="px-3 py-2.5" /><td className="px-3 py-2.5" />
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[13px] font-bold text-[#111827]">
                              {selectedRetailer?.openingBalance != null ? `Rs. ${formatNumber(selectedRetailer.openingBalance)}` : '—'}
                            </span>
                          </td>
                        </tr>

                        {ledgerData.map((row) => (
                          <tr key={row.id || row.sr} className="trow">
                            <td className="px-3 py-2.5 text-center">
                              <span className="text-[11px] text-[#D1D5DB]">{row.sr}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[12px] text-[#6B7280] whitespace-nowrap">{row.date}</span>
                            </td>
                            <td className="px-3 py-2.5 max-w-[160px]">
                              <p className="text-[13px] text-[#111827] font-medium truncate">{row.details}</p>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 ${
                                
                                row.type === 'PURCHASE' ? 'bg-blue-50 text-blue-600'    :
row.type === 'PAYMENT'  ? 'bg-orange-50 text-[#FF5934]' :
                                row.type === 'RETURN'   ? 'bg-amber-50 text-amber-600'  :
                                
                                
                                row.type === 'CREDIT'   ? 'bg-purple-50 text-purple-600':
                                                          'bg-gray-100 text-gray-500'
                              }`}>{row.type}</span>
                            </td>
                            <td className="px-3 py-2.5"><span className="text-[12px] text-[#6B7280]">{row.bankName || '—'}</span></td>
                            <td className="px-3 py-2.5 max-w-[140px]"><span className="text-[12px] text-[#6B7280] break-words">{row.refNo || '—'}</span></td>
                            <td className="px-3 py-2.5 text-center"><span className="text-[12px] text-[#6B7280]">{row.vNo || '—'}</span></td>
                            <td className="px-3 py-2.5 text-right"><span className="text-[12px] text-[#6B7280]">{row.quantity ?? 0}</span></td>
                            <td className="px-3 py-2.5 text-right">
                              {row.rawDr > 0
                                ? <span className="text-[13px] font-semibold text-emerald-600">Rs. {row.dr}</span>
                                : <span className="text-[12px] text-[#D1D5DB]">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {row.rawCr > 0
                                ? <span className="text-[13px] font-semibold text-red-500">Rs. {row.cr}</span>
                                : <span className="text-[12px] text-[#D1D5DB]">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right">
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
                      {ledgerData.length} of {allLedgerData.length} transaction{allLedgerData.length !== 1 ? 's' : ''}
                      {isDateFiltered && <span className="ml-1.5 text-[#FF5934]">(date filtered)</span>}
                    </p>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Qty</p>
                        <p className="text-[14px] font-bold text-[#374151]">{totals.totalQty}</p>
                      </div>
                      <div className="w-px h-8 bg-gray-200" />
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
                <p className="text-[#9CA3AF] text-sm font-medium">
                  {isDateFiltered ? 'No transactions in this date range' : 'No transactions found for this customer'}
                </p>
                {isDateFiltered
                  ? <button onClick={handleClearDates} className="text-[#FF5934] text-xs hover:underline font-semibold">Show all transactions</button>
                  : <button onClick={handleReset} className="text-[#FF5934] text-xs hover:underline font-semibold">Go back</button>
                }
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ReportsCustomerLedger;