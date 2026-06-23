type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

export async function sendExpoPushBatch(
  tokens: string[],
  message: { title: string; body: string; data?: Record<string, unknown> }
): Promise<number> {
  const unique = [
    ...new Set(
      tokens.filter(
        (t) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')
      )
    ),
  ];
  if (unique.length === 0) return 0;

  const payload: ExpoPushMessage[] = unique.map((to) => ({
    to,
    title: message.title,
    body: message.body,
    data: message.data,
    sound: 'default',
  }));

  try {
    const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN?.trim();
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('Expo push HTTP error', res.status, await res.text());
      return 0;
    }

    const json = (await res.json()) as { data?: ExpoPushTicket[] };
    const tickets = json.data ?? [];
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error('Expo push ticket error', ticket.message, ticket.details);
      }
    }
    return tickets.filter((t) => t.status === 'ok').length;
  } catch (err) {
    console.error('Expo push send failed', err);
    return 0;
  }
}
