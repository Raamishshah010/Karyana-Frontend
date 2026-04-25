import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { read, utils } from 'xlsx';
import User from './User';
import { PiToggleLeftFill } from "react-icons/pi";
import { PiToggleRightFill } from "react-icons/pi";
import { createRetialer, deleteRetialer, getAllCities, getDatas, getRetailers, updateRetialerStatus, getSalesPersons, updateRetialer } from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { HiDotsVertical } from "react-icons/hi";
import { checkAuthError, USER_STATUSES } from '../../utils';
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import ClickOutside from '../../Hooks/ClickOutside';
import { Formik, Form } from 'formik';
import * as yup from 'yup';
import { Input } from '../common/input';
import { Select } from '../common/select';
import placeholder from '../../assets/placehold.jpg'

const Retailers = () => {
  const [limit, setLimit] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [importing, setImporting] = useState(false);
  const [showDropdown, setShowDropdown] = useState("");
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [cities, setCities] = useState({
    isLoaded: false,
    data: [],
  });
  const [isAddRetailerFormVisible, setIsAddRetailerFormVisible] = useState(false);
  const [salesPersons, setSalesPersons] = useState([]);
  const [editInitialValues, setEditInitialValues] = useState({
    id: '', // for edit
    userId: '',
    name: "",
    email: "",
    phoneNumber: "",
    cnic: "",
    cityID: "",
    shopName: "",
    shopAddress1: "",
    shopAddress2: "",
    shopCategory: "",
    distance: "",
    lng: "",
    lat: "",
    salesPersonID: "",
    password: "",
    image: null,
  });

  const token = useSelector((state) => state.admin.token);

  // Normalize API data so UI uses `isAdminVerified` consistently
  const normalizeRetailersList = (list = []) => {
    try {
      return (list || []).map((r) => ({
        ...r,
        // Frontend expects `isAdminVerified`; backend returns `isVerified`
        isAdminVerified:
          typeof r.isAdminVerified !== 'undefined'
            ? !!r.isAdminVerified
            : !!r.isVerified,
      }));
    } catch (e) {
      console.error('[Retailers] normalizeRetailersList error', e);
      return list || [];
    }
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/octet-stream'
    ];
  
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Unsupported file type: ${file.type}. Please upload .xlsx, .xls or .csv files only.`);
      e.target.value = '';
      return;
    }
  
    // Show info toast about required columns
    // toast.info(
    //   <div>
    //     <div style={{fontWeight: 'bold', marginBottom: '8px'}}>📋 Importing Retailers</div>
    //     <div>Required columns: <strong>Business Name</strong>, <strong>Phone</strong>, <strong>Account No</strong>, <strong>City Code</strong></div>
    //     <div style={{marginTop: '8px', fontSize: '0.9em'}}>
    //       • City Code must match an existing location code in the system<br/>
    //       • All other fields will use default values if not provided
    //     </div>
    //   </div>,
    //   { autoClose: 8000, closeOnClick: false }
    // );
    
    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        
        // Find header row
        const headerRow = jsonData[0] || [];
        
        // Find column indices (case-insensitive and trim whitespace)
        const findColumnIndex = (possibleNames) => {
          const headerMap = headerRow.reduce((acc, val, idx) => {
            if (val) acc[String(val).toLowerCase().trim()] = idx;
            return acc;
          }, {});
          
          console.log('Available columns in Excel:', Object.keys(headerMap).join(', '));
          
          for (const name of possibleNames) {
            const normalizedSearch = name.toLowerCase().trim();
            console.log(`Looking for column: ${normalizedSearch}`);
            const idx = headerMap[normalizedSearch];
            if (idx !== undefined) {
              console.log(`Found column "${headerRow[idx]}" at index ${idx} for "${name}"`);
              return idx;
            }
          }
          console.warn(`Column not found for any of: ${possibleNames.join(', ')}`);
          return -1;
        };
        
        // First, log all available headers for debugging
        console.log('Available headers with indices:');
        headerRow.forEach((header, idx) => {
          if (header) console.log(`  [${idx}]: "${header}"`);
        });
        
        // Define column indices with improved detection and logging
        const businessNameIdx = findColumnIndex(['business name', 'shop name', 'shopname', 'business', 'company name']);
        const firstNameIdx = findColumnIndex(['first name', 'name', 'firstname', 'contact person']);
        const phoneIdx = findColumnIndex(['phone', 'phone number', 'phonenumber', 'contact', 'mobile', 'mobile number']);
        const cnicIdx = findColumnIndex(['cnic', 'cninc', 'id card', 'idcard', 'nic']);
        const cityCodeIdx = findColumnIndex(['postal code', 'zip code', 'zip', 'city code', 'location code', 'city', 'location', 'city id', 'location id']);
        const accountNoIdx = findColumnIndex(['account no', 'account', 'account number', 'account no.']) || 4;
        
        // First try to find 'Field1' column by exact match (case insensitive)
        let salesIdIdx = -1;
        headerRow.some((header, idx) => {
          if (String(header).trim().toLowerCase() === 'field1') {
            salesIdIdx = idx;
            console.log(`Found 'Field1' column at index ${salesIdIdx}`);
            return true;
          }
          return false;
        });
        
        // If 'Field1' not found, try other possible column names
        if (salesIdIdx === -1) {
          salesIdIdx = findColumnIndex(['sales id', 'salesid', 'salesperson id', 'salespersonid', 'sales rep id', 'salesrep id']);
          console.log(`Sales ID column found at index: ${salesIdIdx} (using alternative names)`);
        } else {
          console.log(`Sales ID column found at index: ${salesIdIdx} (using 'Field1')`);
        }
        
        console.log('Column indices:', {
          businessNameIdx,
          phoneIdx,
          accountNoIdx,
          salesIdIdx,
          cityCodeIdx,
          firstNameIdx,
          cnicIdx
        });
        
        // Validate required columns with more detailed error messages
        const missingColumns = [];
        if (businessNameIdx === -1) missingColumns.push('Business Name');
        if (phoneIdx === -1) missingColumns.push('Phone');
        if (accountNoIdx === -1) missingColumns.push('Account No');
        if (salesIdIdx === -1) missingColumns.push('Sales ID');
        
        if (missingColumns.length > 0) {
          throw new Error(`Required columns not found in Excel file. Missing columns: ${missingColumns.join(', ')}. Available columns: ${headerRow.filter(Boolean).join(', ')}`);
        }
        
        // Fetch all cities for city code matching
        let cities = [];
        const cityMap = new Map();
        
        try {
          const citiesResponse = await getAllCities();
          console.log('Cities API Response:', citiesResponse); // Debug log
          
          // Handle different possible response structures
          if (citiesResponse?.data?.data && Array.isArray(citiesResponse.data.data)) {
            cities = citiesResponse.data.data; // Handle paginated response
          } else if (citiesResponse?.data && Array.isArray(citiesResponse.data)) {
            cities = citiesResponse.data; // Handle direct array in data
          } else if (Array.isArray(citiesResponse)) {
            cities = citiesResponse; // Handle direct array response
          } else {
            console.warn('Unexpected cities response format:', citiesResponse);
            throw new Error('Failed to load city data. Please try again.');
          }
          
          console.log('Parsed Cities:', cities); // Debug log
          
          // Create a map of city codes to city IDs (case-insensitive)
          let validCityCount = 0;
          cities.forEach(city => {
            if (city?._id && city?.locationId) {
              const locationId = String(city.locationId).trim().toLowerCase();
              if (locationId) {
                cityMap.set(locationId, city._id);
                validCityCount++;
              }
            }
          });
          
          console.log(`City Map (${validCityCount} valid cities):`, Object.fromEntries(cityMap));
          
          if (validCityCount === 0) {
            throw new Error('No valid city codes found in the system. Please check your city data.');
          }
          
        } catch (error) {
          console.error('Error loading cities:', error);
          throw new Error(`Failed to load city data: ${error.message}`);
        }
        
        let successCount = 0;
        const errors = [];
        
        // Process each row (skip header)
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          // Get values from row with detailed logging
          console.log(`\n--- Processing Row ${i + 1} ---`);
          console.log('Raw row data:', row);
          
          const businessName = row[businessNameIdx] ? String(row[businessNameIdx]).trim() : '';
          const firstName = firstNameIdx >= 0 ? String(row[firstNameIdx] || '').trim() : '';
          const phoneNumber = row[phoneIdx] ? String(row[phoneIdx]).trim() : '';
          const cnic = cnicIdx >= 0 ? String(row[cnicIdx] || '').replace(/\D/g, '') : '';
          const accountNo = row[accountNoIdx] ? String(row[accountNoIdx]).trim() : '';
          const cityCode = cityCodeIdx >= 0 ? String(row[cityCodeIdx] || '').trim() : '';
          
          // Get and log sales ID with more details
          const rawSalesId = salesIdIdx >= 0 ? row[salesIdIdx] : undefined;
          let salesId = rawSalesId !== undefined ? String(rawSalesId).trim() : '';
          
          // Extract ID from format "Name [ID]" if present
          const idMatch = salesId.match(/\[([^\]]+)\]/);
          if (idMatch && idMatch[1]) {
            salesId = idMatch[1].trim();
            console.log(`Extracted sales ID from brackets: ${salesId}`);
          }
          
          console.log('Extracted values:', {
            businessName,
            phoneNumber,
            accountNo,
            salesId: salesId || '(empty or undefined)',
            salesIdRaw: rawSalesId,
            extractedId: idMatch ? idMatch[1] : 'No ID in brackets',
            salesIdIdx,
            rowLength: row.length
          });
          
          // Validate required fields with detailed logging
          const missingFields = [];
          if (!businessName) missingFields.push('Business Name');
          // Phone is no longer mandatory
          if (!accountNo) missingFields.push('Account No');
          if (!salesId) missingFields.push('Sales ID');
          
          if (missingFields.length > 0) {
            const errorMsg = `Row ${i + 1}: Missing required fields - ${missingFields.join(', ')}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            continue;
          }
          
          // Validate city code
          if (!cityCode) {
            errors.push(`Row ${i + 1}: City code is required`);
            continue;
          }
          
          // Find matching city ID
          const normalizedCityCode = cityCode.toLowerCase();
          const cityId = cityMap.get(normalizedCityCode);
          
          if (!cityId) {
            errors.push(`Row ${i + 1}: Invalid city code "${cityCode}". Please use a valid city code.`);
            continue;
          }
          
          // Use Account No. as userId
          const userId = accountNo;
          
          // salesId is already defined above
          
          // Find matching sales person by salesId (case-insensitive and trim whitespace)
          const normalizedSalesId = salesId.trim().toLowerCase();
          console.log(`Looking for sales person with ID: "${normalizedSalesId}"`);
          
          const matchedSalesPerson = salesPersons.find(sp => {
            if (!sp.salesId) return false;
            const spSalesId = String(sp.salesId).trim().toLowerCase();
            console.log(`Checking sales person: ${sp.name} (${sp.salesId})`);
            return spSalesId === normalizedSalesId;
          });
          
          if (!matchedSalesPerson) {
            const availableSalesIds = salesPersons
              .map(sp => sp.salesId ? `"${sp.salesId}"` : null)
              .filter(Boolean)
              .join(', ');
              
            console.error(`No sales person found with ID: "${salesId}". Available sales IDs:`, availableSalesIds);
            errors.push(`Row ${i + 1}: No sales person found with ID: "${salesId}". Available sales IDs: ${availableSalesIds || 'None found'}`);
            continue;
          }
          
          const salesPersonID = matchedSalesPerson._id;
          console.log(`Matched sales ID: "${salesId}" to user: ${matchedSalesPerson.name} (${matchedSalesPerson._id})`);

          // Create retailer data with required fields
          const retailerData = {
            userId: userId,
            name: firstName || businessName, // Use business name as fallback
            phoneNumber: phoneNumber,
            cnic: cnic,
            shopName: businessName,
            shopAddress1: 'Imported from Excel',
            shopAddress2: 'N/A', // Required field
            cityID: cityId, // Use the matched city ID from cityMap
            locationCode: cityCode, // Store the original city code for reference
            isActive: true,
            isAdminVerified: false,
            email: '',
            lat: 0,
            lng: 0,
            distance: 0, // Required field, must be a number
            shopCategory: 'General Store', // Required field with default value
            isFiler: false,
            ntnNumber: '',
            stn: '',
            billingAddress: '',
            city: cityCode, // Store city code as text for display
            province: '',
            postalCode: '',
            country: '',
            balance: 0,
            lastPayment: 0,
            salesPersonID: salesPersonID, // Required field
          };
          
          try {
            // Validate required fields before API call
            if (!retailerData.userId || !retailerData.cityID) {
              throw new Error(`Missing required fields in retailer data: ${JSON.stringify({
                userId: !!retailerData.userId,
                cityID: !!retailerData.cityID
              }, null, 2)}`);
            }
            
            // Validate cityID format (should be a valid MongoDB ObjectId)
            if (!/^[0-9a-fA-F]{24}$/.test(retailerData.cityID)) {
              throw new Error(`Invalid cityID format: ${retailerData.cityID}`);
            }
            
            console.log('Sending retailer data:', JSON.stringify({
              ...retailerData,
              // Don't log sensitive data
              cnic: retailerData.cnic ? '***' : 'not provided',
              phoneNumber: retailerData.phoneNumber ? '***' : 'not provided'
            }, null, 2));
            
            // Call the createRetailer API
            try {
              console.log('Sending request to create retailer with cityID:', retailerData.cityID);
              const response = await createRetialer(retailerData, token);
              console.log('API Response:', response);
              successCount++;
              
              // Small delay between API calls to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (apiError) {
              console.error('Raw error object:', apiError);
              console.error('Error response data:', apiError.response?.data);
              console.error('Error response status:', apiError.response?.status);
              console.error('Error response headers:', apiError.response?.headers);
              
              const errorDetails = {
                requestData: retailerData,
                response: apiError.response?.data,
                status: apiError.response?.status,
                statusText: apiError.response?.statusText,
                message: apiError.message,
                config: {
                  url: apiError.config?.url,
                  method: apiError.config?.method,
                  headers: apiError.config?.headers
                }
              };
              
              console.error('API Error details:', JSON.stringify(errorDetails, null, 2));
              
              // Extract error message from different possible locations
              let errorMsg = 'Unknown error';
              const responseData = apiError.response?.data;
              
              if (responseData) {
                if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
                  errorMsg = responseData.errors.map(e => e.msg || JSON.stringify(e)).join('; ');
                } else if (responseData.message) {
                  errorMsg = responseData.message;
                } else if (typeof responseData === 'string') {
                  errorMsg = responseData;
                } else {
                  errorMsg = JSON.stringify(responseData);
                }
              } else if (apiError.message) {
                errorMsg = apiError.message;
              }
              
              // Try to parse JSON error if it's a string
              if (typeof errorMsg === 'string' && errorMsg.startsWith('{')) {
                try {
                  const parsedError = JSON.parse(errorMsg);
                  errorMsg = parsedError.message || JSON.stringify(parsedError);
                } catch (e) {
                  console.error('Error parsing error message:', e);
                }
              }
              
              errors.push(`Row ${i + 1}: ${errorMsg}`);
              console.error(`Error processing row ${i + 1}:`, apiError);
            }
          } catch (error) {
            console.error('Unexpected error:', error);
            errors.push(`Row ${i + 1}: ${error.message || 'Unknown error'}`);
          }
        }
        
        // Show results with more detailed feedback
        if (successCount > 0) {
          const successMsg = `Successfully imported ${successCount} retailer${successCount > 1 ? 's' : ''}`;
          
          if (errors.length > 0) {
            // Show success with warning about some failures
            toast.success(
              <div>
                <div>{successMsg}</div>
                <div style={{marginTop: '10px', fontWeight: 'bold'}}>
                  {errors.length} row{errors.length > 1 ? 's' : ''} had issues
                </div>
              </div>,
              { autoClose: 10000 }
            );
            
            // Show detailed errors in a separate toast
            const errorGroups = [];
            const errorCounts = {};
            
            // Group similar errors
            errors.forEach(error => {
              const errorMsg = error.split(': ').slice(1).join(': ');
              errorCounts[errorMsg] = (errorCounts[errorMsg] || 0) + 1;
            });
            
            // Create grouped error messages
            for (const [errorMsg, count] of Object.entries(errorCounts)) {
              errorGroups.push(`• ${count} row${count > 1 ? 's' : ''}: ${errorMsg}`);
            }
            
            // Show first 5 error groups
            const maxErrorsToShow = 5;
            toast.warn(
              <div>
                <div style={{fontWeight: 'bold', marginBottom: '8px'}}>Import Issues:</div>
                {errorGroups.slice(0, maxErrorsToShow).map((error, idx) => (
                  <div key={idx} style={{margin: '4px 0', fontSize: '0.9em'}}>{error}</div>
                ))}
                {errorGroups.length > maxErrorsToShow && (
                  <div style={{marginTop: '8px', fontStyle: 'italic'}}>
                    ... and {errorGroups.length - maxErrorsToShow} more issue{errorGroups.length - maxErrorsToShow > 1 ? 's' : ''}
                  </div>
                )}
              </div>,
              {
                autoClose: 15000,
                closeOnClick: false,
                style: { maxHeight: '60vh', overflowY: 'auto' }
              }
            );
          } else {
            // All successful
            toast.success(successMsg);
          }
          
          // Refresh the data
          try {
            const res = await getRetailers(currentPage, limit);
            setData(normalizeRetailersList(res.data.data));
            setTotalPages(res.data.totalPages);
          } catch (refreshError) {
            console.error('Error refreshing retailer list:', refreshError);
            toast.error('Retailers were imported, but there was an error refreshing the list');
          }
        } else if (errors.length > 0) {
          // All rows failed
          toast.error(
            <div>
              <div>❌ Import failed for all rows</div>
              <div style={{marginTop: '8px'}}>
                {errors[0].split(': ')[1] || 'Unknown error'}
                {errors.length > 1 ? ` (and ${errors.length - 1} more issue${errors.length > 2 ? 's' : ''})` : ''}
              </div>
            </div>,
            { autoClose: 8000 }
          );
        }
        
      } catch (error) {
        console.error('Excel import error:', error);
        toast.error(error.message || 'Failed to process Excel file');
      } finally {
        setImporting(false);
        e.target.value = ''; // Reset file input
      }
    };
    
    reader.onerror = () => {
      toast.error('Error reading file');
      setImporting(false);
      e.target.value = ''; // Reset file input
    };
    
    // Start reading the file
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (!cities.isLoaded) {
      getAllCities().then(res => {
        setCities({
          isLoaded: true,
          data: res.data.data,
        });
      }).catch(err => {
        console.log("Loading cities: ", err.message);
      });
    }
  }, [cities.isLoaded]);

  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        console.log('Fetching sales persons...');
        const response = await getSalesPersons(token);
        console.log('Sales persons response:', response);
        const salesPersonsData = response.data.data || [];
        console.log('Sales persons loaded:', salesPersonsData.map(sp => ({
          _id: sp._id,
          name: sp.name,
          salesId: sp.salesId,
          email: sp.email
        })));
        setSalesPersons(salesPersonsData);
      } catch (err) {
        console.error("Error loading sales persons:", err);
        toast.error('Failed to load sales persons data');
      }
    };
    fetchSalesPersons();
  }, [token]);

  useEffect(() => {
    setLoading(true);
    const link = `/retailer/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(normalizeRetailersList(res.data.data));
      setLoading(false);
      setTotalPages(res.data.totalPages);
    }).catch((err) => {
      setLoading(false);
      toast.error(err.message);
    });
  }, [currentPage, limit, selectedMaritalStatus, selectedCityId]);

  const deleteHandler = async (id) => {
    const c = window.confirm("Are you sure to delete?");
    if (!c) return;
    try {
      setLoading(true);
      await deleteRetialer(id, token);
      getRetailers(currentPage, limit).then((res) => {
        setData(normalizeRetailersList(res.data.data));
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => {
        setLoading(false);
        toast.error(err.message);
      });
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const updateDataHandler = async (check, name, item) => {
    try {
      setLoading(true);
      console.log('[Retailers] Toggle clicked', {
        target: name,
        nextValue: check,
        itemId: item._id,
        currentValues: {
          isActive: item.isActive,
          isAdminVerified: item.isAdminVerified,
        }
      });

      // Map frontend keys to backend expected payload
      const payload = {
        id: item._id,
        // Backend expects `isVerified` and `isActive` booleans
        isActive: name === "isActive" ? check : !!item.isActive,
        isVerified: name === "isAdminVerified" ? check : !!item.isAdminVerified,
      };

      console.log('[Retailers] Sending verification update payload', payload);

      const response = await updateRetialerStatus(payload, token);
      console.log('[Retailers] Verification API response', response?.data || response);

      const toggledLabel = name === 'isAdminVerified' ? 'Admin Verified' : 'Active';
      const stateText = check ? 'enabled' : 'disabled';
      toast.success(`${toggledLabel} ${stateText}`);
  
      setLoading(false);
      getRetailers(currentPage, limit).then((res) => {
        console.log('[Retailers] Refreshed list after toggle', {
          total: res?.data?.data?.length,
          page: currentPage,
        });
        setData(normalizeRetailersList(res.data.data));
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => {
        setLoading(false);
        toast.error(err.message);
        console.error('[Retailers] Refresh after toggle failed', err?.response?.data || err);
      });
    } catch (error) {
      checkAuthError(error);
      const apiError = error?.response?.data || error?.message || error;
      console.error('[Retailers] Toggle failed', apiError);
      toast.error(typeof apiError === 'string' ? apiError : (apiError?.msg || 'Toggle failed'));
    }
  };

  const citySelectHandler = async (e) => {
    if (e.target.value?.length) {
      setSelectedCityId(e.target.value);
    } else {
      setSelectedCityId("");
      setCurrentPage(1);
    }
  };

  const statusSelectHandler = async (e) => {
    if (e.target.value?.length) {
      setSelectedMaritalStatus(e.target.value === USER_STATUSES[0]);
    } else {
      setSelectedMaritalStatus("");
      setCurrentPage(1);
    }
  };

  const refreshData = () => {
    setSearchTerm("");
    setLoading(true);
    const link = `/retailer/search?page=${1}&limit=${limit}&searchTerm=&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(normalizeRetailersList(res.data.data));
      setTotalPages(res.data.totalPages);
      setLoading(false);
    }).catch((err) => {
      setLoading(false);
      toast.error(err.message);
    });
  };

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      setLoading(true);
      setSearchTerm(e.target.value);
      const link = `/retailer/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
      getDatas(link).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => {
        setLoading(false);
        toast.error(err.message);
      });
    }
  };

  const validationSchema = yup.object().shape({
    userId: yup.string().required("User ID is required"),
    name: yup.string().required("Name is required"),
    email: yup.string().nullable().email("Invalid email"),
    phoneNumber: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "Phone number is not valid e.g +923333333333").required("Phone number is required"),
    cnic: yup.string()
      .transform((value) => value ? value.replace(/[^0-9]/g, '') : value) // Remove non-digits
      .matches(/^[0-9]{13}$|^$/, 'CNIC must be 13 digits') // Allow empty or exactly 13 digits
      .nullable()
      .transform((value) => value || undefined), // Convert empty string to undefined
    cityID: yup.string().required("City is required"),
    shopName: yup.string().required("Shop name is required"),
    shopAddress1: yup.string().required("Shop address 1 is required"),
    shopAddress2: yup.string().required("Shop address 2 is required"),
    shopCategory: yup.string().required("Shop category is required"),
    distance: yup.number().typeError("Distance must be a number").required("Distance is required"),
    lng: yup.number().typeError("Longitude must be a number").required("Longitude is required"),
    lat: yup.number().typeError("Latitude must be a number").required("Latitude is required"),
    salesPersonID: yup.string().required("Sales person is required"),
    password: yup.string().nullable(), // Optional password field
    image: yup.mixed().nullable(), // Optional file upload
  });

  const initialValues = {
    id: '', // for edit
    userId: '',
    name: "",
    email: "",
    phoneNumber: "",
    cnic: "",
    cityID: "",
    shopName: "",
    shopAddress1: "",
    shopAddress2: "",
    shopCategory: "",
    distance: "",
    lng: "",
    lat: "",
    salesPersonID: "",
    password: "",
    image: null,
  };

  const handleAddRetailer = async (values, { setSubmitting, resetForm }) => {
    try {
      setLoading(true);
      const formData = new FormData();
      // Explicitly append each field to ensure correct structure
      formData.append("userId", values.userId);
      formData.append("name", values.name);
      formData.append("email", values.email || ""); // Always append email, even if empty
      formData.append("phoneNumber", values.phoneNumber);
      // Format CNIC to remove any non-digit characters before submission
      const cleanCnic = values.cnic ? values.cnic.replace(/[^0-9]/g, '') : '';
      formData.append("cnic", cleanCnic); // Always append cnic, even if empty
      formData.append("cityID", values.cityID);
      formData.append("shopName", values.shopName);
      formData.append("shopAddress1", values.shopAddress1);
      formData.append("shopAddress2", values.shopAddress2);
      formData.append("shopCategory", values.shopCategory);
      formData.append("distance", values.distance || ""); // Always append distance
      formData.append("lng", values.lng || ""); // Always append lng
      formData.append("lat", values.lat || ""); // Always append lat
      formData.append("salesPersonID", values.salesPersonID);
      // Only append password if it's provided (for both create and edit)
      if (values.password && values.password.trim()) {
        formData.append("password", values.password);
        console.log("Password being sent:", values.password);
      } else {
        console.log("No password provided or empty password");
      }
      if (values.image) {
        formData.append("file", values.image); // Matches backend req.files['file']
      }
      
      // Debug: Log all form data being sent
      console.log("Form data being sent:");
      for (let [key, value] of formData.entries()) {
        console.log(key, ":", value);
      }
      
      if (values.id) {
        // Edit mode
        console.log("Updating retailer with ID:", values.id);
        await updateRetialer(values.id, formData, token);
        toast.success("Retailer updated successfully!");
      } else {
        // Add mode
        const response = await createRetialer(formData, token);
        if (response.data && response.data.msg === "success") {
          toast.success("Retailer added successfully!");
        } else {
          throw new Error(response.data.msg || "Failed to add retailer");
        }
      }
      getRetailers(currentPage, limit).then((res) => {
        setData(normalizeRetailersList(res.data.data));
        setTotalPages(res.data.totalPages);
        setLoading(false);
      });
      setIsAddRetailerFormVisible(false);
      resetForm();
    } catch (error) {
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const duplicate = error.response.data.errors.find(e => e.msg && e.msg.toLowerCase().includes('user id'));
        if (duplicate) {
          toast.error(duplicate.msg);
          setSubmitting(false);
          setLoading(false);
          return;
        }
      }
      console.error("Error adding/updating retailer:", error.response ? error.response.data : error);
      toast.error(error.response?.data?.msg || error.response?.data?.errors?.map(e => e.msg).join(", ") || error.message || "Failed to add/update retailer");
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };
  const handleDownloadSample = () => {
      try {
        // Create a temporary anchor element
        const link = document.createElement('a');
        
        // Use the direct path to the file in the public folder
        link.href = '/customerSample.xlsx';
        
        // Set the download attribute with the desired filename
        link.download = 'Product_Import_Sample.xlsx';
        
        // Append to body, click and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Error downloading sample file:', error);
        toast.error('Failed to download sample file. Please make sure the file exists in the public folder.');
      }
    };


  if (loading) return <Loader />;

  return (
    <div className='relative'>
      <User />
      <div className='flex justify-between items-center mt-3'>
        <h1 className='text-xl text-nowrap font-bold'>Customers</h1>
        <div className='flex gap-7'>
          <div className='flex bg-[#FFFFFF] rounded-xl ml-10 px-1'>
            <img src="/Search.svg" alt="search" className='' />
            <input
              onChange={e => {
                if (e.target.value.length) {
                  setSearchTerm(e.target.value);
                } else {
                  refreshData();
                }
              }}
              onKeyPress={searchHandler}
              value={searchTerm}
              className='p-2 outline-none rounded-xl'
              type="search"
              name="search"
              id=""
              placeholder='Search by name'
            />
          </div>
          <select value={selectedCityId} onChange={citySelectHandler} className='bg-[#FFFFFF] rounded-lg p-1'>
            <option value="">Select Location</option>
            <option value="">View All</option>
            {cities.data.map((city) => (
              <option value={city._id} key={city._id}>{city.name}</option>
            ))}
          </select>
          <select
            value={selectedMaritalStatus === '' ? ' ' : selectedMaritalStatus ? USER_STATUSES[0] : USER_STATUSES[1]}
            onChange={statusSelectHandler}
            className='bg-[#FFFFFF] rounded-lg p-1'
          >
            <option value="">Status</option>
            <option value="">View All</option>
            {USER_STATUSES.map((status) => (
              <option value={status} key={status}>{status}</option>
            ))}
          </select>
          <button
            className="bg-[#FFD7CE] text-[#FF5934] font-bold text-nowrap p-2 rounded"
            onClick={() => setIsAddRetailerFormVisible(true)}
          >
            + Add Retailer
          </button>
          <button 
            className='bg-[#FFD7CE] text-[#FF5934] font-bold text-nowrap p-2 rounded'
            disabled={importing}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              id="excel-import"
              onChange={handleExcelImport}
              disabled={importing}
            />
            <label htmlFor="excel-import" style={{ cursor: importing ? 'not-allowed' : 'pointer' }}>
              {importing ? 'Importing...' : 'Import Excel'}
            </label>
          </button>
          <button
            onClick={handleDownloadSample}
            className='bg-[#FFD7CE] text-[#FF5934] text-nowrap font-bold p-2 rounded w-full sm:w-auto'
          >
            Download Sample
          </button>
        </div>
      </div>

      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left text-gray-500'>
              <td>Name</td>
              <td>User ID</td>
              <td>Phone no</td>
              <td>CNIC</td>
              <td>Active</td>
              <td>Admin Verified</td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((item, index) => (
              <tr key={index} className='border-b cursor-pointer'>
                <td className='flex items-center gap-2 p-2 bg-[#FFFFFF] rounded-l-xl'>
                  <img src={(item.image && item.image.length) ? item.image : placeholder} alt="" className='w-8 h-8 rounded-full' />
                  <div>
                    <h1 className='font-bold'>{item.shopName}</h1>
                    <h3 className='text-sm text-gray-400'>{item.email}</h3>
                  </div>
                </td>
                <td className='p-2 bg-[#FFFFFF] uppercase'>
                  {/* Show User ID instead of MongoDB _id */}
                  #{item.userId}
                </td>
                <td className='p-2 bg-[#FFFFFF]'>{item.phoneNumber}</td>
                <td className='p-2 bg-[#FFFFFF]'>{item.cnic}</td>
                <td
                  className='p-2 bg-[#FFFFFF]'
                  onClick={() => updateDataHandler(!item.isActive, "isActive", item)}
                >
                  {item.isActive ? <PiToggleRightFill size={25} className='text-green-500' /> : <PiToggleLeftFill size={25} className='text-gray-400' />}
                </td>
                <td
                  className='p-2 bg-[#FFFFFF]'
                  onClick={() => updateDataHandler(!item.isAdminVerified, "isAdminVerified", item)}
                >
                  {item.isAdminVerified ? <PiToggleRightFill size={25} className='text-green-500' /> : <PiToggleLeftFill size={25} className='text-gray-400' />}
                </td>
                <td className='bg-[#FFFFFF] rounded-r-xl'>
                  <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl border inline-block text-left">
                    <div className='flex gap-5'>
                      <FaRegEye onClick={() => setSelectedUser(item)} />
                      <button
                        className='flex'
                        onClick={() => setShowDropdown(prev => prev === item._id ? "" : item._id)}
                      >
                        <HiDotsVertical />
                      </button>
                    </div>
                    {showDropdown === item._id && (
                      <ClickOutside onClick={() => setShowDropdown('')}>
                        <div
                          className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5"
                          role="menu"
                          aria-orientation="vertical"
                          aria-labelledby="dropdownButton"
                        >
                          <div className="flex flex-col gap-2 justify-center items-start" role="none">
                            <li
                              onClick={async () => {
                                // Edit handler: pre-fill form and show
                                setIsAddRetailerFormVisible(true);
                                setShowDropdown("");
                                
                                try {
                                  // Fetch individual user data to get the password
                                  const response = await getDatas(`/retailer/${item._id}`);
                                  
                                  if (response.data && response.data.msg === "success") {
                                    const fullUserData = response.data.data;
                                    
                                    // Pre-fill form with all data including password
                                    setTimeout(() => {
                                      setEditInitialValues({
                                        id: fullUserData._id,
                                        userId: fullUserData.userId || "",
                                        name: fullUserData.name,
                                        email: fullUserData.email || "",
                                        phoneNumber: fullUserData.phoneNumber,
                                        cnic: fullUserData.cnic,
                                        cityID: fullUserData.cityID?._id || fullUserData.cityID,
                                        shopName: fullUserData.shopName,
                                        shopAddress1: fullUserData.shopAddress1,
                                        shopAddress2: fullUserData.shopAddress2,
                                        shopCategory: fullUserData.shopCategory,
                                        distance: fullUserData.distance,
                                        lng: fullUserData.lng,
                                        lat: fullUserData.lat,
                                        salesPersonID: fullUserData.salesPersonID?._id || fullUserData.salesPersonID,
                                        password: fullUserData.password || "", // Show current password
                                        image: null,
                                      });
                                    }, 0);
                                  } else {
                                    console.error('Failed to fetch user data:', response.data);
                                    // Fallback to using the item data without password
                                    setTimeout(() => {
                                      setEditInitialValues({
                                        id: item._id,
                                        userId: item.userId || "",
                                        name: item.name,
                                        email: item.email || "",
                                        phoneNumber: item.phoneNumber,
                                        cnic: item.cnic,
                                        cityID: item.cityID?._id || item.cityID,
                                        shopName: item.shopName,
                                        shopAddress1: item.shopAddress1,
                                        shopAddress2: item.shopAddress2,
                                        shopCategory: item.shopCategory,
                                        distance: item.distance,
                                        lng: item.lng,
                                        lat: item.lat,
                                        salesPersonID: item.salesPersonID?._id || item.salesPersonID,
                                        password: "",
                                        image: null,
                                      });
                                    }, 0);
                                  }
                                } catch (error) {
                                  console.error('Error fetching user data:', error);
                                  // Fallback to using the item data without password
                                  setTimeout(() => {
                                    setEditInitialValues({
                                      id: item._id,
                                      userId: item.userId || "",
                                      name: item.name,
                                      email: item.email || "",
                                      phoneNumber: item.phoneNumber,
                                      cnic: item.cnic,
                                      cityID: item.cityID?._id || item.cityID,
                                      shopName: item.shopName,
                                      shopAddress1: item.shopAddress1,
                                      shopAddress2: item.shopAddress2,
                                      shopCategory: item.shopCategory,
                                      distance: item.distance,
                                      lng: item.lng,
                                      lat: item.lat,
                                      salesPersonID: item.salesPersonID?._id || item.salesPersonID,
                                      password: "",
                                      image: null,
                                    });
                                  }, 0);
                                }
                              }}
                              className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2"
                            >
                              <button className="btn btn-light">Edit</button>
                            </li>
                            <li
                              onClick={() => {
                                deleteHandler(item._id);
                                setShowDropdown("");
                              }}
                              className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2"
                            >
                              <button className="btn btn-light">Delete</button>
                            </li>
                          </div>
                        </div>
                      </ClickOutside>
                    )}
                  </div>
                </td>
              </tr>
            )) : <p>No data found</p>}
          </tbody>
        </table>
      </div>

      <div
        className="pagination-container mt-3"
        style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "space-between", margin: 0 }}
      >
        <div className='flex items-center gap-2'>
          <button
            className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <GrFormPrevious className='text-white' />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span>{currentPage}</span> <span>/</span>
            <span>{totalPages}</span>
          </div>
          <button
            className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <GrFormNext className='text-white' />
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <span className='text-sm text-gray-500'>Show:</span>
          <select 
            value={limit} 
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setCurrentPage(1);
            }} 
            className='bg-[#FFFFFF] rounded-lg p-1 border text-sm outline-none'
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {isAddRetailerFormVisible && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[600px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>
                {editInitialValues.id ? 'Edit Retailer' : 'Add Retailer'}
              </h2>
            </div>
            <Formik
              initialValues={editInitialValues}
              enableReinitialize
              validationSchema={validationSchema}
              onSubmit={handleAddRetailer}
            >
              {({ values, handleChange, errors, touched, setFieldValue, setTouched, resetForm }) => {
                // Clear touched fields on form open (editInitialValues changes)
                useEffect(() => {
                  setTouched({});
                }, [editInitialValues, setTouched]);
                return (
                  <Form>
                    <div className="px-6">
                      <Input
                        name="userId"
                        label="User ID"
                        placeholder="Enter User ID"
                        value={values.userId}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.userId && touched.userId ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.userId && touched.userId && <div className="text-red-500 text-sm mt-1">{errors.userId}</div>}

                      <Input
                        name="name"
                        label="Name"
                        placeholder="Enter Name"
                        value={values.name}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.name && touched.name ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="email"
                        label="Email"
                        placeholder="Enter Email"
                        value={values.email}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.email && touched.email ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="phoneNumber"
                        label="Phone Number"
                        placeholder="Enter Phone Number (e.g., +923333333333)"
                        value={values.phoneNumber}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.phoneNumber && touched.phoneNumber ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="cnic"
                        label="CNIC"
                        placeholder="Enter CNIC (e.g., xxxxx-xxxxxxx-x)"
                        value={values.cnic}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.cnic && touched.cnic ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="password"
                        label={editInitialValues.id ? "Password (Leave empty to keep current)" : "Password (Optional)"}
                        placeholder={editInitialValues.id ? "Enter new password or leave empty to keep current" : "Enter Password (leave empty for no password)"}
                        value={values.password}
                        onChange={handleChange}
                        type="text"
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.password && touched.password ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {errors.password && touched.password && <div className="text-red-500 text-sm mt-1">{errors.password}</div>}

                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700">City</label>
                        <select
                          name="cityID"
                          value={values.cityID}
                          onChange={handleChange}
                          className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.cityID && touched.cityID ? 'border-red-500' : 'border-gray-300'}`}
                        >
                          <option value="">Select Location</option>
                          {cities.data.map((city) => (
                            <option value={city._id} key={city._id}>{city.name}</option>
                          ))}
                        </select>
                      </div>

                      <Input
                        name="shopName"
                        label="Shop Name"
                        placeholder="Enter Shop Name"
                        value={values.shopName}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.shopName && touched.shopName ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="shopAddress1"
                        label="Shop Address 1"
                        placeholder="Enter Shop Address 1"
                        value={values.shopAddress1}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.shopAddress1 && touched.shopAddress1 ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="shopAddress2"
                        label="Shop Address 2"
                        placeholder="Enter Shop Address 2"
                        value={values.shopAddress2}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.shopAddress2 && touched.shopAddress2 ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="shopCategory"
                        label="Shop Category"
                        placeholder="Enter Shop Category"
                        value={values.shopCategory}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.shopCategory && touched.shopCategory ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="distance"
                        label="Distance"
                        placeholder="Enter Distance"
                        value={values.distance}
                        onChange={handleChange}
                        type="number"
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.distance && touched.distance ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="lng"
                        label="Longitude"
                        placeholder="Enter Longitude"
                        value={values.lng}
                        onChange={handleChange}
                        type="number"
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.lng && touched.lng ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="lat"
                        label="Latitude"
                        placeholder="Enter Latitude"
                        value={values.lat}
                        onChange={handleChange}
                        type="number"
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.lat && touched.lat ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700">Sales Person</label>
                        <select
                          name="salesPersonID"
                          value={values.salesPersonID}
                          onChange={handleChange}
                          className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.salesPersonID && touched.salesPersonID ? 'border-red-500' : 'border-gray-300'}`}
                        >
                          <option value="">Select Sales Person</option>
                          {salesPersons.map((person) => (
                            <option value={person._id} key={person._id}>{person.name}</option>
                          ))}
                        </select>
                        {errors.salesPersonID && touched.salesPersonID && <div className="text-red-500 text-sm mt-1">{errors.salesPersonID}</div>}
                      </div>

                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700">Image</label>
                        <input
                          type="file"
                          name="image"
                          onChange={(e) => setFieldValue("image", e.currentTarget.files[0])}
                          className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.image && touched.image ? 'border-red-500' : 'border-gray-300'}`}
                        />
                      </div>
                    </div>

                    <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                      <div
                        onClick={() => { setIsAddRetailerFormVisible(false); setEditInitialValues(initialValues); }}
                        className="bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer"
                      >
                        Cancel
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </Form>
                );
              }}
            </Formik>
          </div>
        </div>
      )}

      {selectedUser && (
        <ClickOutside onClick={() => setSelectedUser(null)}>
          <div className={`fixed top-0 right-0 h-full w-[30%] bg-white shadow-lg transition-transform ${selectedUser ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className='flex flex-col h-full'>
              <div className='flex flex-col items-start relative flex-grow overflow-y-auto'>
                <h2 className='text-xl font-bold mb-4 px-4 py-2'>Details</h2>
                <img src={selectedUser.image ?? "placeholder.png"} alt="" className='w-20 h-20 rounded-full mb-4 ml-4' />
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <span className='font-bold'>{selectedUser.name}</span> <br />
                  <span className='font-bold text-[#FF5934]'>Retailer</span> <br />
                  <span className='text-gray-600'>{selectedUser.cityID?.name}</span>
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>Phone no:</strong> <br />{selectedUser.phoneNumber}
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>CNIC:</strong><br /> {selectedUser.cnic}
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>CNIC Front:</strong><br />
                  <div>
                    <img src={selectedUser.cnicFront} alt="" className='w-10 h-10 rounded-full mb-4 ml-4' />
                  </div>
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>CNIC Back:</strong><br />
                  <div>
                    <img src={selectedUser.cnicBack} alt="" className='w-10 h-10 rounded-full mb-4 ml-4' />
                  </div>
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>City:</strong> <br />{selectedUser.cityID?.name}
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>First Address:</strong> <br />{selectedUser.shopAddress1}
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>Second Address:</strong> <br />{selectedUser.shopAddress2}
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>Distance:</strong> <br />{selectedUser.distance}
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>Shop Category:</strong> <br />{selectedUser.shopCategory}
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                  <strong>Shop Name:</strong> <br />{selectedUser.shopName}
                </div>
                <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-4 w-full px-4'>
                  <strong>Sales Person:</strong> <br />{selectedUser.salesPersonID?.name}
                </div>
              </div>

              <div className='flex justify-center items-center w-full px-4 mb-2'>
                <button
                  onClick={() => setSelectedUser(null)}
                  className='text-[#FF5934] bg-[#FFD7CE] flex gap-2 w-full justify-center items-center p-2 rounded-xl'
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ClickOutside>
      )}

    </div>
  );
};

export default Retailers;