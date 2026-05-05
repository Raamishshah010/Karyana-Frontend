import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllSalesPersons,
  getTargetsBySalesperson,
  getOrdersBySalesPersonAndDate,
} from "../APIS";
import { Loader } from "../components/common/loader";
import {
  MdRefresh,
  MdFilterList,
  MdExpandMore,
  MdPictureAsPdf,
  MdGridOn,
  MdWarning,
  MdBarChart,
  MdBugReport,
} from "react-icons/md";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

const formatCurrency = (val) => {
  if (val === null || val === undefined || val === "") return "—";
  const num = Number(val);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatNumber = (val) => {
  if (val === null || val === undefined || val === "") return "0";
  const num = Number(val);
  if (Number.isNaN(num)) return "0";
  return num.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const formatPercent = (val) => {
  if (val === null || val === undefined || val === "") return "0%";
  const num = Number(val);
  if (Number.isNaN(num)) return "0%";
  return `${num.toFixed(1)}%`;
};

const safeNumber = (val) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

const getLocalDateString = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayLocal = () => getLocalDateString(new Date());

const getFirstDayOfMonthLocal = () => {
  const d = new Date();
  d.setDate(1);
  return getLocalDateString(d);
};

const extractArray = (res) => {
  const candidates = [
    res?.data,
    res?.data?.data,
    res?.data?.records,
    res?.data?.result,
    res?.data?.items,
    res?.records,
    res?.result,
    res?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const pickNumber = (obj, keys = []) => {
  for (const key of keys) {
    const value = obj?.[key];
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
};

const getAuthToken = () => {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("x-auth-token") ||
    ""
  );
};

const getStatusColor = (achieved, target) => {
  if (!target || target === 0) return { label: "N/A", color: "gray" };
  const percent = (achieved / target) * 100;
  if (percent >= 100) return { label: "Achieved", color: "emerald" };
  if (percent >= 80) return { label: "On Track", color: "blue" };
  if (percent >= 60) return { label: "In Progress", color: "amber" };
  return { label: "Behind", color: "red" };
};

const sumTargets = (targets = []) => {
  return targets.reduce((sum, t) => {
    return (
      sum +
      pickNumber(t, [
        "targetAmount",
        "targetValue",
        "target",
        "amount",
        "monthlyTarget",
        "currentTarget",
        "targetQty",
      ])
    );
  }, 0);
};

const sumAchievements = (orders = []) => {
  return orders.reduce((sum, o) => {
    return (
      sum +
      pickNumber(o, [
        "achievedAmount",
        "totalAmount",
        "grandTotal",
        "netAmount",
        "total",
        "amount",
        "orderTotal",
        "invoiceTotal",
      ])
    );
  }, 0);
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const ReportsTargetVsAchieve = () => {
  const [salesPersons, setSalesPersons] = useState([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState(null);
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayLocal());
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [spSearch, setSpSearch] = useState("");
  const [spDropOpen, setSpDropOpen] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState("");
  const [debugMode, setDebugMode] = useState(false); // Debug toggle
  const [apiErrors, setApiErrors] = useState([]); // Track API errors for debugging

  const loadSalesPersons = useCallback(async () => {
    try {
      console.log("📥 Loading sales persons...");
      const res = await getAllSalesPersons();
      const list = extractArray(res);
      
      console.log(`✅ Loaded ${list.length} sales persons`, list);
      setSalesPersons(list);
      
      if (list.length === 0) {
        setError("No sales persons found in the system");
      }
    } catch (err) {
      console.error("❌ Error loading sales persons:", err);
      setError(`Failed to load sales persons: ${err?.message || "Unknown error"}`);
      setSalesPersons([]);
    }
  }, []);

  const fetchReport = useCallback(
    async ({ salespersonId = null, from = dateFrom, to = dateTo } = {}) => {
      setLoading(true);
      setError("");
      setApiErrors([]); // Clear previous errors

      try {
        const token = getAuthToken();
        
        if (!token) {
          setError("⚠️ Authentication token not found. Please login again.");
          setLoading(false);
          return;
        }

        console.log(`\n🔍 Fetching report for:`, {
          salespersonId: salespersonId || "All",
          from,
          to,
          tokenExists: !!token,
        });

        const personsToProcess = salespersonId
          ? salesPersons.filter((sp) => sp?._id === salespersonId)
          : salesPersons;

        if (!personsToProcess.length) {
          setReportData([]);
          setGenerated(true);
          setError("No sales persons found to process");
          setLoading(false);
          return;
        }

        console.log(`📊 Processing ${personsToProcess.length} salesperson(s)`);

        const rows = await Promise.all(
          personsToProcess.map(async (sp) => {
            try {
              console.log(`\n  📍 Processing: ${sp.name} (${sp._id})`);

              // Log what we're sending to the API
              const requestData = {
                salesPersonId: sp._id,
                startDate: from,
                endDate: to,
              };
              console.log(`     📤 Sending request:`, requestData);

              const [targetsRes, ordersRes] = await Promise.all([
                getTargetsBySalesperson(sp._id),
                getOrdersBySalesPersonAndDate(requestData, token),
              ]);

              const targets = extractArray(targetsRes);
              const orders = extractArray(ordersRes);

              console.log(`     ✅ Got ${targets.length} targets and ${orders.length} orders`);

              const totalTarget = sumTargets(targets);
              const totalAchievement = sumAchievements(orders);
              const pending = Math.max(totalTarget - totalAchievement, 0);

              return {
                salespersonId: sp._id,
                salespersonName: sp.name || sp.fullName || sp.email || "—",
                email: sp.email || "",
                totalTarget,
                totalAchievement,
                pending,
                achievementPercent:
                  totalTarget > 0 ? (totalAchievement / totalTarget) * 100 : 0,
                status: getStatusColor(totalAchievement, totalTarget),
              };
            } catch (err) {
              console.error(`  ❌ Error processing ${sp.name}:`, err);
              
              // Capture error details for debugging
              const errorInfo = {
                salespersonName: sp.name,
                salespersonId: sp._id,
                errorStatus: err.response?.status,
                errorMessage: err.response?.data?.message || err.message,
                errorData: err.response?.data,
              };
              
              setApiErrors((prev) => [...prev, errorInfo]);

              return {
                salespersonId: sp._id,
                salespersonName: sp.name || sp.fullName || sp.email || "—",
                email: sp.email || "",
                totalTarget: 0,
                totalAchievement: 0,
                pending: 0,
                achievementPercent: 0,
                status: { label: "Error", color: "gray" },
                error: err?.response?.data?.message || err?.message || "Failed to load",
              };
            }
          })
        );

        rows.sort((a, b) => b.achievementPercent - a.achievementPercent);

        console.log(`\n✨ Report generated with ${rows.length} rows`, rows);
        setReportData(rows);
        setGenerated(true);

        if (!rows.length) {
          setError("No data found for the selected date range");
        }
      } catch (err) {
        console.error("❌ Error fetching report:", err);
        setError(`Failed to fetch report: ${err?.message || "Unknown error"}`);
        setReportData([]);
        setGenerated(true);
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, salesPersons]
  );

  useEffect(() => {
    loadSalesPersons();
  }, [loadSalesPersons]);

  useEffect(() => {
    if (salesPersons.length > 0 && !generated) {
      fetchReport({ salespersonId: null, from: dateFrom, to: dateTo });
    }
  }, [salesPersons.length]);

  const filteredSP = useMemo(() => {
    const q = spSearch.toLowerCase().trim();
    if (!q) return salesPersons;
    return salesPersons.filter((sp) => {
      const name = (sp?.name || "").toLowerCase();
      const email = (sp?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [salesPersons, spSearch]);

  const selectedPerson = useMemo(
    () => salesPersons.find((s) => s?._id === selectedSalesPerson),
    [salesPersons, selectedSalesPerson]
  );

  const totals = useMemo(() => {
    return reportData.reduce(
      (acc, r) => {
        acc.targetQty += safeNumber(r.totalTarget);
        acc.achievedQty += safeNumber(r.totalAchievement);
        acc.pendingQty += safeNumber(r.pending);
        return acc;
      },
      { targetQty: 0, achievedQty: 0, pendingQty: 0 }
    );
  }, [reportData]);

  const overallPercent =
    totals.targetQty > 0 ? ((totals.achievedQty / totals.targetQty) * 100).toFixed(1) : "0.0";

  const handleGenerateReport = async () => {
    if (!dateFrom || !dateTo) {
      setError("Please select both From and To dates");
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      setError("From date cannot be after To date");
      return;
    }

    await fetchReport({
      salespersonId: selectedSalesPerson,
      from: dateFrom,
      to: dateTo,
    });
  };

  const handleReset = async () => {
    const from = getFirstDayOfMonthLocal();
    const to = getTodayLocal();

    setSelectedSalesPerson(null);
    setDateFrom(from);
    setDateTo(to);
    setSpSearch("");
    setSpDropOpen(false);
    setGenerated(false);
    setError("");
    setReportData([]);
    setApiErrors([]);

    await fetchReport({
      salespersonId: null,
      from,
      to,
    });
  };

  const handleExportExcel = () => {
    if (!reportData.length) {
      alert("No data to export");
      return;
    }

    const data = reportData.map((r) => ({
      "Sales Person": r.salespersonName,
      Email: r.email,
      "Total Target": r.totalTarget,
      "Total Achievement": r.totalAchievement,
      Pending: r.pending,
      "Achievement %": `${safeNumber(r.achievementPercent).toFixed(1)}%`,
      Status: r.status?.label || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    const person = selectedPerson?.name || "All-Salespersons";
    XLSX.writeFile(wb, `target-report-${person}-${dateFrom}-${dateTo}.xlsx`);
  };

  const handleExportPdf = () => {
    if (!reportData.length) {
      alert("No data to export");
      return;
    }

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let y = 15;

    doc.setFillColor(255, 89, 52);
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Target vs Achievement Report", margin, 12);

    const person = selectedPerson?.name || "All Salespersons";
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Sales Person: ${person}`, margin, y + 10);
    doc.text(`Date Range: ${dateFrom} to ${dateTo}`, margin + 70, y + 10);
    doc.text(
      `Generated: ${new Date().toLocaleDateString("en-GB")}`,
      pageWidth - margin - 55,
      y + 10
    );

    y += 20;

    const cols = ["Sales Person", "Target", "Achieved", "Pending", "Achievement %"];
    const colWidths = [55, 30, 30, 30, 30];

    doc.setFillColor(240, 240, 240);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    let x = margin;
    cols.forEach((col, i) => {
      doc.rect(x, y, colWidths[i], 8, "FD");
      doc.text(col, x + 2, y + 5);
      x += colWidths[i];
    });

    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    reportData.forEach((row) => {
      if (y > pageHeight - 15) {
        doc.addPage();
        y = 15;
      }

      x = margin;
      const rowData = [
        row.salespersonName || "—",
        `${row.totalTarget || 0}`,
        `${row.totalAchievement || 0}`,
        `${row.pending || 0}`,
        `${safeNumber(row.achievementPercent).toFixed(1)}%`,
      ];

      rowData.forEach((val, i) => {
        doc.rect(x, y, colWidths[i], 6, "D");
        doc.text(String(val).substring(0, 22), x + 2, y + 4);
        x += colWidths[i];
      });

      y += 6;
    });

    doc.save(`target-report-${person}-${dateFrom}-${dateTo}.pdf`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
        .rta-page {
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
          min-height: 100vh;
          padding: 24px 16px;
        }
        .rta-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          transition: all 0.2s;
        }
        .rta-card:hover { border-color: #d1d5db; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }
        .rta-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: inherit;
        }
        .rta-btn-primary {
          background: linear-gradient(135deg, #ff5934 0%, #ff4522 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(255, 89, 52, 0.2);
        }
        .rta-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 89, 52, 0.3);
        }
        .rta-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .rta-btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }
        .rta-btn-secondary:hover { background: #eff0f5; }
        .rta-input {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          font-family: inherit;
          transition: all 0.15s;
        }
        .rta-input:focus {
          outline: none;
          border-color: #ff5934;
          background: white;
          box-shadow: 0 0 0 3px rgba(255, 89, 52, 0.1);
        }
        .rta-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          max-height: 300px;
          overflow-y: auto;
          z-index: 50;
        }
        .rta-dropdown-item {
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid #f3f4f6;
          transition: background 0.1s;
        }
        .rta-dropdown-item:hover { background: #f9fafb; }
        .rta-dropdown-item.active { background: rgba(255, 89, 52, 0.1); color: #ff5934; }
        .rta-stat-card {
          padding: 16px;
          border-radius: 10px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }
        .rta-stat-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .rta-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
        }
        .rta-table {
          width: 100%;
          border-collapse: collapse;
        }
        .rta-table thead tr { background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
        .rta-table th {
          padding: 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        .rta-table td {
          padding: 12px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 13px;
          color: #374151;
          white-space: nowrap;
        }
        .rta-table tbody tr:hover { background: #f9fafb; }
        .rta-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid;
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .rta-animate { animation: slideIn 0.3s cubic-bezier(0.34, 1.2, 0.64, 1); }
        .rta-empty { padding: 32px 16px; text-align: center; color: #9ca3af; }
        .rta-error {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #991b1b;
          padding: 12px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        .rta-debug {
          background: #f0f9ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-family: monospace;
          font-size: 11px;
          max-height: 300px;
          overflow-y: auto;
        }
        .rta-no-scroll::-webkit-scrollbar { width: 6px; }
        .rta-no-scroll::-webkit-scrollbar-track { background: #f3f4f6; }
        .rta-no-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
      `}</style>

      <div className="rta-page">
        <div className="rta-animate" style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "24px",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>
                {selectedPerson?.name || "All Salespersons"}
              </h2>
              <p style={{ fontSize: "13px", color: "#6b7280" }}>
                {dateFrom} to {dateTo}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button 
                className="rta-btn rta-btn-secondary" 
                onClick={() => setDebugMode(!debugMode)}
                title="Toggle debug mode"
              >
                <MdBugReport size={16} /> Debug
              </button>
              <button className="rta-btn rta-btn-secondary" onClick={handleExportPdf} disabled={!reportData.length}>
                <MdPictureAsPdf size={16} /> PDF
              </button>
              <button className="rta-btn rta-btn-secondary" onClick={handleExportExcel} disabled={!reportData.length}>
                <MdGridOn size={16} /> Excel
              </button>
              <button className="rta-btn rta-btn-secondary" onClick={handleReset}>
                <MdRefresh size={16} /> Refresh
              </button>
            </div>
          </div>

          {debugMode && apiErrors.length > 0 && (
            <div className="rta-debug">
              <strong>🐛 API Errors ({apiErrors.length}):</strong>
              {apiErrors.map((err, idx) => (
                <div key={idx} style={{ marginTop: "8px", padding: "8px", background: "white", borderRadius: "4px" }}>
                  <div><strong>{err.salespersonName}</strong> ({err.salespersonId})</div>
                  <div>Status: {err.errorStatus || "Unknown"}</div>
                  <div>Message: {err.errorMessage}</div>
                  {err.errorData && (
                    <div style={{ marginTop: "4px", fontSize: "10px" }}>
                      Data: {JSON.stringify(err.errorData)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rta-error">
              <MdWarning size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="rta-card" style={{ padding: "24px", marginBottom: "24px" }}>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <MdFilterList size={16} style={{ color: "#ff5934" }} /> Filters
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  Sales Person
                </label>

                <div style={{ position: "relative" }}>
                  <div
                    className="rta-input"
                    onClick={() => setSpDropOpen((prev) => !prev)}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                    }}
                  >
                    <span style={{ color: selectedPerson ? "#111827" : "#111827" }}>
                      {selectedPerson ? selectedPerson.name : "All Salespersons"}
                    </span>
                    <MdExpandMore
                      size={18}
                      style={{ transform: spDropOpen ? "rotate(180deg)" : "", transition: "transform 0.2s" }}
                    />
                  </div>

                  {spDropOpen && (
                    <div className="rta-dropdown rta-no-scroll">
                      <div style={{ padding: "8px", borderBottom: "1px solid #f3f4f6" }}>
                        <input
                          autoFocus
                          type="text"
                          className="rta-input"
                          value={spSearch}
                          onChange={(e) => setSpSearch(e.target.value)}
                          placeholder="Search..."
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div
                        className={`rta-dropdown-item ${selectedSalesPerson === null ? "active" : ""}`}
                        onClick={() => {
                          setSelectedSalesPerson(null);
                          setSpDropOpen(false);
                          setSpSearch("");
                        }}
                      >
                        <div style={{ fontWeight: 500, fontSize: "13px" }}>All Salespersons</div>
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                          Show combined report
                        </div>
                      </div>

                      {filteredSP.length > 0 ? (
                        filteredSP.map((sp) => (
                          <div
                            key={sp._id}
                            className={`rta-dropdown-item ${selectedSalesPerson === sp._id ? "active" : ""}`}
                            onClick={() => {
                              setSelectedSalesPerson(sp._id);
                              setSpDropOpen(false);
                              setSpSearch("");
                            }}
                          >
                            <div style={{ fontWeight: 500, fontSize: "13px" }}>{sp.name}</div>
                            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                              {sp.email}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rta-empty" style={{ padding: "16px" }}>
                          No results
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  From Date *
                </label>
                <input
                  type="date"
                  className="rta-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  To Date *
                </label>
                <input
                  type="date"
                  className="rta-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="rta-btn rta-btn-secondary" onClick={handleReset}>
                <MdRefresh size={16} /> Reset & Reload
              </button>
              <button
                className="rta-btn rta-btn-primary"
                onClick={handleGenerateReport}
                disabled={!dateFrom || !dateTo || loading}
              >
                {loading ? <Loader /> : <MdBarChart size={16} />}
                Generate Report
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "12px" }}>
              Leave the salesperson on <strong>All Salespersons</strong> to see the combined report.
            </p>
          </div>

          {loading ? (
            <div className="rta-card" style={{ padding: "40px", textAlign: "center" }}>
              <Loader />
              <div style={{ marginTop: "12px", fontSize: "13px", color: "#6b7280" }}>
                Loading report...
              </div>
            </div>
          ) : generated && reportData.length > 0 ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "12px",
                  marginBottom: "24px",
                }}
              >
                <div className="rta-stat-card">
                  <div className="rta-stat-label">Total Target</div>
                  <div className="rta-stat-value">{formatNumber(totals.targetQty)}</div>
                </div>
                <div className="rta-stat-card">
                  <div className="rta-stat-label">Total Achieved</div>
                  <div className="rta-stat-value" style={{ color: "#ff5934" }}>
                    {formatNumber(totals.achievedQty)}
                  </div>
                </div>
                <div className="rta-stat-card">
                  <div className="rta-stat-label">Overall Achievement</div>
                  <div
                    className="rta-stat-value"
                    style={{ color: Number(overallPercent) >= 100 ? "#10b981" : "#ff5934" }}
                  >
                    {formatPercent(overallPercent)}
                  </div>
                </div>
                <div className="rta-stat-card">
                  <div className="rta-stat-label">Pending</div>
                  <div className="rta-stat-value">{formatNumber(totals.pendingQty)}</div>
                </div>
              </div>

              <div className="rta-card" style={{ overflow: "auto" }}>
                <table className="rta-table">
                  <thead>
                    <tr>
                      <th>Sales Person</th>
                      <th>Email</th>
                      <th>Target</th>
                      <th>Achieved</th>
                      <th>Pending</th>
                      <th>Achievement %</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => {
                      const status = row.status || getStatusColor(row.totalAchievement, row.totalTarget);
                      const colors = {
                        emerald: "#10b981",
                        blue: "#3b82f6",
                        amber: "#f59e0b",
                        red: "#ef4444",
                        gray: "#6b7280",
                      };

                      return (
                        <tr key={row.salespersonId || i}>
                          <td style={{ fontWeight: 500 }}>{row.salespersonName || "—"}</td>
                          <td>{row.email || "—"}</td>
                          <td>{formatCurrency(row.totalTarget)}</td>
                          <td style={{ color: "#ff5934", fontWeight: 500 }}>
                            {formatCurrency(row.totalAchievement)}
                          </td>
                          <td>{formatCurrency(row.pending)}</td>
                          <td style={{ fontWeight: 600, color: "#ff5934" }}>
                            {formatPercent(row.achievementPercent)}
                          </td>
                          <td>
                            <span
                              className="rta-badge"
                              style={{
                                backgroundColor: `${colors[status.color] || colors.gray}20`,
                                borderColor: colors[status.color] || colors.gray,
                                color: colors[status.color] || colors.gray,
                              }}
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  backgroundColor: colors[status.color] || colors.gray,
                                  display: "inline-block",
                                }}
                              />
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  background: "#f9fafb",
                  borderRadius: "8px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                {reportData.length} record{reportData.length !== 1 ? "s" : ""} • Overall Achievement:{" "}
                {formatPercent(overallPercent)}
              </div>
            </>
          ) : generated ? (
            <div className="rta-card" style={{ padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📊</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                No Data Found
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                No records match your selection. Try adjusting the date range or salesperson.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default ReportsTargetVsAchieve;