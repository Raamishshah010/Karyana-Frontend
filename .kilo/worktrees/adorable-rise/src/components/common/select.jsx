/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import { useField, ErrorMessage } from "formik";
import { useEffect, useState, useRef } from "react";

export const Select = (props) => {
	const [field, meta, helpers] = useField(props);
	// Track if the component has been initialized with a value
	const [initialized, setInitialized] = useState(false);
	// Track if we've logged debug info
	const [loggedDebug, setLoggedDebug] = useState(false);
	
	// Debug the component props on mount
	useEffect(() => {
		if (props.name === 'brandID' || props.name === 'categoryID') {
			console.log(`${props.name} Select mounted with:`, {
				value: props.value,
				dataLength: props.data?.length || 0,
				fieldValue: field.value
			});
		}
	}, []);

	// Handle external value changes (like when editing a product)
	useEffect(() => {
		// If props.value exists, always set it (even if already initialized)
		if (props.value) {
			console.log(`Setting ${props.name} value to:`, props.value);
			// Set the field value to match the external value
			helpers.setValue(props.value);
			setInitialized(true);
			
			// For brand selection, ensure we're tracking that this is an initial value
			if (props.name === 'brandID') {
				isInitialValueSet.current = true;
				setLoggedDebug(true);
			}
		}
	}, [props.value, helpers, props.name, loggedDebug]);

	// Re-check when data changes (important for dropdowns that load data asynchronously)
	useEffect(() => {
		if (props.data && props.data.length > 0) {
			// Special handling for brand and category selection
			if (props.name === 'brandID' || props.name === 'categoryID') {
				console.log(`${props.name} data loaded:`, props.data.length, 'items');
				
				// When data loads and we have a value, make sure it's set
				if (props.value) {
					console.log(`Checking if ${props.value} exists in ${props.name} data`);
					
					// Verify the value exists in the data
					const valueExists = props.data.some(item => {
						// Check _id first (this is most likely what you need)
						if (item._id && item._id === props.value) {
							console.log(`Found matching ${props.name} with _id:`, item._id);
							return true;
						}
						
						// Check for direct match on searchKey
						if (item[props.searchKey] === props.value) {
							console.log(`Found matching ${props.name} with ${props.searchKey}:`, item[props.searchKey]);
							return true;
						}
						
						return false;
					});
					
					if (valueExists) {
						// Ensure the value is set and mark as initial value to prevent changeHandler
						helpers.setValue(props.value);
						isInitialValueSet.current = true;
					} else {
						console.log(`Warning: ${props.name} value ${props.value} not found in data`);
					}
				}
			} else if (props.value) {
				// For other fields, just set the value
				helpers.setValue(props.value);
			}
		}
	}, [props.data, props.value, props.searchKey, props.name, helpers]);

	const isFirstRender = useRef(true);

	// Track if this is an initial value set from props or a user change
	const isInitialValueSet = useRef(props.value ? true : false);

	useEffect(() => {
		// Skip the first render to prevent resetting values
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}

		// Skip calling changeHandler when the value is being set from props
		// This prevents the brand from being reset when editing
		if (isInitialValueSet.current) {
			isInitialValueSet.current = false;
			return;
		}

		// Only call changeHandler for user-initiated changes
		props.changeHandler?.(field.name, meta.value);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [meta.value]);

	return (
		<>
			<select
			key={`${props.name}-${field.value || props.value}-${props.data?.length || 0}`}
			className={`${meta.error ? "border-red-400" : "border-gray-300"} my-2 bg-gray-50 border text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500`}
			{...field}
			{...props}
			value={field.value || props.value || ''}
			onChange={(e) => {
				// Handle the change event
				field.onChange(e);
				
				// Log the change for debugging
				if (props.name === 'brandID' || props.name === 'categoryID') {
					console.log(`${props.name} changed to:`, e.target.value);
				}
			}}
		>
				<option value="" disabled>Search {props.label}</option>
				{props.data.map((e, i) => {
					// Determine the correct value to use for the option
					let optionValue = e[props.searchKey]; // Default to searchKey
					let displayValue = e[props.searchValue];
					
					// For brand and category selection, always use _id as the value
					if (props.name === 'brandID') {
						// Always use _id for consistency
						optionValue = e._id;
						// Ensure we have a display value
						displayValue = e.englishName || e.name || e.brandName || optionValue;
					} else if (props.name === 'categoryID') {
						// Always use _id for consistency
						optionValue = e._id;
						// Ensure we have a display value
						displayValue = e.englishName || e.name || e.categoryName || optionValue;
					}
					
					return (
						<option 
							key={i} 
							value={optionValue}
						>
							{displayValue}
						</option>
					);
				})}
			</select>
			<ErrorMessage
				name={field.name}
				component="div"
				className="text-red-600"
			/>
		</>
	);
};