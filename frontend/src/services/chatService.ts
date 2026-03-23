import api from '../lib/api';

export interface ChatSession {
    id: string;
    title: string;
    updatedAt: string;
    lastMessage?: string;
}

class ChatService {
    /**
     * Get recent chat sessions
     */
    async getRecentChats(limit: number = 5): Promise<ChatSession[]> {
        try {
            const response = await api.get(`/chats/recent?limit=${limit}`);
            return response.data?.data || [];
        } catch (error) {
            console.warn('Failed to fetch recent chats:', error);
            return [];
        }
    }

    /**
     * Get count of unread messages or notifications
     */
    async getUnreadCount(): Promise<number> {
        try {
            const response = await api.get('/chats/unread-count');
            return response.data?.data?.count || 0;
        } catch {
            // Silent fail for counts
            return 0;
        }
    }
}

const chatService = new ChatService();
export default chatService;
