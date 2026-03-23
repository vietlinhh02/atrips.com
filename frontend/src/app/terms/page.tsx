import BrandHeader from '@/src/components/common/brand/BrandHeader';
import AuthFooter from '@/src/components/common/layout/AuthFooter';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                <BrandHeader logoSize="medium" />

                <main className="mt-12 space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-3xl font-semibold text-[var(--neutral-100)] md:text-4xl">
                            Terms of Service
                        </h1>
                        <p className="text-sm text-[var(--neutral-60)]">
                            Last updated: January 28, 2026
                        </p>
                    </div>

                    <div className="prose prose-neutral max-w-none text-[var(--neutral-80)]">
                        <p className="lead">
                            Welcome to TripMind. By accessing or using our website and services, you agree to be bound by these Terms of Service.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">1. Acceptance of Terms</h3>
                        <p>
                            By accessing or using the TripMind service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the service.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">2. Description of Service</h3>
                        <p>
                            TripMind provides an AI-powered travel planning platform. We assist users in creating itineraries, discovering destinations, and organizing travel plans. The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">3. User Accounts</h3>
                        <p>
                            When you create an account with us, you must provide ensuring that the information is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">4. Intellectual Property</h3>
                        <p>
                            The Service and its original content, features, and functionality are and will remain the exclusive property of TripMind and its licensors. The Service is protected by copyright, trademark, and other laws of both the country and foreign countries.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">5. Termination</h3>
                        <p>
                            We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">6. Changes</h3>
                        <p>
                            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">7. Contact Us</h3>
                        <p>
                            If you have any questions about these Terms, please contact us at support@tripmind.com.
                        </p>
                    </div>

                    <div className="pt-12 border-t border-[var(--neutral-20)]">
                        <AuthFooter />
                    </div>
                </main>
            </div>
        </div>
    );
}
