import { Suspense } from 'react';
import EmailStep from './EmailStep';

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <EmailStep />
    </Suspense>
  );
}
