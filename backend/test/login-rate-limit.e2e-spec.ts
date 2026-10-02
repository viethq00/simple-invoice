import './utils/low-login-rate-limit'; // must stay the first import
import request from 'supertest';
import { createTestApp, resetDatabase, type TestContext } from './utils/test-app';

describe('Login rate limiting (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.dataSource);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  // Throttle buckets outlive a test, so each test uses its own IPs and accounts.
  const attempt = (email: string, clientIp: string) =>
    request(ctx.server)
      .post('/auth/login')
      .set('X-Forwarded-For', clientIp)
      .send({ email, password: 'guess' });

  it('answers 429 in the standard error shape after too many attempts', async () => {
    for (let i = 0; i < 3; i += 1) await attempt('attacker@example.com', '192.0.2.1').expect(401);
    const blocked = await attempt('attacker@example.com', '192.0.2.1').expect(429);
    expect(blocked.body).toEqual({
      statusCode: 429,
      message: 'Too many login attempts. Try again in a minute.',
      error: 'Too Many Requests',
    });
  });

  it('limits each client IP across accounts, with a standard Retry-After header', async () => {
    for (let i = 0; i < 3; i += 1)
      await attempt(`user${i}@example.com`, '198.51.100.7').expect(401);
    const blocked = await attempt('user9@example.com', '198.51.100.7').expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits each account even when the client IP keeps changing', async () => {
    for (let i = 0; i < 3; i += 1)
      await attempt('victim@example.com', `203.0.113.${i}`).expect(401);
    await attempt(' Victim@Example.com ', '203.0.113.99').expect(429);
    await attempt('someone-else@example.com', '203.0.113.99').expect(401);
  });

  it('does not rate-limit other routes', async () => {
    for (let i = 0; i < 5; i += 1) await request(ctx.server).get('/health').expect(200);
  });
});
