import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllCities, getAllSalesPersons, getTargetsBySalesperson } from '../APIS';
import { toast } from 'react-toastify';
import { GrFormPrevious, GrFormNext } from 'react-icons/gr';
import {
  MdRefresh, MdFilterList, MdExpandMore,
  MdPictureAsPdf, MdGridOn, MdBarChart, MdCalendarToday,
  MdCheckCircle, MdSearch, MdClose, MdLocationOn,
  MdTrackChanges, MdDone, MdShowChart, MdHourglassEmpty,
} from 'react-icons/md';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import placeholder from '../assets/placehold.jpg';

/* ─── constants ─── */
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const getMonthName   = (n) => MONTHS[parseInt(n) - 1] || '';
const getMonthNumber = (name) => MONTHS.indexOf(name) + 1;
const fmtNum = (n) => (!n && n !== 0 ? 0 : Number(n).toLocaleString('en-PK'));
const pctColor = (p) => p >= 80 ? '#16a34a' : p >= 60 ? '#d97706' : '#dc2626';
const pctBg    = (p) => p >= 80 ? '#f0fdf4' : p >= 60 ? '#fffbeb' : '#fef2f2';
const ROWS_PER_PAGE  = 10;
const getCityId = (city) => (typeof city === 'object' ? city?._id : city) || '';
const getCityName = (city, cityList = []) => {
  if (!city) return '';
  if (typeof city === 'object') return city.name || city.cityName || '';
  const found = cityList.find(c => c._id === city);
  return found?.name || found?.cityName || '';
};

