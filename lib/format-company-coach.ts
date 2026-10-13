export type CompanyCoachSelect = {
  id: string;
  firebaseId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  city: string | null;
  state: string | null;
  specialty: string | null;
  isActive: boolean;
};

export function formatCompanyCoach(coach: CompanyCoachSelect) {
  return {
    id: coach.id,
    firebaseId: coach.firebaseId,
    email: coach.email,
    firstName: coach.firstName,
    lastName: coach.lastName,
    photoURL: coach.photoURL,
    city: coach.city,
    state: coach.state,
    specialty: coach.specialty,
    isActive: coach.isActive,
    inApp: Boolean(coach.firebaseId?.trim()),
  };
}
