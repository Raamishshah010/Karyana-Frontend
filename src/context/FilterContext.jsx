import { createContext, useContext, useState, useCallback } from 'react';

/**
 * FilterContext — stores per-module filter state that persists across navigation.
 * Usage:
 *   1. Wrap your app (or router) with <FilterProvider>
 *   2. In any component: const { getFilters, setFilters, clearFilters, getFilterCount } = useFilters();
 *   3. Call getFilters('coordinators'), setFilters('coordinators', {...}), etc.
 *
 * Supported module keys (add more as needed):
 *   'coordinators' | 'sales' | 'retailers' | 'ledgerSales' | 'warehouseManagers'
 */

const DEFAULT_FILTERS = {
  searchTerm: '',
  selectedCityId: '',
  selectedStatus: '',
  startDate: '',
  endDate: '',
  selectedSalesPerson: '',
  selectedCustomer: '',
  limit: 10,
  currentPage: 1,
};

const FilterContext = createContext(null);

export const FilterProvider = ({ children }) => {
  // Map of moduleKey -> filter state object
  const [filtersMap, setFiltersMap] = useState({});

  /** Get filters for a module (returns defaults if not set yet) */
  const getFilters = useCallback((moduleKey) => {
    return filtersMap[moduleKey] ?? { ...DEFAULT_FILTERS };
  }, [filtersMap]);

  /** Merge partial filter updates into a module's filter state */
  const setFilters = useCallback((moduleKey, partial) => {
    setFiltersMap(prev => ({
      ...prev,
      [moduleKey]: {
        ...(prev[moduleKey] ?? { ...DEFAULT_FILTERS }),
        ...partial,
      },
    }));
  }, []);

  /** Reset a module's filters back to defaults */
  const clearFilters = useCallback((moduleKey) => {
    setFiltersMap(prev => ({
      ...prev,
      [moduleKey]: { ...DEFAULT_FILTERS },
    }));
  }, []);

  /** Clear ALL modules' filters (e.g., on logout) */
  const clearAllFilters = useCallback(() => {
    setFiltersMap({});
  }, []);

  /**
   * Count how many filters are actively set (non-default) for a module.
   * Ignores: limit, currentPage
   */
  const getFilterCount = useCallback((moduleKey) => {
    const f = filtersMap[moduleKey];
    if (!f) return 0;
    const countable = ['searchTerm', 'selectedCityId', 'selectedStatus', 'startDate', 'endDate', 'selectedSalesPerson', 'selectedCustomer'];
    return countable.filter(k => f[k] && f[k] !== '').length;
  }, [filtersMap]);

  return (
    <FilterContext.Provider value={{ getFilters, setFilters, clearFilters, clearAllFilters, getFilterCount }}>
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