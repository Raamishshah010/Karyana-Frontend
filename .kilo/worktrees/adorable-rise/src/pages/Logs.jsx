import React, { useState } from 'react';
import { BsToggle2Off, BsToggle2On } from 'react-icons/bs';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";

const Logs = () => {
  const [products, setProducts] = useState([
    {
      id: '1',
      user: 'John Doe',
      role: 'Admin',
      detail: 'Wheat and grain',
      createdDate: '2024-08-01',
      active: false,
      adminVerify: true,
    },
  ]);

  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <div className='relative'>
      <div className='flex justify-between mt-3'>
        <h1 className='text-xl font-bold'>Logs</h1>
        <div className='flex gap-7'>
          <input className='p-2 border' type='search' name='search' placeholder='Search by title, id...' />
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full'>
          <thead>
            <tr className='text-left'>
              <th>ID</th>
              <th>User</th>
              <th>Role</th>
              <th>Detail</th>
              <th>Date</th>
              <th>Active</th>
              <th>Admin Verified</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={index} className='border-b cursor-pointer' onClick={() => setSelectedProduct(product)}>
                <td className='p-2'>{product.id}</td>
                <td className='p-2'>{product.user}</td>
                <td className='p-2'>{product.role}</td>
                <td className='p-2'>{product.detail}</td>
                <td className='p-2'>{product.createdDate}</td>
                <td className='p-2 text-2xl'>{product.active ? <PiToggleRightFill /> : <PiToggleLeftFill />}</td>
                <td className='p-2 text-2xl'>{product.adminVerify ? <PiToggleRightFill/> : <PiToggleLeftFill />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={`fixed top-0 right-0 h-full w-[35%] bg-white p-4 shadow-lg transition-transform ${
          selectedProduct ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedProduct && (
          <div className='flex flex-col justify-center items-center'>
            <h2 className='text-xl font-bold mb-4'>Log Details</h2>
            <div className='mb-2'>
              <strong>ID:</strong> {selectedProduct.id}
            </div>
            <div className='mb-2'>
              <strong>User:</strong> {selectedProduct.user}
            </div>
            <div className='mb-2'>
              <strong>Role:</strong> {selectedProduct.role}
            </div>
            <div className='mb-2'>
              <strong>Detail:</strong> {selectedProduct.detail}
            </div>
            <div className='mb-2'>
              <strong>Created Date:</strong> {selectedProduct.createdDate}
            </div>
            <div className='mb-2'>
              <strong>Active:</strong> {selectedProduct.active ? 'Yes' : 'No'}
            </div>
            <div className='mb-2'>
              <strong>Admin Verified:</strong> {selectedProduct.adminVerify ? 'Yes' : 'No'}
            </div>
            <button onClick={() => setSelectedProduct(null)} className='bg-gray-300 p-2 rounded mt-4'>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logs;
