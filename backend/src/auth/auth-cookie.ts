import type { CookieOptions } from 'express';

export function authCookieOptions(secure: boolean, maxAgeSeconds?: number): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds * 1000 }),
  };
}
