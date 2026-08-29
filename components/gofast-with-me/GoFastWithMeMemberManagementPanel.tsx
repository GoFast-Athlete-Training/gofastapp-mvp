'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, Users } from 'lucide-react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import type { ContainerMemberRow } from '@/lib/gofast-with-me/container-members-types';
import {
  athleteCommunityPath,
  athletePublicPagePath,
} from '@/lib/gofast-with-me/athlete-community-routes';
import GoFastWithMeUrlEditor from '@/components/profile/GoFastWithMeUrlEditor';

type Props = {
  athleteId: string;
  publicSlug: string;
  gofastHandle: string;
  slugUsesHandle: boolean;
  liveUrl: string;
  embedded?: boolean;
  memberCount?: number;
  members?: ContainerHubPayload['members'];
  membersLoading?: boolean;
  onMembersRefresh?: () => Promise<void>;
  onUrlUpdated?: (slug: string, usesHandle: boolean) => void;
};

function memberDisplayName(m: ContainerMemberRow): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (m.gofastHandle) return `@${m.gofastHandle}`;
  return 'Follower';
}

export default function GoFastWithMeMemberManagementPanel({
  athleteId,
  publicSlug,
  gofastHandle,
  slugUsesHandle,
  liveUrl,
  embedded = false,
  memberCount: memberCountProp,
  members: membersProp,
  membersLoading = false,
  onMembersRefresh,
  onUrlUpdated,
}: Props) {
  const [memberCount, setMemberCount] = useState(memberCountProp ?? 0);
  const [members, setMembers] = useState<ContainerMemberRow[]>(
    (membersProp ?? []) as ContainerMemberRow[]
  );
  const [loading, setLoading] = useState(memberCountProp == null);
  const [error, setError] = useState<string | null>(null);

  const followersPath = athleteCommunityPath(publicSlug, 'followers');

  const loadMembers = useCallback(async () => {
    if (onMembersRefresh) {
      await onMembersRefresh();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/container/members`);
      if (res.data?.success) {
        setMemberCount(res.data.count ?? 0);
        setMembers((res.data.members ?? []) as ContainerMemberRow[]);
      } else {
        throw new Error(res.data?.error || 'Could not load followers');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load followers');
    } finally {
      setLoading(false);
    }
  }, [athleteId, onMembersRefresh]);

  useEffect(() => {
    if (memberCountProp != null) setMemberCount(memberCountProp);
    if (membersProp) setMembers(membersProp as ContainerMemberRow[]);
    if (memberCountProp != null) setLoading(false);
  }, [memberCountProp, membersProp]);

  useEffect(() => {
    if (memberCountProp != null || onMembersRefresh) return;
    void loadMembers();
  }, [memberCountProp, onMembersRefresh, loadMembers]);

  const isLoading = loading || membersLoading;

  return (
    <section id="followers" className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">Members</h2>
          <p className="text-sm text-gray-600 mt-1">
            See all runners following your athlete community — face, name, and profile.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Members</h3>
          <p className="text-xs text-gray-600 mt-1">Who follows your athlete community.</p>
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Roster</h3>
              {isLoading ? (
                <p className="text-xs text-gray-500 mt-1">Loading…</p>
              ) : (
                <p className="text-xs text-gray-600 mt-1">
                  {memberCount} follower{memberCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>
          {!embedded ? (
            <Link
              href={followersPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
            >
              View public community
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>

        {!isLoading && members.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {members.map((m) => {
              const name = memberDisplayName(m);
              const profileHref = m.gofastHandle
                ? athletePublicPagePath(m.gofastHandle)
                : null;
              const row = (
                <>
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                    {m.photoURL ? (
                      <Image
                        src={m.photoURL}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-500">
                        {(m.firstName?.[0] ?? m.gofastHandle?.[0] ?? '?').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                    {m.gofastHandle ? (
                      <p className="text-xs text-gray-500 truncate">@{m.gofastHandle}</p>
                    ) : null}
                  </div>
                </>
              );

              return (
                <li key={m.id}>
                  {profileHref ? (
                    <Link
                      href={profileHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition"
                    >
                      {row}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : !isLoading ? (
          <p className="text-sm text-gray-500">No followers yet — share your invite link to grow.</p>
        ) : null}
      </div>

      {!embedded && onUrlUpdated ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Public URL</h3>
            <p className="text-xs text-gray-600 mt-1">
              Your community landing slug — followers use this to find you.
            </p>
          </div>
          <GoFastWithMeUrlEditor
            gofastHandle={gofastHandle}
            publicSlug={publicSlug}
            slugUsesHandle={slugUsesHandle}
            publicUrl={liveUrl}
            onUpdated={(slug, usesHandle) => onUrlUpdated(slug, usesHandle)}
          />
        </div>
      ) : null}
    </section>
  );
}
