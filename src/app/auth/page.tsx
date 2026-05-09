import { Suspense } from 'react';
import AuthFlow from './AuthFlow';

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthFlow />
    </Suspense>
  );
}
