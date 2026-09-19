import { useState } from 'react';
import { whatsappApi } from './marketingApi';
import { toast } from '../../utils/toast';

export default function SingleWhatsAppModal({ customer, onClose }) {
  const [message, setMessage] = useState(
    `Dear ${customer.name},\n\nThank you for choosing our jewellery store! We have exciting new Hallmark 916 gold and diamond collections in stock.\n\nVisit us today or call us for any queries.\n\nWarm regards,\nJewelloSoft Jewellers`
  );
  const [mediaFile, setMediaFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [clientType, setClientType] = useState('web'); // 'web' or 'app'

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSend() {
    if (!message.trim()) return;

    // 1. Copy image to clipboard if attached so user can simply Ctrl+V in WhatsApp
    if (mediaFile) {
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({ [mediaFile.type || 'image/png']: mediaFile });
          await navigator.clipboard.write([item]);
          toast.info('Flyer copied to clipboard! Press Ctrl+V in WhatsApp to attach.');
        }
      } catch (err) {
        console.warn('Clipboard write skipped:', err);
      }
    }

    // 2. Format phone number
    const digits = (customer.phone || '').replace(/[^0-9]/g, '');
    const phone = digits.length === 10 ? `91${digits}` : digits;

    // 3. Build target URL
    const encoded = encodeURIComponent(message);
    const targetUrl = clientType === 'app'
      ? `whatsapp://send?phone=${phone}&text=${encoded}`
      : `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;

    // 4. Log message to backend audit trail
    try {
      whatsappApi.sendSingle({
        customer_id: customer.id,
        phone: customer.phone,
        name: customer.name,
        message: message,
      }).catch(() => {});
    } catch {}

    // 5. Open WhatsApp
    window.open(targetUrl, '_blank');
    toast.success(`Opening WhatsApp for ${customer.name}...`);
    onClose();
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal__header">
          <h2 className="modal__title">
            <i className="fa-brands fa-whatsapp" style={{ marginRight: 8, color: '#25D366' }} />
            WhatsApp to {customer.name}
          </h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-phone" style={{ marginRight: 6, opacity: 0.6 }} />
              {customer.phone}
            </span>
            <div style={{ display: 'flex', gap: 12, fontSize: 'var(--text-xs)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="singleClient"
                  value="web"
                  checked={clientType === 'web'}
                  onChange={() => setClientType('web')}
                />
                WhatsApp Web
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="singleClient"
                  value="app"
                  checked={clientType === 'app'}
                  onChange={() => setClientType('app')}
                />
                WhatsApp App
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea
              className="form-input"
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Attach Image / Flyer (optional)</label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="form-input" />
            {preview && (
              <div style={{ marginTop: 8, position: 'relative' }}>
                <img src={preview} alt="preview" style={{ maxHeight: 120, borderRadius: 8, objectFit: 'cover' }} />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }} />
                  Image is automatically copied to clipboard. Simply press <strong>Ctrl + V</strong> in WhatsApp to attach it.
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSend} disabled={!message.trim()}>
            <i className="fa-brands fa-whatsapp" style={{ marginRight: 6 }} />
            Open in WhatsApp
          </button>
        </div>
      </div>
    </>
  );
}
