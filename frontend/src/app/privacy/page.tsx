import BrandHeader from '@/src/components/common/brand/BrandHeader';
import AuthFooter from '@/src/components/common/layout/AuthFooter';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                <BrandHeader logoSize="medium" />

                <main className="mt-12 space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-3xl font-semibold text-[var(--neutral-100)] md:text-4xl">
                            Privacy Policy
                        </h1>
                        <p className="text-sm text-[var(--neutral-60)]">
                            Last updated: January 28, 2026
                        </p>
                    </div>

                    <div className="prose prose-neutral max-w-none text-[var(--neutral-80)]">
                        <p className="lead">
                            At TripMind, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">1. Information We Collect</h3>
                        <p>
                            We may collect information about you in a variety of ways. The information we may collect on the Site includes:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, shipping address, email address, and telephone number, that you voluntarily give to us when you register with the Site or when you choose to participate in various activities related to the Site.</li>
                            <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Site, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Site.</li>
                        </ul>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">2. Use of Your Information</h3>
                        <p>
                            Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>Create and manage your account.</li>
                            <li>Compile anonymous statistical data and analysis for use internally or with third parties.</li>
                            <li>Email you regarding your account or order.</li>
                            <li>Enable user-to-user communications.</li>
                            <li>Fulfill and manage purchases, orders, payments, and other transactions related to the Site.</li>
                        </ul>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">3. Disclosure of Your Information</h3>
                        <p>
                            We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
                        </ul>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">4. Security of Your Information</h3>
                        <p>
                            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                        </p>

                        <h3 className="text-xl font-medium text-[var(--neutral-100)] mt-8 mb-4">5. Contact Us</h3>
                        <p>
                            If you have questions or comments about this Privacy Policy, please contact us at privacy@tripmind.com.
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
