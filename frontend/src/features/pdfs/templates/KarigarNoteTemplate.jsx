import React from 'react';

export default function KarigarNoteTemplate({ data }) {
  if (!data) return null;

  const {
    shop = {},
    meta = {},
    customer = {},
    worker = '',
    items = [],
    designNotes = '',
    designImages = [],
    isCompleted = false,
  } = data;

  let effectiveShop = { ...shop };
  if (!effectiveShop?.name || effectiveShop.name === 'Jewellery Workshop' || effectiveShop.name === 'My Jewellery Shop') {
    try {
      const cached = localStorage.getItem('jewellosoft_shop_info');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.name) {
          effectiveShop = {
            ...parsed,
            ...effectiveShop,
            name: parsed.name,
            address: parsed.address || effectiveShop.address,
            phone: parsed.phone || effectiveShop.phone,
            email: parsed.email || effectiveShop.email,
            gst_number: parsed.gst_number || effectiveShop.gst_number,
          };
        }
      }
    } catch {}
  }

  const allItemsCompleted = isCompleted || (items.length > 0 && items.every(i => i.status === 'complete' || i.karigarNoteStatus === 'completed'));

  return (
    <div className="karigar-note-document" style={{
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '24px 32px',
      backgroundColor: '#ffffff',
      color: '#111827',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '12px',
      lineHeight: 1.4,
      boxSizing: 'border-box',
    }}>
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .karigar-note-document {
            padding: 10px 14px !important;
            max-width: 100% !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 6mm;
            size: A5 portrait;
          }
        }
        .kn-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
          margin-bottom: 12px;
        }
        .kn-table th {
          background-color: #f3f4f6;
          color: #111827;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          text-align: left;
        }
        .kn-table td {
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          vertical-align: top;
          font-size: 11.5px;
        }
      `}</style>

      <div style={{
        borderBottom: '2px solid #111827',
        paddingBottom: '12px',
        marginBottom: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 800,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            color: '#111827',
          }}>
            {effectiveShop.name || 'Jewellery Workshop'}
          </h1>
          {effectiveShop.address && (
            <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '2px' }}>
              {effectiveShop.address}
            </div>
          )}
          {effectiveShop.phone && (
            <div style={{ color: '#4b5563', fontSize: '11px' }}>
              Tel: {effectiveShop.phone} {effectiveShop.gst_number ? `| GSTIN: ${effectiveShop.gst_number}` : ''}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-block',
            // border: '2px solid #111827',
            padding: '4px 0px',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            // backgroundColor: allItemsCompleted ? '#f0fdf4' : '#f9fafb',
            color: allItemsCompleted ? '#166534' : '#111827',
          }}>
            {allItemsCompleted ? '✓ WORK ORDER COMPLETED' : 'KARIGAR HAND NOTE'}
          </div>
          <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>
            Order No: <strong style={{ color: '#111827' }}>{meta.orderNo || '—'}</strong>
          </div>
          <div style={{ fontSize: '11px', color: '#4b5563' }}>
            Date: {meta.orderDate || '—'}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        padding: '8px 10px',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
        marginBottom: '14px',
        fontSize: '11px',
      }}>
        <div>
          <span style={{ color: '#6b7280', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', fontWeight: 600 }}>Customer</span>
          <strong style={{ color: '#111827' }}>{customer.name || 'Walk-in'}</strong>
          {customer.phone && <div style={{ color: '#4b5563' }}>{customer.phone}</div>}
        </div>

        <div>
          <span style={{ color: '#6b7280', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', fontWeight: 600 }}>Target Delivery Date</span>
          <strong style={{ color: '#111827' }}>{meta.deliveryDate || 'Not specified'}</strong>
        </div>

        <div>
          <span style={{ color: '#6b7280', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', fontWeight: 600 }}>Priority Level</span>
          <span style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '2px',
            fontWeight: 700,
            fontSize: '10px',
            backgroundColor: meta.priority?.toLowerCase() === 'urgent' ? '#fee2e2' : meta.priority?.toLowerCase() === 'high' ? '#fef3c7' : '#e5e7eb',
            color: meta.priority?.toLowerCase() === 'urgent' ? '#991b1b' : meta.priority?.toLowerCase() === 'high' ? '#92400e' : '#374151',
            textTransform: 'uppercase',
          }}>
            {meta.priority || 'Normal'}
          </span>
        </div>

        <div>
          <span style={{ color: '#6b7280', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', fontWeight: 600 }}>Workshop Status</span>
          <strong style={{
            color: allItemsCompleted ? '#166534' : '#1e40af',
            textTransform: 'uppercase',
          }}>
            {allItemsCompleted ? 'COMPLETED' : (meta.orderStatus?.replace('_', ' ') || 'ACTIVE')}
          </strong>
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          borderBottom: '1px solid #111827',
          paddingBottom: '4px',
          marginBottom: '6px',
        }}>
          Assigned Products & Work Specifications
        </div>

        <table className="kn-table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>#</th>
              <th style={{ width: '26%' }}>Product / Item</th>
              <th style={{ width: '12%' }}>Specs</th>
              <th style={{ width: '18%' }}>Assigned Karigar</th>
              <th style={{ width: '16%' }}>Est. Completion</th>
              <th style={{ width: '14%' }}>Urgency Note</th>
              <th style={{ width: '10%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>
                  No items listed for this order.
                </td>
              </tr>
            ) : items.map((item, idx) => {
              const itemComplete = item.status === 'complete' || item.karigarNoteStatus === 'completed';
              return (
                <tr key={item.id || idx} style={{
                  backgroundColor: itemComplete ? '#f9fafb' : '#ffffff',
                }}>
                  <td style={{ fontWeight: 700, color: '#4b5563' }}>{idx + 1}</td>
                  <td>
                    <strong style={{ color: '#111827', fontSize: '12px' }}>{item.name || item.product_name}</strong>
                    {item.designRemarks && (
                      <div style={{ color: '#4b5563', fontSize: '10.5px', marginTop: '2px', fontStyle: 'italic' }}>
                        Notes: {item.designRemarks}
                      </div>
                    )}
                  </td>
                  <td>
                    {item.weight ? <div><strong>{item.weight}</strong> g</div> : null}
                    {item.size ? <div style={{ color: '#4b5563' }}>Size: {item.size}</div> : null}
                    {item.metalType ? <div style={{ textTransform: 'capitalize', color: '#6b7280', fontSize: '10px' }}>{item.metalType}</div> : null}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#111827' }}>
                      {item.karigar || worker || '—'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {item.estimateDate ? new Date(item.estimateDate).toLocaleDateString('en-IN') : '—'}
                    </div>
                  </td>
                  <td>
                    {item.urgencyNote ? (
                      <div style={{
                        padding: '2px 4px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '2px',
                        fontSize: '10.5px',
                        color: '#92400e',
                        fontWeight: 600,
                      }}>
                        {item.urgencyNote}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '2px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      backgroundColor: itemComplete ? '#dcfce7' : '#e0f2fe',
                      color: itemComplete ? '#15803d' : '#0369a1',
                    }}>
                      {itemComplete ? 'Done' : (item.status?.replace('_', ' ') || 'Active')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(designNotes || (designImages && designImages.length > 0)) && (
        <div style={{
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          padding: '10px 12px',
          marginBottom: '14px',
          backgroundColor: '#fafafa',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '6px',
            color: '#111827',
          }}>
            Design Details & Workbench Reference
          </div>

          {designNotes && (
            <div style={{
              fontSize: '11.5px',
              lineHeight: 1.5,
              color: '#374151',
              marginBottom: designImages.length > 0 ? '10px' : 0,
              padding: '6px 8px',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '2px',
            }}>
              <strong>Special Instructions:</strong> {designNotes}
            </div>
          )}

          {designImages && designImages.length > 0 && (
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>
                Reference Design Images ({designImages.length}):
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {designImages.map((img, i) => (
                  <div key={i} style={{
                    width: '100px',
                    height: '100px',
                    border: '1px solid #9ca3af',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                  }}>
                    <img
                      src={img}
                      alt={`Reference ${i + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '28px',
        paddingTop: '12px',
        borderTop: '1px dashed #9ca3af',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '24px',
        textAlign: 'center',
        fontSize: '10.5px',
      }}>
        <div>
          <div style={{ height: '32px' }} />
          <div style={{ borderTop: '1px solid #4b5563', paddingTop: '4px', fontWeight: 600, color: '#374151' }}>
            Karigar Signature
          </div>
        </div>
        <div>
          <div style={{ height: '32px' }} />
          <div style={{ borderTop: '1px solid #4b5563', paddingTop: '4px', fontWeight: 600, color: '#374151' }}>
            QC / Weight Verification
          </div>
        </div>
        <div>
          <div style={{ height: '32px' }} />
          <div style={{ borderTop: '1px solid #4b5563', paddingTop: '4px', fontWeight: 600, color: '#374151' }}>
            Authorized Store Signature
          </div>
        </div>
      </div>
    </div>
  );
}
