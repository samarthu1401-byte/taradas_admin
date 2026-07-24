import { useState, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useLivePrice } from '../context/LivePriceContext';
import {
  Search, Calendar, DollarSign, CheckCircle2, User, CreditCard,
  TrendingUp, Printer, Banknote, Clock, Coins, X, Check, Copy, History, AlertCircle
} from 'lucide-react';
import { schemeService } from '../services/schemeService';
import PageLead from '../components/PageLead';

// Safe date & time formatting helpers
const formatTimeSafe = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatDateSafe = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

// Calculate next due date info for a scheme
const getNextDueDateInfo = (scheme, actualPaid) => {
  if (!scheme) return { dueDateIso: '', dueDateDisplay: 'N/A', isOverdue: false };
  let startDate = new Date();
  if (scheme.enrolled_date || scheme.startDate) {
    const parsed = new Date(scheme.enrolled_date || scheme.startDate);
    if (!isNaN(parsed.getTime())) startDate = parsed;
  }
  const nextInstIndex = actualPaid; // 0-indexed for next unpaid
  const dueDate = new Date(startDate);
  if (scheme.scheme_type === 'DAILY') dueDate.setDate(dueDate.getDate() + nextInstIndex);
  else if (scheme.scheme_type === 'WEEKLY') dueDate.setDate(dueDate.getDate() + nextInstIndex * 7);
  else dueDate.setMonth(dueDate.getMonth() + nextInstIndex);

  dueDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const iso = dueDate.toISOString().split('T')[0];
  const display = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return {
    dueDateIso: iso,
    dueDateDisplay: display,
    isOverdue: dueDate < today,
  };
};

// Calculate payable installments strictly due ON OR BEFORE TODAY (present day)
const getPayableInstallmentsTillToday = (scheme, actualPaid = 0) => {
  if (!scheme) return [];
  const list = [];
  const total = scheme.total_installments || 11;
  const paid = typeof actualPaid === 'number' ? actualPaid : (scheme.installments_paid || 0);

  let startDate = new Date();
  if (scheme.enrolled_date || scheme.startDate) {
    const parsed = new Date(scheme.enrolled_date || scheme.startDate);
    if (!isNaN(parsed.getTime())) startDate = parsed;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999); // Strict end of today (present day)

  for (let i = paid + 1; i <= total; i++) {
    const k = i - 1; // 0-based offset
    const dueDate = new Date(startDate);

    if (scheme.scheme_type === 'DAILY') dueDate.setDate(dueDate.getDate() + k);
    else if (scheme.scheme_type === 'WEEKLY') dueDate.setDate(dueDate.getDate() + k * 7);
    else dueDate.setMonth(dueDate.getMonth() + k);

    dueDate.setHours(0, 0, 0, 0);

    // STRICT FILTER: ONLY include if due date is ON OR BEFORE PRESENT DAY (TODAY)
    if (dueDate <= today) {
      list.push({
        installmentNumber: i,
        dueDateIso: dueDate.toISOString().split('T')[0],
        dueDateDisplay: dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        amount: scheme.installment_amount || 0,
      });
    } else {
      // Due date is in the future (e.g. tomorrow / 25th) -> STOP AND DO NOT ALLOW
      break;
    }
  }

  return list;
};

