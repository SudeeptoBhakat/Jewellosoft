import { useState, useMemo, useEffect } from 'react';
import api, { extractList } from '../../lib/axios';
import ProductNameInput from '../../components/elements/ProductNameInput';


function ProductModal({ product, onClose, onSave }) {
  const isEdit = !!product;
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [name, setName] = useState(product?.name || '');
  const [metalType, setMetalType] = useState(product?.metal_type ? product.metal_type.charAt(0).toUpperCase() + product.metal_type.slice(1) : 'Gold');
  const [purity, setPurity] = useState(product?.purity || '22K');
  const [huid, setHuid] = useState(product?.huid || '');
  const [netWeight, setNetWeight] = useState(product?.net_weight?.toString() || '');
  const [location, setLocation] = useState(product?.location || '');
  const [imagePreview, setImagePreview] = useState(product?.image || null);
  const [imageFile, setImageFile] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!barcode.trim() || !name.trim()) return;
    onSave({
      id: product?.id || null,
      barcode: barcode.trim(),
      name: name.trim(),
      metal_type: metalType.toLowerCase(),
      purity,
      huid: huid.trim(),
      net_weight: parseFloat(netWeight) || 0,
      location: location.trim(),
      imageFile: imageFile, // the actual file for FormData
      status: product?.status || 'available', // keep existing status or default
    });
    // Form disables save button during loading, onClose shouldn't happen immediately if loading, but for simplicity:
    onClose();
  };

  const purityOptions = metalType === 'Gold' ? ['24K', '22K', '18K', '14K'] : metalType === 'Silver' ? ['999', '925', '900'] : ['950', '900', '850'];

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 580, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="modal__header">
          <h2 className="modal__title">
            <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-plus-circle'}`} style={{ marginRight: 8, color: 'var(--color-primary)' }}></i>
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div style={{ padding: 'var(--space-5)' }}>
          {/* Image Upload */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Product Image</label>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
              <div
                onClick={() => document.getElementById('product-img-input')?.click()}
                style={{
                  width: 100, height: 100, borderRadius: 'var(--radius-md)',
                  border: '2px dashed var(--border-hover)', background: 'var(--bg-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
                  transition: 'border-color 150ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-camera" style={{ fontSize: '1.2rem', display: 'block', marginBottom: 4 }}></i>
                    <span style={{ fontSize: 'var(--text-xs)' }}>Upload</span>
                  </div>
                )}
              </div>
              <input id="product-img-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
              <div style={{ flex: 1 }}>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label">Barcode / SKU *</label>
                  <input className="form-input" type="text" placeholder="JW-GN-001" value={barcode} onChange={e => setBarcode(e.target.value)} id="product-barcode" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Product Name *</label>
                  <ProductNameInput value={name} onChange={val => setName(val)} placeholder="Gold Necklace — Rani Haar" id="product-name" autoFocus />
                </div>
              </div>
            </div>
          </div>

          {/* Metal & Purity */}
          <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Metal Type *</label>
              <select className="form-input form-select" value={metalType} onChange={e => { setMetalType(e.target.value); setPurity(e.target.value === 'Gold' ? '22K' : '925'); }} id="product-metal">
                <option>Gold</option>
                <option>Silver</option>
                <option>Platinum</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Purity</label>
              <select className="form-input form-select" value={purity} onChange={e => setPurity(e.target.value)} id="product-purity">
                {purityOptions.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* HUID & Weight */}
          <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">HUID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Hallmark ID)</span></label>
              <input className="form-input" type="text" placeholder="AB12C3" value={huid} onChange={e => setHuid(e.target.value)} maxLength={6} id="product-huid" style={{ fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Net Weight (g) *</label>
              <input className="form-input" type="number" step="0.001" placeholder="0.000" value={netWeight} onChange={e => setNetWeight(e.target.value)} id="product-weight" />
            </div>
          </div>

          {/* Location */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Storage Location</label>
            <input className="form-input" type="text" placeholder="Vault A — Shelf 1" value={location} onChange={e => setLocation(e.target.value)} id="product-location" />
          </div>
        </div>

        <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!barcode.trim() || !name.trim()}>
            <i className={`fa-solid ${isEdit ? 'fa-check' : 'fa-plus'}`}></i>
            {isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   DELETE MODAL
   ═══════════════════════════════════════════ */
function DeleteModal({ product, onClose, onConfirm }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const handleDelete = () => {
    if (password === 'admin123') { onConfirm(product.id); onClose(); }
    else { setError('Incorrect password.'); setTimeout(() => setError(''), 3000); }
  };
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal__header">
          <h2 className="modal__title" style={{ color: 'var(--color-danger)' }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>Delete Product</h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal__body">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            Delete <strong style={{ color: 'var(--text-primary)' }}>{product?.name}</strong> ({product?.barcode})?
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>This action cannot be undone.</p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Admin Password *</label>
            <input className={`form-input${error ? ' form-input--error' : ''}`} type="password" placeholder="Enter password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleDelete()} autoFocus />
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--danger" onClick={handleDelete} disabled={!password}><i className="fa-solid fa-trash-can"></i> Delete</button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   INVENTORY PAGE
   ═══════════════════════════════════════════ */
export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [metalFilter, setMetalFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');

  const [addModal, setAddModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [deleteProduct, setDeleteProduct] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/');
      const records = extractList(res.data);
      const data = records.map(p => ({
        ...p,
        inStock: p.status === 'available',
      }));
      setProducts(data);
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  /* ─── Unique locations for filter ─── */
  const locations = useMemo(() => ['All', ...new Set(products.map(p => p.location).filter(Boolean))], [products]);

  /* ─── Stats ─── */
  const stats = useMemo(() => ({
    total: products.length,
    inStock: products.filter(p => p.inStock).length,
    outOfStock: products.filter(p => !p.inStock).length,
    totalWeight: products.filter(p => p.inStock).reduce((s, p) => s + Number(p.net_weight), 0),
    gold: products.filter(p => p.metal_type?.toLowerCase() === 'gold' && p.inStock).length,
    silver: products.filter(p => p.metal_type?.toLowerCase() === 'silver' && p.inStock).length,
  }), [products]);

  /* ─── Filtered ─── */
  const filtered = useMemo(() => {
    return products.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q) || (p.huid || '').toLowerCase().includes(q);
      const matchMetal = metalFilter === 'All' || p.metal_type?.toLowerCase() === metalFilter.toLowerCase();
      const matchStock = stockFilter === 'All' || (stockFilter === 'In Stock' ? p.inStock : !p.inStock);
      const matchLoc = locationFilter === 'All' || p.location === locationFilter;
      return matchSearch && matchMetal && matchStock && matchLoc;
    });
  }, [products, search, metalFilter, stockFilter, locationFilter]);

  /* ─── Handlers ─── */
  const handleSaveProduct = async (productData) => {
    try {
      // Build form data
      const formData = new FormData();
      Object.entries(productData).forEach(([key, value]) => {
        if (key === 'imageFile') {
          if (value) formData.append('image', value);
        } else if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      if (productData.id) {
        // Edit
        await api.put(`/inventory/${productData.id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Create
        // Assume default shop 1 for demo if your API requires it (otherwise handled by auth)
        formData.append('shop', 1);
        await api.post(`/inventory/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      fetchProducts();
    } catch (err) {
      console.error("Failed to save product:", err);
      alert("Failed to save product. Ensure all fields are valid.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/inventory/${id}/`);
      fetchProducts();
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/inventory/${id}/`, { status });
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status, inStock: status === 'available' } : p));
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleRestock = (id) => handleStatusChange(id, 'available');
  const handleMarkOutOfStock = (id) => handleStatusChange(id, 'sold');

  const hasFilters = search || metalFilter !== 'All' || stockFilter !== 'All' || locationFilter !== 'All';
  const clearFilters = () => { setSearch(''); setMetalFilter('All'); setStockFilter('All'); setLocationFilter('All'); };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Inventory Management</h1>
          <div className="page-header__actions">
            <button className="btn btn--ghost btn--sm"><i className="fa-solid fa-download"></i> Export</button>
            <button className="btn btn--primary" onClick={() => setAddModal(true)}>
              <i className="fa-solid fa-plus"></i> Add Product
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">Manage your jewelry inventory, stock levels, and product catalog.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 'var(--space-4)' }}>
        {[
          { label: 'Total Products', value: stats.total, icon: 'fa-gem', color: 'primary' },
          { label: 'In Stock', value: stats.inStock, icon: 'fa-check-circle', color: 'success' },
          { label: 'Out of Stock', value: stats.outOfStock, icon: 'fa-exclamation-circle', color: 'danger' },
          { label: 'Total Weight', value: `${stats.totalWeight.toFixed(1)}g`, icon: 'fa-scale-balanced', color: 'warning' },
          { label: 'Gold Items', value: stats.gold, icon: 'fa-coins', color: 'warning' },
          { label: 'Silver Items', value: stats.silver, icon: 'fa-coins', color: 'info' },
        ].map((s, i) => (
          <div key={i} className="card animate-fade-in-up" style={{ padding: 'var(--space-4)' }}>
            <div className="card__header" style={{ marginBottom: 0 }}>
              <div>
                <div className="card__value" style={{ fontSize: 'var(--text-xl)' }}>{s.value}</div>
                <div className="card__label">{s.label}</div>
              </div>
              <div className={`card__icon card__icon--${s.color}`} style={{ width: 36, height: 36 }}><i className={`fa-solid ${s.icon}`}></i></div>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alert Banner */}
      {stats.outOfStock > 0 && (
        <div className="animate-fade-in-up" style={{
          background: 'var(--color-danger-muted)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-5)',
          marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-lg)' }}></i>
          <div>
            <strong style={{ color: 'var(--color-danger)' }}>{stats.outOfStock} product{stats.outOfStock > 1 ? 's' : ''} out of stock!</strong>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 'var(--text-sm)' }}>
              {products.filter(p => !p.inStock).map(p => p.name.split('—')[0].trim()).join(', ')}
            </span>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => setStockFilter('Out of Stock')} style={{ marginLeft: 'auto', flexShrink: 0 }}>
            View All
          </button>
        </div>
      )}

      {/* Filters + Table */}
      <div className="data-table-wrapper animate-fade-in-up">
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', minWidth: 200 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Search</label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', pointerEvents: 'none' }}></i>
                <input className="form-input" type="text" placeholder="Name, barcode, HUID..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34, height: 36, fontSize: 'var(--text-sm)' }} id="inv-search" />
              </div>
            </div>
            <div style={{ minWidth: 110 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Metal</label>
              <select className="form-input form-select" value={metalFilter} onChange={e => setMetalFilter(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }}>
                <option>All</option><option>Gold</option><option>Silver</option><option>Platinum</option>
              </select>
            </div>
            <div style={{ minWidth: 120 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Stock</label>
              <select className="form-input form-select" value={stockFilter} onChange={e => setStockFilter(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }}>
                <option>All</option><option>In Stock</option><option>Out of Stock</option>
              </select>
            </div>
            <div style={{ minWidth: 160 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Location</label>
              <select className="form-input form-select" value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }}>
                {locations.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            {hasFilters && <button className="btn btn--ghost btn--sm" onClick={clearFilters} style={{ height: 36 }}><i className="fa-solid fa-xmark"></i> Clear</button>}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            Showing {filtered.length} of {products.length} products
            {hasFilters && <span style={{ color: 'var(--color-primary)', marginLeft: 8 }}>(filtered)</span>}
          </div>
        </div>

        {/* Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}></th>
              <th>Barcode</th>
              <th>Product Name</th>
              <th>Metal</th>
              <th>Purity</th>
              <th>HUID</th>
              <th>Net Weight</th>
              <th>Location</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>
                  <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div className="spinner"></div>
                    <div style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>Loading inventory...</div>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <i className="fa-solid fa-box-open" style={{ fontSize: '2rem', opacity: 0.2, display: 'block', marginBottom: 'var(--space-2)' }}></i>
                    <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>No products found</div>
                    {hasFilters && <button className="btn btn--ghost btn--sm" onClick={clearFilters} style={{ marginTop: 'var(--space-3)' }}>Clear filters</button>}
                  </div>
                </td>
              </tr>
            ) : filtered.map(product => {
              const isOut = !product.inStock;
              return (
                <tr key={product.id} style={{ opacity: isOut ? 0.4 : 1, transition: 'opacity 0.2s ease', position: 'relative' }}>
                  {/* Image Thumbnail */}
                  <td>
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                      background: product.image ? 'transparent' : (product.metal_type === 'gold' ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : product.metal_type === 'silver' ? 'linear-gradient(135deg, #e2e8f0, #94a3b8)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', fontSize: '0.7rem', color: product.metal_type === 'gold' ? '#78350f' : '#1e293b',
                      filter: isOut ? 'grayscale(1)' : 'none',
                    }}>
                      {product.image ? (
                        <img src={product.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <i className="fa-solid fa-gem"></i>
                      )}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', letterSpacing: '0.03em', color: 'var(--text-secondary)' }}>{product.barcode}</td>
                  <td style={{ fontWeight: 600 }}>{product.name}</td>
                  <td>
                    <span className={`badge badge--${product.metal_type === 'gold' ? 'warning' : product.metal_type === 'silver' ? 'info' : 'primary'}`} style={{ fontSize: '0.6rem', textTransform: 'capitalize' }}>
                      {product.metal_type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{product.purity}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: product.huid ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{product.huid || '—'}</td>
                  <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Number(product.net_weight).toFixed(3)}g</td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-location-dot" style={{ marginRight: 4, opacity: 0.5 }}></i>
                    {product.location || '—'}
                  </td>
                  <td>
                    {isOut ? (
                      <span className="badge badge--danger">Out of Stock</span>
                    ) : (
                      <span className="badge badge--success">In Stock</span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                    <div className="flex gap-1" style={{ justifyContent: 'center', opacity: isOut ? 1 : undefined }}>
                      {isOut ? (
                        /* Out of stock — only ReStock is highlighted */
                        <>
                          <button className="btn btn--ghost btn--sm btn--icon" title="Edit" style={{ opacity: 0.3, pointerEvents: 'none' }}><i className="fa-solid fa-pen-to-square"></i></button>
                          <button
                            className="btn btn--success btn--sm"
                            onClick={() => handleRestock(product.id)}
                            style={{ gap: 4, fontWeight: 700, boxShadow: '0 0 12px rgba(34,197,94,0.4)' }}
                            title="Restock this product"
                          >
                            <i className="fa-solid fa-rotate-right"></i> ReStock
                          </button>
                          <button className="btn btn--ghost btn--sm btn--icon" title="Delete" style={{ opacity: 0.3, pointerEvents: 'none', color: 'var(--color-danger)' }}><i className="fa-solid fa-trash-can"></i></button>
                        </>
                      ) : (
                        /* In stock — Edit, Mark Out, Delete */
                        <>
                          <button className="btn btn--ghost btn--sm btn--icon" title="Edit" onClick={() => setEditProduct(product)}><i className="fa-solid fa-pen-to-square"></i></button>
                          <button className="btn btn--ghost btn--sm btn--icon" title="Mark Out of Stock" onClick={() => handleMarkOutOfStock(product.id)} style={{ color: 'var(--color-warning)' }}><i className="fa-solid fa-ban"></i></button>
                          <button className="btn btn--ghost btn--sm btn--icon" title="Delete" style={{ color: 'var(--color-danger)' }} onClick={() => setDeleteProduct(product)}><i className="fa-solid fa-trash-can"></i></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="data-table__pagination">
            <span>Showing 1–{filtered.length} of {filtered.length} products</span>
            <div className="flex gap-2">
              <button className="btn btn--ghost btn--sm" disabled>Previous</button>
              <button className="btn btn--primary btn--sm">1</button>
              <button className="btn btn--ghost btn--sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {addModal && <ProductModal product={null} onClose={() => setAddModal(false)} onSave={handleSaveProduct} />}
      {editProduct && <ProductModal product={editProduct} onClose={() => setEditProduct(null)} onSave={handleSaveProduct} />}
      {deleteProduct && <DeleteModal product={deleteProduct} onClose={() => setDeleteProduct(null)} onConfirm={handleDelete} />}
    </div>
  );
}
