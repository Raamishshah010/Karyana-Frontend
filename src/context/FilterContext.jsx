import { createContext, useContext, useState, useCallback } from 'react';

/**
 * FilterContext — stores per-module filter state that persists across navigation.
 *
 * Usage:
 *   1. Wrap your app (or router) with <FilterProvider>
 *   2. In any component:
 *        const { getFilters, setFilters, clearFilters, getFilterCount } = useFilters();
 *   3. Call getFilters('orders'), setFilters('orders', { selectedStatus: 'Pending' }), etc.
 *
 * Supported module keys (add more as needed):
 *   'orders' | 'coordinators' | 'sales' | 'retailers' | 'ledgerSales' | 'warehouseManagers'
 *
 * Rules:
 *   - All filter fields must be flat primitives (string, number, bool).
 *     Do NOT add nested objects — it will break the shallow-merge in setFilters.
 *   - To add a new filter field, add it to DEFAULT_FILTERS with its default value.
 *     getFilterCount will automatically pick it up — no manual update needed.
 */

const DEFAULT_FILTERS = {
  searchTerm:          '',
  selectedCityId:      '',
  selectedStatus:      '',
  startDate:           '',
  endDate:             '',
  selectedSalesPerson: '',
  selectedCustomer:    '',
  limit:               10,
  currentPage:         1,
};

/** Keys we intentionally exclude from the "active filter" badge count */
const NON_FILTER_KEYS = new Set(['limit', 'currentPage']);

const FilterContext = createContext(null);

export const FilterProvider = ({ children }) => {
  /** Map of moduleKey → filter state object */
  const [filtersMap, setFiltersMap] = useState({});

  /**
   * Get filters for a module.
   * Always returns a fresh copy of DEFAULT_FILTERS if the module hasn't been set yet.
   */
  const getFilters = useCallback((moduleKey) => {
    return filtersMap[moduleKey] ?? { ...DEFAULT_FILTERS };
  }, [filtersMap]);

  /**
   * Merge partial filter updates into a module's filter state.
   *
   * Automatically resets currentPage → 1 whenever any non-page filter changes,
   * UNLESS the caller explicitly passes currentPage in the partial update.
   */
  const setFilters = useCallback((moduleKey, partial) => {
    setFiltersMap(prev => {
      const current = prev[moduleKey] ?? { ...DEFAULT_FILTERS };
      const isPageOnlyUpdate = Object.keys(partial).every(k => k === 'currentPage');

      return {
        ...prev,
        [moduleKey]: {
          ...current,
          ...partial,
          // Reset to page 1 when any real filter changes (not when only page changes)
          ...(!isPageOnlyUpdate && !('currentPage' in partial)
            ? { currentPage: 1 }
            : {}),
        },
      };
    });
  }, []);

  /**
   * Reset a single module's filters back to defaults.
   * Call this when the user hits "Clear Filters" or "Reset" on a specific page.
   */
  const clearFilters = useCallback((moduleKey) => {
    setFiltersMap(prev => ({
      ...prev,
      [moduleKey]: { ...DEFAULT_FILTERS },
    }));
  }, []);

  /**
   * Reset ALL modules' filters.
   * Call this on logout so a new session starts clean.
   */
  const clearAllFilters = useCallback(() => {
    setFiltersMap({});
  }, []);

  /**
   * Count how many filters are actively set (non-default) for a module.
   *
   * Derived from DEFAULT_FILTERS keys automatically — adding a new key
   * to DEFAULT_FILTERS is all you need; this function updates itself.
   * Ignores: limit, currentPage (listed in NON_FILTER_KEYS above).
   */
  const getFilterCount = useCallback((moduleKey) => {
    const f = filtersMap[moduleKey];
    if (!f) return 0;

    return Object.keys(DEFAULT_FILTERS)
      .filter(k =>
        !NON_FILTER_KEYS.has(k) &&           // skip non-filter keys
        f[k] !== undefined &&                  // key exists in current state
        f[k] !== DEFAULT_FILTERS[k]            // value differs from default
      )
      .length;
  }, [filtersMap]);

  return (
    <FilterContext.Provider
      value={{
        getFilters,
        setFilters,
        clearFilters,
        clearAllFilters,
        getFilterCount,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside <FilterProvider>');
  return ctx;
};

export default FilterContext;