import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { getAttendanceBySalesId, getAllSalesPersons, getAllRetailers } from "../APIS";
import { Loader } from "../components/common/loader";
import { db, doc, onSnapshot } from "../firebase";
import shopIcon from "../assets/karyana-icon.png";
import {
  MdSearch, MdClose, MdRefresh, MdPerson, MdCalendarToday,
  MdAccessTime, MdBarChart, MdCheckCircle, MdLogout, MdLogin,
  MdTimer, MdFilterList, MdPictureAsPdf, MdGridOn, MdMap, MdTableRows,
} from "react-icons/md";
import { Navigation } from "lucide-react";

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

const statusColor = (checkIn, checkOut) => {
  const { seconds } = calcDiff(checkIn, checkOut);
  if (!checkIn)         return { pill: "bg-gray-100 text-gray-400 ring-gray-200",          dot: "bg-gray-300",    label: "Absent"   };
  if (!checkOut)        return { pill: "bg-amber-50 text-amber-600 ring-amber-200",        dot: "bg-amber-400",   label: "Active"   };
  if (seconds >= 28800) return { pill: "bg-emerald-50 text-emerald-600 ring-emerald-200",  dot: "bg-emerald-400", label: "Full Day" };
  if (seconds >= 14400) return { pill: "bg-blue-50 text-blue-600 ring-blue-200",           dot: "bg-blue-400",    label: "Half Day" };
  return                       { pill: "bg-red-50 text-red-500 ring-red-200",              dot: "bg-red-400",     label: "Short"    };
};

const reportHeaders = ["Employee Name","Date","Check-In Time","Check-Out Time","Total Hours Worked","Status","Remarks"];

const safeFilePart = (value) =>
  String(value || "attendance-report").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();

const getRecordDateKey = (record) => {
  const rawDate = record.date || record.checkInTime || record.checkOutTime;
  if (!rawDate) return "";
  if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const getEmployeeName = (record, selectedPerson) =>
  selectedPerson?.name || record.salesPersonID?.name || record.salesPerson?.name || record.employeeName || record.name || "Unknown";

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
      const [ad, am, ay] = a.split("/"); const [bd, bm, by] = b.split("/");
      return new Date(`${ay}-${am}-${ad}`) - new Date(`${by}-${bm}-${bd}`);
    });
  if (!validDates.length) return "Generated records";
  return `${validDates[0]} - ${validDates[validDates.length - 1]}`;
};

