import { create } from 'zustand';
import chatService, { ChatSession } from '../services/chatService';
import userService from '../services/userService';
import aiConversationService, { type ConversationItem } from '../services/aiConversationService';

interface SidebarState {
    // State
    recentChats: ChatSession[];
    recentConversations: ConversationItem[];
    tripCount: number;
    unreadAssistantCount: number;
    isLoading: boolean;
    isCollapsed: boolean;
    showProfileView: boolean;

    // Actions
    toggleCollapse: () => void;
    setCollapsed: (collapsed: boolean) => void;
    setShowProfileView: (show: boolean) => void;
    toggleProfileView: () => void;
    fetchSidebarData: () => Promise<void>;
}

const useSidebarStore = create<SidebarState>((set) => ({
    // State
    recentChats: [],
    recentConversations: [],
    tripCount: 0,
    unreadAssistantCount: 0,
    isLoading: false,
    isCollapsed: true,
    showProfileView: false,

    // Actions
    toggleCollapse: () => {
        set((state) => ({ isCollapsed: !state.isCollapsed }));
    },

    setCollapsed: (collapsed: boolean) => {
        set({ isCollapsed: collapsed });
    },

    setShowProfileView: (show: boolean) => {
        set({ showProfileView: show });
    },

    toggleProfileView: () => {
        set((state) => ({ showProfileView: !state.showProfileView }));
    },

    fetchSidebarData: async () => {
        set({ isLoading: true });
        try {
            const [recentChats, aiConversationsData, unreadCount, stats] = await Promise.all([
                chatService.getRecentChats(),
                aiConversationService.listConversations({ offset: 0, limit: 50 }).catch(() => ({ data: [], pagination: { offset: 0, limit: 50, total: 0 } })),
                chatService.getUnreadCount(),
                userService.getStats().catch(() => ({ totalTrips: 0 })), // Fallback if stats fail
            ]);

            set({
                recentChats,
                recentConversations: aiConversationsData.data,
                unreadAssistantCount: unreadCount,
                tripCount: stats.totalTrips || 0,
                isLoading: false,
            });
        } catch (error) {
            console.error('Failed to fetch sidebar data:', error);
            set({ isLoading: false });
        }
    },
}));

export default useSidebarStore;
