import api from '@/src/lib/api';

interface ShareResponse {
  shareToken: string;
}

const shareService = {
  async shareTrip(tripId: string): Promise<ShareResponse> {
    const response = await api.post<{ data: ShareResponse }>(
      `/trips/${tripId}/share`
    );
    return response.data.data;
  },

  async revokeShare(tripId: string): Promise<void> {
    await api.delete(`/trips/${tripId}/share`);
  },

  async getSharedTrip(shareToken: string) {
    const response = await api.get(`/trips/shared/${shareToken}`);
    return response.data.data.trip;
  },

  async duplicateSharedTrip(shareToken: string) {
    const response = await api.post(
      `/trips/shared/${shareToken}/duplicate`
    );
    return response.data.data.trip;
  },
};

export default shareService;
