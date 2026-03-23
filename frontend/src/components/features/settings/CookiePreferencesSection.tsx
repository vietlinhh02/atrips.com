'use client';

import { useState } from 'react';
import { useToast } from '@/src/components/ui/use-toast';
import { Button } from '@/src/components/ui/button';

export function CookiePreferencesSection() {
  const { success } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Local state for cookies (usually managed by a consent manager)
  const [cookies, setCookies] = useState({
    essential: true,
    analytics: true,
    marketing: false,
    functional: true
  });

  const handleSave = () => {
    setLoading(true);
    // Simulate save
    setTimeout(() => {
      setLoading(false);
      success('Preferences saved', 'Your cookie preferences have been updated.');
    }, 500);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Manage Cookie Preferences</h3>
        <p className="text-[14px] text-[var(--neutral-60)] leading-relaxed">
          We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. 
          By clicking &ldquo;Save Preferences&rdquo;, you consent to our use of cookies.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Essential */}
        <div className="flex items-start justify-between py-4 border-b border-[var(--neutral-30)]">
          <div className="flex flex-col gap-1 max-w-[80%]">
            <span className="text-[14px] font-medium text-[var(--neutral-100)]">Essential Cookies</span>
            <span className="text-[12px] text-[var(--neutral-60)]">
              These cookies are necessary for the website to function and cannot be switched off in our systems.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-not-allowed">
            <input type="checkbox" className="sr-only peer" checked={true} disabled />
            <div className="w-11 h-6 bg-[var(--neutral-30)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-main)] opacity-50"></div>
          </label>
        </div>

        {/* Analytics */}
        <div className="flex items-start justify-between py-4 border-b border-[var(--neutral-30)]">
          <div className="flex flex-col gap-1 max-w-[80%]">
            <span className="text-[14px] font-medium text-[var(--neutral-100)]">Analytics Cookies</span>
            <span className="text-[12px] text-[var(--neutral-60)]">
              Allow us to count visits and traffic sources so we can measure and improve the performance of our site.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={cookies.analytics}
              onChange={(e) => setCookies({...cookies, analytics: e.target.checked})}
            />
            <div className="w-11 h-6 bg-[var(--neutral-30)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-main)]"></div>
          </label>
        </div>

        {/* Functional */}
        <div className="flex items-start justify-between py-4 border-b border-[var(--neutral-30)]">
          <div className="flex flex-col gap-1 max-w-[80%]">
            <span className="text-[14px] font-medium text-[var(--neutral-100)]">Functional Cookies</span>
            <span className="text-[12px] text-[var(--neutral-60)]">
              Enable the website to provide enhanced functionality and personalization.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={cookies.functional}
              onChange={(e) => setCookies({...cookies, functional: e.target.checked})}
            />
            <div className="w-11 h-6 bg-[var(--neutral-30)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-main)]"></div>
          </label>
        </div>

        {/* Marketing */}
        <div className="flex items-start justify-between py-4 border-b border-[var(--neutral-30)]">
          <div className="flex flex-col gap-1 max-w-[80%]">
            <span className="text-[14px] font-medium text-[var(--neutral-100)]">Marketing Cookies</span>
            <span className="text-[12px] text-[var(--neutral-60)]">
              Used to track visitors across websites. The intention is to display ads that are relevant and engaging.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={cookies.marketing}
              onChange={(e) => setCookies({...cookies, marketing: e.target.checked})}
            />
            <div className="w-11 h-6 bg-[var(--neutral-30)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-main)]"></div>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)] px-8"
        >
          {loading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
