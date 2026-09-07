export default function Security() {
  return (
    <section className="section-security" id="security">
      <div className="container">
        <div className="security-inner">
          <div className="row align-items-center gy-5">
            <div className="col-lg-5 text-center animate-slide-left">
              <div className="security-shield">
                <i className="bi bi-shield-lock-fill"></i>
              </div>
            </div>
            <div className="col-lg-6 offset-lg-1 animate-slide-right">
              <div className="section-eyebrow">Security &amp; Privacy</div>
              <h2 className="section-title">Your Data Stays <em>With You</em></h2>
              <p className="section-body">
                JewelloSoft is engineered with a local-first philosophy. Every byte of your business data — customer information, billing records, inventory — lives on <em>your</em> computer and only your computer.
              </p>
              <div className="security-points">
                <div className="sec-point">
                  <i className="bi bi-database-lock"></i>
                  <div>
                    <strong>Local Storage Only</strong>
                    <p>No cloud, no external servers. Your data is stored in an encrypted local database on your PC.</p>
                  </div>
                </div>
                <div className="sec-point">
                  <i className="bi bi-eye-slash"></i>
                  <div>
                    <strong>Zero Data Sharing</strong>
                    <p>We have no access to your business records, customer names, or transaction history — ever.</p>
                  </div>
                </div>
                <div className="sec-point">
                  <i className="bi bi-key"></i>
                  <div>
                    <strong>Password Protected</strong>
                    <p>Role-based access ensures only authorised staff can access sensitive billing and reporting data.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