/* ─── load Google Maps script once globally ─── */
let googleMapsPromise = null;
const loadGoogleMaps = () => {
  if (googleMapsPromise) return googleMapsPromise;
  if (window.google && window.google.maps) {
    googleMapsPromise = Promise.resolve();
    return googleMapsPromise;
  }
  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const poll = setInterval(() => {
        if (window.google && window.google.maps) { clearInterval(poll); resolve(); }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAuJYLmzmglhCpBYTn0BjbJhjWYg0fPEEA`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return googleMapsPromise;
};

/* ─── Embedded Map Component ─── */
const EmbeddedMap = ({ salesId }) => {
  // FIX: single consistent ref name used both in useRef and in JSX
  const mapContainerRef = useRef(null);
  const mapInstanceRef  = useRef(null);
  const markerRef       = useRef(null);
  const animationRef    = useRef(null);
  const shopMarkersRef  = useRef([]);
  const prevPosRef      = useRef(null); // FIX: only one ref, no duplicate state

  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationData, setLocationData]       = useState([]);
  const [isTracking, setIsTracking]           = useState(false);
  const [shops, setShops]                     = useState([]);
  const [mapError, setMapError]               = useState(null);
  const [mapReady, setMapReady]               = useState(false);

  /* shop fetching */
  useEffect(() => {
    getAllRetailers()
      .then((res) => {
        if (res.data?.msg === "success") {
          const all = res.data.data || [];
          setShops(salesId
            ? all.filter(s => s.salesPersonID && (s.salesPersonID._id === salesId || s.salesPersonID === salesId))
            : all);
        }
      })
      .catch(() => {});
  }, [salesId]);

  /* init map once container is mounted */
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapContainerRef.current) return;
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: 33.6844, lng: 73.0479 },
          zoom: 14,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: true,
          zoomControl: true,
        });
        mapInstanceRef.current = map;
        markerRef.current = new window.google.maps.Marker({
          position: { lat: 33.6844, lng: 73.0479 },
          map,
          title: 'Current Location',
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
              `<svg width="32" height="48" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.163 0 0 7.163 0 16C0 24.837 16 48 16 48S32 24.837 32 16C32 7.163 24.837 0 16 0Z" fill="#FF5934"/>
                <circle cx="16" cy="16" r="8" fill="white"/>
              </svg>`
            ),
            scaledSize: new window.google.maps.Size(32, 48),
            anchor: new window.google.maps.Point(16, 48),
          },
        });
        setMapReady(true);
      })
      .catch(() => setMapError('Failed to load Google Maps.'));
    return () => { cancelled = true; };
  }, []);

  /* add shop markers after map + shops are ready */
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    shopMarkersRef.current.forEach(m => m.setMap(null));
    shopMarkersRef.current = [];
    shops.forEach(shop => {
      if (!shop.lat || !shop.lng) return;
      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(shop.lat), lng: parseFloat(shop.lng) },
        map: mapInstanceRef.current,
        title: shop.shopName || shop.name,
        icon: {
          url: shopIcon,
          scaledSize: new window.google.maps.Size(30, 30),
          anchor: new window.google.maps.Point(15, 15),
        },
      });
      const info = new window.google.maps.InfoWindow({
        content: `<div style="padding:8px;font-family:sans-serif;">
          <h4 style="margin:0 0 4px 0;font-weight:bold;color:#FF5934;">${shop.shopName || shop.name}</h4>
          <p style="margin:0 0 2px 0;font-size:12px;"><b>Owner:</b> ${shop.name}</p>
          <p style="margin:0 0 2px 0;font-size:12px;"><b>Phone:</b> ${shop.phoneNumber}</p>
          <p style="margin:0;font-size:12px;"><b>Address:</b> ${shop.shopAddress1 || 'N/A'}</p>
        </div>`,
      });
      marker.addListener('click', () => info.open(mapInstanceRef.current, marker));
      shopMarkersRef.current.push(marker);
    });
  }, [mapReady, shops]);

  /* FIX: single Firebase tracking effect — removed the duplicate */
  useEffect(() => {
    if (!salesId) return;
    setIsTracking(true);
    setLocationData([]);
    setCurrentLocation(null);
    prevPosRef.current = null;

    const unsubscribe = onSnapshot(
      doc(db, 'LocationCollection', salesId),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const loc = {
          lat: d.latitude,
          lng: d.longitude,
          timestamp: d.updatedAt || d.createdAt,
        };
        setCurrentLocation(loc);
        setLocationData(prev => [...prev, loc].slice(-100));
      },
      (err) => {
        console.error(err);
        setMapError("Failed to connect to live tracking.");
      }
    );

    return () => {
      unsubscribe();
      setIsTracking(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [salesId]);

  /* animate marker when location updates */
  useEffect(() => {
    if (!mapReady || !markerRef.current || !currentLocation) return;

    const to   = { lat: currentLocation.lat, lng: currentLocation.lng };
    const from = prevPosRef.current;

    if (from) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      const startTime = Date.now();
      const animate = () => {
        const p    = Math.min((Date.now() - startTime) / 2000, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        markerRef.current?.setPosition({
          lat: from.lat + (to.lat - from.lat) * ease,
          lng: from.lng + (to.lng - from.lng) * ease,
        });
        if (p < 1) animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      markerRef.current.setPosition(to);
      mapInstanceRef.current?.setCenter(to);
      mapInstanceRef.current?.setZoom(16);
    }

    prevPosRef.current = to;
  }, [currentLocation, mapReady]);

  if (mapError) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-2xl border border-gray-200">
        <div className="text-center">
          <Navigation size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 420 }}>
      {/* Map status bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
        <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
        <span className="text-xs font-semibold text-gray-600">
          {isTracking ? 'Live Tracking' : 'Connecting…'}
        </span>
        {currentLocation?.timestamp && (
          <span className="text-[10px] text-gray-400 border-l border-gray-200 pl-2 ml-1">
            {new Date(currentLocation.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {locationData.length > 0 && (
        <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {locationData.length} pts
          </span>
        </div>
      )}

      {/* FIX: ref name matches the declared useRef — was "mapRef", now "mapContainerRef" */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const TrackingLocation = () => {
  const [attendanceData, setAttendanceData]           = useState([]);
  const [loading, setLoading]                         = useState(false);
  const [salesPersons, setSalesPersons]               = useState([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
  const [startDate, setStartDate]                     = useState("");
  const [endDate, setEndDate]                         = useState("");
  const [spSearch, setSpSearch]                       = useState("");
  const [spDropOpen, setSpDropOpen]                   = useState(false);
  const [generated, setGenerated]                     = useState(false);
  const [activeTab, setActiveTab]                     = useState("map");

  const [searchParams] = useSearchParams();
  const salesIdFromUrl = searchParams.get("salesId");

  useEffect(() => {
    getAllSalesPersons()
      .then((res) => setSalesPersons(res.data.data || []))
      .catch(() => {});
    if (salesIdFromUrl) setSelectedSalesPerson(salesIdFromUrl);
  }, []);

  useEffect(() => {
    if (salesIdFromUrl && salesPersons.length > 0) fetchData(salesIdFromUrl);
  }, [salesIdFromUrl, salesPersons]);

  const fetchData = async (overrideSid) => {
    const sid = overrideSid || selectedSalesPerson || salesIdFromUrl;
    if (!sid) { alert("Please select a sales person first."); return; }
    try {
      setLoading(true); setGenerated(false);
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
    setStartDate(""); setEndDate(""); setSelectedSalesPerson("");
    setAttendanceData([]); setGenerated(false); setSpSearch("");
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
  const reportRows    = buildReportRows(sortedData, selectedPersonObj);
  const canGenerate   = !!(selectedSalesPerson || salesIdFromUrl);
  const canExport     = generated && reportRows.length > 0 && !loading;
  const activeSalesId = selectedSalesPerson || salesIdFromUrl;

  const getReportFileName = (extension) => {
    const person = safeFilePart(selectedPersonObj?.name || selectedSalesPerson || salesIdFromUrl || "all");
    const from = startDate || "latest";
    const to   = endDate || new Date().toISOString().slice(0, 10);
    return `attendance-report-${person}-${from}-to-${to}.${extension}`;
  };

  const handleExportExcel = () => {
    if (!canExport) { alert("Please generate a report with attendance records first."); return; }
    const worksheet = XLSX.utils.json_to_sheet(reportRows, { header: reportHeaders });
    worksheet["!cols"] = [{ wch: 24 },{ wch: 14 },{ wch: 16 },{ wch: 16 },{ wch: 20 },{ wch: 14 },{ wch: 32 }];
    if (worksheet["!ref"]) worksheet["!autofilter"] = { ref: worksheet["!ref"] };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
    XLSX.writeFile(workbook, getReportFileName("xlsx"));
  };

  const handleExportPdf = () => {
    if (!canExport) { alert("Please generate a report with attendance records first."); return; }
    const pdfDoc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth  = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    const margin = 10; const footerHeight = 12; const rowMinHeight = 8;
    const columns = [
      { key: "Employee Name", width: 44 },{ key: "Date", width: 24 },
      { key: "Check-In Time", width: 28 },{ key: "Check-Out Time", width: 28 },
      { key: "Total Hours Worked", width: 34 },{ key: "Status", width: 24 },
      { key: "Remarks", width: 95 },
    ];
    const dateRange = getDateRangeLabel(reportRows, startDate, endDate);

    const drawReportHeader = () => {
      pdfDoc.setFillColor(255, 89, 52); pdfDoc.rect(0, 0, pageWidth, 17, "F");
      pdfDoc.setTextColor(255, 255, 255); pdfDoc.setFont("helvetica", "bold"); pdfDoc.setFontSize(14);
      pdfDoc.text("Prime Link Distribution", margin, 10.5);
      pdfDoc.setFontSize(9); pdfDoc.text("Attendance Report", pageWidth - margin, 10.5, { align: "right" });
      pdfDoc.setTextColor(17, 24, 39); pdfDoc.setFontSize(10); pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text("Attendance Report", margin, 25);
      pdfDoc.setFont("helvetica", "normal"); pdfDoc.setFontSize(8.5); pdfDoc.setTextColor(75, 85, 99);
      pdfDoc.text(`Sales Person: ${selectedPersonObj?.name || "Selected salesperson"}`, margin, 31);
      pdfDoc.text(`Date Range: ${dateRange}`, margin + 92, 31);
      pdfDoc.text(`Records: ${reportRows.length}`, margin + 175, 31);
      pdfDoc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, pageWidth - margin, 31, { align: "right" });
      let x = margin; const y = 38;
      pdfDoc.setFont("helvetica", "bold"); pdfDoc.setFontSize(7);
      columns.forEach((column) => {
        pdfDoc.setFillColor(255, 239, 235); pdfDoc.rect(x, y, column.width, 8, "F");
        pdfDoc.setDrawColor(255, 183, 167); pdfDoc.rect(x, y, column.width, 8, "S");
        pdfDoc.setTextColor(17, 24, 39);
        pdfDoc.text(pdfDoc.splitTextToSize(column.key, column.width - 4), x + 2, y + 5);
        x += column.width;
      });
      return y + 8;
    };

    let y = drawReportHeader();
    pdfDoc.setFont("helvetica", "normal"); pdfDoc.setFontSize(7.5);
    reportRows.forEach((row) => {
      const cellLines = columns.map((column) =>
        pdfDoc.splitTextToSize(String(row[column.key] || "-"), column.width - 4)
      );
      const rowHeight = Math.max(rowMinHeight, ...cellLines.map((lines) => lines.length * 4 + 4));
      if (y + rowHeight > pageHeight - footerHeight) {
        pdfDoc.addPage(); y = drawReportHeader();
        pdfDoc.setFont("helvetica", "normal"); pdfDoc.setFontSize(7.5);
      }
      let x = margin;
      pdfDoc.setDrawColor(229, 231, 235); pdfDoc.setTextColor(31, 41, 55);
      cellLines.forEach((lines, index) => {
        const column = columns[index];
        pdfDoc.rect(x, y, column.width, rowHeight);
        pdfDoc.text(lines, x + 2, y + 5);
        x += column.width;
      });
      y += rowHeight;
    });

    const pageCount = pdfDoc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      pdfDoc.setPage(page);
      pdfDoc.setFont("helvetica", "normal"); pdfDoc.setFontSize(8); pdfDoc.setTextColor(107, 114, 128);
      pdfDoc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
    }
    pdfDoc.save(getReportFileName("pdf"));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .att-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .att-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .att-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .att-tab { transition: all 0.2s; border-bottom: 2.5px solid transparent; padding: 10px 16px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .att-tab.active { border-bottom-color: #FF5934; color: #FF5934; background: #fff8f6; border-radius: 8px 8px 0 0; }
        .att-tab:not(.active) { color: #6B7280; }
        .att-tab:not(.active):hover { color: #111827; background: #F9FAFB; border-radius: 8px 8px 0 0; }
        .att-no-scroll::-webkit-scrollbar { display: none; }
        .att-no-scroll { scrollbar-width: none; }
        .att-input {
          background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px;
          padding: 10px 14px; font-size: 13px; color: #111827; outline: none;
          font-family: 'DM Sans', sans-serif; width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .att-input:focus { border-color: #FF5934; box-shadow: 0 0 0 3px rgba(255,89,52,0.1); }
        .att-input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      `}</style>

      <div className="att-page">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Tracking Location</h1>
            {generated && attendanceData.length > 0 && (
              <p className="text-sm text-[#9CA3AF] mt-0.5">
                Total: <span className="text-[#FF5934] font-semibold">{calcTotal(attendanceData)}</span>
                &nbsp;·&nbsp;{attendanceData.length} record{attendanceData.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleExportPdf} disabled={!canExport}
              className="h-10 px-4 rounded-xl border border-red-100 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-100 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
              <MdPictureAsPdf size={16} /> PDF
            </button>
            <button type="button" onClick={handleExportExcel} disabled={!canExport}
              className="h-10 px-4 rounded-xl border border-emerald-100 bg-white text-emerald-600 text-sm font-semibold hover:bg-emerald-50 disabled:bg-gray-100 disabled:text-gray-300 disabled:border-gray-100 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
              <MdGridOn size={16} /> Excel
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-visible">

          {/* Filter Card */}
          <div className="px-5 py-5 border-b border-gray-100 bg-[#FAFAFA]">
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
              <MdFilterList size={13} className="text-[#FF5934]" /> Filters
            </p>
            <div className="flex flex-wrap gap-4 items-end">

              {/* Sales Person Picker */}
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
                          <span className="text-[#FF5934] text-[10px] font-bold">{(selectedPersonObj.name || "?")[0].toUpperCase()}</span>
                        </div>
                        <span className="text-[13px] text-[#111827] font-medium truncate">{selectedPersonObj.name}</span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-gray-300 flex-1">Select sales person…</span>
                    )}
                    <MdFilterList size={15} className="text-[#9CA3AF] flex-shrink-0" />
                  </div>

                  {spDropOpen && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                          <MdSearch size={14} className="text-[#9CA3AF]" />
                          <input autoFocus value={spSearch} onChange={e => setSpSearch(e.target.value)}
                            placeholder="Search…" className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                          {spSearch && (
                            <button onClick={() => setSpSearch("")} className="text-[#9CA3AF] hover:text-[#FF5934]">
                              <MdClose size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto att-no-scroll">
                        {filteredSP.length ? filteredSP.map(sp => (
                          <div key={sp._id}
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
                            {selectedSalesPerson === sp._id && <MdCheckCircle size={15} className="text-[#FF5934] flex-shrink-0" />}
                          </div>
                        )) : (
                          <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No results found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Date From */}
              <div className="flex-1 min-w-[160px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdCalendarToday size={12} className="text-[#FF5934]" /> From
                </label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="att-input" />
              </div>

              {/* Date To */}
              <div className="flex-1 min-w-[160px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdCalendarToday size={12} className="text-[#FF5934]" /> To
                </label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined} className="att-input" />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={handleReset}
                  className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                  <MdRefresh size={15} /> Reset
                </button>
                <button onClick={() => fetchData()} disabled={!canGenerate}
                  className="h-10 px-5 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-orange-100 transition-all flex items-center gap-2">
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

          {/* Tab Bar */}
          <div className="flex border-b border-gray-100 px-2 pt-1">
            <button className={`att-tab ${activeTab === "map" ? "active" : ""}`} onClick={() => setActiveTab("map")}>
              <MdMap size={15} /> Live Map
            </button>
            {/* <button className={`att-tab ${activeTab === "report" ? "active" : ""}`} onClick={() => setActiveTab("report")}>
              <MdTableRows size={15} /> Attendance Report
            </button> */}
          </div>

          {/* MAP TAB */}
          {activeTab === "map" && (
            <div className="p-5">
              {activeSalesId ? (
                <>
                  {selectedPersonObj && (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#FF5934] text-[13px] font-bold">{(selectedPersonObj.name || "?")[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-[#111827]">{selectedPersonObj.name}</p>
                        <p className="text-[11px] text-[#9CA3AF]">Tracking live location</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[11px] font-bold px-3 py-1.5 rounded-xl">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </div>
                    </div>
                  )}
                  <EmbeddedMap salesId={activeSalesId} key={activeSalesId} />
                </>
              ) : (
                <div className="py-20 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <MdMap size={24} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">Select a sales person to view their live location</p>
                </div>
              )}
            </div>
          )}

          {/* REPORT TAB */}
          {activeTab === "report" && (
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
                    <MdAccessTime size={24} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">No attendance records found for this period</p>
                  <button onClick={handleReset} className="text-[#FF5934] text-xs hover:underline font-medium">Clear filters</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#FAFAFA] border-b border-gray-100">
                        {["Date", "Check In", "Check Out", "Duration", "Status"].map(h => (
                          <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sortedData.map((record, i) => {
                        const { display } = calcDiff(record.checkInTime, record.checkOutTime);
                        const sc = statusColor(record.checkInTime, record.checkOutTime);
                        return (
                          <tr key={record._id || i} className="table-row">
                            <td className="px-4 py-3">
                              <p className="text-[13px] font-semibold text-[#111827]">{formatDate(record.date)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                  <MdLogin size={12} className="text-emerald-500" />
                                </div>
                                <span className="text-[13px] text-[#374151] font-medium">{formatTime(record.checkInTime)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                                  <MdLogout size={12} className="text-red-400" />
                                </div>
                                <span className="text-[13px] text-[#374151] font-medium">{formatTime(record.checkOutTime)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[13px] font-semibold text-[#111827]">{display}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${sc.pill}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {sc.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-5 py-4 bg-[#FAFAFA] border-t border-gray-100 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                      {sortedData.length} record{sortedData.length !== 1 ? "s" : ""}
                    </p>
                    <span className="inline-flex items-center gap-2 text-[14px] font-bold text-[#111827]">
                      <MdTimer size={16} className="text-[#FF5934]" />
                      Total: {calcTotal(attendanceData)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default TrackingLocation;