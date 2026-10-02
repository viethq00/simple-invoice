import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/controls';
import { Alert, Spinner } from '@/components/ui/feedback';
import { Field } from '@/components/ui/Field';
import { Wordmark } from '@/components/Wordmark';
import { isApiError } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { useDocumentTitle } from '@/lib/use-document-title';
import { loginSchema, type LoginFormValues } from './login-schema';
import type { LoginLocationState } from './route-guards';
import { useLogin } from './session';

function signInErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401)
      return 'The email or password is incorrect. Check both and try again.';
    if (error.status === 429) return 'Too many sign-in attempts. Wait a minute, then try again.';
  }
  return describeError(error);
}

export function LoginPage() {
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const login = useLogin();
  const [passwordVisible, setPasswordVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  useDocumentTitle('Sign in');

  // The disabled button loses focus while signing in. Put it back where a retry starts.
  useEffect(() => {
    if (login.isError) setFocus('password');
  }, [login.isError, setFocus]);

  // No navigate() here: PublicOnly redirects once the session is set.
  const onSubmit = handleSubmit((values) => login.mutate(values));

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        <div className="rounded-sheet bg-paper px-6 py-7 shadow-paper sm:px-8 sm:py-9">
          <h1 className="font-display text-2xl">Sign in</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to see and create invoices.</p>

          {state?.reason === 'expired' && !login.error && (
            <Alert tone="info" className="mt-5">
              Your session has expired. Sign in again.
            </Alert>
          )}
          {login.error && (
            <Alert tone="error" className="mt-5">
              {signInErrorMessage(login.error)}
            </Alert>
          )}

          <form
            noValidate
            onSubmit={(event) => void onSubmit(event)}
            className="mt-6 flex flex-col gap-4"
          >
            <Field id="email" label="Email address" required error={errors.email?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  {...register('email')}
                />
              )}
            </Field>

            <Field id="password" label="Password" required error={errors.password?.message}>
              {(control) => (
                <div className="relative">
                  <Input
                    {...control}
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-12"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-pressed={passwordVisible}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-ink-soft hover:text-ink"
                  >
                    {passwordVisible ? (
                      <EyeOff aria-hidden="true" className="size-4" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4" />
                    )}
                    <span className="sr-only">Show password</span>
                  </button>
                </div>
              )}
            </Field>

            <Button type="submit" className="mt-2 w-full" disabled={login.isPending}>
              {login.isPending && <Spinner />}
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
