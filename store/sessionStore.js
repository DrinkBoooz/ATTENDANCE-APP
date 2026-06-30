import { create } from 'zustand';

export const useSessionStore = create((set, get) => ({
  activeSession: null,        // { id, sectionId, sectionName, startedAt }
  scanFeed: [],                // [{ studentId, name, status, timestamp, accepted }]
  selectedSection: null,

  setSelectedSection: (section) => set({ selectedSection: section }),

  beginSession: (session) => set({ activeSession: session, scanFeed: [] }),

  endSessionLocal: () => set({ activeSession: null }),

  pushScanResult: (entry) =>
    set((state) => ({ scanFeed: [entry, ...state.scanFeed].slice(0, 200) })),
}));