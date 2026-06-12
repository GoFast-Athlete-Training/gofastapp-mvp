import { formatCompanyUser, type FormattedCompanyUser } from '@/lib/format-company-user';

export type CompanyProfileCard = {
  identity: {
    athleteId: string;
    firebaseId: string;
    name: string;
    handle: string | null;
    photoURL: string | null;
    primarySport: string | null;
  };
  contact: {
    email: string;
    contactEmail: string | null;
    contactability: FormattedCompanyUser['contactability'];
    inAppOnly: boolean;
    isPrivateRelayEmail: boolean;
  };
  profile: {
    complete: boolean;
    personalInfoComplete: boolean;
    city: string | null;
    state: string | null;
    birthday: Date | null;
    gender: string | null;
    bio: string | null;
    instagram: string | null;
  };
  activity: {
    lastSeenAt: Date | null;
    lastSignInAt: string | null;
    createdAt: Date;
    updatedAt: Date;
    daysSinceCreation: number;
  };
  integrations: {
    garmin: FormattedCompanyUser['garmin'];
  };
};

export function buildCompanyProfileCard(
  user: FormattedCompanyUser,
  lastSignInAt: string | null
): CompanyProfileCard {
  return {
    identity: {
      athleteId: user.athleteId,
      firebaseId: user.firebaseId,
      name: user.fullName || user.firstName || 'No Name',
      handle: user.gofastHandle ?? null,
      photoURL: user.photoURL ?? null,
      primarySport: user.primarySport ?? null,
    },
    contact: {
      email: user.email,
      contactEmail: user.contactEmail ?? null,
      contactability: user.contactability,
      inAppOnly: user.inAppOnly,
      isPrivateRelayEmail: user.isPrivateRelayEmail,
    },
    profile: {
      complete: user.profileComplete,
      personalInfoComplete: user.personalInfoComplete,
      city: user.city ?? null,
      state: user.state ?? null,
      birthday: user.birthday ?? null,
      gender: user.gender ?? null,
      bio: user.bio ?? null,
      instagram: user.instagram ?? null,
    },
    activity: {
      lastSeenAt: user.lastSeenAt ?? null,
      lastSignInAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      daysSinceCreation: user.daysSinceCreation,
    },
    integrations: {
      garmin: user.garmin,
    },
  };
}

export type AthleteRowForProfileCard = Parameters<typeof formatCompanyUser>[0];

export function formatAthleteToProfileCard(
  athlete: AthleteRowForProfileCard,
  lastSignInAt: string | null
): CompanyProfileCard {
  return buildCompanyProfileCard(formatCompanyUser(athlete), lastSignInAt);
}
