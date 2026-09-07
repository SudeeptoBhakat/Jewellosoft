export default function MarqueeStrip() {
  const items = [
    'Smart Billing',
    'GST Ready',
    'Offline First',
    'Weight-Based Pricing',
    'PDF Invoices',
    'Inventory Management',
    'Customer Ledger',
    'Payment Tracking',
    'Business Reports'
  ];

  return (
    <div className="marquee-strip">
      <div className="marquee-track">
        {items.map((item, idx) => (
          <span key={`m1-${idx}`}>
            <span>{item}</span>
            <i className="bi bi-gem mx-3"></i>
          </span>
        ))}
        {items.map((item, idx) => (
          <span key={`m2-${idx}`}>
            <span>{item}</span>
            <i className="bi bi-gem mx-3"></i>
          </span>
        ))}
      </div>
    </div>
  );
}
