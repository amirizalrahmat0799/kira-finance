// expo-notifications doesn't support the web. The web build (used for previews) shows in-app alerts only.
import type { BillReminder } from './notifications';

export async function configureNotifications(): Promise<void> {}
export async function notificationsAllowed(): Promise<boolean> {
  return false;
}
export async function notifyNow(): Promise<void> {}
export async function scheduleBillReminders(_bills: BillReminder[]): Promise<number> {
  return 0;
}
export const notificationsSupported = false;
export type { BillReminder };
