import { useRef, useState } from 'react';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useLocation } from 'react-router-dom';
import { Spinner } from '../components/common/spinner';


const LoadForm = () => {
	const htmlRef = useRef();
	const { state } = useLocation();
	const [loading, setLoading] = useState(false);

	const generatePDF = async () => {
		setLoading(true);
		const element = htmlRef.current;
		const canvas = await html2canvas(element);
		const imgData = canvas.toDataURL("image/png");
		const pdf = new jsPDF("p", "mm", "a4");
		const pdfWidth = pdf.internal.pageSize.getWidth();
		const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
		pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
		pdf.save("generated.pdf");
		setLoading(false);
	};

	const getTotalUnits = () => {
		let total = 0;
		state.orders.forEach((order) => {
			total += order.items.reduce((acc, item) => acc + item.quantity, 0);
		});
		return total;
	}

	return (
		<>
			<button disabled={loading} onClick={generatePDF} className='bg-orange-600 text-white rounded px-4 py-2'>{loading ? <Spinner /> : "Generate Form"}</button>
			<div className='p-2' ref={htmlRef}>
				<div className='border border-black p-4 rounded'>

					<div className="text-center font-extrabold text-xl">
						<h2>Load Form [ 3432423432 ] - Open</h2>
					</div>
					<div className="flex justify-between">
						<h6><strong>Deliveryman:</strong> Aziz Javed</h6>
						<h6><strong>For Date: </strong> 2024-10-03</h6>
					</div>
					<div className="flex justify-between">
						<h6><strong>PJP Name: </strong>Ali</h6>
						<h6><strong>PJP Date: </strong> 2024-10-03</h6>
					</div>
					<div className="flex justify-between">
						<h6><strong>Order Booker: </strong>Shafat Ali</h6>
						<h6><strong>Print Date: </strong> Friday, Octobor 4, 2024 12:45 PM</h6>
					</div>
					<div className='mt-3'>
						<table className='w-full border-collapse border border-black rounded'>
							<thead className='bg-blue-300'>
								<tr className='text-left  text-gray-500'>
									<td className='p-2 border border-black w-[30%]'>SKU</td>
									<td className='p-2 border border-black'>Sku Menufacturer Code</td>
									<td className='p-2 border border-black'>Issued Units</td>
									<td className='p-2 border border-black'>Issued Free Units</td>
									<td className='p-2 border border-black'>Units</td>
									<td className='p-2 border border-black'>Packet</td>
									<td className='p-2 border border-black'>Cartons</td>
									<td className='p-2 border border-black'>Units</td>
									<td className='p-2 border border-black'>Packet</td>
									<td className='p-2 border border-black'>Cartons</td>
									<td className='p-2 border border-black'>Sale</td>
								</tr>
							</thead>
							<tbody>
								{
									state.cats.map((it) => (
										<>
											<tr className='border-b cursor-pointer'>
												<td colSpan={11} className='p-2  bg-[#FFFFFF] border border-black text-blue-600'>
													{it.categoryName}
												</td>
											</tr>
											{
												it.items.map((prd) => (
													<tr key={prd.productId?._id} className='border-b cursor-pointer'>
														<td className='border border-black p-2 bg-[#FFFFFF] uppercase'>{prd.productId?.englishTitle}</td>
														<td className='border border-black p-2 bg-[#FFFFFF] uppercase'>123</td>
														<td className='border border-black p-2 bg-[#FFFFFF]'>{prd.quantity}</td>
														<td className='border border-black text-sm urdu bg-[#FFFFFF]'>-</td>
														<td className='border border-black p-2 bg-[#FFFFFF]'>-</td>
														<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
														<td className='border border-black p-2 bg-[#FFFFFF]'>-</td>
														<td className='border border-black p-2 bg-[#FFFFFF]'>-</td>
														<td className='border border-black p-2 bg-[#FFFFFF]'>-</td>
														<td className='border border-black p-2 bg-[#FFFFFF]'>-</td>
														<td className='border border-black p-2 bg-[#FFFFFF]'>{prd.price}</td>
													</tr>
												))
											}
										</>
									))
								}
							</tbody>
						</table>
					</div>
					<div className='mt-8'>
						<table className='w-full border-collapse border border-black rounded'>
							<thead className='bg-blue-300'>
								<tr className='text-left  text-gray-500'>
									<td className='p-2 border text-sm border-black'>S.No#</td>
									<td className='p-2 border text-sm border-black'>Invoice Number</td>
									<td className='p-2 border text-sm border-black w-[20%]'>Store Name / Owner Name</td>
									<td className='p-2 border text-sm border-black'>Order Booker</td>
									<td className='p-2 border text-sm border-black'>Status</td>
									<td className='p-2 border text-sm border-black'>Issued Units</td>
									<td className='p-2 border text-sm border-black'>Issued Free Units</td>
									<td className='p-2 border text-sm border-black'>Total Issued Units</td>
									<td className='p-2 border text-sm border-black'>(Resturned Extra) Units</td>
									<td className='p-2 border text-sm border-black'>Sale</td>
									<td className='p-2 border text-sm border-black'>Amount</td>
								</tr>
							</thead>
							<tbody>
								{
									state.orders.map((order, index) => (
										<tr key={order._id} className='border-b cursor-pointer'>
											<td className='border border-black p-2 bg-[#FFFFFF]'>{index + 1}</td>
											<td className='border border-black p-2 bg-[#FFFFFF] uppercase'>{order._id.toString().substring(1, 7)}</td>
											<td className='border border-black p-2 bg-[#FFFFFF]'>{order.RetailerUser?.name}</td>
											<td className='border border-black p-2 bg-[#FFFFFF]'>{order.SaleUser?.name}</td>
											<td className='border border-black p-2 bg-[#FFFFFF]'>open</td>
											<td className='border border-black text-sm urdu bg-[#FFFFFF]'>{order.items.reduce((acc, item) => acc + item.quantity, 0)}</td>
											<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
											<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
											<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
											<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
											<td className='border border-black p-2 bg-[#FFFFFF]'>{order.total}</td>
										</tr>
									))
								}

								<tr className='border-b cursor-pointer'>
									<td className='border border-black p-2 bg-[#FFFFFF]'></td>
									<td className='border border-black p-2 bg-[#FFFFFF] uppercase'></td>
									<td className='border border-black p-2 bg-[#FFFFFF]'></td>
									<td className='border border-black p-2 bg-[#FFFFFF]'></td>
									<td className='border border-black p-2 bg-[#FFFFFF]'>Total</td>
									<td className='border border-black text-sm urdu bg-[#FFFFFF]'>{getTotalUnits()}</td>
									<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
									<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
									<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
									<td className='border border-black p-2 bg-[#FFFFFF]'>0</td>
									<td className='border border-black p-2 bg-[#FFFFFF]'>{state.orders.reduce((acc, it) => acc + it.total, 0)}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div >
		</>
	);
};

export default LoadForm;
