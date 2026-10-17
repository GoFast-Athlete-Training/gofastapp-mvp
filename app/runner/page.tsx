import { redirect } from 'next/navigation';

/** Legacy URL — My Runs lives at /myruns */
export default function RunnerRedirectPage() {
  redirect('/myruns');
}
