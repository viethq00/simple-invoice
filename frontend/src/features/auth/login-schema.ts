import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .max(254, 'Email address must be 254 characters or fewer')
    .pipe(z.email('Enter a valid email address, like name@example.com')),
  password: z
    .string()
    .min(1, 'Enter your password')
    .max(128, 'Password must be 128 characters or fewer'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
