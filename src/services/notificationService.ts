import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Set notification behavior when the app is in the foreground (supports both newer and older SDKs)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    return true; // Simulators can still test local registration
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminders', {
      name: 'Daily Training Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#BCE3AA',
    });
  }

  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleDailyReminder(timeString: string): Promise<boolean> {
  const granted = await requestNotificationPermissions();
  if (!granted) return false;

  // Clear existing schedules before registering the new time
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Parse time format: "08:00 AM" or "07:30 PM"
  const [timePart, modifier] = timeString.split(' ');
  const [hourStr, minuteStr] = timePart.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (modifier === 'PM' && hour < 12) hour += 12;
  if (modifier === 'AM' && hour === 12) hour = 0;

  const content: any = {
    title: 'Time for your daily drill 🧠',
    body: 'Keep your momentum going. Complete a quick 10-question workout today!',
    sound: true,
  };

  if (Platform.OS === 'android') {
    content.channelId = 'daily-reminders';
  }

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      hour,
      minute,
      repeats: true,
    } as any,
  });

  return true;
}