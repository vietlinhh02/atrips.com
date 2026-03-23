'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { useToast } from '@/src/components/ui/use-toast';
import useAuthStore from '@/src/stores/authStore';
import {
  EnvelopeSimple,
  CloudArrowDown,
  Receipt
} from '@phosphor-icons/react';
import { cn } from '@/src/lib/utils';

import { Badge } from '@/src/components/ui/badge';

export function PaymentInformationSection() {
  const { subscription, fetchSubscription, user } = useAuthStore();
  const { info } = useToast();
  const [emailPreference, setEmailPreference] = useState('account'); // 'account' | 'alternative'
  
  // Real data would come from API, currently empty as requested
  const invoices: never[] = []; 

  useEffect(() => {
    fetchSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgrade = () => {
    info('Coming soon', 'Upgrade flow will be integrated soon.');
  };

  if (!subscription) {
    return (
      <div className="flex flex-col gap-6 p-6 rounded-[20px] border border-[var(--neutral-30)] bg-white shadow-sm animate-pulse">
        <div className="h-6 w-1/3 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-100 rounded-[12px]"></div>
      </div>
    );
  }

  const { tier, status, usage } = subscription;

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Current Plan Summary */}
      <section className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div className="flex-1 flex flex-col gap-2">
           <h2 className="text-[16px] font-medium text-[var(--neutral-100)]">Current Plan</h2>
           <div className="flex items-center gap-3 mt-1">
             <span className="text-2xl font-bold text-[var(--primary-main)]">{tier} Plan</span>
             <Badge className={cn(
               "px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wide",
               status === 'ACTIVE' ? "bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]" :
               status === 'TRIAL' ? "bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]" :
               "bg-[var(--neutral-30)] text-[var(--neutral-60)] hover:bg-[var(--neutral-20)]"
             )}>
               {status}
             </Badge>
           </div>
           <p className="text-[14px] text-[var(--neutral-60)]">
             {usage.aiQuota.limit === -1 
                ? 'You have unlimited AI usage.' 
                : `You have used ${usage.aiQuota.used} of ${usage.aiQuota.limit} AI requests this month.`}
           </p>
        </div>
        <div className="flex items-center">
            {tier === 'FREE' ? (
              <Button onClick={() => handleUpgrade()} className="bg-[var(--primary-main)] hover:bg-[var(--primary-hover)] h-10 px-6">
                Upgrade Plan
              </Button>
            ) : (
              <Button variant="outline" className="h-10 px-6">Manage Subscription</Button>
            )}
        </div>
      </section>

      <div className="h-px w-full bg-[var(--neutral-30)]" />

      {/* Contact Email Section */}
      <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Contact Email</h3>
                <p className="text-[12px] text-[var(--neutral-60)]">Where should invoices be sent?</p>
            </div>
            
            <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-[var(--neutral-20)] hover:bg-[var(--neutral-10)] transition-colors">
                    <input 
                        type="radio" 
                        name="contact_email" 
                        className="mt-1 w-4 h-4 accent-[var(--primary-main)] border-[var(--neutral-30)] focus:ring-[var(--primary-main)]"
                        checked={emailPreference === 'account'}
                        onChange={() => setEmailPreference('account')}
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-[var(--neutral-90)]">Send to my account email</span>
                        <span className="text-sm text-[var(--neutral-50)]">{user?.email}</span>
                    </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-[var(--neutral-20)] hover:bg-[var(--neutral-10)] transition-colors">
                    <input 
                        type="radio" 
                        name="contact_email" 
                        className="mt-1 w-4 h-4 accent-[var(--primary-main)] border-[var(--neutral-30)] focus:ring-[var(--primary-main)]"
                        checked={emailPreference === 'alternative'}
                        onChange={() => setEmailPreference('alternative')}
                    />
                    <div className="flex flex-col w-full gap-2">
                        <span className="text-sm font-medium text-[var(--neutral-90)]">Send to an alternative email</span>
                        {emailPreference === 'alternative' && (
                             <div className="relative w-full max-w-md mt-2">
                                <EnvelopeSimple className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-50)]" size={18} />
                                <Input 
                                    placeholder="billing@company.com"
                                    className="pl-10 bg-white border-[var(--neutral-30)] focus:border-[var(--primary-main)] h-10"
                                />
                             </div>
                        )}
                    </div>
                </label>
            </div>
      </div>

      <div className="h-px w-full bg-[var(--neutral-30)]" />

      {/* Billing History Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
             <div className="flex flex-col gap-1">
                <h3 className="text-[16px] font-medium text-[var(--neutral-100)]">Billing History</h3>
                <p className="text-[12px] text-[var(--neutral-60)]">View and download your past invoices.</p>
             </div>
             {invoices.length > 0 && (
                <Button variant="outline" className="gap-2 h-9 text-sm">
                    <CloudArrowDown size={16} />
                    Download all
                </Button>
             )}
        </div>

        {invoices.length > 0 ? (
            <div className="w-full">
                <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                        <tr className="text-left">
                            <th className="w-10 px-2 pb-2">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[var(--primary-main)] focus:ring-[var(--primary-main)]" />
                            </th>
                            <th className="px-2 pb-2 text-xs font-medium text-[var(--neutral-60)]">Invoice</th>
                            <th className="px-2 pb-2 text-xs font-medium text-[var(--neutral-60)]">Amount</th>
                            <th className="px-2 pb-2 text-xs font-medium text-[var(--neutral-60)]">Date</th>
                            <th className="px-2 pb-2 text-xs font-medium text-[var(--neutral-60)]">Status</th>
                            <th className="px-2 pb-2 text-xs font-medium text-[var(--neutral-60)]">Users on plan</th>
                            <th className="px-2 pb-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Render invoice rows here */}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-[12px] border border-dashed border-[var(--neutral-30)] bg-[var(--neutral-10)]/30 text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--neutral-20)] flex items-center justify-center mb-3">
                    <Receipt size={24} className="text-[var(--neutral-40)]" />
                </div>
                <p className="text-[14px] font-medium text-[var(--neutral-80)] mb-1">No invoices found</p>
                <p className="text-[13px] text-[var(--neutral-60)] max-w-xs">
                    You haven&apos;t been billed yet. Invoices will appear here once you have a payment history.
                </p>
            </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <div className="flex gap-3">
             <Button variant="outline" className="h-10">Cancel</Button>
             <Button className="h-10 bg-[var(--primary-main)] hover:bg-[var(--primary-hover)]">Save changes</Button>
        </div>
      </div>
    </div>
  );
}
