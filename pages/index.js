
/**
 * @fileoverview This is the main landing page for the LeakDetector application.
 * It includes the primary call-to-action for users to start the audit process,
 * as well as informational sections about the service.
 */
import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, AlertCircle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

/**
 * The main landing page component.
 * It handles the initial user interaction, including email and company name input,
 * and initiates the audit process by calling the user creation API.
 * @returns {JSX.Element} The rendered LeakDetectorLanding component.
 */
export default function LeakDetectorLanding() {
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [auditId, setAuditId] = useState(null);
  const [step, setStep] = useState('landing'); // landing, payment, connect, success

  // Initialize Stripe (in real app, load from @stripe/stripe-js)
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleGetStarted = async () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email');
      return;
    }

    setLoading(true);
    
    try {
      // Create user and audit
      const response = await fetch('/api/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setAuditId(data.auditId);
      setStep('connect');
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'connect') {
    return <ConnectBankScreen auditId={auditId} />;
  }

  if (step === 'success') {
    return <SuccessScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-red-100 text-red-800 px-4 py-2 rounded-full mb-6">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">Your company is bleeding money</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900">
            Find <span className="text-red-600">$50,000+</span> in Wasted SaaS Spend
            <br />
            <span className="text-2xl md:text-4xl text-gray-600">in 24 Hours</span>
          </h1>
          
          <a href="/dashboard" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors">
            Go to Dashboard
          </a>

          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Most companies waste <strong>30% of their software budget</strong> on unused licenses, 
            duplicate tools, and forgotten subscriptions. We find them. You cancel them.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 flex-wrap">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-red-600">$21M</div>
              <div className="text-xs md:text-sm text-gray-600">Average waste</div>
            </div>
            <div className="hidden sm:block text-gray-400">•</div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-red-600">47%</div>
              <div className="text-xs md:text-sm text-gray-600">Licenses unused</div>
            </div>
            <div className="hidden sm:block text-gray-400">•</div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-red-600">23</div>
              <div className="text-xs md:text-sm text-gray-600">Duplicate apps</div>
            </div>
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-red-200">
              <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">$497</div>
              <div className="text-sm text-gray-500 mb-6">One-time audit • 100x ROI guarantee</div>
              
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg mb-3 text-lg"
                disabled={loading}
              />
              
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name (optional)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg mb-4 text-lg"
                disabled={loading}
              />
              
              <button
                onClick={handleGetStarted}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Get Your Leak Report <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              
              <p className="text-xs text-gray-500 mt-4">
                If we don't find 10x value ($5,000+), full refund + $100
              </p>
            </div>
          </div>
        </div>

        {/* What We Find */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Zombie Subscriptions</h3>
            <p className="text-gray-600">
              Charges running after last use. Employee left 6 months ago? Still paying for their seat.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Duplicate Tools</h3>
            <p className="text-gray-600">
              Marketing uses Asana. Engineering uses Jira. Product uses Monday. Pick one, save $15K/year.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Free Software</h3>
            <p className="text-gray-600">
              Example: $20K on WinZip. VSCode licenses. Both free. We find these.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold text-blue-600">1</div>
              <h4 className="font-bold mb-2">Pay</h4>
              <p className="text-sm text-gray-600">$497 one-time via Stripe</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold text-blue-600">2</div>
              <h4 className="font-bold mb-2">Connect</h4>
              <p className="text-sm text-gray-600">Link company card via Plaid (secure)</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold text-blue-600">3</div>
              <h4 className="font-bold mb-2">Analyze</h4>
              <p className="text-sm text-gray-600">AI scans 12 months of charges</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold text-green-600">✓</div>
              <h4 className="font-bold mb-2">Report</h4>
              <p className="text-sm text-gray-600">Get detailed report in 24hrs</p>
            </div>
          </div>
        </div>

        {/* Social Proof */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-8">Real Waste Examples</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
            <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-red-600">
              <p className="text-gray-700 italic mb-4">
                "380 unused Microsoft 365 licenses and 250 licenses for VSCode (free). $127K waste in 20 minutes."
              </p>
              <p className="text-sm text-gray-600">— Government IT audit</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-orange-600">
              <p className="text-gray-700 italic mb-4">
                "Kept charging cancelled accounts for 18 months post-acquisition. Cost me my CFO role."
              </p>
              <p className="text-sm text-gray-600">— Former CFO, public company</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-12 text-white mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">The SaaS Sprawl Crisis</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">48%</div>
              <p className="text-gray-300">of apps completely unmanaged</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">$49M</div>
              <p className="text-gray-300">average SaaS spend per company</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">247</div>
              <p className="text-gray-300">renewals per year (auto-approved)</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-12 text-white text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Your CFO Will Thank You</h2>
          <p className="text-lg md:text-xl mb-8 opacity-90">Every week = another $1,000+ wasted</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white text-red-600 hover:bg-gray-100 font-bold px-8 py-4 rounded-lg text-lg"
          >
            Get Your $497 Audit Now
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A component that displays a message to the user after their payment has been received,
 * instructing them to check their email to connect their bank account.
 * @param {object} props - The component props.
 * @param {string} props.auditId - The ID of the audit.
 * @returns {JSX.Element} The rendered ConnectBankScreen component.
 */
function ConnectBankScreen({ auditId }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Payment Received!</h2>
        <p className="text-gray-600 mb-6">
          Check your email for a secure link to connect your company credit card via Plaid.
        </p>
        <p className="text-sm text-gray-500">
          Your report will be ready in 24 hours.
        </p>
      </div>
    </div>
  );
}

/**
 * A component that displays a success message to the user after the analysis is complete,
 * informing them that their report has been emailed.
 * @returns {JSX.Element} The rendered SuccessScreen component.
 */
function SuccessScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Analysis Complete!</h2>
        <p className="text-gray-600 mb-6">
          Your leak report has been emailed to you.
        </p>
        <p className="text-sm text-gray-500">
          Start canceling those subscriptions and pocket the savings!
        </p>
      </div>
    </div>
  );
}
