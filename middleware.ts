import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRaceHubStaffHostname } from "@/lib/race-hub-staff-host";

/** Map racehubstaff host + /race-hub/{slug} to internal staff hub page. */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  if (!isRaceHubStaffHostname(host)) {
    return NextResponse.next();
  }

  const match = request.nextUrl.pathname.match(/^\/race-hub\/([^/]+)\/?$/);
  if (!match?.[1]) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/race-hub-staff/${match[1]}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/race-hub/:path*"],
};
