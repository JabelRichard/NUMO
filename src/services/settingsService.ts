// src/services/settingsService.ts
import { supabase } from '../config/supabase';
import { UserSettings, DEFAULT_USER_SETTINGS } from '../types/settings';

// Pure TS helper to convert base64 string to ArrayBuffer without external dependencies
function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = cleanBase64.length;
  const bufferLength = len * 0.75 - (cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(bufferLength);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = chars.indexOf(cleanBase64[i]);
    const enc2 = chars.indexOf(cleanBase64[i + 1]);
    const enc3 = chars.indexOf(cleanBase64[i + 2]);
    const enc4 = chars.indexOf(cleanBase64[i + 3]);

    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (enc3 !== -1 && enc3 !== 64) {
      bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    }
    if (enc4 !== -1 && enc4 !== 64) {
      bytes[p++] = ((enc3 & 3) << 6) | enc4;
    }
  }

  return bytes.buffer;
}

// --- User Settings ---

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .select('daily_question_goal, goals, has_completed_onboarding')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return DEFAULT_USER_SETTINGS;
  }

  return {
    daily_question_goal: data.daily_question_goal ?? DEFAULT_USER_SETTINGS.daily_question_goal,
    goals: data.goals ?? DEFAULT_USER_SETTINGS.goals,
    has_completed_onboarding: data.has_completed_onboarding ?? false,
  };
}

export async function saveUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// --- Account & Profile Management ---

export async function getUserProfile(
  userId: string
): Promise<{ full_name?: string; avatar_url?: string }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return {};
  }

  return {
    full_name: data.full_name,
    avatar_url: data.avatar_url,
  };
}

export async function updateProfileName(
  userId: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  return { success: true };
}

export async function uploadProfileAvatar(
  userId: string,
  base64Image: string,
  fileExt: string = 'jpg'
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
    const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;
    const contentType = `image/${fileExt === 'png' ? 'png' : 'jpeg'}`;

    const arrayBuffer = decodeBase64ToArrayBuffer(base64Image);

    // Upload to 'avatars' storage bucket
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Retrieve public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;

    // Save avatar_url to profiles table & auth metadata
    await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', userId);

    await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl },
    });

    return { success: true, avatarUrl };
  } catch (err: any) {
    return { success: false, error: err.message || 'Avatar upload failed.' };
  }
}

export async function removeProfileAvatar(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.auth.updateUser({
    data: { avatar_url: null },
  });

  return { success: true };
}

export async function updateAccountPasswordWithOldPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (signInError) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

export async function deleteUserAccount(): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('delete_user_account');

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.auth.signOut();
  return { success: true };
}