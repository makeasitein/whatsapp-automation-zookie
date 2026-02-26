import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-dark p-6 md:p-12 text-text-main font-outfit">
      <div className="max-w-4xl mx-auto glass-panel p-8 md:p-12">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-primary hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>

        <h1 className="text-3xl font-bold mb-6 text-white">Terms and Conditions</h1>
        <p className="text-muted text-sm mb-8">Last Updated: February 26, 2026</p>

        <div className="space-y-8 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to WappBroaddcast. By accessing or using our website and services, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Use of Service</h2>
            <p className="mb-2">
              Our service provides WhatsApp automation tools for businesses. You agree to use this service only for lawful purposes and in accordance with WhatsApp's Business Policy and Commerce Policy.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>You must not use the service to send spam or unsolicited messages.</li>
              <li>You are responsible for obtaining necessary consents from your contacts before messaging them.</li>
              <li>We reserve the right to suspend your account if you violate WhatsApp's policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Payment and Subscription</h2>
            <p>
              Access to WappBroaddcast is provided on a prepaid monthly basis. Payments are processed securely via Razorpay.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Fees:</strong> You agree to pay the fees associated with your selected plan (₹600/month).</li>
              <li><strong>Billing Cycle:</strong> Service is active until the 7th of the following month after payment.</li>
              <li><strong>Modifications:</strong> We reserve the right to change our pricing tailored to future updates, with notice provided before your next billing cycle.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Limitation of Liability</h2>
            <p>
              WappBroaddcast shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Termination</h2>
            <p>
              We may terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at makeasite.in@gmail.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
