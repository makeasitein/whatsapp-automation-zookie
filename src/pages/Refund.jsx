import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Refund = () => {
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

        <h1 className="text-3xl font-bold mb-6 text-white">Refund and Cancellation Policy</h1>
        <p className="text-muted text-sm mb-8">Last Updated: February 26, 2026</p>

        <div className="space-y-8 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. No Refund Policy</h2>
            <p>
              WappBroaddcast operates on a prepaid monthly subscription model. Once a payment is made for the subscription period (valid until the 7th of the following month), <strong>it is non-refundable</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Cancellations</h2>
            <p>
              You may choose to discontinue using the service at any time. Since the service is prepaid, your access will remain active until the end of your current validity period. There are no cancellation fees, but no partial refunds will be issued for the remaining unused days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Service Interruptions</h2>
            <p>
              In the unlikely event that the service is permanently discontinued by us before your validity period expires, a pro-rated refund may be issued at our sole discretion. Temporary downtime or maintenance does not qualify for a refund.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Failed Transactions</h2>
            <p>
              If a payment is deducted from your account but the service is not activated, please contact our support team immediately with your transaction details. If the transaction was failed or incomplete, the amount will typically be auto-refunded by your bank within 5-7 business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Contact Us</h2>
            <p>
              For any payment-related issues, please reach out to us at makeasite.in@gmail.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Refund;
