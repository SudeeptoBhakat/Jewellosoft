import { useState } from 'react';

const faqList = [
  {
    id: 'faq1',
    q: 'Does JewelloSoft work without internet?',
    a: 'Yes, absolutely. JewelloSoft is built offline-first. It runs entirely on your local machine with no internet connection required. You can bill customers, manage inventory, and generate reports 24/7 — even during network outages.'
  },
  {
    id: 'faq2',
    q: 'Can I customise my invoices?',
    a: 'Yes. You can add your shop logo, choose from multiple layouts, show or hide specific charge fields (making charges, wastage, hallmarking), set custom terms & conditions, and export to a print-ready PDF.'
  },
  {
    id: 'faq3',
    q: 'Is my business data safe?',
    a: 'Completely safe. All data is stored in an encrypted local database on your computer. JewelloSoft has zero access to your records. No data is ever transmitted to any external server.'
  },
  {
    id: 'faq4',
    q: 'Is it suitable for small shops?',
    a: "Yes. JewelloSoft's free Basic plan is designed specifically for single-counter jewellery shops. It has no complexity, no setup fees, and anyone can learn it in a single day regardless of technical background."
  },
  {
    id: 'faq5',
    q: 'Does it support GST billing?',
    a: 'Yes. JewelloSoft auto-calculates GST on gold, silver, and making charges as per Indian tax regulations. It also generates GST-compliant invoices and summary reports ready for your accountant.'
  },
  {
    id: 'faq6',
    q: 'What operating systems are supported?',
    a: 'Currently JewelloSoft supports Windows 10 and Windows 11. A macOS version is under active development and will be released soon.'
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggleFAQ = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="section-faq alt-bg" id="faq">
      <div className="container">
        <div className="text-center mb-section">
          <div className="section-eyebrow">FAQ</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="gold-line-center"></div>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="accordion faq-accordion" id="faqAccordion">
              {faqList.map((item, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div className="accordion-item faq-item" key={item.id}>
                    <h2 className="accordion-header">
                      <button
                        className={`accordion-button faq-btn ${!isOpen ? 'collapsed' : ''}`}
                        type="button"
                        onClick={() => toggleFAQ(idx)}
                        aria-expanded={isOpen}
                      >
                        {item.q}
                      </button>
                    </h2>
                    <div className={`accordion-collapse collapse ${isOpen ? 'show' : ''}`}>
                      <div className="accordion-body faq-body">{item.a}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
