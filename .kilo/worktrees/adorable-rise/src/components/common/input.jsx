/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import { useField, ErrorMessage } from "formik";
import { useEffect } from "react";

export const Input = (props) => {
	const [field, meta] = useField(props);
	useEffect(() => {
		props?.changeHandler?.(field.name, meta.value);
	}, [field.name, meta.value]);
	
	// Special handling for number inputs to allow decimal values with many digits
	const inputProps = { ...props };
	if (props.type === 'number') {
		// Remove the type="number" to allow any decimal format
		delete inputProps.type;
		// Add step="any" to allow any decimal value
		inputProps.step = 'any';
		// Use pattern to allow decimal numbers with up to 7 digits after decimal point
		inputProps.pattern = '[0-9]+(\\.[0-9]{1,7})?';
		// For price and purchase rate fields, ensure we don't restrict decimal places
		if (props.name === 'price' || props.name === 'purchaseRate') {
			// Allow any number of decimal places for price fields
			inputProps.pattern = '[0-9]+(\\.[0-9]+)?';
		}
	}
	
	return (
		<div>
			<input
				className={`${meta.error && "border-red-400"} p-2 bg-[#EEF0F6] mt-3 w-full border outline-none rounded-lg`}
				{...field}
				{...inputProps}
			/>
			<ErrorMessage
				name={field.name}
				component="div"
				className="text-red-600"
			/>
		</div>
	);
};
