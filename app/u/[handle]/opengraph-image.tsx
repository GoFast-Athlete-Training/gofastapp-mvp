import { ImageResponse } from 'next/og';
import { loadPublicAthletePage } from '@/lib/server/load-public-athlete-page';

export const runtime = 'nodejs';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'GoFast profile';

type RouteParams = { handle: string };

function displayNameFor(
  firstName: string | null,
  lastName: string | null,
  handle: string | null,
): string {
  const composed = [firstName, lastName].filter(Boolean).join(' ');
  if (composed) return composed;
  return handle ? `@${handle}` : 'Runner';
}

export default async function OgImage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { handle } = await params;
  const data = await loadPublicAthletePage(handle);

  const name = data
    ? displayNameFor(data.athlete.firstName, data.athlete.lastName, data.athlete.gofastHandle)
    : 'GoFast runner';
  const handleLine = data?.athlete.gofastHandle ? `@${data.athlete.gofastHandle}` : '';
  const chasing =
    data?.trainingSummary?.raceName ??
    data?.primaryChasingGoal?.raceName ??
    data?.primaryChasingGoal?.name ??
    null;
  const upcomingCount = data?.upcomingRuns.length ?? 0;
  const heroPhoto = data?.athlete.myBestRunPhotoURL ?? null;
  const avatar = data?.athlete.photoURL ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: 'linear-gradient(135deg, #f97316 0%, #fb7185 100%)',
        }}
      >
        {heroPhoto && (
          <img
            src={heroPhoto}
            alt=""
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              inset: 0,
              objectFit: 'cover',
              width: 1200,
              height: 630,
            }}
          />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.75) 100%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'white',
              letterSpacing: -0.5,
              textShadow: '0 2px 12px rgba(0,0,0,0.35)',
            }}
          >
            GoFast
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: 56,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 28,
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt=""
              width={144}
              height={144}
              style={{
                width: 144,
                height: 144,
                borderRadius: 9999,
                border: '6px solid white',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: 144,
                height: 144,
                borderRadius: 9999,
                border: '6px solid white',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 64,
                fontWeight: 800,
              }}
            >
              {(name.charAt(0) || '?').toUpperCase()}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: 'white',
                lineHeight: 1.05,
                letterSpacing: -1.5,
                textShadow: '0 2px 16px rgba(0,0,0,0.45)',
                display: 'flex',
              }}
            >
              {name}
            </div>
            {handleLine && (
              <div
                style={{
                  fontSize: 28,
                  color: 'rgba(255,255,255,0.85)',
                  marginTop: 6,
                  textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                  display: 'flex',
                }}
              >
                {handleLine}
              </div>
            )}
            {chasing && (
              <div
                style={{
                  fontSize: 30,
                  color: 'white',
                  marginTop: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    background: '#f97316',
                    color: 'white',
                    padding: '6px 14px',
                    borderRadius: 9999,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}
                >
                  Chasing
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                    display: 'flex',
                  }}
                >
                  {chasing}
                </span>
              </div>
            )}
            {upcomingCount > 0 && (
              <div
                style={{
                  fontSize: 22,
                  color: 'rgba(255,255,255,0.92)',
                  marginTop: 14,
                  textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                  display: 'flex',
                }}
              >
                {upcomingCount === 1
                  ? '1 upcoming run \u00b7 RSVP to join'
                  : `${upcomingCount} upcoming runs \u00b7 RSVP to join`}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
