import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    prisma = moduleRef.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@e2e.test' } } });
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    const validPayload = {
      email: 'alice@e2e.test',
      password: 'Password1!',
      firstName: 'Alice',
      lastName: 'Smith',
    };

    it('registers a new user and returns tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validPayload)
        .expect(201);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe(validPayload.email);
      expect(res.body.data.user).not.toHaveProperty('password');
    });

    it('returns 409 when email is already registered', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send(validPayload);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validPayload)
        .expect(409);

      expect(res.body.statusCode).toBe(409);
    });

    it('returns 400 when password does not meet requirements', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validPayload, email: 'weak@e2e.test', password: 'weak' })
        .expect(400);
    });

    it('strips unknown fields (mass assignment protection)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validPayload, email: 'noextra@e2e.test', isAdmin: true, role: 'ADMIN' })
        .expect(400);

      // forbidNonWhitelisted should reject the extra fields
      expect(res.body.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const credentials = { email: 'login@e2e.test', password: 'Password1!' };

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...credentials, firstName: 'Login', lastName: 'User' });
    });

    it('returns an access token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(200);

      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('returns 401 for invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: 'WrongPass1!' })
        .expect(401);
    });
  });

  describe('GET /api/v1/users/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'me@e2e.test',
          password: 'Password1!',
          firstName: 'Me',
          lastName: 'User',
        });
      accessToken = res.body.data.accessToken as string;
    });

    it('returns the authenticated user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe('me@e2e.test');
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });
  });
});
