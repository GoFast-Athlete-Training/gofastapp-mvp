"use client";

import type { RaceInfoPacket } from "@/lib/races/race-info-packet-types";

type Props = {
  packets: RaceInfoPacket[];
};

function packetByKind(packets: RaceInfoPacket[], kind: RaceInfoPacket["kind"]) {
  return packets.find((p) => p.kind === kind && p.visible) ?? null;
}

function PacketBlock({ packet }: { packet: RaceInfoPacket | null }) {
  if (!packet) {
    return (
      <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-4">
        No content saved yet for this section.
      </p>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="text-base font-bold text-gray-900">{packet.title}</h3>
        {packet.summary ? <p className="text-sm text-gray-600 mt-1">{packet.summary}</p> : null}
      </div>
      {packet.items.length > 0 ? (
        <dl className="space-y-2 text-sm">
          {packet.items.map((item) => (
            <div key={`${item.label}-${item.value}`}>
              <dt className="font-medium text-gray-500">{item.label}</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:underline"
                  >
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {packet.courseMapUrl ? (
        <a
          href={packet.courseMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-semibold text-orange-600 hover:underline"
        >
          Open course map
        </a>
      ) : null}
      {packet.segments && packet.segments.length > 0 ? (
        <ol className="space-y-3 border-t border-gray-100 pt-3">
          {packet.segments.map((seg) => (
            <li key={seg.order} className="text-sm">
              <p className="font-semibold text-gray-900">
                {seg.name}
                {seg.mileMarker ? ` · ${seg.mileMarker}` : ""}
              </p>
              {seg.description ? (
                <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{seg.description}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/** Arrival + course slices from info-packets (staff hub read-only). */
export default function RaceHubStaffInfoPacketsSection({ packets }: Props) {
  const arrival = packetByKind(packets, "arrival");
  const course = packetByKind(packets, "course");
  const pickup = packetByKind(packets, "packetPickup");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Arrival &amp; logistics</h2>
        <p className="text-sm text-gray-500 mt-1">Same packets athletes see before race day.</p>
      </div>
      <PacketBlock packet={arrival ?? pickup} />
      <div>
        <h2 className="text-lg font-bold text-gray-900">Course</h2>
        <p className="text-sm text-gray-500 mt-1">Map and segments from the race info packet.</p>
      </div>
      <PacketBlock packet={course} />
    </div>
  );
}
