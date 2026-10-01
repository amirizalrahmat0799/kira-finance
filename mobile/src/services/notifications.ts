import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, parseISODate, type ISODate } from '@/lib/dates';

const CHANNEL = 'reminders';
let configured = false;

/** Shows notifications while the app is open too, and creates the Android channel. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Bills and budgets',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function notificationsAllowed(ask = false): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

export async function notifyNow(title: string, body: string): Promise<void> {
  if (!(await notificationsAllowed())) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

export interface BillReminder {
  name: string;
  amountLabel: string;
  dueDate: ISODate;
  remindDaysBefore: number;
}

/**
 * Re-schedules every bill reminder from scratch (9:00 am, N days before the due date).
 * The app owns all scheduled notifications, so cancelling everything first keeps this idempotent.
 */
export async function scheduleBillReminders(bills: BillReminder[]): Promise<number> {
  if (!(await notificationsAllowed())) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();

  let scheduled = 0;
  const now = Date.now();
  for (const bill of bills) {
    const remindOn = addDays(bill.dueDate, -bill.remindDaysBefore);
    const at = parseISODate(remindOn);
    at.setHours(9, 0, 0, 0);
    if (at.getTime() <= now) continue;

    const when = bill.remindDaysBefore === 0 ? 'today' : bill.remindDaysBefore === 1 ? 'tomorrow' : `in ${bill.remindDaysBefore} days`;
    await Notifications.scheduleNotificationAsync({
      content: { title: `${bill.name} is due ${when}`, body: `${bill.amountLabel} on ${bill.dueDate}` },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
      },
    });
    scheduled++;
  }
  return scheduled;
}

export const notificationsSupported = true;
