import RacesHubShell from "@/components/races/RacesHubShell";

export const dynamic = "force-dynamic";

export default function MyRaceLayout({ children }: { children: React.ReactNode }) {
  return <RacesHubShell>{children}</RacesHubShell>;
}
