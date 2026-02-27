import type { FeatureProfileApiExtension } from '../types.js';

const loadService = async () => import('./lib/service.js');

const normalizeProfileData = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, any>) };
  }
  return {};
};

const getNewsletterPreference = (data: Record<string, any>): boolean | undefined => {
  const newsletter = data.newsletter;
  if (!newsletter || typeof newsletter !== 'object' || Array.isArray(newsletter)) {
    return undefined;
  }
  return typeof newsletter.optIn === 'boolean' ? newsletter.optIn : undefined;
};

const setNewsletterPreference = (data: Record<string, any>, optedIn: boolean): Record<string, any> => ({
  ...data,
  newsletter: {
    ...(data.newsletter && typeof data.newsletter === 'object' && !Array.isArray(data.newsletter)
      ? data.newsletter
      : {}),
    optIn: optedIn
  }
});

export const NEWSLETTER_PROFILE_API_EXTENSION: FeatureProfileApiExtension = {
  async getFeatureFlags() {
    const { loadNewsletterRuntimeSettings } = await loadService();
    const settings = await loadNewsletterRuntimeSettings();
    return { newsletter: settings.enabled };
  },

  async hydrateProfileData({ user, profileData }) {
    const { getNewsletterSubscriptionStatus, loadNewsletterRuntimeSettings } = await loadService();
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled || !user.email) {
      return normalizeProfileData(profileData);
    }

    const subscribed = await getNewsletterSubscriptionStatus(user.email);
    return setNewsletterPreference(normalizeProfileData(profileData), subscribed);
  },

  async afterProfileUpdate({ user, profileData }) {
    const { loadNewsletterRuntimeSettings, syncNewsletterSubscription } = await loadService();
    const settings = await loadNewsletterRuntimeSettings();
    if (!settings.enabled || !user.email) return;

    const data = normalizeProfileData(profileData);
    const newsletterPreference = getNewsletterPreference(data);
    if (typeof newsletterPreference !== 'boolean') return;

    await syncNewsletterSubscription({
      authUserId: user.id,
      email: user.email,
      source: 'profile',
      optedIn: newsletterPreference
    });
  }
};
