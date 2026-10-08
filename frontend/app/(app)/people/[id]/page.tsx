'use client';

import { useParams } from 'next/navigation';
import { Profile } from '@/components/people/Profile';

/** People — Profile (prototype screen 04). */
export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <Profile id={id} />;
}
