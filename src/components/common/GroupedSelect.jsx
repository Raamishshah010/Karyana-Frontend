import React from 'react';
import Select from 'react-select';

const groupStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
};

const groupBadgeStyles = {
  backgroundColor: '#FF5934',
  borderRadius: '2em',
  color: 'white',
  display: 'inline-block',
  fontSize: 12,
  fontWeight: 'normal',
  lineHeight: '1',
  minWidth: 1,
  padding: '0.16666666666667em 0.5em',
  textAlign: 'center',
};

const customStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    background: '#EEF0F6',
    borderColor: state.isFocused ? '#000' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 1px #000' : 'none',
    '&:hover': {
      borderColor: '#000',
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#FF5934' : state.isFocused ? '#FFF1EE' : 'white',
    color: state.isSelected ? 'white' : '#333',
    '&:active': {
      backgroundColor: '#FF5934',
    },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  }),
  group: (base) => ({
    ...base,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  groupHeading: (base) => ({
    ...base,
    color: '#4A5568',
    fontWeight: 600,
    fontSize: '0.875rem',
    textTransform: 'none',
    letterSpacing: 'normal',
  }),
};

const formatGroupLabel = (data) => (
  <div style={groupStyles}>
    <span className="font-semibold">{data.label}</span>
    <span style={groupBadgeStyles}>{data.options.length}</span>
  </div>
);

const GroupedSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select...",
  isSearchable = true,
  isClearable = true,
  isDisabled = false,
  className = "",
  error = null
}) => {
  return (
    <div className={className}>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        formatGroupLabel={formatGroupLabel}
        placeholder={placeholder}
        isSearchable={isSearchable}
        isClearable={isClearable}
        isDisabled={isDisabled}
        styles={customStyles}
        className={error ? 'border-red-500' : ''}
      />
      {error && (
        <div className="text-red-500 text-sm mt-1">{error}</div>
      )}
    </div>
  );
};

export default GroupedSelect;
