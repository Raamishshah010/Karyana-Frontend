/* eslint-disable react/prop-types */
import { useField, ErrorMessage } from "formik";
import { useEffect } from "react";

export const Textarea = (props) => {
	const [field, meta] = useField(props);
	useEffect(() => {
		props.changeHandler?.(field.name, meta.value);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [field.name, meta.value]);
	return (
		<div>
			<textarea
				rows="4"
				className={`${meta.error && "border-red-400"} my-2 block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500`}
				{...field}
				{...props}
			/>
			<ErrorMessage
				name={field.name}
				component="div"
				className="text-red-600"
			/>
		</div>
	);
};
