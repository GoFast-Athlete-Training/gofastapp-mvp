export type ContainerMessageCityRun = {
  id: string;
  title: string;
  date: string;
  citySlug: string;
  meetUpPoint: string;
  gorunPath: string;
};

export type MappedContainerMessage = {
  id: string;
  body: string;
  topic: string;
  routeId: string | null;
  cityRunId: string | null;
  createdAt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    gofastHandle: string | null;
  };
  route: {
    id: string;
    name: string;
    distanceMiles: number | null;
    citySlug: string | null;
  } | null;
  cityRun: ContainerMessageCityRun | null;
};

export const containerMessageInclude = {
  authorAthlete: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photoURL: true,
      gofastHandle: true,
    },
  },
  route: {
    select: {
      id: true,
      name: true,
      distanceMiles: true,
      citySlug: true,
    },
  },
  cityRun: {
    select: {
      id: true,
      title: true,
      date: true,
      citySlug: true,
      meetUpPoint: true,
    },
  },
} as const;

export function mapContainerMessageRow(m: {
  id: string;
  body: string;
  topic: string;
  routeId: string | null;
  cityRunId: string | null;
  createdAt: Date;
  authorAthlete: MappedContainerMessage['author'];
  route: MappedContainerMessage['route'];
  cityRun: {
    id: string;
    title: string;
    date: Date;
    citySlug: string;
    meetUpPoint: string;
  } | null;
}): MappedContainerMessage {
  return {
    id: m.id,
    body: m.body,
    topic: m.topic,
    routeId: m.routeId,
    cityRunId: m.cityRunId,
    createdAt: m.createdAt.toISOString(),
    author: m.authorAthlete,
    route: m.route,
    cityRun: m.cityRun
      ? {
          id: m.cityRun.id,
          title: m.cityRun.title,
          date: m.cityRun.date.toISOString(),
          citySlug: m.cityRun.citySlug,
          meetUpPoint: m.cityRun.meetUpPoint,
          gorunPath: `/gorun/${m.cityRun.id}`,
        }
      : null,
  };
}