export default function AcceptCash() {
  const adminContext = useAdmin() || {};
  const { customers = [], showToast = () => {}, refreshCustomers } = adminContext;
  const livePriceContext = useLivePrice() || {};
  const { prices = {} } = livePriceContext;

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [customerSchemes, setCustomerSchemes] = useState([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [collectionDate, setCollectionDate] = useState(getTodayStr());
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState(null);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  const users = Array.isArray(customers) ? customers : [];
  const selectedScheme = customerSchemes.find(s => s._id === selectedSchemeId);

  // Live Gold Rates
  const goldRate24k = prices?.gold24k?.price || 7200;
  const goldRate22k = prices?.gold22k?.price || 6600;
  const goldRate18k = prices?.gold18k?.price || 5400;

  const getGoldRateForKarat = (karat) => {
    if (karat === '18K') return goldRate18k;
    if (karat === '22K') return goldRate22k;
    return goldRate24k;
  };

  // Helper to compute actual paid count for a scheme
  const getActualPaidCount = (scheme, user) => {
    if (!scheme) return 0;
    let countFromProp = Number(scheme.installments_paid ?? scheme.installmentsPaid ?? 0);
    let countFromTx = 0;
    if (user?.wallet?.transactions) {
      const txs = Array.isArray(user.wallet.transactions) ? user.wallet.transactions : [];
      countFromTx = txs.filter(tx =>
        tx && tx.type === 'credit' && (tx.status === 'SUCCESS' || !tx.status) &&
        (tx.customer_scheme_id === scheme._id || (scheme.scheme_name && tx.desc?.includes(scheme.scheme_name)))
      ).length;
    }
    return Math.max(countFromProp, countFromTx);
  };

  // Search Suggestions
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return users.filter(u =>
      u && (
        u.userId?.toLowerCase().includes(q) ||
        u.customerId?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.phoneNumber?.includes(q)
      )
    ).slice(0, 5);
  }, [searchQuery, users]);

  // Today's collections stats
  const collectionStats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-IN');
    let totalCash = 0;
    let count = 0;
    let recentTxList = [];

    users.forEach(u => {
      if (!u) return;
      const txs = Array.isArray(u.wallet?.transactions) ? u.wallet.transactions : [];
      txs.forEach(tx => {
        if (tx && tx.type === 'credit' && (tx.status === 'SUCCESS' || !tx.status)) {
          let txDateStr = '';
          try {
            const d = new Date(tx.date || Date.now());
            txDateStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN');
          } catch {
            txDateStr = '';
          }

          if (txDateStr === todayStr || !tx.date) {
            const amountNum = Number(tx.amount || 0);
            totalCash += amountNum;
            count += 1;
            recentTxList.push({
              customerName: u.name || 'Customer',
              customerId: u.customerId || u.userId || '',
              amount: amountNum,
              date: tx.date || new Date().toISOString(),
              desc: tx.desc || 'Cash Collection',
            });
          }
        }
      });
    });

    recentTxList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { totalCash, count, recentTxs: recentTxList.slice(0, 5) };
  }, [users]);

  // Select Customer
  const selectCustomer = async (user) => {
    if (!user) return;
    setSelectedUser(user);
    setSearchQuery(user.name || user.customerId || '');
    setShowSearchDropdown(false);
    setInstallmentsCount(1);

    try {
      let fetchedSchemes = [];
      try {
        fetchedSchemes = await schemeService.getCustomerSchemes(user.userId || user.customerId);
      } catch (err) {
        console.warn('Backend schemes fetch failed, falling back to local wallet:', err);
      }

      if ((!fetchedSchemes || fetchedSchemes.length === 0) && user.wallet?.activeSchemes) {
        fetchedSchemes = user.wallet.activeSchemes.map(s => ({
          _id: s.id || s._id,
          scheme_id: s.schemeId || s.scheme_id,
          scheme_name: s.name || s.scheme_name || 'Gold Savings Scheme',
          scheme_type: s.schemeType || s.scheme_type || 'MONTHLY',
          gold_carat: s.goldCarat || s.gold_carat || '24K',
          installment_amount: Number(s.installmentAmount ?? s.installment_amount ?? 0),
          installments_paid: Number(s.installmentsPaid ?? s.installments_paid ?? 0),
          total_installments: Number(s.totalInstallments ?? s.total_installments ?? 11),
          total_paid_amount: Number(s.totalPaid ?? s.total_paid_amount ?? 0),
          total_gold_grams: Number(s.totalGoldGrams ?? s.total_gold_grams ?? 0),
          enrolled_date: s.startDate || s.enrolled_date || new Date().toISOString(),
          status: s.status ? String(s.status).toUpperCase() : 'ACTIVE',
        }));
      }

      const normalizedSchemes = (fetchedSchemes || [])
        .map(s => {
          const paidCount = getActualPaidCount(s, user);
          return {
            ...s,
            installment_amount: Number(s.installment_amount ?? s.installmentAmount ?? 0),
            installments_paid: paidCount,
            total_installments: Number(s.total_installments ?? s.totalInstallments ?? 11),
            scheme_type: s.scheme_type ?? s.schemeType ?? 'MONTHLY',
            gold_carat: s.gold_carat ?? s.goldCarat ?? '24K',
            total_paid_amount: Number(s.total_paid_amount ?? s.totalPaid ?? 0),
            total_gold_grams: Number(s.total_gold_grams ?? s.totalGoldGrams ?? 0),
            enrolled_date: s.enrolled_date || s.startDate || new Date().toISOString(),
            status: (s.status || 'ACTIVE').toUpperCase(),
          };
        })
        .filter(s => (s.status === 'ACTIVE' || s.status === 'MISSED PAYMENT') && s.installments_paid < s.total_installments);

      setCustomerSchemes(normalizedSchemes);
      setSelectedSchemeId(normalizedSchemes[0]?._id || '');

      if (normalizedSchemes.length === 0) {
        showToast(`Customer ${user.name || ''} has no active scheme with pending installments`, 'info');
      }
    } catch (error) {
      showToast(error?.errors?.[0]?.message || error.message || 'Unable to load customer schemes', 'error');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchSuggestions.length > 0) {
      selectCustomer(searchSuggestions[0]);
    } else {
      const q = searchQuery.trim().toLowerCase();
      const user = users.find(u =>
        u && (
          u.userId?.toLowerCase() === q ||
          u.customerId?.toLowerCase() === q ||
          u.name?.toLowerCase().includes(q) ||
          u.phone === q ||
          u.phoneNumber?.includes(q)
        )
      );
      if (user) selectCustomer(user);
      else showToast('Customer not found', 'error');
    }
  };

  // Calculations for selected scheme
  const actualPaid = selectedScheme ? getActualPaidCount(selectedScheme, selectedUser) : 0;
  
  // Filtered installments strictly due ON OR BEFORE TODAY
  const payableTillTodayList = useMemo(() => {
    return selectedScheme ? getPayableInstallmentsTillToday(selectedScheme, actualPaid) : [];
  }, [selectedScheme, actualPaid]);

  const currentRate = selectedScheme ? getGoldRateForKarat(selectedScheme.gold_carat) : 7200;
  const singleInstAmount = selectedScheme ? selectedScheme.installment_amount : 0;
  const totalAmountDue = singleInstAmount * (payableTillTodayList.length > 0 ? installmentsCount : 0);
  const totalGoldGrams = currentRate > 0 ? (totalAmountDue / currentRate).toFixed(4) : '0.0000';
  const dueDateInfo = selectedScheme ? getNextDueDateInfo(selectedScheme, actualPaid) : null;

  // Selected Installment Due Dates List
  const selectedDueDates = useMemo(() => {
    if (!payableTillTodayList || payableTillTodayList.length === 0) return [];
    const validCount = Math.min(installmentsCount, payableTillTodayList.length);
    return payableTillTodayList.slice(0, validCount).map(item => item.dueDateDisplay);
  }, [payableTillTodayList, installmentsCount]);

  const coveredDatesText = useMemo(() => {
    if (selectedDueDates.length === 0) return 'None';
    if (selectedDueDates.length === 1) return selectedDueDates[0];
    if (selectedDueDates.length === 2) return `${selectedDueDates[0]} & ${selectedDueDates[1]}`;
    return `${selectedDueDates[0]} to ${selectedDueDates[selectedDueDates.length - 1]}`;
  }, [selectedDueDates]);

  // Previous payments for selected customer
  const previousPayments = useMemo(() => {
    if (!selectedUser || !selectedUser.wallet) return [];
    const txs = Array.isArray(selectedUser.wallet.transactions) ? selectedUser.wallet.transactions : [];
    return txs.filter(tx => tx && (tx.type === 'credit' || tx.assetAdded === 'inr'))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedUser]);

  // Handle Cash Collection Approval
  const handleCollect = async (e) => {
    e.preventDefault();
    if (!selectedScheme || !selectedUser || payableTillTodayList.length === 0) return;

    setProcessing(true);

    try {
      let gramsAllocatedTotal = 0;

      for (let i = 0; i < installmentsCount; i++) {
        let installment = null;
        try {
          installment = await schemeService.collectCashInstallment(selectedScheme._id, collectionDate);
        } catch (err) {
          console.warn('Backend cash collect skipped, processing locally:', err);
        }
        const grams = installment?.grams_allocated ? Number(installment.grams_allocated) : (singleInstAmount / currentRate);
        gramsAllocatedTotal += grams;
      }

      const dateFormatted = collectionDate || getTodayStr();
      let isoDate = new Date().toISOString();
      try {
        const d = new Date(dateFormatted);
        if (!isNaN(d.getTime())) isoDate = d.toISOString();
      } catch {
        isoDate = new Date().toISOString();
      }

      const addedPaid = actualPaid + installmentsCount;

      // Persist to local payments cache so page refreshes retain paid state
      try {
        const localPayments = JSON.parse(localStorage.getItem('taradas_local_payments') || '[]');
        for (let i = 0; i < installmentsCount; i++) {
          localPayments.push({
            customerSchemeId: selectedScheme._id,
            customerId: selectedUser.userId || selectedUser.customerId,
            amount: singleInstAmount,
            date: isoDate,
            paymentDate: collectionDate,
          });
        }
        localStorage.setItem('taradas_local_payments', JSON.stringify(localPayments));
      } catch (e) {
        console.warn('LocalStorage payment persist error:', e);
      }

      // Update local state
      setCustomerSchemes(prev => prev.map(s => {
        if (s._id === selectedScheme._id) {
          return {
            ...s,
            installments_paid: addedPaid,
            total_paid_amount: (s.total_paid_amount || 0) + totalAmountDue,
            total_gold_grams: (s.total_gold_grams || 0) + gramsAllocatedTotal,
            status: addedPaid >= s.total_installments ? 'COMPLETED' : s.status,
          };
        }
        return s;
      }));

      if (selectedUser.wallet) {
        const newTx = {
          id: `tx-cash-${Date.now()}`,
          date: isoDate,
          amount: totalAmountDue,
          type: 'credit',
          assetAdded: 'inr',
          customer_scheme_id: selectedScheme._id,
          desc: `Cash collection (${paymentMode}) - ${selectedScheme.scheme_name || selectedScheme.scheme_type} (${installmentsCount} Payment${installmentsCount > 1 ? 's' : ''}: ${coveredDatesText})`,
          status: 'SUCCESS',
          orderId: `CASH-${Date.now()}`,
        };
        selectedUser.wallet.transactions = [newTx, ...(selectedUser.wallet.transactions || [])];
        selectedUser.wallet.totalInvested = (selectedUser.wallet.totalInvested || 0) + totalAmountDue;
        selectedUser.wallet.gold24kBalance = (selectedUser.wallet.gold24kBalance || 0) + gramsAllocatedTotal;
      }

      showToast(`Collection Approved! ₹${totalAmountDue.toLocaleString()} credited for ${selectedUser.name}`, 'success');

      // Setup Receipt Modal
      setReceiptData({
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
        date: dateFormatted,
        time: formatTimeSafe(new Date()),
        customerName: selectedUser.name || 'Valued Customer',
        customerId: selectedUser.customerId || selectedUser.userId,
        phone: selectedUser.phoneNumber || selectedUser.phone || 'N/A',
        schemeName: selectedScheme.scheme_name || `${selectedScheme.scheme_type} Savings Scheme`,
        goldCarat: selectedScheme.gold_carat,
        installmentsCountText: `${installmentsCount} Installment${installmentsCount > 1 ? 's' : ''}`,
        dueDatesCoveredText: coveredDatesText,
        totalInstallments: selectedScheme.total_installments,
        amountPaid: totalAmountDue,
        goldRate: currentRate,
        gramsCredited: gramsAllocatedTotal.toFixed(4),
        paymentMode: paymentMode,
        operatorNotes: operatorNotes,
      });

      setOperatorNotes('');
      setInstallmentsCount(1);
      if (refreshCustomers) refreshCustomers().catch(() => {});
    } catch (error) {
      showToast(error?.errors?.[0]?.message || error.message || 'Unable to approve collection', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const copyWhatsappReceipt = () => {
    if (!receiptData) return;
    const msg = `*TARA GOLD & DIAMONDS - Official Receipt*\n\n` +
      `*Receipt No:* ${receiptData.receiptNo}\n` +
      `*Date:* ${receiptData.date} (${receiptData.time})\n` +
      `*Customer:* ${receiptData.customerName} (${receiptData.customerId})\n` +
      `*Scheme:* ${receiptData.schemeName} (${receiptData.goldCarat})\n` +
      `*Payment:* ${receiptData.installmentsCountText} Paid (${receiptData.dueDatesCoveredText})\n` +
      `*Gold Rate:* ₹${receiptData.goldRate.toLocaleString()}/g\n` +
      `*Gold Credited:* +${receiptData.gramsCredited} grams\n` +
      `*Total Cash Received:* ₹${receiptData.amountPaid.toLocaleString()} (${receiptData.paymentMode})\n\n` +
      `Thank you for saving with Tara Gold & Diamonds!`;

    navigator.clipboard.writeText(msg);
    setCopiedWhatsapp(true);
    showToast('WhatsApp receipt text copied!', 'success');
    setTimeout(() => setCopiedWhatsapp(false), 3000);
  };

  return (
    <>
      <PageLead
        eyebrow="Express Collection Desk"
        title="Accept Cash & Wallet Credit"
        description="Fast 3-step cashier workstation: Search customer, choose payment count for present-day due installments, and approve cash payment instantly."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: STREAMLINED POS FORM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* STEP 1: CUSTOMER SEARCH BAR */}
          <div className="panel" style={{ padding: 16, position: 'relative', overflow: 'visible' }}>
            <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
              <div className="d-flex gap-2">
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search Customer by ID, Name, or Mobile..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                    onFocus={() => setShowSearchDropdown(true)}
                    style={{ paddingLeft: 38, fontSize: 14 }}
                  />
                  <Search size={18} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-light)' }} />
                </div>
                <button type="submit" className="btn btn-secondary" disabled={!searchQuery.trim()}>
                  Find
                </button>
              </div>

              {/* Instant Dropdown Suggestions */}
              {showSearchDropdown && searchSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: '#fff', border: '1px solid #ddd', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden'
                }}>
                  {searchSuggestions.map(u => (
                    <div
                      key={u.userId || u.customerId}
                      onClick={() => selectCustomer(u)}
                      style={{
                        padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', borderBottom: '1px solid #eee', transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div className="d-flex align-center gap-2">
                        <strong style={{ fontSize: 13, color: 'var(--dark)' }}>{u.name}</strong>
                        <span style={{ fontSize: 12, color: '#777' }}>({u.phoneNumber || u.phone})</span>
                      </div>
                      <span style={{ background: 'rgba(198,153,62,0.15)', color: 'var(--gold-dark)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                        {u.customerId || u.userId}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </form>

            {/* Quick Customer Badges */}
            {!selectedUser && users.length > 0 && (
              <div className="d-flex align-center gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#777', fontWeight: 600 }}>QUICK:</span>
                {users.slice(0, 4).map(u => (
                  <button
                    key={u.userId || u.customerId}
                    type="button"
                    onClick={() => selectCustomer(u)}
                    style={{ padding: '3px 8px', borderRadius: 14, fontSize: 11, border: '1px solid #ddd', background: '#f9f9f9', cursor: 'pointer' }}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* STEP 2: SELECTED CUSTOMER & SCHEME FORM */}
          {selectedUser ? (
            <div className="panel" style={{ padding: 20 }}>
              {/* Customer Header Strip */}
              <div className="d-flex justify-between align-center mb-4" style={{ background: 'linear-gradient(135deg, rgba(128,0,32,0.06) 0%, rgba(198,153,62,0.08) 100%)', padding: '12px 16px', borderRadius: 10, border: '1px solid #eee' }}>
                <div className="d-flex align-center gap-3">
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--maroon)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                    {(selectedUser.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, color: 'var(--maroon)', margin: 0 }}>{selectedUser.name}</h4>
                    <div style={{ fontSize: 12, color: '#666' }}>{selectedUser.phoneNumber || selectedUser.phone}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span style={{ fontSize: 11, color: '#777', textTransform: 'uppercase' }}>ID: </span>
                  <strong style={{ fontSize: 14, color: 'var(--dark)' }}>{selectedUser.customerId || selectedUser.userId}</strong>
                </div>
              </div>

              <form onSubmit={handleCollect}>
                {/* Active Schemes Radio Selector */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'block' }}>
                    Select Active Savings Scheme
                  </label>

                  {customerSchemes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {customerSchemes.map(s => {
                        const isSelected = s._id === selectedSchemeId;
                        const paid = getActualPaidCount(s, selectedUser);
                        const progress = Math.round((paid / (s.total_installments || 11)) * 100);
                        const dueInfo = getNextDueDateInfo(s, paid);

                        return (
                          <div
                            key={s._id}
                            onClick={() => {
                              setSelectedSchemeId(s._id);
                              setInstallmentsCount(1);
                            }}
                            style={{
                              padding: 14, borderRadius: 10, cursor: 'pointer',
                              border: isSelected ? '2px solid var(--gold)' : '1px solid #eee',
                              background: isSelected ? 'rgba(198,153,62,0.06)' : '#fafafa',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div className="d-flex justify-between align-center mb-1">
                              <div className="d-flex align-center gap-2">
                                <Coins size={16} style={{ color: 'var(--gold-dark)' }} />
                                <strong style={{ fontSize: 14 }}>{s.scheme_name || `${s.scheme_type} Gold`}</strong>
                                <span style={{ background: 'var(--gold)', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                  {s.gold_carat}
                                </span>
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--maroon)' }}>
                                ₹{s.installment_amount.toLocaleString()} <small style={{ fontSize: 11, fontWeight: 400, color: '#777' }}>/month</small>
                              </span>
                            </div>

                            <div className="d-flex justify-between align-center" style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                              <span>Progress: <strong>{paid} of {s.total_installments} paid</strong></span>
                              <span style={{ color: dueInfo.isOverdue ? '#ef4444' : 'var(--gold-dark)', fontWeight: 600 }}>
                                Next Due: {dueInfo.dueDateDisplay} {dueInfo.isOverdue && '(OVERDUE)'}
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div style={{ width: '100%', height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--gold) 0%, var(--maroon) 100%)' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-muted text-center" style={{ padding: 14, background: '#f8f8f8', borderRadius: 8, fontSize: 13 }}>
                      No active scheme with pending installments.
                    </div>
                  )}
                </div>

                {selectedScheme && (
                  <>
                    {/* Collection Date & Super-Simple Payment Selector */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div className="form-group mb-0">
                        <label style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={14} /> Payment Date
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={collectionDate}
                          max={getTodayStr()}
                          onChange={e => setCollectionDate(e.target.value)}
                          required
                          style={{ fontSize: 13 }}
                        />
                      </div>

                      <div className="form-group mb-0">
                        <label style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, display: 'block' }}>
                          How Many Payments?
                        </label>
                        {payableTillTodayList.length > 0 ? (
                          <select
                            className="form-control"
                            value={installmentsCount}
                            onChange={e => setInstallmentsCount(Number(e.target.value))}
                            style={{ fontSize: 13, fontWeight: 600 }}
                          >
                            {payableTillTodayList.map((item, idx) => {
                              const num = idx + 1;
                              const isMonthly = selectedScheme.scheme_type === 'MONTHLY' || !selectedScheme.scheme_type;
                              const unitLabel = isMonthly
                                ? (num === 1 ? '1 Month' : `${num} Months`)
                                : (num === 1 ? '1 Installment' : `${num} Installments`);

                              let datesText = '';
                              if (num === 1) {
                                datesText = ` (${item.dueDateDisplay})`;
                              } else if (num === 2) {
                                datesText = ` (${payableTillTodayList[0].dueDateDisplay} & ${payableTillTodayList[1].dueDateDisplay})`;
                              } else {
                                datesText = ` (${payableTillTodayList[0].dueDateDisplay} to ${payableTillTodayList[num - 1].dueDateDisplay})`;
                              }

                              const cost = num * singleInstAmount;

                              return (
                                <option key={num} value={num}>
                                  {unitLabel}{datesText} — ₹{cost.toLocaleString()}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #fca5a5' }}>
                            No Due Installments
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Subtext Notice */}
                    {payableTillTodayList.length > 0 ? (
                      <div style={{ fontSize: 11, color: '#444', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                        <div className="d-flex align-center gap-2 mb-1" style={{ color: '#10b981', fontWeight: 600 }}>
                          <CheckCircle2 size={13} />
                          <span>Selected Payment: {installmentsCount} Installment{installmentsCount > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ color: 'var(--dark)', fontWeight: 600 }}>
                          Due Date{selectedDueDates.length > 1 ? 's' : ''} Covered: <span style={{ color: 'var(--maroon)' }}>{coveredDatesText}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#065f46', background: '#d1fae5', padding: '10px 14px', borderRadius: 8, border: '1px solid #a7f3d0', marginBottom: 16 }}>
                        <CheckCircle2 size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                        <strong>All installments due up to today ({formatDateSafe(new Date())}) are fully paid!</strong> Next installment is due on {getNextDueDateInfo(selectedScheme, actualPaid).dueDateDisplay}.
                      </div>
                    )}

                    {/* Payment Mode & Reference Note */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div className="form-group mb-0">
                        <label style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CreditCard size={14} /> Mode
                        </label>
                        <select
                          className="form-control"
                          value={paymentMode}
                          onChange={e => setPaymentMode(e.target.value)}
                          style={{ fontSize: 13 }}
                          disabled={payableTillTodayList.length === 0}
                        >
                          <option value="CASH">Cash at Counter</option>
                          <option value="UPI">UPI Transfer</option>
                          <option value="NETBANKING">Net Banking / NEFT</option>
                          <option value="CHEQUE">Cheque / Demand Draft</option>
                        </select>
                      </div>

                      <div className="form-group mb-0">
                        <label style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, display: 'block' }}>
                          Memo Note (Optional)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Receipt # / Note"
                          value={operatorNotes}
                          onChange={e => setOperatorNotes(e.target.value)}
                          style={{ fontSize: 13 }}
                          disabled={payableTillTodayList.length === 0}
                        />
                      </div>
                    </div>

                    {/* Compact Amount & Gold Summary Card */}
                    <div style={{ background: '#1C1C1E', color: '#fff', padding: 14, borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', fontWeight: 600 }}>Total Cash Amount</div>
                        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>₹{totalAmountDue.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Gold Allocated ({selectedScheme.gold_carat})</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold-light)', marginTop: 2 }}>+{totalGoldGrams} g</div>
                      </div>
                    </div>

                    {/* One-Click Primary Submit Button */}
                    <button
                      type="submit"
                      className="btn btn-primary w-100"
                      style={{
                        padding: 14, fontSize: 16, fontWeight: 700,
                        background: payableTillTodayList.length > 0 ? 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%)' : '#ccc',
                        border: 'none', borderRadius: 10, boxShadow: payableTillTodayList.length > 0 ? '0 4px 14px rgba(198,153,62,0.3)' : 'none',
                        cursor: payableTillTodayList.length > 0 ? 'pointer' : 'not-allowed'
                      }}
                      disabled={processing || !selectedScheme || payableTillTodayList.length === 0}
                    >
                      {processing ? 'Processing...' : payableTillTodayList.length > 0 ? `Approve Collection · ₹${totalAmountDue.toLocaleString()}` : 'All Due Installments Up to Today Paid'}
                    </button>
                  </>
                )}
              </form>
            </div>
          ) : (
            <div className="panel text-center text-muted" style={{ padding: 36 }}>
              <User size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ color: 'var(--dark)', fontWeight: 600 }}>Search a Customer</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Type Customer ID, name, or phone above to load savings schemes.</div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: RECENT LOG & PREVIOUS PAYMENTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Today's Desk Summary Widget */}
          <div className="panel" style={{ padding: 16 }}>
            <div className="d-flex align-center justify-between mb-2">
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#777' }}>Today's Desk Total</span>
              <span style={{ fontSize: 11, background: '#d1fae5', color: '#10b981', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                {collectionStats.count} Done
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)' }}>
              ₹{collectionStats.totalCash.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
              Live Rate (24K): ₹{goldRate24k.toLocaleString()}/g
            </div>
          </div>

          {/* Customer Previous Payments History */}
          {selectedUser && (
            <div className="panel" style={{ padding: 16 }}>
              <div className="panel-header mb-2" style={{ border: 'none', padding: 0 }}>
                <h4 style={{ fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History size={16} style={{ color: 'var(--gold)' }} /> Previous Payments History
                </h4>
              </div>

              {previousPayments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {previousPayments.slice(0, 5).map((tx, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px', borderRadius: 8, background: '#fafafa',
                        border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--dark)' }}>{tx.desc || 'Cash Payment'}</div>
                        <div style={{ fontSize: 10, color: '#888' }}>{formatDateSafe(tx.date)}</div>
                      </div>
                      <strong style={{ color: 'var(--maroon)' }}>₹{Number(tx.amount || 0).toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                  No previous payments recorded yet.
                </div>
              )}
            </div>
          )}

          {/* Today's Cash Receipts Log */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ fontSize: 14, margin: '0 0 10px', color: 'var(--dark)' }}>Today's Desk Receipts</h4>
            {collectionStats.recentTxs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {collectionStats.recentTxs.map((tx, idx) => (
                  <div key={idx} style={{ padding: '8px 10px', borderRadius: 8, background: '#fafafa', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <div>
                      <strong style={{ color: 'var(--dark)' }}>{tx.customerName}</strong>
                      <div style={{ fontSize: 10, color: '#888' }}>{formatTimeSafe(tx.date)}</div>
                    </div>
                    <strong style={{ color: 'var(--gold-dark)' }}>+₹{Number(tx.amount).toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                No receipts logged today.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {receiptData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid var(--gold)'
          }}>
            <div style={{ background: 'linear-gradient(135deg, var(--maroon) 0%, var(--maroon-dark) 100%)', color: '#fff', padding: 16, textAlign: 'center', position: 'relative' }}>
              <button
                onClick={() => setReceiptData(null)}
                style={{ position: 'absolute', right: 14, top: 14, background: 'rgba(255,255,255,0.15)', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={15} />
              </button>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--gold-light)' }}>
                TARA GOLD & DIAMONDS
              </div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, marginTop: 2 }}>
                Cash Collection Receipt
              </div>
            </div>

            <div style={{ padding: 20, background: '#fff' }} id="printable-receipt">
              <div className="d-flex justify-between align-center mb-3" style={{ borderBottom: '1px dashed #ddd', paddingBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#777', textTransform: 'uppercase' }}>Receipt No</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{receiptData.receiptNo}</div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 10, color: '#777', textTransform: 'uppercase' }}>Date & Time</div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{receiptData.date} · {receiptData.time}</div>
                </div>
              </div>

              <div style={{ background: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#777', textTransform: 'uppercase', marginBottom: 2 }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{receiptData.customerName}</div>
                <div style={{ fontSize: 11, color: '#555' }}>ID: {receiptData.customerId} · Mobile: {receiptData.phone}</div>
              </div>

              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 14 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 0', color: '#666' }}>Scheme</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{receiptData.schemeName} ({receiptData.goldCarat})</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 0', color: '#666' }}>Installments Paid</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{receiptData.installmentsCountText}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 0', color: '#666' }}>Due Dates Covered</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: 'var(--maroon)' }}>{receiptData.dueDatesCoveredText}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 0', color: '#666' }}>Gold Allocated</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: 'var(--gold-dark)' }}>+{receiptData.gramsCredited} grams</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 0 0', fontWeight: 700, fontSize: 14, color: '#111' }}>Total Received</td>
                    <td style={{ padding: '10px 0 0', textAlign: 'right', fontWeight: 700, fontSize: 16, color: 'var(--maroon)' }}>₹{receiptData.amountPaid.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ textAlign: 'center', fontSize: 10, color: '#888', marginTop: 8 }}>
                Thank you for saving with Tara Gold & Diamonds!
              </div>
            </div>

            <div style={{ padding: 14, background: '#f9f9f9', borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}
                onClick={copyWhatsappReceipt}
              >
                {copiedWhatsapp ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
                {copiedWhatsapp ? 'Copied' : 'Copy WhatsApp Text'}
              </button>

              <button
                className="btn btn-outline"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}
                onClick={() => window.print()}
              >
                <Printer size={15} /> Print
              </button>

              <button
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--maroon)', fontSize: 12 }}
                onClick={() => setReceiptData(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
