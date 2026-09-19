import { useState, useEffect } from 'react';
import { templateApi, whatsappApi } from './marketingApi';
import { extractList } from '../../lib/axios';
import { toast } from '../../utils/toast';

export default function WhatsAppBroadcastModal({ selectedCustomers, allCustomers, onClose }) {
  const [targetMode, setTargetMode] = useState(selectedCustomers.length ? 'selected' : 'all');
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [clientType, setClientType] = useState('web'); // 'web' or 'app'
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Queue state for 1-by-1 guided broadcast
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  const recipientList = targetMode === 'all'
    ? allCustomers
    : targetMode === 'vip'
    ? allCustomers.filter(c => c.customer_type === 'VIP')
    : selectedCustomers;

  const totalRecipients = recipientList.length;
  const currentCustomer = isBroadcasting && currentIndex < totalRecipients ? recipientList[currentIndex] : null;

  useEffect(() => {
    templateApi.list().then(r => {
      const list = extractList(r.data);
      setTemplates(Array.isArray(list) ? list : []);
    }).catch(() => setTemplates([]));
  }, []);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function applyTemplate(id) {
    setSelectedTemplate(id);
    const tpl = templates.find(t => String(t.id) === String(id));
    if (tpl) setMessage(tpl.message_text);
  }

  function getPersonalizedText(rawText, customer) {
    if (!rawText) return '';
    return rawText
      .replace(/{name}/g, customer?.name || 'Valued Customer')
      .replace(/{phone}/g, customer?.phone || '')
      .replace(/{shop_name}/g, 'JewelloSoft Jewellers')
      .replace(/{shop_phone}/g, '');
  }

  async function copyImageToClipboard() {
    if (mediaFile && navigator.clipboard && window.ClipboardItem) {
      try {
        const item = new ClipboardItem({ [mediaFile.type || 'image/png']: mediaFile });
        await navigator.clipboard.write([item]);
      } catch (err) {
        console.warn('Clipboard copy skipped:', err);
      }
    }
  }

  async function openWhatsAppForCustomer(cust) {
    if (!cust) return;

    // Copy image if attached
    await copyImageToClipboard();

    // Format phone
    const digits = (cust.phone || '').replace(/[^0-9]/g, '');
    const phone = digits.length === 10 ? `91${digits}` : digits;

    // Build URL
    const finalText = getPersonalizedText(message, cust);
    const encoded = encodeURIComponent(finalText);
    const targetUrl = clientType === 'app'
      ? `whatsapp://send?phone=${phone}&text=${encoded}`
      : `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;

    // Log to backend
    whatsappApi.sendSingle({
      customer_id: cust.id,
      phone: cust.phone,
      name: cust.name,
      message: finalText,
    }).catch(() => {});

    // Open WhatsApp
    window.open(targetUrl, '_blank');
  }

  function handleStartBroadcast() {
    if (!message.trim()) {
      toast.error('Please enter a message or choose a template.');
      return;
    }
    if (totalRecipients === 0) {
      toast.error('No recipients selected.');
      return;
    }
    setIsBroadcasting(true);
    setCurrentIndex(0);
    setSentCount(0);
  }

  async function handleSendAndNext() {
    if (!currentCustomer) return;
    await openWhatsAppForCustomer(currentCustomer);
    setSentCount(prev => prev + 1);

    if (currentIndex + 1 < totalRecipients) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(totalRecipients); // Done
      toast.success('Broadcast queue completed!');
    }
  }

  function handleSkip() {
    if (currentIndex + 1 < totalRecipients) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(totalRecipients);
    }
  }

  const isCompleted = isBroadcasting && currentIndex >= totalRecipients;
  const progressPercent = totalRecipients > 0 ? Math.round((currentIndex / totalRecipients) * 100) : 0;

  return (
    <>
      <div className="overlay" onClick={!isBroadcasting ? onClose : undefined} />
      <div className="modal" style={{ maxWidth: 620, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal__header">
          <h2 className="modal__title">
            <i className="fa-brands fa-whatsapp" style={{ marginRight: 8, color: '#25D366' }} />
            {isBroadcasting ? 'WhatsApp Broadcast Assistant' : 'New WhatsApp Broadcast'}
          </h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {!isBroadcasting ? (
            <>
              {/* Target Audience */}
              <div className="form-group">
                <label className="form-label">Recipients</label>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {[
                    { value: 'all', label: `All Customers (${allCustomers.length})` },
                    { value: 'vip', label: `VIP Only (${allCustomers.filter(c => c.customer_type === 'VIP').length})` },
                    ...(selectedCustomers.length ? [{ value: 'selected', label: `Selected (${selectedCustomers.length})` }] : []),
                  ].map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                      <input
                        type="radio"
                        name="target"
                        value={opt.value}
                        checked={targetMode === opt.value}
                        onChange={() => setTargetMode(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Client Selection */}
              <div className="form-group">
                <label className="form-label">Open In</label>
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                    <input
                      type="radio"
                      name="broadcastClient"
                      value="web"
                      checked={clientType === 'web'}
                      onChange={() => setClientType('web')}
                    />
                    WhatsApp Web (Browser Tab)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                    <input
                      type="radio"
                      name="broadcastClient"
                      value="app"
                      checked={clientType === 'app'}
                      onChange={() => setClientType('app')}
                    />
                    WhatsApp Desktop App
                  </label>
                </div>
              </div>

              {/* Template Picker */}
              {Array.isArray(templates) && templates.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Load Saved Template</label>
                  <select className="form-input" value={selectedTemplate} onChange={e => applyTemplate(e.target.value)}>
                    <option value="">— Select a template —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Message */}
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea
                  className="form-input"
                  rows={6}
                  placeholder="Type your promotional message here..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                  Supported dynamic tags: {'{name}'}, {'{phone}'}, {'{shop_name}'}
                </div>
              </div>

              {/* Image Flyer */}
              <div className="form-group">
                <label className="form-label">Attach Offer Flyer / Image (optional)</label>
                <input type="file" accept="image/*" onChange={handleFileChange} className="form-input" />
                {preview && (
                  <div style={{ marginTop: 8 }}>
                    <img src={preview} alt="preview" style={{ maxHeight: 120, borderRadius: 8, objectFit: 'cover' }} />
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                      <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }} />
                      Flyer is automatically copied to clipboard. In WhatsApp Web, simply press <strong>Ctrl + V</strong> to attach it.
                    </div>
                  </div>
                )}
              </div>

              {/* Free Mode Badge */}
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <i className="fa-solid fa-gift" style={{ marginRight: 6, color: '#25D366' }} />
                <strong>100% Free Direct Mode:</strong> Messages leave JewelloSoft and open directly in your WhatsApp Web with the receiver's details and personalized message pre-filled. No third-party accounts, zero API costs, and zero ban risk.
              </div>
            </>
          ) : isCompleted ? (
            /* Completed Screen */
            <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto var(--space-3)' }}>
                <i className="fa-solid fa-check" />
              </div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 8 }}>Broadcast Complete!</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Finished sending messages to <strong>{sentCount}</strong> customers.
              </p>
            </div>
          ) : (
            /* Active Guided Queue */
            <div>
              {/* Progress Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 'var(--text-sm)' }}>
                <span style={{ fontWeight: 600 }}>Customer {currentIndex + 1} of {totalRecipients}</span>
                <span style={{ color: 'var(--text-muted)' }}>{sentCount} sent</span>
              </div>

              <div style={{ background: 'var(--bg-elevated)', borderRadius: 100, height: 10, overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
                <div style={{ height: '100%', width: `${progressPercent}%`, background: '#25D366', transition: 'width 0.3s ease' }} />
              </div>

              {/* Current Customer Card */}
              {currentCustomer && (
                <div style={{ padding: 'var(--space-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{currentCustomer.name}</div>
                    <span className="badge badge--info">{currentCustomer.customer_type || 'Regular'}</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                    <i className="fa-solid fa-phone" style={{ marginRight: 6 }} />
                    {currentCustomer.phone}
                  </div>

                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#334155', whiteSpace: 'pre-wrap', maxHeight: 150, overflowY: 'auto' }}>
                    {getPersonalizedText(message, currentCustomer)}
                  </div>

                  {preview && (
                    <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: '#16a34a' }}>
                      <i className="fa-solid fa-image" style={{ marginRight: 4 }} />
                      Flyer attached (will copy to clipboard — press Ctrl+V in WhatsApp)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          {!isBroadcasting ? (
            <>
              <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn--primary" onClick={handleStartBroadcast} disabled={!message.trim() || totalRecipients === 0}>
                <i className="fa-brands fa-whatsapp" style={{ marginRight: 6 }} />
                Start Sending to {totalRecipients} Customers
              </button>
            </>
          ) : isCompleted ? (
            <button className="btn btn--primary" onClick={onClose}>Done</button>
          ) : (
            <>
              <button className="btn btn--ghost" onClick={onClose}>Stop & Exit</button>
              <button className="btn btn--outline btn--sm" onClick={handleSkip}>Skip Customer</button>
              <button className="btn btn--primary" onClick={handleSendAndNext}>
                <i className="fa-brands fa-whatsapp" style={{ marginRight: 6 }} />
                Open WhatsApp & Next ➔
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