/* ─── status badge ─── */
const getStatus = (pct) => {
  if (pct >= 100) return { label: 'Achieved',    color: 'emerald' };
  if (pct >= 80)  return { label: 'On Track',    color: 'blue'    };
  if (pct >= 60)  return { label: 'In Progress', color: 'amber'   };
  return           { label: 'Behind',            color: 'red'     };
};
const statusColors = {
  emerald: { bg:'#f0fdf4', border:'#bbf7d0', text:'#16a34a', dot:'#16a34a' },
  blue:    { bg:'#eff6ff', border:'#bfdbfe', text:'#2563eb', dot:'#2563eb' },
  amber:   { bg:'#fffbeb', border:'#fde68a', text:'#d97706', dot:'#f59e0b' },
  red:     { bg:'#fef2f2', border:'#fecaca', text:'#dc2626', dot:'#ef4444' },
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ReportsTargetVsAchieve = () => {
  /* ── data ── */
  const [salesPersons, setSalesPersons] = useState([]);
  const [cities,       setCities]       = useState([]);
  const [reportData,   setReportData]   = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [generated,    setGenerated]    = useState(false);

  /* ── filters ── */
  const [selectedMonth, setSelectedMonth]       = useState(String(new Date().getMonth() + 1));
  const [selectedSP,    setSelectedSP]          = useState('');
  const [selectedCity,  setSelectedCity]        = useState('');
  const [spDropOpen,    setSpDropOpen]           = useState(false);
  const [spSearch,      setSpSearch]             = useState('');
  const [monthDropOpen, setMonthDropOpen]        = useState(false);
  const [cityDropOpen,  setCityDropOpen]         = useState(false);

  /* ── pagination ── */
  const [currentPage, setCurrentPage] = useState(1);

  /* ── close dropdowns on outside click ── */
  useEffect(() => {
    const h = (e) => {
      if (!e.target.closest('.rta-dropdown-wrap')) {
        setSpDropOpen(false);
        setMonthDropOpen(false);
        setCityDropOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── load sales persons ── */
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [spRes, cityRes] = await Promise.all([
          getAllSalesPersons(),
          getAllCities(),
        ]);
        setSalesPersons(spRes?.data?.data || []);
        setCities(cityRes?.data?.data || []);
      } catch {
        toast.error('Failed to load report filters');
      }
    };
    loadFilters();
  }, []);

  /* ── FETCH REPORT ── */
  const fetchReport = useCallback(async ({ spId = '', month = selectedMonth, cityId = selectedCity } = {}) => {
    setLoading(true);
    setGenerated(false);
    setReportData([]);
    setCurrentPage(1);

    try {
      const monthName = getMonthName(month);
      const persons   = (spId
        ? salesPersons.filter(s => s._id === spId)
        : salesPersons
      ).filter(sp => !cityId || getCityId(sp.city) === cityId);

      if (!persons.length) {
        toast.info('No sales persons found');
        setLoading(false);
        setGenerated(true);
        return;
      }

      const results = await Promise.allSettled(
        persons.map(async sp => {
          try {
            const res     = await getTargetsBySalesperson(sp._id);
            const targets = res?.data?.data || res?.data || [];
            const arr     = Array.isArray(targets) ? targets : [];

            const monthTargets = arr.filter(t => {
              const tMonth = typeof t.month === 'string' ? t.month : getMonthName(t.month);
              return tMonth === monthName;
            });

            const totalTarget   = monthTargets.reduce((s, t) => s + (Number(t.target)   || 0), 0);
            const totalAchieved = monthTargets.reduce((s, t) => s + (Number(t.achieved)  || 0), 0);
            const pending       = Math.max(totalTarget - totalAchieved, 0);
            const pct           = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

            return {
              spId:       sp._id,
              name:       sp.name  || '—',
              email:      sp.email || '',
              image:      sp.image || null,
              city:       getCityName(sp.city, cities),
              totalTarget,
              totalAchieved,
              pending,
              pct,
              status:    getStatus(pct),
              hasTarget: monthTargets.length > 0,
            };
          } catch {
            return {
              spId:          sp._id,
              name:          sp.name  || '—',
              email:         sp.email || '',
              image:         sp.image || null,
              city:          getCityName(sp.city, cities),
              totalTarget:   0,
              totalAchieved: 0,
              pending:       0,
              pct:           0,
              status:        getStatus(0),
              hasTarget:     false,
            };
          }
        })
      );

      const rows = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(r => r.hasTarget)
        .sort((a, b) => b.pct - a.pct);

      setReportData(rows);
      setGenerated(true);
      if (!rows.length) toast.info(`No targets found for ${monthName}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate report');
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }, [cities, salesPersons, selectedCity, selectedMonth]);

  useEffect(() => {
    if (salesPersons.length && !generated) {
      fetchReport({ spId: selectedSP, month: selectedMonth, cityId: selectedCity });
    }
  // eslint-disable-next-line
  }, [salesPersons.length]);

  /* ── derived totals ── */
  const totals = useMemo(() => ({
    target:   reportData.reduce((s, r) => s + r.totalTarget,   0),
    achieved: reportData.reduce((s, r) => s + r.totalAchieved, 0),
    pending:  reportData.reduce((s, r) => s + r.pending,       0),
  }), [reportData]);

  const overallPct = totals.target > 0
    ? ((totals.achieved / totals.target) * 100).toFixed(1)
    : '0.0';

  /* ── pagination ── */
  const totalPages = Math.max(1, Math.ceil(reportData.length / ROWS_PER_PAGE));
  const paginated  = reportData.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  );

  /* ── dropdown helpers ── */
  const filteredSPs    = salesPersons.filter(s =>
    (s.name  || '').toLowerCase().includes(spSearch.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(spSearch.toLowerCase())
  );
  const selectedSPObj = salesPersons.find(s => s._id === selectedSP);
  const selectedCityObj = cities.find(c => c._id === selectedCity);

  /* ── handlers ── */
  const handleGenerate = () => fetchReport({ spId: selectedSP, month: selectedMonth, cityId: selectedCity });

  const handleReset = () => {
    setSelectedSP('');
    setSelectedCity('');
    setSelectedMonth(String(new Date().getMonth() + 1));
    setSpSearch('');
    setCurrentPage(1);
    setGenerated(false);
    setReportData([]);
    setTimeout(() => {
      fetchReport({ spId: '', month: String(new Date().getMonth() + 1), cityId: '' });
    }, 0);
  };

  /* ── export Excel ── */
  const handleExportExcel = () => {
    if (!reportData.length) { toast.info('No data to export'); return; }
    const rows = reportData.map(r => ({
      'Sales Person':  r.name,
      'Email':         r.email,
      'City':          r.city,
      'Month':         getMonthName(selectedMonth),
      'Target':        r.totalTarget,
      'Achieved':      r.totalAchieved,
      'Pending':       r.pending,
      'Achievement %': `${r.pct.toFixed(1)}%`,
      'Status':        r.status.label,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:22 },{ wch:28 },{ wch:15 },{ wch:12 },{ wch:12 },{ wch:12 },{ wch:12 },{ wch:14 },{ wch:14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Target Report');
    XLSX.writeFile(wb, `Target_Report_${getMonthName(selectedMonth)}.xlsx`);
    toast.success('Exported successfully');
  };

  /* ── export PDF ── */
  const handleExportPdf = () => {
    if (!reportData.length) { toast.info('No data to export'); return; }
    const doc    = new jsPDF();
    const pw     = doc.internal.pageSize.getWidth();
    const ph     = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y        = 0;

    doc.setFillColor(255, 89, 52);
    doc.rect(0, 0, pw, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Target vs Achievement Report', margin, 14);
    doc.setFontSize(9);
    doc.text(`${getMonthName(selectedMonth)} • Generated ${new Date().toLocaleDateString('en-GB')}`, pw - margin, 14, { align:'right' });

    y = 30;
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Overall: ${overallPct}% achieved | Target: ${fmtNum(totals.target)} | Achieved: ${fmtNum(totals.achieved)} | Pending: ${fmtNum(totals.pending)}`, margin, y);
    y += 8;

    const cols   = ['Sales Person','City','Target','Achieved','Pending','Achiev. %','Status'];
    const widths = [50,28,24,24,24,22,22];

    doc.setFillColor(250,250,250);
    doc.setDrawColor(229,231,235);
    doc.rect(margin, y, pw - margin * 2, 8, 'FD');
    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    doc.setTextColor(107,114,128);
    let x = margin + 2;
    cols.forEach((c, i) => { doc.text(c, x, y + 5); x += widths[i]; });
    y += 8;

    doc.setFont('helvetica','normal');
    doc.setTextColor(55,65,81);
    reportData.forEach(row => {
      if (y > ph - 16) { doc.addPage(); y = 16; }
      doc.setDrawColor(243,244,246);
      doc.rect(margin, y, pw - margin * 2, 7, 'D');
      x = margin + 2;
      const cells = [
        String(row.name).substring(0,26),
        String(row.city).substring(0,14),
        fmtNum(row.totalTarget),
        fmtNum(row.totalAchieved),
        fmtNum(row.pending),
        `${row.pct.toFixed(1)}%`,
        row.status.label,
      ];
      cells.forEach((val, i) => { doc.text(val, x, y + 4.5); x += widths[i]; });
      y += 7;
    });

    doc.save(`Target_Report_${getMonthName(selectedMonth)}.pdf`);
    toast.success('PDF exported');
  };

  /* ── active filter count ── */
  const activeFilters = [selectedSP, selectedCity, selectedMonth !== String(new Date().getMonth() + 1)].filter(Boolean).length;

  /* ── stat card config — Material icons instead of emojis ── */
  const overallPctNum = Number(overallPct);
  const statCards = [
    {
      label:   'Total Target',
      value:   fmtNum(totals.target),
      color:   'text-[#111827]',
      iconBg:  'bg-gray-100',
      Icon:    MdTrackChanges,
      iconClr: 'text-gray-500',
    },
    {
      label:   'Total Achieved',
      value:   fmtNum(totals.achieved),
      color:   'text-[#FF5934]',
      iconBg:  'bg-[#FF5934]/10',
      Icon:    MdDone,
      iconClr: 'text-[#FF5934]',
    },
    {
      label:   'Overall %',
      value:   `${overallPct}%`,
      color:   overallPctNum >= 80 ? 'text-emerald-600' : 'text-amber-600',
      iconBg:  overallPctNum >= 80 ? 'bg-emerald-50'    : 'bg-amber-50',
      Icon:    MdShowChart,
      iconClr: overallPctNum >= 80 ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      label:   'Pending',
      value:   fmtNum(totals.pending),
      color:   'text-red-500',
      iconBg:  'bg-red-50',
      Icon:    MdHourglassEmpty,
      iconClr: 'text-red-400',
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .rta-page { font-family:'DM Sans','Segoe UI',sans-serif; }
        .rta-page .table-row { transition:background 0.15s,box-shadow 0.15s; }
        .rta-page .table-row:hover { background:#FFFAF9; box-shadow:0 0 0 1px #FFD7CE inset; }
        .rta-page .rta-fselect {
          appearance:none; -webkit-appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center; padding-right:28px;
        }
        .rta-no-scroll::-webkit-scrollbar { display:none; }
        .rta-no-scroll { scrollbar-width:none; }
        .rta-dropdown-wrap { position:relative; }
        .rta-input {
          background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px;
          padding:10px 14px; font-size:13px; color:#111827; outline:none;
          font-family:'DM Sans',sans-serif; width:100%; transition:border-color 0.15s,box-shadow 0.15s;
        }
        .rta-input:focus { border-color:#FF5934; box-shadow:0 0 0 3px rgba(255,89,52,0.1); }
        @keyframes rta-in { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .rta-animate { animation:rta-in 0.22s ease both; }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.4} }
        .rta-skeleton { animation:shimmer 1.4s infinite; background:#F3F4F6; border-radius:8px; }
        .stat-card { transition:transform 0.15s,box-shadow 0.15s; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.08); }
      `}</style>

      <div className="rta-page">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Target vs Achievement</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {generated
                ? `${reportData.length} salesperson${reportData.length !== 1 ? 's' : ''} · ${getMonthName(selectedMonth)}${selectedSPObj ? ` · ${selectedSPObj.name}` : ''}`
                : 'Select filters and generate report'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {generated && reportData.length > 0 && (
              <>
                <button onClick={handleExportExcel}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 text-[#374151] text-sm font-semibold px-3 py-2 rounded-xl transition-all">
                  <MdGridOn size={15} /> Excel
                </button>
                <button onClick={handleExportPdf}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-[#374151] text-sm font-semibold px-3 py-2 rounded-xl transition-all">
                  <MdPictureAsPdf size={15} /> PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Filter Card ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-5 mb-5">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
            <MdFilterList size={13} className="text-[#FF5934]" /> Filters
            {activeFilters > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {activeFilters}
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-4 items-end">

            {/* Sales Person dropdown */}
            <div className="flex-1 min-w-[200px] rta-dropdown-wrap">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdCalendarToday size={12} className="text-[#FF5934]" /> Sales Person
              </label>
              <div
                className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                onClick={() => { setSpDropOpen(p => !p); setMonthDropOpen(false); setCityDropOpen(false); }}
              >
                {selectedSPObj ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <img src={selectedSPObj.image || placeholder} alt=""
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                      onError={e => { e.target.src = placeholder; }} />
                    <span className="text-[13px] text-[#111827] font-medium truncate">{selectedSPObj.name}</span>
                  </div>
                ) : (
                  <span className="text-[13px] text-[#9CA3AF] flex-1">All salespersons</span>
                )}
                <MdExpandMore size={18} className={`text-[#9CA3AF] transition-transform flex-shrink-0 ${spDropOpen ? 'rotate-180' : ''}`} />
              </div>

              {spDropOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ top:'100%' }}>
                  <div className="p-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                      <MdSearch size={14} className="text-[#9CA3AF]" />
                      <input autoFocus value={spSearch} onChange={e => setSpSearch(e.target.value)}
                        placeholder="Search…"
                        className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                      {spSearch && <button onClick={() => setSpSearch('')} className="text-[#9CA3AF] hover:text-[#FF5934]"><MdClose size={13} /></button>}
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto rta-no-scroll">
                    <div onClick={() => { setSelectedSP(''); setSpDropOpen(false); setSpSearch(''); }}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${!selectedSP ? 'bg-orange-50' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-gray-400">All</div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[#374151]">All Salespersons</p>
                        <p className="text-[11px] text-[#9CA3AF]">Combined report</p>
                      </div>
                      {!selectedSP && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                    </div>
                    {filteredSPs.map(sp => (
                      <div key={sp._id} onClick={() => { setSelectedSP(sp._id); setSpDropOpen(false); setSpSearch(''); }}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${selectedSP === sp._id ? 'bg-orange-50' : ''}`}>
                        <img src={sp.image || placeholder} alt=""
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-100"
                          onError={e => { e.target.src = placeholder; }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#111827] truncate">{sp.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">{sp.email}</p>
                        </div>
                        {selectedSP === sp._id && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                      </div>
                    ))}
                    {filteredSPs.length === 0 && (
                      <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No results</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Site / Location dropdown */}
            <div className="flex-1 min-w-[200px] rta-dropdown-wrap">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdLocationOn size={12} className="text-[#FF5934]" /> Site / Location
              </label>
              <div
                className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                onClick={() => { setCityDropOpen(p => !p); setSpDropOpen(false); setMonthDropOpen(false); }}
              >
                {selectedCityObj ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MdLocationOn size={14} className="text-blue-500 flex-shrink-0" />
                    <span className="text-[13px] text-[#111827] font-medium truncate">
                      {selectedCityObj.name || selectedCityObj.cityName}
                    </span>
                  </div>
                ) : (
                  <span className="text-[13px] text-[#9CA3AF] flex-1">All locations</span>
                )}
                <MdExpandMore size={18} className={`text-[#9CA3AF] transition-transform flex-shrink-0 ${cityDropOpen ? 'rotate-180' : ''}`} />
              </div>

              {cityDropOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ top:'100%' }}>
                  <div className="max-h-56 overflow-y-auto rta-no-scroll">
                    <div onClick={() => { setSelectedCity(''); setCityDropOpen(false); }}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors border-b border-gray-50 ${!selectedCity ? 'bg-orange-50' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-gray-400">All</div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[#374151]">All Locations</p>
                        <p className="text-[11px] text-[#9CA3AF]">Combined report</p>
                      </div>
                      {!selectedCity && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                    </div>
                    {cities.map(city => {
                      const isSelected = selectedCity === city._id;
                      return (
                        <div key={city._id} onClick={() => { setSelectedCity(city._id); setCityDropOpen(false); }}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0 ${isSelected ? 'bg-orange-50' : ''}`}>
                          <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <MdLocationOn size={13} className="text-blue-500" />
                          </div>
                          <p className={`text-[13px] font-medium truncate flex-1 ${isSelected ? 'text-[#FF5934]' : 'text-[#111827]'}`}>
                            {city.name || city.cityName}
                          </p>
                          {isSelected && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                        </div>
                      );
                    })}
                    {cities.length === 0 && (
                      <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No locations found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Month dropdown */}
            <div className="flex-1 min-w-[180px] rta-dropdown-wrap">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdCalendarToday size={12} className="text-[#FF5934]" /> Month
              </label>
              <div
                className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                onClick={() => { setMonthDropOpen(p => !p); setSpDropOpen(false); setCityDropOpen(false); }}
              >
                <span className="text-[13px] text-[#111827] font-medium flex-1">{getMonthName(selectedMonth)}</span>
                <MdExpandMore size={18} className={`text-[#9CA3AF] transition-transform flex-shrink-0 ${monthDropOpen ? 'rotate-180' : ''}`} />
              </div>

              {monthDropOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ top:'100%' }}>
                  <div className="max-h-64 overflow-y-auto rta-no-scroll">
                    {MONTHS.map((m, i) => {
                      const val        = String(i + 1);
                      const isSelected = val === selectedMonth;
                      return (
                        <div key={m} onClick={() => { setSelectedMonth(val); setMonthDropOpen(false); }}
                          className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0 ${isSelected ? 'bg-orange-50' : ''}`}>
                          <span className={`text-[13px] font-medium ${isSelected ? 'text-[#FF5934]' : 'text-[#374151]'}`}>{m}</span>
                          {isSelected && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleReset}
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                <MdRefresh size={15} /> Reset
              </button>
              <button onClick={handleGenerate} disabled={loading || !salesPersons.length}
                className="h-10 px-5 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-orange-100 transition-all flex items-center gap-2">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading…</>
                  : <><MdBarChart size={16} /> Generate</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-20 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[#9CA3AF]">Fetching targets for {getMonthName(selectedMonth)}…</p>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && generated && (
          <div className="rta-animate">

            {/* ── Stat cards — Material icons, no emojis ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {statCards.map(({ label, value, color, iconBg, Icon, iconClr }) => (
                <div key={label} className="stat-card bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 flex items-center gap-4">
                  {/* Icon container */}
                  <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={22} className={iconClr} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                    <p className={`text-[15px] font-bold truncate ${color}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Table ── */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {reportData.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <MdBarChart size={26} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">No targets found for {getMonthName(selectedMonth)}</p>
                  <p className="text-[11px] text-[#9CA3AF]">Try a different month or add targets in Target Management</p>
                </div>
              ) : (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#FAFAFA] border-b border-gray-100">
                        {['#','Salesperson','City','Target','Achieved','Pending','Progress','Status'].map(h => (
                          <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginated.map((row, i) => {
                        const n  = (currentPage - 1) * ROWS_PER_PAGE + i + 1;
                        const sc = statusColors[row.status.color] || statusColors.red;
                        return (
                          <tr key={row.spId} className="table-row">
                            <td className="px-4 py-3 text-[12px] font-bold text-[#C4C9D4]">{n}</td>

                            {/* Salesperson */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                  <img src={row.image || placeholder} alt={row.name}
                                    className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                                    onError={e => { e.target.src = placeholder; }} />
                                </div>
                                <div>
                                  <p className="text-[13px] font-semibold text-[#111827] leading-tight">{row.name}</p>
                                  <p className="text-[11px] text-[#9CA3AF]">{row.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* City */}
                            <td className="px-4 py-3 text-[13px] text-[#6B7280]">{row.city || '—'}</td>

                            {/* Target */}
                            <td className="px-4 py-3">
                              <span className="text-[13px] font-semibold text-[#111827]">{fmtNum(row.totalTarget)}</span>
                              <div className="text-[11px] text-[#9CA3AF]">cartons</div>
                            </td>

                            {/* Achieved */}
                            <td className="px-4 py-3">
                              <span className="text-[13px] font-semibold text-[#FF5934]">{fmtNum(row.totalAchieved)}</span>
                              <div className="text-[11px] text-[#9CA3AF]">cartons</div>
                            </td>

                            {/* Pending */}
                            <td className="px-4 py-3">
                              <span className="text-[13px] font-semibold text-red-500">{fmtNum(row.pending)}</span>
                              <div className="text-[11px] text-[#9CA3AF]">remaining</div>
                            </td>

                            {/* Progress */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span style={{ color: pctColor(row.pct), background: pctBg(row.pct) }}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold">
                                  {row.pct.toFixed(1)}%
                                </span>
                              </div>
                              <div className="mt-1 w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{ width:`${Math.min(row.pct, 100)}%`, background: pctColor(row.pct) }} />
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                                style={{ background:sc.bg, borderColor:sc.border, color:sc.text }}>
                                <span style={{ width:5, height:5, borderRadius:'50%', background:sc.dot, display:'inline-block' }} />
                                {row.status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Footer */}
                  <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Target</p>
                        <p className="text-[14px] font-bold text-[#111827]">{fmtNum(totals.target)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Achieved</p>
                        <p className="text-[14px] font-bold text-[#FF5934]">{fmtNum(totals.achieved)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Overall</p>
                        <p className={`text-[14px] font-bold ${Number(overallPct) >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>{overallPct}%</p>
                      </div>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                          <GrFormPrevious size={16} />
                        </button>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                          <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-[#374151]">{totalPages}</span>
                        </div>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                          <GrFormNext size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ReportsTargetVsAchieve;
