'use client';

import { useParams } from 'next/navigation';
import { StudyReader } from '@/components/studies/StudyReader';

export default function StudyPage() {
  const { id } = useParams<{ id: string }>();
  return <StudyReader key={id} id={id} />;
}
