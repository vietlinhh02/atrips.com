'use client';

import { useState, useEffect } from 'react';
import useAuthStore from '@/src/stores/authStore';
import userService from '@/src/services/userService';

export default function SubscriptionCard() {
  const subscription = useAuthStore((state) => state.subscription);
  const fetchSubscription = useAuthStore((state) => state.fetchSubscription);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleUpgrade = async (tier: 'PRO' | 'BUSINESS') => {
    setLoading(true);
    try {
      const { url } = await userService.createCheckoutSession(tier);
      window.location.href = url; // Redirect to Stripe checkout
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Nâng cấp thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (!subscription) {
    return <div>Loading...</div>;
  }

  const { tier, usage } = subscription;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Gói dịch vụ của bạn</h2>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-semibold">
            Gói {tier === 'FREE' ? 'Miễn phí' : tier === 'PRO' ? 'Pro' : 'Business'}
          </span>
          {tier !== 'FREE' && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              Đang kích hoạt
            </span>
          )}
        </div>

        {/* AI Quota Usage */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>AI Quota</span>
            <span className="font-medium">
              {usage.aiQuota.used}/{usage.aiQuota.limit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${(usage.aiQuota.used / usage.aiQuota.limit) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Trips Usage */}
        {tier === 'FREE' && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Số chuyến đi</span>
              <span className="font-medium">
                {usage.trips.created}/{usage.trips.limit}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${(usage.trips.created / usage.trips.limit) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Options */}
      {tier === 'FREE' && (
        <div className="space-y-3">
          <button
            onClick={() => handleUpgrade('PRO')}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Nâng cấp lên Pro
          </button>
          <button
            onClick={() => handleUpgrade('BUSINESS')}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Nâng cấp lên Business
          </button>
        </div>
      )}

      {tier === 'PRO' && (
        <button
          onClick={() => handleUpgrade('BUSINESS')}
          disabled={loading}
          className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Nâng cấp lên Business
        </button>
      )}
    </div>
  );
}
