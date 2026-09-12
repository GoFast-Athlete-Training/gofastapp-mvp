/** Row from GET /api/athlete/[id]/container/members (gfwm_athlete junction). */
export type ContainerMemberRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  gofastHandle: string | null;
  joinedAt: string;
};

export type ContainerMembersPayload = {
  success: boolean;
  count: number;
  members: ContainerMemberRow[];
  error?: string;
};
