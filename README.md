# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh



{isFormVisible && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[350px] max-h-[90vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Add Sales</h2>
            </div>
            <Formik
              initialValues={newSalesPerson}
              validationSchema={validations}
              onSubmit={handleSubmit}
            >
              {() => (
                <Form className='overflow-x-hidden overflow-y-auto scrollbar-hide'>
                  <h6 className='font-semibold p-6 mb-2'>Profile Image</h6>
                  <div className='px-6'>

                    <div className='relative h-[200px] flex border border-gray-300 border-dotted flex-col justify-center items-center p-4 rounded-lg mb-4'>
                      {newSalesPerson.image ? (
                        <img
                          src={newSalesPerson.image}
                          alt='Preview'
                          className='w-20 h-20 rounded-full cursor-pointer object-cover mb-4'
                        />
                      ) : (
                        <img
                          src="/Avatar.svg"
                          alt='Default Avatar'
                          className='w-20 h-20 mt-2 rounded-full cursor-pointer object-cover mb-4'
                        />
                      )}

                      {imageLoading ?
                        <Spinner />
                        : (
                          <>
                            <DragNdrop onFilesSelected={fileUploadHandler} width="300px" height='100%' />

                          </>
                        )}
                    </div>

                    <Input
                      name="name"
                      label="Name"
                      placeholder="Name"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />

                    <Input
                      name="phone"
                      placeholder="Phone"
                      label="Phone"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'
                    />
                    <Input
                      name="balance"
                      placeholder="Balance"
                      label="Balance"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />
                    <Input
                      name="lastPayment"
                      placeholder="Last Payment"
                      label="Last Payment"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />

                  </div>
                  <div className='flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6'>
                    <div
                      onClick={() => {
                        setImageLoading(false);
                        setFormVisible(false);
                      }}
                      className='bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer'
                    >
                      Cancel
                    </div>
                    <button
                      type="submit"
                      className='bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg'
                    >
                      Save
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}



This is the code that is cut form add product form: 
 <div className="form-check space-x-3 form-switch my-2 product-checkbox">
                      <input
                        className="form-checkbox h-5 w-5"
                        type="checkbox"
                        name="includeBulkOrder"
                        onChange={(e) => setState((p) => ({ ...p, includeBulkOrder: e.target.checked }))}
                        checked={state.includeBulkOrder}
                      />
                      <label className="form-check-label" htmlFor="includeBulkOrder">Include Bulk Order</label>
                    </div>
                    {
                      state.includeBulkOrder && (
                        <div className="my-2">
                          <div className="flex flex-shrink-0 gap-2">
                            <div className="w-full ">
                              <input
                                className="form-input rounded p-2 text-center bg-[#EEF0F6] w-full"
                                placeholder="Quantity"
                                value={bulkOrder.quantity}
                                onChange={(e) => setBulkOrder((p) => ({ ...p, quantity: e.target.value }))}
                              />
                            </div>
                            <div className="w-full flex justify-center items-center p-2 bg-[#EEF0F6] rounded ">
                              <input
                                className="form-input bg-transparent w-full"
                                placeholder="Amount"
                                type="number"
                                value={bulkOrder.amount}
                                min={1}
                                onChange={(e) => {
                                  if (parseInt(e.target.value) > 0) {
                                    setBulkOrder((p) => ({ ...p, amount: e.target.value }))
                                  } else {
                                    setBulkOrder((p) => ({ ...p, amount: 1 }))
                                  }
                                }}
                              />
                            </div>
                            <div className="w-full md:w-1/6 flex justify-center items-center" onClick={bulkOrderHandler}>
                              <CiCirclePlus style={{ fontSize: "30px", cursor: "pointer" }} />
                            </div>
                          </div>
                        </div>
                      )
                    }
                    {
                      state.bulkOrders.length ? (
                        <div className="flex flex-wrap items-center gap-2 my-3">
                          {state.bulkOrders.map((it, index) => (
                            <div
                              key={it.quantity}
                              className="card  flex items-center gap-3 p-2 overflow-x-auto  bg-[#e3dfdf]"
                            >
                              <div className="flex items-center gap-4">

                                <span className='text-wrap'>
                                  {"Quantity: " + it.quantity}
                                </span>
                                <strong className='text-wrap'>
                                  {"Amount: " + it.amount}
                                </strong>

                              </div>
                              <span
                                className='text-red-500 cursor-pointer'
                                onClick={() => deleteBulkOrderItem(index)}>
                                <RxCross2 />
                              </span>
                              <span
                                className='text-teal-600 cursor-pointer'
                                onClick={() => editBuolOrderItem(index)}>
                                <FaEdit />
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null
                    }
                    <div className="form-check space-x-3 form-switch my-2 product-checkbox">
                      <input
                        className="form-checkbox h-5 w-5"
                        type="checkbox"
                        name="isDiscounted"
                        onChange={(e) => setState((p) => ({ ...p, isDiscounted: e.target.checked }))}
                        checked={state.isDiscounted}
                      />
                      <label className="form-check-label" htmlFor="isDiscounted">Apply Discount</label>
                    </div>
                    {
                      state.isDiscounted && (
                        <div className="my-2">
                          <div className="flex gap-2 flex-shrink-0 justify-center items-center">
                            <div className="w-full">
                              <input
                                className="form-input  rounded p-2 bg-[#EEF0F6] w-full"
                                placeholder="Discount"
                                type="number"
                                value={state.discount}
                                min={1}
                                max={100}
                                onChange={(e) => {
                                  if (parseInt(e.target.value) > 0) {
                                    if (parseInt(e.target.value) > 100) {
                                      toast.error("Discound should be less than 100")
                                    } else {
                                      setState((p) => ({ ...p, discount: e.target.value }))
                                    }
                                  } else {
                                    setState((p) => ({ ...p, discount: 1 }))
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    }