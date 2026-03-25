import RacesHubShell from "@/components/races/RacesHubShell";

export const dynamic = "force-dynamic";

export default function RacesLayout({ children }: { children: React.ReactNode }) {
  return <RacesHubShell>{children}</RacesHubShell>;
}
