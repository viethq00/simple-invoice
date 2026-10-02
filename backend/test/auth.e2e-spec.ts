import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { JWT_AUDIENCE, JWT_ISSUER } from '../src/auth/auth.constants';
import { User } from '../src/users/user.entity';
import {
  createTestApp,
  createUser,
  login,
  resetDatabase,
  REVIEWER,
  type TestContext,
} from './utils/test-app';

describe('Authentication (e2e)', () => {
  let ctx: TestContext;
  let user: User;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    user = await createUser(ctx.dataSource);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /auth/login', () => {
    it('returns a JWT and the profile, and sets a secure session cookie', async () => {
      const response = await request(ctx.server)
        .post('/auth/login')
        .send({ email: REVIEWER.email, password: REVIEWER.password })
        .expect(200);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: user.id,
          email: REVIEWER.email,
          fullname: REVIEWER.fullname,
          createdAt: expect.any(String),
        },
      });
      const cookie = String(response.headers['set-cookie']);
      expect(cookie).toMatch(/^access_token=[\w-]+\.[\w-]+\.[\w-]+;/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=3600');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('matches the email case- and whitespace-insensitively', async () => {
      await request(ctx.server)
        .post('/auth/login')
        .send({ email: `  ${REVIEWER.email.toUpperCase()} `, password: REVIEWER.password })
        .expect(200);
    });

    it.each([
      ['a wrong password', { email: REVIEWER.email, password: 'not-the-password' }],
      ['an unknown email', { email: 'nobody@simpleinvoice.test', password: REVIEWER.password }],
    ])('rejects %s with one generic message', async (_label, credentials) => {
      const response = await request(ctx.server).post('/auth/login').send(credentials).expect(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('refuses form-encoded credentials (login CSRF) without setting a cookie', async () => {
      const response = await request(ctx.server)
        .post('/auth/login')
        .type('form')
        .send({ email: REVIEWER.email, password: REVIEWER.password })
        .expect(415);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('validates the input server-side', async () => {
      const response = await request(ctx.server)
        .post('/auth/login')
        .send({ email: 'not-an-email' })
        .expect(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: ['email must be a valid email address', 'password is required'],
        error: 'Bad Request',
      });
    });
  });

  describe('GET /auth/me', () => {
    it('accepts the token as a Bearer header', async () => {
      const token = await login(ctx.server);
      const response = await request(ctx.server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body).toEqual({
        id: user.id,
        email: REVIEWER.email,
        fullname: REVIEWER.fullname,
        createdAt: expect.any(String),
      });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('accepts the HttpOnly session cookie', async () => {
      const agent = request.agent(ctx.server);
      await agent.post('/auth/login').send({ email: REVIEWER.email, password: REVIEWER.password });
      const response = await agent.get('/auth/me').expect(200);
      expect(response.body).toMatchObject({ email: REVIEWER.email });
    });

    it('rejects missing credentials', async () => {
      const response = await request(ctx.server).get('/auth/me').expect(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
    });

    it('rejects an expired token with a specific message', async () => {
      const jwt = ctx.app.get(JwtService);
      const expired = await jwt.signAsync({ sub: user.id, email: user.email }, { expiresIn: -10 });
      const response = await request(ctx.server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
      expect(response.body.message).toBe('Access token has expired');
    });

    it.each([
      [
        'signed with another secret',
        () =>
          new JwtService().signAsync(
            { sub: '00000000-0000-4000-8000-000000000000', email: 'x@y.z' },
            {
              secret: 'another-secret-another-secret-123',
              issuer: JWT_ISSUER,
              audience: JWT_AUDIENCE,
            },
          ),
      ],
      ['malformed', () => Promise.resolve('not.a.jwt')],
    ])('rejects a token %s', async (_label, makeToken) => {
      await request(ctx.server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${await makeToken()}`)
        .expect(401);
    });

    it('rejects a token with the wrong audience', async () => {
      const token = await ctx.app
        .get(JwtService)
        .signAsync({ sub: user.id, email: user.email }, { audience: 'someone-else' });
      await request(ctx.server).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('rejects a valid token once the user no longer exists', async () => {
      const token = await login(ctx.server);
      await ctx.dataSource.getRepository(User).delete(user.id);
      await request(ctx.server).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the session cookie', async () => {
      const agent = request.agent(ctx.server);
      await agent.post('/auth/login').send({ email: REVIEWER.email, password: REVIEWER.password });
      const response = await agent.post('/auth/logout').expect(204);
      expect(String(response.headers['set-cookie'])).toMatch(
        /access_token=;.*Expires=Thu, 01 Jan 1970/,
      );
      await agent.get('/auth/me').expect(401);
    });
  });
});
