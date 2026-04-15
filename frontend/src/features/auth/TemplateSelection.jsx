/**
 * ─── Template Selection Onboarding ──────────────────────────────
 * Shown once after shop registration so the user can pick their
 * preferred billing PDF layout before entering the main app.
 *
 * Two templates:
 *   • Classic  — Gold/silver themed, gradient headers, decorative
 *   • Standard — Clean B&W minimal, universally professional
 *
 * The choice is persisted to shop.pdf_template via PATCH.
 * ────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/axios';

/* ─── Mini PDF Preview (purely visual, no real data) ──────────── */

function ClassicPreview({ isActive }) {
  return (
    <div style={{
      width: '100%', aspectRatio: '210/297',
      background: '#fff', borderRadius: 6, overflow: 'hidden',
      fontSize: 6, color: '#333', padding: '8%', position: 'relative',
      boxShadow: isActive ? '0 8px 32px rgba(201, 168, 76, 0.3)' : '0 4px 16px rgba(0,0,0,0.15)',
      transition: 'box-shadow 0.3s ease',
    }}>
      {/* Faint watermark circle */}
      <div style={{
        position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '60%', height: '40%', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)',
      }} />
      {/* Header bar */}
      <div style={{ borderBottom: '1.5px solid #d4af37', paddingBottom: 6, marginBottom: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 9, color: '#b8860b', letterSpacing: 0.5 }}>JEWELLERS NAME</div>
        <div style={{ fontSize: 5, color: '#777', marginTop: 1 }}>Address • Phone • GSTIN</div>
        <div style={{ float: 'right', marginTop: -16, fontSize: 7, fontWeight: 700, color: '#333' }}>TAX INVOICE</div>
      </div>
      {/* Info boxes */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
        <div style={{ flex: 2, background: 'linear-gradient(135deg, #fff 60%, rgba(212,175,55,0.1))', border: '0.5px solid #e6d599', borderRadius: 3, padding: 4 }}>
          <div style={{ fontSize: 4.5, color: '#b8860b', fontWeight: 700 }}>BILLED TO</div>
          <div style={{ height: 3, width: '60%', background: '#ddd', borderRadius: 1, marginTop: 2 }} />
          <div style={{ height: 2, width: '40%', background: '#eee', borderRadius: 1, marginTop: 2 }} />
        </div>
        <div style={{ flex: 1, background: 'linear-gradient(135deg, #fff 40%, rgba(212,175,55,0.1))', border: '0.5px solid #e6d599', borderRadius: 3, padding: 4 }}>
          <div style={{ height: 2, width: '80%', background: '#ddd', borderRadius: 1, marginBottom: 3 }} />
          <div style={{ height: 2, width: '60%', background: '#ddd', borderRadius: 1 }} />
        </div>
      </div>
      {/* Table with gold header */}
      <div style={{ marginBottom: 5 }}>
        <div style={{ background: 'linear-gradient(90deg, #d4af37, #aa7c11)', height: 7, borderRadius: '2px 2px 0 0', display: 'flex', alignItems: 'center', padding: '0 3px' }}>
          {['#', 'Description', 'Wt', 'Value', 'Total'].map((h, i) => (
            <span key={i} style={{ color: '#fff', fontSize: 3.5, fontWeight: 600, flex: i === 1 ? 3 : 1, textAlign: i > 1 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {[1, 2, 3].map(r => (
          <div key={r} style={{ display: 'flex', padding: '2px 3px', borderBottom: '0.5px dashed #e6d599' }}>
            {[1, 2, 3, 4, 5].map((c, i) => (
              <span key={i} style={{ flex: i === 1 ? 3 : 1, height: 2, background: '#e0e0e0', borderRadius: 1, margin: '0 1px' }} />
            ))}
          </div>
        ))}
      </div>
      {/* Grand total */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'linear-gradient(90deg, #d4af37, #aa7c11)', color: '#fff', padding: '2px 6px', borderRadius: 2, fontSize: 5, fontWeight: 700 }}>
          TOTAL: ₹XX,XXX
        </div>
      </div>
    </div>
  );
}

function StandardPreview({ isActive }) {
  return (
    <div style={{
      width: '100%', aspectRatio: '210/297',
      background: '#fff', borderRadius: 6, overflow: 'hidden',
      fontSize: 6, color: '#333', padding: '8%', position: 'relative',
      boxShadow: isActive ? '0 8px 32px rgba(100,100,100,0.3)' : '0 4px 16px rgba(0,0,0,0.15)',
      transition: 'box-shadow 0.3s ease',
    }}>
      {/* Header — centered, minimal */}
      <div style={{ textAlign: 'center', borderBottom: '1px solid #333', paddingBottom: 6, marginBottom: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 10, color: '#111', letterSpacing: 1 }}>JEWELLERS NAME</div>
        <div style={{ fontSize: 4.5, color: '#666', marginTop: 2 }}>Address • Phone • Email</div>
        <div style={{ fontSize: 4, color: '#888', marginTop: 1 }}>GSTIN: XXXXX | PAN: XXXXX</div>
      </div>
      {/* Doc title + meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ fontWeight: 700, fontSize: 7, color: '#111' }}>TAX INVOICE</div>
        <div style={{ fontSize: 5, color: '#666' }}>No: INV-001 | Date: 01/01/2026</div>
      </div>
      {/* Customer info */}
      <div style={{ border: '0.5px solid #ccc', borderRadius: 2, padding: 4, marginBottom: 5 }}>
        <div style={{ fontSize: 4, color: '#888', fontWeight: 600, marginBottom: 2 }}>BILL TO</div>
        <div style={{ height: 2.5, width: '50%', background: '#ddd', borderRadius: 1 }} />
        <div style={{ height: 2, width: '35%', background: '#eee', borderRadius: 1, marginTop: 2 }} />
      </div>
      {/* Plain table */}
      <div style={{ marginBottom: 5 }}>
        <div style={{ background: '#222', height: 6, borderRadius: '2px 2px 0 0', display: 'flex', alignItems: 'center', padding: '0 3px' }}>
          {['#', 'Item', 'Wt', 'Rate', 'Amount'].map((h, i) => (
            <span key={i} style={{ color: '#fff', fontSize: 3.5, fontWeight: 600, flex: i === 1 ? 3 : 1, textAlign: i > 1 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {[1, 2, 3].map((r, idx) => (
          <div key={r} style={{ display: 'flex', padding: '2px 3px', borderBottom: '0.5px solid #ddd', background: idx % 2 === 0 ? '#fafafa' : '#fff' }}>
            {[1, 2, 3, 4, 5].map((c, i) => (
              <span key={i} style={{ flex: i === 1 ? 3 : 1, height: 2, background: '#e0e0e0', borderRadius: 1, margin: '0 1px' }} />
            ))}
          </div>
        ))}
      </div>
      {/* Totals — right aligned, no gradient */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: '#222', color: '#fff', padding: '2.5px 8px', borderRadius: 2, fontSize: 5, fontWeight: 700 }}>
          TOTAL: ₹XX,XXX
        </div>
      </div>
    </div>
  );
}


/* ─── Template Card ────────────────────────────────────────────── */
function TemplateCard({ id, name, description, isActive, onClick, children }) {
  return (
    <div
      id={id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{
        position: 'relative',
        flex: '1 1 300px',
        maxWidth: 360,
        borderRadius: 16,
        border: isActive ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        background: isActive
          ? 'linear-gradient(145deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.02) 100%)'
          : 'rgba(255,255,255,0.03)',
        boxShadow: isActive
          ? '0 12px 40px rgba(201,168,76,0.15), 0 0 0 1px rgba(201,168,76,0.2)'
          : '0 4px 20px rgba(0,0,0,0.2)',
        transform: isActive ? 'translateY(-4px) scale(1.02)' : 'scale(1)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Active indicator badge */}
      {isActive && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 5,
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(201,168,76,0.4)',
        }}>
          <i className="fa-solid fa-check" style={{ fontSize: 12, color: '#fff' }} />
        </div>
      )}

      {/* PDF Preview */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '75%', transition: 'transform 0.3s ease' }}>
          {children}
        </div>
      </div>

      {/* Label Area */}
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{
          fontSize: '1.05rem', fontWeight: 700,
          color: isActive ? 'var(--color-primary)' : 'var(--text-primary)',
          marginBottom: 4, transition: 'color 0.3s ease',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: '0.8rem', color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}>
          {description}
        </div>
      </div>
    </div>
  );
}


/* ─── Main Page ───────────────────────────────────────────────── */
export default function TemplateSelection() {
  const [selected, setSelected] = useState('classic');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { syncShop } = useAuth();

  const handleContinue = async () => {
    setSaving(true);
    try {
      await api.patch('/accounts/shop/current/', { pdf_template: selected });
      if (syncShop) await syncShop();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('[TemplateSelection] Failed to save template:', err);
      // Still allow the user to proceed — they can change template in settings
      navigate('/dashboard', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: 'var(--bg-main)',
      display: 'flex', flexDirection: 'column',
      padding: '40px 24px',
      overflowX: 'hidden',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <div style={{ margin: 'auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Header */}
      <div className="animate-fade-in" style={{ textAlign: 'center', marginBottom: 40, maxWidth: 600 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(201,168,76,0.1)',
          border: '1px solid rgba(201,168,76,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <i className="fa-solid fa-file-invoice" style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }} />
        </div>
        <h1 style={{
          fontSize: '1.8rem', fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 8px', letterSpacing: '-0.3px',
          fontFamily: 'var(--font-heading)',
        }}>
          Choose Your Invoice Template
        </h1>
        <p style={{
          fontSize: '0.95rem', color: 'var(--text-muted)',
          lineHeight: 1.6, margin: 0,
        }}>
          Select a default layout for your billing and order PDFs.
          <br />
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            You can always change this later from Settings.
          </span>
        </p>
      </div>

      {/* Template Cards */}
      <div className="animate-fade-in-up" style={{
        display: 'flex', gap: 28,
        justifyContent: 'center', flexWrap: 'wrap',
        marginBottom: 40, maxWidth: 800,
      }}>
        <TemplateCard
          id="template-classic"
          name="Classic"
          description="Gold & silver themed with gradient accents, decorative borders, and elegant typography. The signature JewelloSoft look."
          isActive={selected === 'classic'}
          onClick={() => setSelected('classic')}
        >
          <ClassicPreview isActive={selected === 'classic'} />
        </TemplateCard>

        <TemplateCard
          id="template-standard"
          name="Standard"
          description="Clean black & white layout with minimal styling. Universal, printer-friendly, and commonly used across the industry."
          isActive={selected === 'standard'}
          onClick={() => setSelected('standard')}
        >
          <StandardPreview isActive={selected === 'standard'} />
        </TemplateCard>
      </div>

      {/* Continue Button */}
      <div className="animate-fade-in-up" style={{ animationDelay: '150ms', textAlign: 'center' }}>
        <button
          className="btn btn--primary"
          onClick={handleContinue}
          disabled={saving}
          style={{
            padding: '14px 48px', fontSize: '1rem', fontWeight: 600,
            borderRadius: 12, minWidth: 220,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving && <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 8 }} />}
          {saving ? 'Saving...' : 'Continue to Dashboard'}
          {!saving && <i className="fa-solid fa-arrow-right" style={{ marginLeft: 10 }} />}
        </button>

        <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)', opacity: 0.6 }}>
          <i className="fa-solid fa-info-circle" style={{ marginRight: 4 }} />
          More templates will be available in future updates.
        </div>
      </div>
      </div>
    </div>
  );
}
