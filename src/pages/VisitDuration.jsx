


import { useState, useEffect } from "react";
import { GrFormPrevious } from "react-icons/gr";
import { Link, useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { getAttendanceBySalesId, getAllSalesPersons } from "../APIS";
import { Loader } from "../components/common/loader";
import {
  MdSearch, MdClose, MdRefresh, MdPerson, MdCalendarToday,
  MdBarChart, MdCheckCircle, MdLogout, MdLogin, MdTimer,
  MdFilterList, MdPictureAsPdf, MdGridOn,
} from "react-icons/md";

/* ─── helpers ─── */
const formatTime = (time) => {
  if (!time) return "—";
  try {
    const date = time.includes("T") ? new Date(time) : (() => {
      const [h, m] = time.split(":");
      const d = new Date(); d.setHours(+h, +m, 0, 0); return d;
    })();
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return "—"; }
};

const formatDate = (dateString) => {
  if (!dateString) return "—";
  try { return new Date(dateString).toLocaleDateString("en-GB"); } catch { return "—"; }
};

const calcDiff = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return { display: "—", seconds: 0 };
  const ms = new Date(checkOut) - new Date(checkIn);
  if (ms <= 0) return { display: "—", seconds: 0 };
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  let display = "";
  if (h > 0) display += `${h}h `;
  if (m > 0 || h > 0) display += `${m}m `;
  display += `${sec}s`;
  return { display: display.trim(), seconds: s };
};

const calcTotal = (data) => {
  let total = 0;
  data.forEach((r) => { const { seconds } = calcDiff(r.checkInTime, r.checkOutTime); total += seconds; });
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  let out = "";
  if (h > 0) out += `${h}h `;
  if (m > 0 || h > 0) out += `${m}m `;
  out += `${s}s`;
  return out.trim() || "0s";
};

const barWidth = (checkIn, checkOut) => {
  const { seconds } = calcDiff(checkIn, checkOut);
  return Math.min((seconds / 36000) * 100, 100);
};

const statusColor = (checkIn, checkOut) => {
  const { seconds } = calcDiff(checkIn, checkOut);
  if (!checkIn)         return { pill: "bg-gray-100 text-gray-400 ring-gray-200",           dot: "bg-gray-300",   label: "Absent"   };
  if (!checkOut)        return { pill: "bg-amber-50 text-amber-600 ring-amber-200",         dot: "bg-amber-400",  label: "Active"   };
  if (seconds >= 28800) return { pill: "bg-emerald-50 text-emerald-600 ring-emerald-200",   dot: "bg-emerald-400", label: "Full Day" };
  if (seconds >= 14400) return { pill: "bg-blue-50 text-blue-600 ring-blue-200",            dot: "bg-blue-400",   label: "Half Day" };
  return                       { pill: "bg-red-50 text-red-500 ring-red-200",               dot: "bg-red-400",    label: "Short"    };
};

const getVisitData = (data) => {
  const byDate = {};
  data.forEach((r) => {
    const d = r.date || (r.checkInTime ? new Date(r.checkInTime).toISOString().slice(0, 10) : null);
    if (!d) return;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  });
  return Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, records]) => ({ date, records }));
};

const reportHeaders = [
  "Employee Name",
  "Date",
  "Check-In Time",
  "Check-Out Time",
  "Total Hours Worked",
  "Status",
  "Remarks",
];

const safeFilePart = (value) =>
  String(value || "attendance-report")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

