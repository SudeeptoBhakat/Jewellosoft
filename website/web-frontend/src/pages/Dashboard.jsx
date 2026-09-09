import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getProfile,
  updateProfile,
  getPlans,
  createPaymentOrder,
  verifyPayment,
  getUserSubscription
} from '../services/api';

export default function Dashboard() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState({
    shop_name: '',
    owner_name: '',
    mobile_number: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [scheduledSubscription, setScheduledSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(null);

  const fetchSubscriptionData = useCallback(async () => {
    try {
      const res = await getUserSubscription();
      if (res.success) {
        setSubscription(res.subscription);
        setScheduledSubscription(res.scheduled_subscription || null);
        setInvoices(res.invoices || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchPlansData = useCallback(async () => {
    try {
      const res = await getPlans();
      if (res.success && res.plans) {
        setPlans(res.plans);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const initData = async () => {
      try {
        const res = await getProfile();
        if (res.success && res.user) {
          updateUser(res.user);
          setProfileData({
            shop_name: res.user.shop_name || '',
            owner_name: res.user.owner_name || '',
            mobile_number: res.user.mobile_number || ''
          });
        }
      } catch (err) {
        if (err.response?.status === 401) {
          logout();
          navigate('/login');
          return;
        }
      }

      await Promise.all([fetchSubscriptionData(), fetchPlansData()]);
      setInitialLoading(false);
    };

    initData();
  }, [logout, navigate, updateUser, fetchSubscriptionData, fetchPlansData]);

  const handleInputChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handleCancel = () => {
    if (user) {
      setProfileData({
        shop_name: user.shop_name || '',
        owner_name: user.owner_name || '',
        mobile_number: user.mobile_number || ''
      });
    }
    setIsEditing(false);
    setFeedback({ type: '', message: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!profileData.shop_name.trim() || !profileData.owner_name.trim()) {
      setFeedback({ type: 'danger', message: 'Shop name and owner name are required.' });
      return;
    }

    try {
      setLoading(true);
      const res = await updateProfile({
        shop_name: profileData.shop_name,
        owner_name: profileData.owner_name,
        mobile_number: profileData.mobile_number
      });

      if (res.success && res.user) {
        updateUser(res.user);
        setFeedback({ type: 'success', message: 'Profile updated successfully.' });
        setIsEditing(false);
      } else {
        setFeedback({ type: 'danger', message: res.message || 'Failed to update profile.' });
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Error updating profile.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    setFeedback({ type: '', message: '' });

    if (!window.Razorpay) {
      setFeedback({
        type: 'danger',
        message: 'Razorpay SDK failed to load. Please check your internet connection.'
      });
      return;
    }

    try {
      setPaymentLoading(planId);
      const orderData = await createPaymentOrder(planId);

      if (!orderData.success) {
        setFeedback({
          type: 'danger',
          message: orderData.message || 'Failed to initiate payment.'
        });
        setPaymentLoading(null);
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'JewelloSoft',
        description: `${orderData.plan.name} Subscription`,
        image: '/logo.png',
        order_id: orderData.gateway_order_id,
        handler: async (response) => {
          try {
            const verifyRes = await verifyPayment({
              order_id: orderData.order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyRes.success) {
              setFeedback({
                type: 'success',
                message: 'Payment verified successfully! Your subscription is now active.'
              });
              await fetchSubscriptionData();
            } else {
              setFeedback({
                type: 'danger',
                message: verifyRes.message || 'Payment verification failed.'
              });
            }
          } catch (verifyErr) {
            setFeedback({
              type: 'danger',
              message: verifyErr.response?.data?.message || 'Payment verification error.'
            });
          } finally {
            setPaymentLoading(null);
          }
        },
        prefill: {
          name: user?.owner_name || '',
          email: user?.email || '',
          contact: user?.mobile_number || ''
        },
        theme: {
          color: '#C9A84C'
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(null);
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', (failRes) => {
        setFeedback({
          type: 'danger',
          message: failRes.error?.description || 'Payment transaction failed.'
        });
        setPaymentLoading(null);
      });
      rzpInstance.open();
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Error processing payment order.'
      });
      setPaymentLoading(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amountInPaise, currency = 'INR') => {
    const num = Number(amountInPaise) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(num);
  };

  if (initialLoading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="spinner-border text-gold" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-color)'
        }}
      >
        <Link to="/" className="text-decoration-none d-inline-flex align-items-center gap-2">
          <img src="/logo.png" alt="JewelloSoft" style={{ width: '32px', height: 'auto' }} />
          <span className="brand-name fs-5">JewelloSoft</span>
        </Link>

        <div className="d-flex align-items-center gap-2">
          <Link to="/" className="btn btn-outline-secondary btn-sm px-3 rounded-pill text-decoration-none">
            <i className="bi bi-house me-1"></i> Home
          </Link>
          <button
            type="button"
            className="btn btn-danger btn-sm px-3 rounded-pill"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-right me-1"></i> Logout
          </button>
        </div>
      </header>

      <main className="container my-5 flex-grow-1" style={{ maxWidth: '1000px' }}>
        {feedback.message && (
          <div
            className={`alert alert-${feedback.type} py-2 px-3 small rounded-3 mb-4 border-0 d-flex align-items-center justify-content-between`}
            role="alert"
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              className="btn-close btn-close-white ms-2"
              aria-label="Close"
              onClick={() => setFeedback({ type: '', message: '' })}
            ></button>
          </div>
        )}

        <div
          className="card p-4 p-md-5 rounded-4 mb-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center pb-4 mb-4 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
            <div className="d-flex align-items-center gap-3 mb-3 mb-sm-0">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-bold fs-4"
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'var(--gold-dim)',
                  color: 'var(--gold)',
                  border: '1px solid var(--gold-border)'
                }}
              >
                {(user?.shop_name || user?.owner_name || 'J').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-heading fs-4 mb-0" style={{ color: 'var(--text-primary)' }}>
                  {user?.shop_name || 'Jewellery Business'}
                </h3>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2 py-1 small">
                    Active {user?.profile_type || 'TENANT'}
                  </span>
                  {subscription ? (
                    <span className="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 small">
                      {subscription.plan_name}
                    </span>
                  ) : (
                    <span className="badge rounded-pill bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1 small">
                      Free Trial
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!isEditing ? (
              <button
                type="button"
                className="btn btn-gold-outline btn-sm px-4 rounded-pill"
                onClick={() => {
                  setFeedback({ type: '', message: '' });
                  setIsEditing(true);
                }}
              >
                <i className="bi bi-pencil-square me-1"></i> Edit Profile
              </button>
            ) : null}
          </div>

          {!isEditing ? (
            <div className="row g-4">
              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="small mb-1" style={{ color: 'var(--text-muted)' }}>Shop Name</div>
                  <div className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                    {user?.shop_name || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="small mb-1" style={{ color: 'var(--text-muted)' }}>Owner Name</div>
                  <div className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                    {user?.owner_name || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="small mb-1" style={{ color: 'var(--text-muted)' }}>Email Address</div>
                  <div className="fw-semibold text-break" style={{ color: 'var(--text-primary)' }}>
                    {user?.email || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="small mb-1" style={{ color: 'var(--text-muted)' }}>Mobile Number</div>
                  <div className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                    {user?.mobile_number || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="small mb-1" style={{ color: 'var(--text-muted)' }}>Member Since</div>
                  <div className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(user?.created_at)}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="small mb-1" style={{ color: 'var(--text-muted)' }}>Last Updated</div>
                  <div className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(user?.updated_at)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                    Shop Name *
                  </label>
                  <input
                    type="text"
                    name="shop_name"
                    className="form-control"
                    value={profileData.shop_name}
                    onChange={handleInputChange}
                    required
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                    Owner Name *
                  </label>
                  <input
                    type="text"
                    name="owner_name"
                    className="form-control"
                    value={profileData.owner_name}
                    onChange={handleInputChange}
                    required
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    name="mobile_number"
                    className="form-control"
                    value={profileData.mobile_number}
                    onChange={handleInputChange}
                    placeholder="9876543210"
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                    Email Address (Read-only)
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={user?.email || ''}
                    disabled
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                      opacity: 0.7
                    }}
                  />
                </div>
              </div>

              <div className="d-flex gap-2 justify-content-end mt-4 pt-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-4 rounded-3"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-gold btn-sm px-4 rounded-3 fw-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  ) : null}
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </div>

        <div
          className="card p-4 p-md-5 rounded-4 mb-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div className="pb-3 mb-4 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
            <h4 className="font-heading fs-4 mb-1" style={{ color: 'var(--text-primary)' }}>
              Current Subscription
            </h4>
            <p className="small mb-0" style={{ color: 'var(--text-secondary)' }}>
              Manage your JewelloSoft software licence and billing
            </p>
          </div>

          {subscription ? (
            <div className="p-4 rounded-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                  <span className="badge bg-success px-3 py-2 rounded-pill mb-2">ACTIVE LICENCE</span>
                  <h4 className="font-heading fs-3 mb-1" style={{ color: 'var(--gold)' }}>
                    {subscription.plan_name}
                  </h4>
                  <div className="small" style={{ color: 'var(--text-secondary)' }}>
                    Billing Interval: Every {subscription.billing_interval.toLowerCase()}
                  </div>
                </div>

                <div className="text-md-end">
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Valid Until</div>
                  <div className="fs-5 fw-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(subscription.expires_at)}
                  </div>
                </div>
              </div>

              {scheduledSubscription && (
                <div className="p-3 mt-3 rounded-3 bg-info-subtle text-info border border-info-subtle d-flex align-items-center gap-2 small">
                  <i className="bi bi-calendar2-check-fill fs-5"></i>
                  <div>
                    <strong>Scheduled Change: </strong>
                    <span>{scheduledSubscription.plan_name} is scheduled to activate on {formatDate(scheduledSubscription.starts_at)} after your current cycle completes.</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-4 text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-color)' }}>
              <div className="fs-2 text-gold mb-2">
                <i className="bi bi-gem"></i>
              </div>
              <h5 style={{ color: 'var(--text-primary)' }}>No Active Paid Subscription</h5>
              <p className="small mx-auto mb-0" style={{ color: 'var(--text-secondary)', maxWidth: '500px' }}>
                Choose a plan below to activate your jewellery billing licence with official GST invoice, live gold rate integration, and cloud sync.
              </p>
            </div>
          )}
        </div>

        <div
          className="card p-4 p-md-5 rounded-4 mb-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div className="pb-3 mb-4 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
            <h4 className="font-heading fs-4 mb-1" style={{ color: 'var(--text-primary)' }}>
              Available Licence Plans
            </h4>
            <p className="small mb-0" style={{ color: 'var(--text-secondary)' }}>
              Instant activation via secure Razorpay payment gateway
            </p>
          </div>

          <div className="row g-4">
            {plans.map((p) => {
              const isCurrent = subscription?.plan_id === p.id;
              const features = Array.isArray(p.features?.items) ? p.features.items : [];
              const isProcessing = paymentLoading === p.id;

              let buttonText = 'Subscribe with Razorpay';
              let buttonClass = 'btn-gold';

              if (subscription) {
                if (isCurrent) {
                  buttonText = `Extend Validity (+1 ${p.billing_interval.toLowerCase()})`;
                  buttonClass = 'btn-gold-outline';
                } else if (Number(p.amount) > Number(subscription.plan_amount)) {
                  buttonText = 'Upgrade (Prorated Credit)';
                  buttonClass = 'btn-gold';
                } else {
                  buttonText = 'Schedule Downgrade';
                  buttonClass = 'btn-outline-secondary';
                }
              }

              return (
                <div key={p.id} className="col-12 col-lg-4">
                  <div
                    className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: isCurrent ? '2px solid var(--gold)' : '1px solid var(--border-color)',
                      boxShadow: isCurrent ? 'var(--shadow-gold)' : 'none'
                    }}
                  >
                    <div>
                      {isCurrent && (
                        <div className="mb-2">
                          <span className="badge bg-gold text-dark fw-bold px-2 py-1 small">CURRENT PLAN</span>
                        </div>
                      )}
                      <h5 className="font-heading mb-1" style={{ color: 'var(--text-primary)' }}>
                        {p.name}
                      </h5>
                      <div className="fs-3 fw-bold mb-3" style={{ color: 'var(--gold)' }}>
                        {formatCurrency(p.amount, p.currency)}
                        <span className="fs-6 fw-normal ms-1" style={{ color: 'var(--text-muted)' }}>
                          / {p.billing_interval.toLowerCase()}
                        </span>
                      </div>

                      {p.features?.summary && (
                        <p className="small mb-3" style={{ color: 'var(--text-secondary)' }}>
                          {p.features.summary}
                        </p>
                      )}

                      <ul className="list-unstyled small mb-4">
                        {features.map((item, idx) => (
                          <li key={idx} className="mb-2 d-flex align-items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                            <i className="bi bi-check-circle-fill text-gold mt-1"></i>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      className={`btn w-100 py-2 fw-semibold rounded-3 ${buttonClass}`}
                      disabled={isProcessing}
                      onClick={() => handleSubscribe(p.id)}
                    >
                      {isProcessing ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Processing...
                        </>
                      ) : (
                        buttonText
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {invoices.length > 0 && (
          <div
            className="card p-4 p-md-5 rounded-4 mb-4"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <div className="pb-3 mb-4 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <h4 className="font-heading fs-4 mb-1" style={{ color: 'var(--text-primary)' }}>
                Billing History & Invoices
              </h4>
              <p className="small mb-0" style={{ color: 'var(--text-secondary)' }}>
                Past subscription payments and tax invoices
              </p>
            </div>

            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr style={{ borderColor: 'var(--border-color)' }}>
                    <th scope="col" className="small" style={{ color: 'var(--text-muted)' }}>INVOICE</th>
                    <th scope="col" className="small" style={{ color: 'var(--text-muted)' }}>DATE</th>
                    <th scope="col" className="small" style={{ color: 'var(--text-muted)' }}>METHOD</th>
                    <th scope="col" className="small" style={{ color: 'var(--text-muted)' }}>AMOUNT</th>
                    <th scope="col" className="small" style={{ color: 'var(--text-muted)' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} style={{ borderColor: 'var(--border-color)' }}>
                      <td className="fw-medium font-monospace" style={{ color: 'var(--gold)' }}>
                        {inv.invoice_number}
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>
                        {formatDate(inv.issued_at)}
                      </td>
                      <td className="small text-uppercase" style={{ color: 'var(--text-secondary)' }}>
                        {inv.payment_method || 'RAZORPAY'}
                      </td>
                      <td className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(inv.amount, inv.currency)}
                      </td>
                      <td>
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
