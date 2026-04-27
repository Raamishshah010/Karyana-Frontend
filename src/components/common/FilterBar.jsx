import { MdSearch, MdFilterList, MdClose, MdRefresh } from "react-icons/md";

/**
 * FilterBar — reusable across all list pages.
 *
 * Props:
 *   searchTerm       string
 *   onSearchChange   (val: string) => void
 *   onSearchEnter    () => void          — called on Enter key
 *   onClear          () => void          — clears search input
 *   filterCount      number              — badge count (0 = no badge)
 *   onClearAll       () => void          — "Clear Filters" button
 *   onReset          () => void          — Reset / refresh data
 *   children         ReactNode           — additional filter pills (city, status, etc.)
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
      {/* Search */}
      <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
        <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
        <input
          value={searchTerm}
          onChange={e => onSearchChange?.(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearchEnter?.()}
          className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
          type="search"
          placeholder={placeholder}
        />
        {searchTerm && (
          <button onClick={onClear} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors flex-shrink-0">
            <MdClose size={14} />
          </button>
        )}
      </div>

      {/* Additional filter pills injected by parent */}
      {children}

      {/* Active filter badge + Clear Filters button */}
      {filterCount > 0 && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#FF5934] bg-[#FF5934]/10 hover:bg-[#FF5934]/20 px-3 py-2 rounded-xl transition-all duration-200"
          title="Clear all active filters"
        >
          <MdClose size={14} />
          Clear Filters
          <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {filterCount}
          </span>
        </button>
      )}

      {/* Reset / Refresh */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all duration-200"
      >
        <MdRefresh size={16} /> Reset
      </button>
    </div>
  );
};

/**
 * FilterPill — a single select filter inside <FilterBar>
 * Props: value, onChange, icon (React component), children (options), minWidth
 */
export const FilterPill = ({ value, onChange, icon: Icon, children, minWidth = '110px' }) => (
  <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 relative">
    {Icon && <Icon size={16} className="text-[#9CA3AF] flex-shrink-0" />}
    <select
      value={value}
      onChange={e => onChange?.(e.target.value)}
      style={{ minWidth }}
      className="bg-transparent outline-none text-sm text-[#374151] appearance-none pr-5"
      // The arrow is handled by the parent FilterBar's CSS class
    >
      {children}
    </select>
    {/* Custom caret */}
    <svg className="absolute right-3 pointer-events-none text-[#9CA3AF]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  </div>
);

export default FilterBar;