import { useSearchParams } from 'react-router-dom';

export function EmailVerificationResultPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  function getVerificationMessage(status: string | null) {
    if (status === 'verified') {
      return 'Email verified. You can now sign in.';
    }
    if (status === 'already_verified') {
      return 'Email is already verified.';
    }

    return 'Verification link is invalild or expired.';
  }

  return (
    <>
      <h1>{getVerificationMessage(status)}</h1>
    </>
  );
}
