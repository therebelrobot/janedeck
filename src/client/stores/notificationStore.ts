// src/client/stores/notificationStore.ts — Zustand: toast notification queue
// Used for bingo mark/win events so players are notified on their own device
// even when nobody is watching the shared presentation screen.
import { create } from "zustand";

export type NotificationKind = "mark" | "win";

export interface ToastNotification {
  id: string;
  kind: NotificationKind;
  message: string;
  createdAt: number;
}

const MARK_DISMISS_MS = 4000;
const WIN_DISMISS_MS = 5500;

interface NotificationStoreState {
  queue: ToastNotification[];
  push: (kind: NotificationKind, message: string) => void;
  dismiss: (id: string) => void;
  reset: () => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  queue: [],

  push: (kind, message) => {
    const createdAt = Date.now();
    const id = `toast-${createdAt}-${nextId++}`;
    set((state) => ({ queue: [...state.queue, { id, kind, message, createdAt }] }));

    const dismissAfter = kind === "win" ? WIN_DISMISS_MS : MARK_DISMISS_MS;
    setTimeout(() => get().dismiss(id), dismissAfter);
  },

  dismiss: (id) =>
    set((state) => ({ queue: state.queue.filter((n) => n.id !== id) })),

  reset: () => set({ queue: [] }),
}));
