import {
  emailContactability,
  isApplePrivateRelayEmail,
  isExternallyContactableEmail,
} from '@/lib/athlete-contact-email';

type AthleteRow = {
  id: string;
  firebaseId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  gofastHandle: string | null;
  birthday: Date | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  primarySport: string | null;
  photoURL: string | null;
  bio: string | null;
  instagram: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt?: Date | null;
  garmin_access_token: string | null;
  garmin_user_id: string | null;
  garmin_connected_at: Date | null;
  garmin_last_sync_at: Date | null;
};

function hasPersonalInfoComplete(athlete: AthleteRow): boolean {
  return !!(
    athlete.firstName?.trim() &&
    athlete.lastName?.trim() &&
    athlete.gender?.trim() &&
    athlete.birthday
  );
}

export function formatCompanyUser(athlete: AthleteRow) {
  const contactability = emailContactability(athlete.email);
  const contactEmail = isExternallyContactableEmail(athlete.email) ? athlete.email!.trim() : null;
  const profileComplete = !!(athlete.firstName?.trim() && athlete.lastName?.trim());
  const personalInfoComplete = hasPersonalInfoComplete(athlete);

  return {
    athleteId: athlete.id,
    id: athlete.id,
    firebaseId: athlete.firebaseId,
    email: athlete.email || '',
    contactEmail,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    gofastHandle: athlete.gofastHandle,
    birthday: athlete.birthday,
    gender: athlete.gender,
    city: athlete.city,
    state: athlete.state,
    primarySport: athlete.primarySport,
    photoURL: athlete.photoURL,
    bio: athlete.bio,
    instagram: athlete.instagram,
    status: 'active' as const,
    createdAt: athlete.createdAt,
    updatedAt: athlete.updatedAt,
    lastSeenAt: athlete.lastSeenAt ?? null,
    fullName:
      athlete.firstName && athlete.lastName
        ? `${athlete.firstName} ${athlete.lastName}`
        : undefined,
    profileComplete,
    personalInfoComplete,
    isPrivateRelayEmail: isApplePrivateRelayEmail(athlete.email),
    contactability,
    inAppOnly: contactability !== 'contactable',
    daysSinceCreation: athlete.createdAt
      ? Math.floor((Date.now() - new Date(athlete.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    garmin: {
      connected: !!(athlete.garmin_access_token && athlete.garmin_access_token.length > 0),
      userId: athlete.garmin_user_id || undefined,
      connectedAt: athlete.garmin_connected_at || undefined,
      lastSyncAt: athlete.garmin_last_sync_at || undefined,
      hasTokens: !!athlete.garmin_user_id,
      tokenStatus:
        athlete.garmin_access_token && athlete.garmin_access_token.length > 0
          ? ('active' as const)
          : ('disconnected' as const),
    },
  };
}

export type FormattedCompanyUser = ReturnType<typeof formatCompanyUser>;
