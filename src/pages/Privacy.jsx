import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
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

        <h1 className="text-3xl font-bold mb-6 text-white">Privacy Policy</h1>
        <p className="text-muted text-sm mb-8">Last Updated: February 26, 2026</p>

        <div className="space-y-8 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-2">We collect information to provide and improve our Service to you.</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Personal Data:</strong> Email address, name, and phone number for account creation.</li>
              <li><strong>Contact Lists:</strong> Phone numbers and names you upload for broadcasting (stored securely and used only for your campaigns).</li>
              <li><strong>Usage Data:</strong> Information on how the service is accessed and used (e.g., broadcast logs, timestamp).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and maintain the Service.</li>
              <li>To manage your account and subscription.</li>
              <li>To facilitate payment processing via Razorpay (we do not store full credit card details).</li>
              <li>To communicate with you about service updates or support.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Security</h2>
            <p>
              The security of your data is important to us. We use database management which employs industry-standard security measures. However, no method of transmission over the Internet or method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
            <p>
              We may employ third-party companies and services to facilitate our Service.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Meta (WhatsApp):</strong> For sending messages through the Cloud API.</li>
              <li><strong>Razorpay:</strong> For processing secure payments.</li>
            </ul>
            <p className="mt-2">
              These third parties have access to your Personal Data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
            <p>
              We will retain your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. You can request deletion of your data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at makeasite.in@gmail.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
