export default function HowItWorks() {
  const steps = [
    { num: '01', icon: 'bi-download', title: 'Install Software', text: 'Download the .exe and install in under 2 minutes on your Windows PC.' },
    { num: '02', icon: 'bi-shop-window', title: 'Setup Your Shop', text: 'Enter your shop name, GST number, logo, and basic preferences.' },
    { num: '03', icon: 'bi-boxes', title: 'Add Inventory', text: 'Import or manually add your jewellery stock with weights and categories.' },
    { num: '04', icon: 'bi-receipt', title: 'Create Bills', text: 'Pick items, add charges, and generate a professional invoice instantly.' },
    { num: '05', icon: 'bi-graph-up-arrow', title: 'Track Reports', text: 'View daily sales, GST summaries, and inventory value at any time.' }
  ];

  return (
    <section className="section-hiw" id="how-it-works">
      <div className="container">
        <div className="text-center mb-section">
          <div className="section-eyebrow">Getting Started</div>
          <h2 className="section-title">Up &amp; Running in Minutes</h2>
          <div className="gold-line-center"></div>
        </div>

        <div className="hiw-steps">
          {steps.map((step, idx) => (
            <div
              key={step.num}
              className="hiw-step animate-fadein"
              style={{ animationDelay: idx === 0 ? '0s' : `${idx * 0.1}s` }}
            >
              <div className="hiw-num">{step.num}</div>
              {idx < steps.length - 1 && <div className="hiw-connector"></div>}
              <div className="hiw-icon"><i className={`bi ${step.icon}`}></i></div>
              <h5>{step.title}</h5>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
