import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Form, Formik } from 'formik';
import * as yup from 'yup';
import {
  MdArrowBack, MdAdd, MdEdit, MdAccountBalance,
  MdBusiness, MdAttachMoney, MdArticle, MdCalendarToday, MdExpandMore,
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import { Spinner } from '../components/common/spinner';
import { Loader } from '../components/common/loader';
import {
  getAllBanks, getAllPurchases,
  createPayment, updatePayment, getPaymentById,
} from '../APIS';

const ACCENT = '#FF5934';

const inputCls =
  'bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300';

const selectCls =
  'bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all appearance-none cursor-pointer';

const FieldGroup = ({ icon: Icon, label, error, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
      {Icon && <Icon size={12} style={{ color: ACCENT }} />}
      {label}
    </label>
    {children}
    {error && <p className="text-red-400 text-[11px] mt-1">{error}</p>}
  </div>
);

const validationSchema = yup.object().shape({
  supplier:    yup.string().required('Supplier is required'),
  bank:        yup.string().required('Bank is required'),
  amount:      yup.number().typeError('Must be a number').positive('Must be greater than 0').required('Amount is required'),
  description: yup.string(),
  date:        yup.string().required('Date is required'),
});

const todayISO = () => new Date().toISOString().slice(0, 10);

const AddPayments = () => {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const token         = useSelector(s => s.admin.token);
  const editId        = searchParams.get('edit');
  const isEdit        = !!editId;

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [banks, setBanks]             = useState([]);
  const [suppliers, setSuppliers]     = useState([]);

  const [initialValues, setInitialValues] = useState({
    supplier:    '',
    bank:        '',
    amount:      '',
    description: '',
    date:        todayISO(),
  });

  // ── Load banks, suppliers, and existing payment if editing ──
  useEffect(() => {
    const init = async () => {
      try {
        setPageLoading(true);

        const [banksRes, suppliersRes] = await Promise.all([
          getAllBanks(),
          getAllPurchases(),
        ]);

        const bankList = Array.isArray(banksRes.data?.data)
          ? banksRes.data.data
          : Array.isArray(banksRes.data) ? banksRes.data : [];

        const supplierList = Array.isArray(suppliersRes.data?.data)
          ? suppliersRes.data.data
          : Array.isArray(suppliersRes.data) ? suppliersRes.data : [];

        setBanks(bankList);
        setSuppliers(supplierList);

        // If editing, fetch existing payment data
        if (isEdit) {
          const paymentRes = await getPaymentById(editId);
          const p = paymentRes.data?.data || paymentRes.data;
          if (p) {
            setInitialValues({
              supplier:    p.supplier?._id || p.supplier || '',
              bank:        p.bank?._id     || p.bank     || '',
              amount:      p.amount        || '',
              description: p.description   || '',
              date:        p.date
                ? new Date(p.date).toISOString().slice(0, 10)
                : todayISO(),
            });
          }
        }
      } catch (err) {
        toast.error('Failed to load form data');
        console.error(err);
      } finally {
        setPageLoading(false);
      }
    };
    init();
  }, [editId, isEdit]);

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (isEdit) {
        await updatePayment(editId, values, token);
        toast.success('Payment updated successfully.');
      } else {
        await createPayment(values, token);
        toast.success('Payment created successfully.');
      }
      navigate('/Purchase/Payments');
    } catch (err) {
      toast.error(err.response?.data?.msg || err.message || 'Failed to save payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) return <Loader />;

  // Find selected bank to show balance hint
  const getSelectedBank = (bankId) => banks.find(b => b._id === bankId);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .ap-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .ap-select-wrap { position: relative; }
        .ap-select-wrap select { -webkit-appearance: none; appearance: none; }
        @keyframes apIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .ap-card { animation: apIn 0.3s cubic-bezier(0.34,1.1,0.64,1); }
      `}</style>

      <div className="ap-page min-h-screen bg-gray-50">

        {/* ── Top Bar ── */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/Purchase/Payments')}
                className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 transition-colors"
              >
                <MdArrowBack size={17} />
              </button>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">Payments</p>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  {isEdit ? 'Edit Payment' : 'Add Payment'}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* ── Form ── */}
        <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-6">
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
            enableReinitialize
          >
            {({ values, errors, touched, setFieldValue }) => (
              <Form className="flex flex-col gap-5">

                {/* ── Main Card ── */}
                <div className="ap-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  {/* Card Header */}
                  <div
                    className="relative px-6 pt-5 pb-10 overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff8c6b)` }}
                  >
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                      }}
                    />
                    <div className="relative">
                      <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">
                        {isEdit ? 'Editing Payment' : 'New Payment'}
                      </p>
                      <h2 className="text-white text-xl font-bold">
                        {isEdit ? 'Update Payment Details' : 'Add New Payment'}
                      </h2>
                      <p className="text-white/60 text-xs mt-1">
                        Payment will be deducted from the selected bank account
                      </p>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="px-6 pt-7 pb-6 flex flex-col gap-5 -mt-5">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-5 flex flex-col gap-4">

                      {/* Supplier */}
                      <FieldGroup
                        icon={MdBusiness}
                        label="Supplier"
                        error={errors.supplier && touched.supplier ? errors.supplier : null}
                      >
                        <div className="ap-select-wrap">
                          <select
                            value={values.supplier}
                            onChange={e => setFieldValue('supplier', e.target.value)}
                            className={selectCls + (errors.supplier && touched.supplier ? ' border-red-300' : '')}
                          >
                            <option value="">Select supplier…</option>
                            {suppliers.map(s => (
                              <option key={s._id} value={s._id}>{s.companyName}</option>
                            ))}
                          </select>
                          <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                        </div>
                      </FieldGroup>

                      {/* Bank */}
                      <FieldGroup
                        icon={MdAccountBalance}
                        label="Bank"
                        error={errors.bank && touched.bank ? errors.bank : null}
                      >
                        <div className="ap-select-wrap">
                          <select
                            value={values.bank}
                            onChange={e => setFieldValue('bank', e.target.value)}
                            className={selectCls + (errors.bank && touched.bank ? ' border-red-300' : '')}
                          >
                            <option value="">Select bank…</option>
                            {banks.map(b => (
                              <option key={b._id} value={b._id}>{b.bankName}</option>
                            ))}
                          </select>
                          <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                        </div>

                        {/* Bank balance hint */}
                        {values.bank && (() => {
                          const bank = getSelectedBank(values.bank);
                          if (!bank) return null;
                          return (
                            <div className="flex items-center justify-between mt-2 px-3 py-2 bg-[#F9FAFB] rounded-xl border border-gray-100">
                              <span className="text-[11px] text-[#9CA3AF] font-semibold">Available Balance</span>
                              <span className={`text-[12px] font-bold ${bank.balance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                PKR {Number(bank.balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          );
                        })()}
                      </FieldGroup>

                      {/* Amount + Date side by side */}
                      <div className="grid grid-cols-2 gap-3">
                        <FieldGroup
                          icon={MdAttachMoney}
                          label="Amount (PKR)"
                          error={errors.amount && touched.amount ? errors.amount : null}
                        >
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={values.amount}
                            onChange={e => setFieldValue('amount', e.target.value)}
                            placeholder="0.00"
                            className={inputCls + (errors.amount && touched.amount ? ' border-red-300' : '')}
                          />
                          {/* Warn if amount exceeds bank balance */}
                          {values.bank && values.amount && (() => {
                            const bank = getSelectedBank(values.bank);
                            if (bank && Number(values.amount) > bank.balance) {
                              return (
                                <p className="text-amber-500 text-[11px] mt-1">
                                  ⚠ Exceeds bank balance
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </FieldGroup>

                        <FieldGroup
                          icon={MdCalendarToday}
                          label="Date"
                          error={errors.date && touched.date ? errors.date : null}
                        >
                          <input
                            type="date"
                            value={values.date}
                            onChange={e => setFieldValue('date', e.target.value)}
                            className={inputCls + (errors.date && touched.date ? ' border-red-300' : '')}
                          />
                        </FieldGroup>
                      </div>

                      {/* Description */}
                      <FieldGroup icon={MdArticle} label="Description">
                        <textarea
                          value={values.description}
                          onChange={e => setFieldValue('description', e.target.value)}
                          placeholder="Payment description or notes…"
                          rows={3}
                          className={inputCls + ' resize-none'}
                        />
                      </FieldGroup>

                    </div>
                  </div>
                </div>

                {/* ── Summary strip (shows when amount + bank are filled) ── */}
                {values.bank && values.amount && values.supplier && (() => {
                  const bank     = getSelectedBank(values.bank);
                  const supplier = suppliers.find(s => s._id === values.supplier);
                  const newBal   = (bank?.balance || 0) - Number(values.amount);
                  return (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">Payment Summary</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Supplier',       value: supplier?.companyName || '—' },
                          { label: 'Bank',            value: bank?.bankName || '—' },
                          { label: 'Payment Amount',  value: `PKR ${Number(values.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` },
                          { label: 'Balance After',   value: `PKR ${newBal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, color: newBal < 0 ? 'text-red-500' : 'text-emerald-600' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-[#F9FAFB] rounded-xl px-3 py-2.5 border border-gray-100">
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                            <p className={`text-[13px] font-semibold truncate ${color || 'text-[#111827]'}`}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Actions ── */}
                <div className="flex gap-3 pb-8">
                  <button
                    type="button"
                    onClick={() => navigate('/Purchase/Payments')}
                    className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-11 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-lg shadow-orange-100"
                    style={{ background: ACCENT }}
                  >
                    {submitting
                      ? <><Spinner /> Saving…</>
                      : isEdit
                        ? <><MdEdit size={16} /> Update Payment</>
                        : <><MdAdd size={16} /> Save Payment</>
                    }
                  </button>
                </div>

              </Form>
            )}
          </Formik>
        </div>

      </div>
    </>
  );
};

export default AddPayments;