import { MdSearch, MdFilterList, MdClose, MdRefresh } from "react-icons/md";

/**
 * FilterBar — reusable across all list pages.
 *
 * Props:
 *   searchTerm       string
 *   onSearchChange   (val: string) => void
 *   onSearchEnter    (val: string) => void   — called on Enter key, receives current value
 *   onClear          () => void              — clears ONLY search, keeps other filters
 *   filterCount      number                  — badge count (0 = no badge shown)
 *   onClearAll       () => void              — "Clear Filters" button — resets everything
 *   onReset          () => void              — Reset / refresh data button
 *   children         ReactNode               — additional filter pills (date, city, status…)
 *   placeholder      string
 */
const FilterBar = ({
  searchTerm = '',
  onSearchChange,
  onSearchEnter,
  onClear,
  filterCount = 0,
  onClearAll,
  onReset,
  children,
  placeholder = 'Search…',
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">

      {/* ── Search input ── */}
      <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
        <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
        <input
          value={searchTerm}
          onChange={e => onSearchChange?.(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              // Pass current value directly to avoid stale-state timing issues
              onSearchEnter?.(e.target.value);
            }
          }}
          className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
          type="search"
          placeholder={placeholder}
        />
        {searchTerm && (
          <button
            onClick={onClear}
            className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors flex-shrink-0"
            title="Clear search"
          >
            <MdClose size={14} />
          </button>
        )}
      </div>

      {/* ── Additional filter pills injected by parent (DateRangePicker, selects…) ── */}
      {children}

      {/* ── Active filter badge + Clear Filters button ── */}
      {filterCount > 0 && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#FF5934] bg-[#FF5934]/10 hover:bg-[#FF5934]/20 px-3 py-2 rounded-xl transition-all duration-200"
          title="Clear all active filters"
        >
          <MdClose size={14} />
          Clear Filters
          <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center leading-none ml-0.5">
            {filterCount}
          </span>
        </button>
      )}

      {/* ── Reset / Refresh ── */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all duration-200"
        title="Reset all filters"
      >
        <MdRefresh size={16} /> Reset
      </button>
    </div>
  );
};

/**
 * FilterPill — a single select-based filter pill, designed to live inside <FilterBar>.
 *
 * Props:
 *   value       string                — controlled value
 *   onChange    (val: string) => void
 *   icon        React component       — optional leading icon
 *   minWidth    string                — CSS min-width for the <select> (default '110px')
 *   children    ReactNode             — <option> elements
 */
export const FilterPill = ({
  value,
  onChange,
  icon: Icon,
  children,
  minWidth = '110px',
}) => (
  <div className="relative flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
    {Icon && <Icon size={15} className="text-[#9CA3AF] flex-shrink-0" />}
    <select
      value={value}
      onChange={e => onChange?.(e.target.value)}
      style={{ minWidth }}
      className="bg-transparent outline-none text-sm text-[#374151] appearance-none cursor-pointer pr-4"
    >
      {children}
    </select>
    {/* Custom caret — sits to the right of the select text */}
    <svg
      className="pointer-events-none text-[#9CA3AF] flex-shrink-0"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  </div>
);

export default FilterBar;