import { useState } from 'react';

export default function Feedback() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    feedback_type: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.feedback_type || !formData.message) return;

    setLoading(true);
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('email', formData.email);
      data.append('feedback_type', formData.feedback_type);
      data.append('message', formData.message);
      data.append('_subject', `JewelloSoft Feedback — ${formData.feedback_type}`);
      data.append('_template', 'table');
      data.append('_captcha', 'false');

      const res = await fetch('https://formsubmit.co/ajax/sudeeptabhakat03@gmail.com', {
        method: 'POST',
        body: data
      });
      const resData = await res.json();
      if (resData.success === 'true' || resData.success === true) {
        setSubmitted(true);
      } else {
        throw new Error('Fallback required');
      }
    } catch {
      const subject = encodeURIComponent(`JewelloSoft Feedback — ${formData.feedback_type}`);
      const body = encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\nFeedback Type: ${formData.feedback_type}\n\n${formData.message}`
      );
      window.location.href = `mailto:sudeeptabhakat03@gmail.com?subject=${subject}&body=${body}`;
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ name: '', email: '', feedback_type: '', message: '' });
    setSubmitted(false);
  };

  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (((e.clientX - rect.left) / rect.width) * 100).toFixed(1);
    const y = (((e.clientY - rect.top) / rect.height) * 100).toFixed(1);
    e.currentTarget.style.background = `radial-gradient(ellipse at ${x}% ${y}%, var(--gold-dim) 0%, var(--bg-card) 65%)`;
  };

  const handleCardMouseLeave = (e) => {
    e.currentTarget.style.background = '';
  };

  return (
    <section className="section-feedback" id="feedback">
      <div className="container">
        <div className="text-center mb-section">
          <div className="section-eyebrow animate-fadein">Feedback &amp; Suggestions</div>
          <h2 className="section-title animate-fadein">Help Us Build the <em>Next Version</em></h2>
          <div className="gold-line-center"></div>
          <p
            className="section-body text-center mt-3 animate-fadein"
            style={{ maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto' }}
          >
            Found a bug? Have a feature request? We'd love to hear from you — your feedback directly shapes the next release of JewelloSoft.
          </p>
        </div>

        <div className="row justify-content-center gy-4">
          <div className="col-lg-4 animate-slide-left">
            <div
              className="feedback-contact-card"
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="fcc-icon"><i className="bi bi-envelope-fill"></i></div>
              <h5>Email Us</h5>
              <p>Send your feedback, bugs or feature requests directly.</p>
              <a href="mailto:sudeeptabhakat03@gmail.com" className="fcc-link">sudeeptabhakat03@gmail.com</a>
            </div>

            <div
              className="feedback-contact-card mt-3"
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="fcc-icon"><i className="bi bi-phone-fill"></i></div>
              <h5>Call / WhatsApp</h5>
              <p>Speak directly for urgent issues or support.</p>
              <a href="tel:+919733248165" className="fcc-link">+91 97332 48165</a>
            </div>

            <div className="feedback-suggest-box mt-3 animate-fadein">
              <div className="fsb-header"><i className="bi bi-lightbulb-fill"></i> What to include</div>
              <ul>
                <li><strong>Bug?</strong> — Steps to reproduce, expected vs actual behaviour</li>
                <li><strong>Feature?</strong> — Describe what you need and how it helps</li>
                <li><strong>UI Issue?</strong> — Screenshot or screen area description</li>
                <li><strong>Performance?</strong> — When it slows down, your PC specs</li>
              </ul>
            </div>
          </div>

          <div className="col-lg-7 offset-lg-1 animate-slide-right">
            <div className="feedback-card">
              {!submitted ? (
                <form id="feedbackForm" className="feedback-form" onSubmit={handleSubmit}>
                  <div className="feedback-row">
                    <div className="feedback-field">
                      <label className="feedback-label" htmlFor="feedbackName">
                        <i className="bi bi-person me-1"></i>Your Name
                      </label>
                      <input
                        type="text"
                        id="feedbackName"
                        name="name"
                        className="feedback-input"
                        placeholder="e.g. Rajesh Kumar"
                        required
                        value={formData.name}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="feedback-field">
                      <label className="feedback-label" htmlFor="feedbackEmail">
                        <i className="bi bi-envelope me-1"></i>Your Email
                      </label>
                      <input
                        type="email"
                        id="feedbackEmail"
                        name="email"
                        className="feedback-input"
                        placeholder="e.g. rajesh@example.com"
                        required
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="feedback-field">
                    <label className="feedback-label" htmlFor="feedbackType">
                      <i className="bi bi-tag me-1"></i>Feedback Type
                    </label>
                    <select
                      id="feedbackType"
                      name="feedback_type"
                      className="feedback-input feedback-select"
                      required
                      value={formData.feedback_type}
                      onChange={handleChange}
                    >
                      <option value="" disabled>Select a category…</option>
                      <option value="Bug Report">Bug Report - Something isn't working</option>
                      <option value="Feature Request">Feature Request - I'd like a new capability</option>
                      <option value="UI/UX Improvement">UI/UX Improvement - Design or layout suggestion</option>
                      <option value="Performance Issue">Performance Issue - App is slow or crashing</option>
                      <option value="General Feedback">General Feedback - Other thoughts or praise</option>
                    </select>
                  </div>

                  <div className="feedback-field">
                    <label className="feedback-label" htmlFor="feedbackMessage">
                      <i className="bi bi-chat-left-text me-1"></i>Describe in Detail
                    </label>
                    <textarea
                      id="feedbackMessage"
                      name="message"
                      className="feedback-input feedback-textarea"
                      rows="5"
                      required
                      placeholder="Please describe the issue or suggestion in detail:&#10;&#10;• What happened / what do you need?&#10;• What did you expect to happen?&#10;• Steps to reproduce (if reporting a bug)&#10;• How would this feature help your workflow?"
                      value={formData.message}
                      onChange={handleChange}
                    ></textarea>
                  </div>

                  <div className="feedback-actions">
                    <button
                      type="submit"
                      className="btn btn-gold btn-lg feedback-submit-btn"
                      disabled={loading}
                      style={{ opacity: loading ? 0.7 : 1 }}
                    >
                      {loading ? (
                        <>
                          <i className="bi bi-hourglass-split me-2"></i>Sending…
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send-fill me-2"></i>Submit Feedback
                        </>
                      )}
                    </button>
                    <span className="feedback-privacy-note">
                      <i className="bi bi-shield-lock me-1"></i>Your data is sent directly to our team. We never share it.
                    </span>
                  </div>
                </form>
              ) : (
                <div className="feedback-success">
                  <div className="feedback-success-icon"><i className="bi bi-check-circle-fill"></i></div>
                  <h4>Thank You!</h4>
                  <p>Your feedback has been sent successfully. We'll review it and include improvements in the next release.</p>
                  <button type="button" className="btn btn-gold-outline" onClick={handleReset}>
                    Send Another
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
