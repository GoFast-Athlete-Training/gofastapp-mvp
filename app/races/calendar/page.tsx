import { redirect } from "next/navigation";

/** Legacy URL — calendar is merged into My Races (`/races`). */
export default function RacesCalendarRedirectPage() {
  redirect("/races");
}
