import { useState } from 'react';
import api from '../../lib/axios';
import { toast } from '../../utils/toast';
import { fmtCurrency as fmt } from '../../utils/billingCalcEngine';

export default function CreditNoteApplicator({
  customerId,
  netTotal,
  appliedNotes,
  onChange,
  disabled = false
}) {
  const [cnNumber, setCnNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedCn, setFetchedCn] = useState(null);
  const [applyAmount, setApplyAmount] = useState('');

  // Calculate total credit applied so far
  const totalApplied = appliedNotes.reduce((sum, n) => sum + parseFloat(n.amount || 0), 0);
  const remainingBillBalance = Math.max(0, netTotal - totalApplied);

  const handleFetch = async () => {
    if (!cnNumber.trim()) return;
    setLoading(true);
    setFetchedCn(null);
    setApplyAmount('');

    try {
      const res = await api.get(`/billing/credit-notes/lookup/?no=${encodeURIComponent(cnNumber.trim())}`);
      const cn = res.data;

      // Business Rules Validation
      if (cn.status === 'closed' || cn.status === 'cancelled') {
        toast.warning(`Credit Note is ${cn.status.toUpperCase()} and cannot be used.`);
        setLoading(false);
        return;
      }
      if (cn.is_expired) {
        toast.warning('This Credit Note has expired.');
        setLoading(false);
        return;
      }
      
      const remainingVal = parseFloat(cn.remaining_amount || 0);
      if (remainingVal <= 0) {
        toast.warning('This Credit Note has zero remaining balance.');
        setLoading(false);
        return;
      }

      // Check if already applied in local session
      if (appliedNotes.some(item => String(item.credit_note_id) === String(cn.id))) {
        toast.warning('This Credit Note is already applied on this document.');
        setLoading(false);
        return;
      }

      // Customer check (skip if walk-in / customerId is null/undefined)
      if (customerId && String(cn.customer) !== String(customerId)) {
        toast.warning(`Credit Note belongs to customer '${cn.customer_detail?.name || 'another customer'}', not the currently selected customer.`);
        setLoading(false);
        return;
      }

      setFetchedCn(cn);
      // Auto-prefill the lesser of remaining credit or remaining bill balance
      const suggestedAmount = Math.min(remainingVal, remainingBillBalance);
      setApplyAmount(suggestedAmount > 0 ? String(suggestedAmount) : '');
      toast.success(`Found Credit Note: ${cn.credit_note_no} (${fmt(remainingVal)} available)`);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Credit Note not found or error occurred.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!fetchedCn) return;
    const amt = parseFloat(applyAmount) || 0;
    const remainingVal = parseFloat(fetchedCn.remaining_amount || 0);

    if (amt <= 0) {
      toast.warning('Please enter a valid application amount.');
      return;
    }
    if (amt > remainingVal) {
      toast.warning(`Cannot apply more than remaining balance (${fmt(remainingVal)}).`);
      return;
    }
    if (amt > remainingBillBalance) {
      toast.warning(`Cannot apply more than remaining bill balance (${fmt(remainingBillBalance)}).`);
      return;
    }

    const newNote = {
      credit_note_id: fetchedCn.id,
      credit_note_no: fetchedCn.credit_note_no,
      amount: amt,
      reason: fetchedCn.reason,
      remaining_amount: remainingVal
    };

    onChange([...appliedNotes, newNote]);
    setFetchedCn(null);
    setCnNumber('');
    setApplyAmount('');
    toast.success(`Applied ₹${amt} from ${newNote.credit_note_no}`);
  };

  const handleRemove = (id) => {
    onChange(appliedNotes.filter(n => n.credit_note_id !== id));
  };

  return (
    <div className="cn-applicator" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Search Input Box */}
      {!disabled && (
        <div className="flex gap-2 items-end">
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              <i className="fa-solid fa-ticket" style={{ marginRight: 6 }} />
              Adjust Credit Note
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="Enter Credit Note # (e.g. CN-2026-001)"
              value={cnNumber}
              onChange={e => setCnNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
            />
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleFetch}
            disabled={loading || !cnNumber.trim()}
            style={{ height: 38 }}
          >
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-magnifying-glass" /> Fetch</>}
          </button>
        </div>
      )}

      {/* Fetched Widget */}
      {fetchedCn && (
        <div 
          className="card animate-fade-in" 
          style={{ 
            padding: 'var(--space-4)', 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(99, 102, 241, 0.03))', 
            border: '1px dashed var(--color-primary)', 
            borderRadius: 'var(--radius-lg)' 
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-primary)' }}>
                {fetchedCn.credit_note_no}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Issued for: {fetchedCn.reason}
              </div>
            </div>
            <span className="badge badge--success" style={{ fontSize: '0.7rem' }}>
              Available: {fmt(fetchedCn.remaining_amount)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Amount to Apply</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                max={fetchedCn.remaining_amount}
                placeholder="Enter amount"
                value={applyAmount}
                onChange={e => setApplyAmount(e.target.value)}
                style={{ height: 32, fontSize: 'var(--text-sm)', fontWeight: 700 }}
              />
            </div>
            <button
              type="button"
              className="btn btn--success btn--sm"
              onClick={handleApply}
              style={{ height: 32, padding: '0 var(--space-4)' }}
            >
              Apply Credit
            </button>
          </div>
        </div>
      )}

      {/* List of Applied Credit Notes */}
      {appliedNotes.length > 0 && (
        <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-primary)' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px' }}>CN Number</th>
                <th style={{ textAlign: 'left', padding: '6px 12px' }}>Reason</th>
                <th style={{ textAlign: 'right', padding: '6px 12px' }}>Applied (₹)</th>
                {!disabled && <th style={{ width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {appliedNotes.map(note => (
                <tr key={note.credit_note_id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {note.credit_note_no}
                  </td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>
                    {note.reason}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-accent)' }}>
                    {fmt(note.amount)}
                  </td>
                  {!disabled && (
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      <button
                        type="button"
                        style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}
                        onClick={() => handleRemove(note.credit_note_id)}
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ background: 'var(--bg-surface)', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)', fontWeight: 600 }}>
            <span>Total Credit Adjusted:</span>
            <span style={{ color: 'var(--color-accent)' }}>{fmt(totalApplied)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
