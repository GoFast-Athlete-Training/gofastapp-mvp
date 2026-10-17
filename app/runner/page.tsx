import { redirect } from 'next/navigation';

/** Legacy URL — upcoming runs live on the Run hub */
export default function RunnerRedirectPage() {
  redirect('/gorun');
}
