import { create } from 'zustand';

interface SettingsState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const useSettingsStore = create<SettingsState>((set) => ({
  activeTab: 'account',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

export default useSettingsStore;