const getRecordDateKey = (record) => {
  const rawDate = record.date || record.checkInTime || record.checkOutTime;
  if (!rawDate) return "";
  if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const getEmployeeName = (record, selectedPerson) =>
  selectedPerson?.name ||
  record.salesPersonID?.name ||
  record.salesPerson?.name ||
  record.employeeName ||
  record.name ||
  "Unknown";

const getRemarks = (record) => {
  const note = record.remarks || record.remark || record.note || record.notes || record.description;
  if (note) return String(note);
  if (!record.checkInTime) return "No check-in recorded";
  if (!record.checkOutTime) return "Check-out pending";
  return "";
};

const buildReportRows = (data, selectedPerson) =>
  data.map((record) => {
    const { display } = calcDiff(record.checkInTime, record.checkOutTime);
    return {
      "Employee Name": getEmployeeName(record, selectedPerson),
      Date: formatDate(getRecordDateKey(record)),
      "Check-In Time": formatTime(record.checkInTime),
      "Check-Out Time": formatTime(record.checkOutTime),
      "Total Hours Worked": display,
      Status: statusColor(record.checkInTime, record.checkOutTime).label,
      Remarks: getRemarks(record),
    };
  });

const getDateRangeLabel = (rows, startDate, endDate) => {
  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  if (startDate) return `${formatDate(startDate)} - Latest`;
  if (endDate) return `Up to ${formatDate(endDate)}`;
  const validDates = rows
    .map((row) => row.Date)
    .filter((date) => date && date.includes("/"))
    .sort((a, b) => {
      const [ad, am, ay] = a.split("/");
      const [bd, bm, by] = b.split("/");
      return new Date(`${ay}-${am}-${ad}`) - new Date(`${by}-${bm}-${bd}`);
    });
  if (!validDates.length) return "Generated records";
  return `${validDates[0]} - ${validDates[validDates.length - 1]}`;
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const VisitDuration = () => {
//   const [activeTab, setActiveTab]                   = useState("visit");
  const [attendanceData, setAttendanceData]         = useState([]);
  const [loading, setLoading]                       = useState(false);
  const [salesPersons, setSalesPersons]             = useState([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
  const [startDate, setStartDate]                   = useState("");
  const [endDate, setEndDate]                       = useState("");
  const [spSearch, setSpSearch]                     = useState("");
  const [spDropOpen, setSpDropOpen]                 = useState(false);
  const [generated, setGenerated]                   = useState(false);

  const [searchParams] = useSearchParams();
  const salesIdFromUrl  = searchParams.get("salesId");

  /* load sales persons once */
  useEffect(() => {
    getAllSalesPersons()
      .then((res) => setSalesPersons(res.data.data || []))
      .catch(() => {});
    if (salesIdFromUrl) setSelectedSalesPerson(salesIdFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* auto-fetch when coming from URL with salesId */
  useEffect(() => {
    if (salesIdFromUrl && salesPersons.length > 0) {
      fetchData(salesIdFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesIdFromUrl, salesPersons]);

  const fetchData = async (overrideSid) => {
    const sid = overrideSid || selectedSalesPerson || salesIdFromUrl;
    if (!sid) { alert("Please select a sales person first."); return; }
    try {
      setLoading(true);
      setGenerated(false);
      const daysToFetch = startDate || endDate ? 365 : 30;
      const response = await getAttendanceBySalesId(sid, daysToFetch);
      if (response.data.msg === "success") {
        let data = Array.isArray(response.data.data) ? response.data.data : [];
        if (startDate || endDate) {
          data = data.filter((r) => {
            const dStr = r.date || (r.checkInTime ? new Date(r.checkInTime).toISOString().slice(0, 10) : null);
            if (!dStr) return false;
            if (startDate && dStr < startDate) return false;
            if (endDate && dStr > endDate) return false;
            return true;
          });
        }
        setAttendanceData(data);
        setGenerated(true);
      }
    } catch (e) {
      console.error("Attendance fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSelectedSalesPerson("");
    setAttendanceData([]);
    setGenerated(false);
    setSpSearch("");
  };

  const sortedData = [...attendanceData].sort((a, b) => {
    const diff = new Date(b.date || 0) - new Date(a.date || 0);
    if (diff !== 0) return diff;
    return (b.checkInTime ? new Date(b.checkInTime).getTime() : 0)
         - (a.checkInTime ? new Date(a.checkInTime).getTime() : 0);
  });

  const selectedPersonObj = salesPersons.find((sp) => sp._id === selectedSalesPerson);
  const filteredSP        = salesPersons.filter((sp) =>
    (sp.name || "").toLowerCase().includes(spSearch.toLowerCase())
  );
  const reportRows = buildReportRows(sortedData, selectedPersonObj);
  const visitGroups = getVisitData(sortedData);

  const canGenerate = !!(selectedSalesPerson || salesIdFromUrl);
  const canExport = generated && reportRows.length > 0 && !loading;

  const getReportFileName = (extension) => {
    const person = safeFilePart(selectedPersonObj?.name || selectedSalesPerson || salesIdFromUrl || "all");
    const from = startDate || "latest";
    const to = endDate || new Date().toISOString().slice(0, 10);
    return `attendance-report-${person}-${from}-to-${to}.${extension}`;
  };

  const handleExportExcel = () => {
    if (!canExport) {
      alert("Please generate a report with attendance records first.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(reportRows, { header: reportHeaders });
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 14 },
      { wch: 32 },
    ];
    if (worksheet["!ref"]) {
      worksheet["!autofilter"] = { ref: worksheet["!ref"] };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
    XLSX.writeFile(workbook, getReportFileName("xlsx"));
  };

  const handleExportPdf = () => {
    if (!canExport) {
      alert("Please generate a report with attendance records first.");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const footerHeight = 12;
    const rowMinHeight = 8;
    const columns = [
      { key: "Employee Name", width: 44 },
      { key: "Date", width: 24 },
      { key: "Check-In Time", width: 28 },
      { key: "Check-Out Time", width: 28 },
      { key: "Total Hours Worked", width: 34 },
      { key: "Status", width: 24 },
      { key: "Remarks", width: 95 },
    ];
    const dateRange = getDateRangeLabel(reportRows, startDate, endDate);

    const drawReportHeader = () => {
      doc.setFillColor(255, 89, 52);
      doc.rect(0, 0, pageWidth, 17, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Prime Link Distribution", margin, 10.5);
      doc.setFontSize(9);
      doc.text("Attendance Report", pageWidth - margin, 10.5, { align: "right" });

      doc.setTextColor(17, 24, 39);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Attendance Report", margin, 25);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(75, 85, 99);
      doc.text(`Sales Person: ${selectedPersonObj?.name || "Selected salesperson"}`, margin, 31);
      doc.text(`Date Range: ${dateRange}`, margin + 92, 31);
      doc.text(`Records: ${reportRows.length}`, margin + 175, 31);
      doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, pageWidth - margin, 31, { align: "right" });

      let x = margin;
      const y = 38;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      columns.forEach((column) => {
        doc.setFillColor(255, 239, 235);
        doc.rect(x, y, column.width, 8, "F");
        doc.setDrawColor(255, 183, 167);
        doc.rect(x, y, column.width, 8, "S");
        doc.setTextColor(17, 24, 39);
        doc.text(doc.splitTextToSize(column.key, column.width - 4), x + 2, y + 5);
        x += column.width;
      });
      return y + 8;
    };

    let y = drawReportHeader();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    reportRows.forEach((row) => {
      const cellLines = columns.map((column) =>
        doc.splitTextToSize(String(row[column.key] || "-"), column.width - 4)
      );
      const rowHeight = Math.max(rowMinHeight, ...cellLines.map((lines) => lines.length * 4 + 4));

      if (y + rowHeight > pageHeight - footerHeight) {
        doc.addPage();
        y = drawReportHeader();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
      }

      let x = margin;
      doc.setDrawColor(229, 231, 235);
      doc.setTextColor(31, 41, 55);
      cellLines.forEach((lines, index) => {
        const column = columns[index];
        doc.rect(x, y, column.width, rowHeight);
        doc.text(lines, x + 2, y + 5);
        x += column.width;
      });
      y += rowHeight;
    });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
    }

    doc.save(getReportFileName("pdf"));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .att-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .att-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .att-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .att-tab { transition: all 0.2s; border-bottom: 2.5px solid transparent; padding: 10px 16px; cursor: pointer; }
        .att-tab.active { border-bottom-color: #FF5934; color: #FF5934; background: #fff8f6; border-radius: 8px 8px 0 0; }
        .att-tab:not(.active) { color: #6B7280; }
        .att-tab:not(.active):hover { color: #111827; background: #F9FAFB; border-radius: 8px 8px 0 0; }
        @keyframes attModalIn   { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes attOverlayIn { from { opacity:0; } to { opacity:1; } }
        .att-modal-overlay { animation: attOverlayIn 0.2s ease; }
        .att-modal-card    { animation: attModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .att-dur-track { height:4px; border-radius:9999px; background:#F3F4F6; overflow:hidden; }
        .att-dur-bar   { height:4px; border-radius:9999px; background:#FF5934; transition: width 0.6s ease; }
        .att-no-scroll::-webkit-scrollbar { display:none; }
        .att-no-scroll { scrollbar-width: none; }
        .att-select {
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        .att-input {
          background: #F9FAFB; border: 1px solid #E5E7EB;
          border-radius: 12px; padding: 10px 14px;
          font-size: 13px; color: #111827; outline: none;
          font-family: 'DM Sans', sans-serif; width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .att-input:focus { border-color: #FF5934; box-shadow: 0 0 0 3px rgba(255,89,52,0.1); }
        .att-input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      `}</style>

      <div className="att-page">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/attendance-tracking"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-orange-50 hover:border-[#FF5934] text-[#374151] hover:text-[#FF5934] transition-all shadow-sm"
            >
              <GrFormPrevious size={18} />
            </Link>
            <div>
              <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Visit Duration</h1>
              {generated && attendanceData.length > 0 && (
                <p className="text-sm text-[#9CA3AF] mt-0.5">
                  Total: <span className="text-[#FF5934] font-semibold">{calcTotal(attendanceData)}</span>
                  &nbsp;·&nbsp;{attendanceData.length} record{attendanceData.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!canExport}
              className="h-10 px-4 rounded-xl border border-red-100 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-100 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <MdPictureAsPdf size={16} /> PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!canExport}
              className="h-10 px-4 rounded-xl border border-emerald-100 bg-white text-emerald-600 text-sm font-semibold hover:bg-emerald-50 disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-100 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <MdGridOn size={16} /> Excel
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-visible mb-0">

          {/* Tab bar */}
          {/* <div className="flex border-b border-gray-100 px-3 pt-2 gap-1">
            {[
              { key: "checkin", icon: MdLogin,  label: "Check-In / Out"  },
              { key: "visit",   icon: MdTimer,  label: "Visit Duration"  },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`att-tab flex items-center gap-2 text-[13px] font-semibold ${activeTab === key ? "active" : ""}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div> */}

          {/* ── Shared Filter Card ── */}
          <div className="px-5 py-5 border-b border-gray-100 bg-[#FAFAFA]">
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
              <MdFilterList size={13} className="text-[#FF5934]" /> Filters
            </p>

            <div className="flex flex-wrap gap-4 items-end">

              {/* ── Sales Person Picker ── */}
              <div className="flex-1 min-w-[220px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdPerson size={12} className="text-[#FF5934]" /> Sales Person
                </label>
                <div className="relative">
                  <div
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                    onClick={() => setSpDropOpen(p => !p)}
                  >
                    {selectedPersonObj ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#FF5934] text-[10px] font-bold">
                            {(selectedPersonObj.name || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[13px] text-[#111827] font-medium truncate">{selectedPersonObj.name}</span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-gray-300 flex-1">Select sales person…</span>
                    )}
                    <MdFilterList size={15} className="text-[#9CA3AF] flex-shrink-0" />
                  </div>

                  {/* Dropdown */}
                  {spDropOpen && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                          <MdSearch size={14} className="text-[#9CA3AF]" />
                          <input
                            autoFocus
                            value={spSearch}
                            onChange={e => setSpSearch(e.target.value)}
                            placeholder="Search…"
                            className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
                          />
                          {spSearch && (
                            <button onClick={() => setSpSearch("")} className="text-[#9CA3AF] hover:text-[#FF5934]">
                              <MdClose size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto att-no-scroll">
                        {filteredSP.length ? filteredSP.map(sp => (
                          <div
                            key={sp._id}
                            onClick={() => { setSelectedSalesPerson(sp._id); setSpDropOpen(false); setSpSearch(""); }}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${selectedSalesPerson === sp._id ? "bg-orange-50" : ""}`}
                          >
                            <div className="w-7 h-7 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[#FF5934] text-[11px] font-bold">{(sp.name || "?")[0].toUpperCase()}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-[#111827] truncate">{sp.name}</p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">{sp.email}</p>
                            </div>
                            {selectedSalesPerson === sp._id && (
                              <MdCheckCircle size={15} className="text-[#FF5934] flex-shrink-0" />
                            )}
                          </div>
                        )) : (
                          <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No results found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Date From ── */}
              <div className="flex-1 min-w-[160px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdCalendarToday size={12} className="text-[#FF5934]" /> From
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="att-input"
                />
              </div>

              {/* ── Date To ── */}
              <div className="flex-1 min-w-[160px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdCalendarToday size={12} className="text-[#FF5934]" /> To
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="att-input"
                />
              </div>

              {/* ── Buttons ── */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleReset}
                  className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
                >
                  <MdRefresh size={15} /> Reset
                </button>
                <button
                  onClick={() => fetchData()}
                  disabled={!canGenerate}
                  className="h-10 px-5 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-orange-100 transition-all flex items-center gap-2"
                >
                  <MdBarChart size={16} /> Generate Report
                </button>
              </div>
            </div>

            {/* Active filter chips */}
            {(selectedPersonObj || startDate || endDate) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {selectedPersonObj && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#FF5934]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#FF5934] text-[9px] font-bold">{(selectedPersonObj.name || "?")[0].toUpperCase()}</span>
                    </div>
                    <span className="text-[12px] font-semibold text-[#FF5934]">{selectedPersonObj.name}</span>
                    <button onClick={() => { setSelectedSalesPerson(""); setAttendanceData([]); setGenerated(false); }} className="text-[#FF5934]/50 hover:text-[#FF5934] ml-1">
                      <MdClose size={13} />
                    </button>
                  </div>
                )}
                {(startDate || endDate) && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                    <MdCalendarToday size={12} className="text-blue-500" />
                    <span className="text-[12px] font-semibold text-blue-600">{startDate || "Start"} to {endDate || "Latest"}</span>
                    <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-blue-400 hover:text-blue-600 ml-1">
                      <MdClose size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ TAB CONTENT ═══ */}

        
            <>
              {loading ? (
                <div className="py-20 flex justify-center"><Loader /></div>
              ) : !generated ? (
                <div className="py-20 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <MdBarChart size={24} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">Select a sales person and click Generate Report</p>
                </div>
              ) : attendanceData.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <MdTimer size={24} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">No visit data found for this period</p>
                  <button onClick={handleReset} className="text-[#FF5934] text-xs hover:underline font-medium">Clear filters</button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {visitGroups.map(({ date, records }) => {
                    const dayTotal = calcTotal(records);
                    return (
                      <div key={date} className="px-5 py-4">

                        {/* Day header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                              <MdCalendarToday size={14} className="text-[#FF5934]" />
                            </div>
                            <p className="text-[13px] font-bold text-[#111827]">{formatDate(date)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-[#9CA3AF]">{records.length} session{records.length !== 1 ? "s" : ""}</span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-[#FF5934] ring-1 ring-orange-200">
                              <MdTimer size={11} /> {dayTotal}
                            </span>
                          </div>
                        </div>

                        {/* Sessions */}
                        <div className="flex flex-col gap-2 pl-10">
                          {records.map((r, i) => {
                            const { display } = calcDiff(r.checkInTime, r.checkOutTime);
                            const pct = barWidth(r.checkInTime, r.checkOutTime);
                            const sc  = statusColor(r.checkInTime, r.checkOutTime);
                            return (
                              <div key={r._id || i} className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-[12px] text-[#374151]">
                                      <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                        <MdLogin size={11} className="text-emerald-500" />
                                      </div>
                                      <span className="font-medium">{formatTime(r.checkInTime)}</span>
                                    </div>
                                    <span className="text-gray-300 text-[10px]">→</span>
                                    <div className="flex items-center gap-1.5 text-[12px] text-[#374151]">
                                      <div className="w-5 h-5 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                                        <MdLogout size={11} className="text-red-400" />
                                      </div>
                                      <span className="font-medium">{formatTime(r.checkOutTime)}</span>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${sc.pill}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                      {sc.label}
                                    </span>
                                  </div>
                                  <span className="text-[13px] font-bold text-[#111827] flex-shrink-0">{display}</span>
                                </div>
                                {/* Duration bar */}
                                <div className="att-dur-track mt-1">
                                  <div className="att-dur-bar" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-[10px] text-[#9CA3AF] mt-1">{Math.round(pct)}% of 10h target</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Overall summary footer */}
                  <div className="px-5 py-4 bg-[#FAFAFA] border-t border-gray-100 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Overall Total</p>
                    <span className="inline-flex items-center gap-2 text-[14px] font-bold text-[#111827]">
                      <MdTimer size={16} className="text-[#FF5934]" />
                      {calcTotal(attendanceData)}
                    </span>
                  </div>
                </div>
              )}
            </>
         
        </div>
      </div>
    </>
  );
};

export default VisitDuration;
