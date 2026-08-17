import type { Server } from 'node:net';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { LoginDto } from '@modules/auth/dto/login.dto';
import type { CreateUserDto } from '@modules/users/dto/create-user.dto';
import { Role } from '@prisma/client';
import * as pactum from 'pactum';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';

describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'fatal';

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
    await prisma.user.deleteMany({ where: { email: { contains: '@e2e.test' } } });

    await app.init();
    await app.listen(0);

    const address = (app.getHttpServer() as Server).address();
    if (!address || typeof address === 'string') {
      throw new Error('HTTP server did not bind to a TCP port');
    }

    pactum.request.setBaseUrl(`http://127.0.0.1:${address.port}/api/v1`);
    pactum.request.setDefaultTimeout(15000);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@e2e.test' } } });
    await app.close();
  });

  describe('Auth', () => {
    const signupDto: CreateUserDto = {
      email: 'testuser@e2e.test',
      password: 'IamSpiderMan!1',
      firstName: 'Peter',
      lastName: 'Parker',
    };
    const signInDto: LoginDto = {
      email: 'testuser@e2e.test',
      password: 'IamSpiderMan!1',
    };
    const weakPasswordSignUpDto: CreateUserDto = {
      email: 'weakpass@e2e.test',
      password: 'password123',
      firstName: 'Weak',
      lastName: 'Password',
    };
    const nonExistingUserSignInDto: LoginDto = {
      email: 'fakeuser@e2e.test',
      password: 'SomePassword!1',
    };
    const adminSignupDto: CreateUserDto = {
      email: 'admin@e2e.test',
      password: 'AdminPass!1',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
    };
    const otherSignupDto: CreateUserDto = {
      email: 'other@e2e.test',
      password: 'OtherPass!1',
      firstName: 'Other',
      lastName: 'User',
    };
    const inactiveSignupDto: CreateUserDto = {
      email: 'inactive@e2e.test',
      password: 'InactivePass!1',
      firstName: 'Inactive',
      lastName: 'User',
    };

    describe('POST /auth/register', () => {
      it('should throw if form is empty', async () => {
        await pactum.spec().post('/auth/register').withBody({}).expectStatus(400);
      });

      it('should throw if email is missing', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withBody({
            password: signupDto.password,
            firstName: signupDto.firstName,
            lastName: signupDto.lastName,
          })
          .expectStatus(400);
      });

      it('should throw if password is missing', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withBody({
            email: signupDto.email,
            firstName: signupDto.firstName,
            lastName: signupDto.lastName,
          })
          .expectStatus(400);
      });

      it('should throw if firstName is missing', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withBody({
            email: 'missingname@e2e.test',
            password: signupDto.password,
            lastName: signupDto.lastName,
          })
          .expectStatus(400);
      });

      it('should throw if email is invalid', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withBody({
            ...signupDto,
            email: 'not-an-email',
          })
          .expectStatus(400);
      });

      it('should throw if password is weak', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withBody(weakPasswordSignUpDto)
          .expectStatus(400);
      });

      it('should throw if unknown fields are sent', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withHeaders('X-Correlation-ID', 'e2e-correlation-id')
          .withBody({
            ...signupDto,
            email: 'noextra@e2e.test',
            isAdmin: true,
          })
          .expectStatus(400)
          .expectJsonLike({
            statusCode: 400,
            correlationId: 'e2e-correlation-id',
          });
      });

      it('should pass signup', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withBody(signupDto)
          .expectStatus(201)
          .expectJsonLike({
            data: {
              accessToken: /.*/,
              user: {
                email: signupDto.email,
                firstName: signupDto.firstName,
                lastName: signupDto.lastName,
                role: Role.USER,
              },
            },
          })
          .stores('userAt', 'data.accessToken')
          .stores('userId', 'data.user.id');
      });

      it('should throw if email is taken', async () => {
        await pactum.spec().post('/auth/register').withBody(signupDto).expectStatus(409);
      });

      it('should pass admin signup', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withBody(adminSignupDto)
          .expectStatus(201)
          .stores('adminAt', 'data.accessToken')
          .stores('adminId', 'data.user.id');
      });

      it('should pass other user signup', async () => {
        await pactum
          .spec()
          .post('/auth/register')
          .withBody(otherSignupDto)
          .expectStatus(201)
          .stores('otherAt', 'data.accessToken')
          .stores('otherId', 'data.user.id');
      });

      it('should pass inactive user signup', async () => {
        await pactum.spec().post('/auth/register').withBody(inactiveSignupDto).expectStatus(201);
      });
    });

    describe('POST /auth/login', () => {
      it('should throw if form is empty', async () => {
        await pactum.spec().post('/auth/login').withBody({}).expectStatus(401);
      });

      it('should throw if email is missing', async () => {
        await pactum
          .spec()
          .post('/auth/login')
          .withBody({ password: signInDto.password })
          .expectStatus(401);
      });

      it('should throw if password is missing', async () => {
        await pactum
          .spec()
          .post('/auth/login')
          .withBody({ email: signInDto.email })
          .expectStatus(401);
      });

      it('should throw if user does not exist', async () => {
        await pactum
          .spec()
          .post('/auth/login')
          .withBody(nonExistingUserSignInDto)
          .expectStatus(401);
      });

      it('should throw if password is wrong', async () => {
        await pactum
          .spec()
          .post('/auth/login')
          .withBody({
            email: signInDto.email,
            password: 'WrongPass!1',
          })
          .expectStatus(401);
      });

      it('should throw if account is inactive', async () => {
        await prisma.user.update({
          where: { email: inactiveSignupDto.email },
          data: { isActive: false },
        });

        await pactum
          .spec()
          .post('/auth/login')
          .withBody({
            email: inactiveSignupDto.email,
            password: inactiveSignupDto.password,
          })
          .expectStatus(401);
      });

      it('should pass login', async () => {
        await pactum
          .spec()
          .post('/auth/login')
          .withBody(signInDto)
          .expectStatus(200)
          .expectJsonLike({
            data: {
              accessToken: /.*/,
              user: { email: signInDto.email },
            },
          })
          .stores('userAt', 'data.accessToken');
      });
    });
  });

  describe('Users', () => {
    const createUserDto: CreateUserDto = {
      email: 'created@e2e.test',
      password: 'CreatedPass!1',
      firstName: 'Created',
      lastName: 'User',
    };

    describe('GET /users/me', () => {
      it('should throw without a token', async () => {
        await pactum.spec().get('/users/me').expectStatus(401);
      });

      it('should throw with an invalid token', async () => {
        await pactum.spec().get('/users/me').withBearerToken('not-a-jwt').expectStatus(401);
      });

      it('should return the authenticated user', async () => {
        await pactum
          .spec()
          .get('/users/me')
          .withBearerToken('$S{userAt}')
          .expectStatus(200)
          .expectJsonLike({
            data: {
              email: 'testuser@e2e.test',
              firstName: 'Peter',
              lastName: 'Parker',
            },
          });
      });
    });

    describe('GET /users', () => {
      it('should throw without a token', async () => {
        await pactum.spec().get('/users').expectStatus(401);
      });

      it('should return a paginated list', async () => {
        await pactum
          .spec()
          .get('/users')
          .withBearerToken('$S{userAt}')
          .withQueryParams({ page: 1, limit: 5, sortBy: 'email', sortOrder: 'asc' })
          .expectStatus(200)
          .expectJsonLike({
            data: {
              pagination: {
                page: 1,
                limit: 5,
              },
            },
          });
      });

      it('should clamp invalid pagination values', async () => {
        await pactum
          .spec()
          .get('/users')
          .withBearerToken('$S{userAt}')
          .withQueryParams({ page: 0, limit: 500 })
          .expectStatus(200)
          .expectJsonLike({
            data: {
              pagination: {
                page: 1,
                limit: 100,
              },
            },
          });
      });
    });

    describe('GET /users/:id', () => {
      it('should throw without a token', async () => {
        await pactum.spec().get('/users/{id}').withPathParams('id', '$S{userId}').expectStatus(401);
      });

      it('should throw if user does not exist', async () => {
        await pactum
          .spec()
          .get('/users/{id}')
          .withPathParams('id', 'nonexistent-user-id')
          .withBearerToken('$S{userAt}')
          .expectStatus(404);
      });

      it('should return a user by id', async () => {
        await pactum
          .spec()
          .get('/users/{id}')
          .withPathParams('id', '$S{userId}')
          .withBearerToken('$S{userAt}')
          .expectStatus(200)
          .expectJsonLike({
            data: { email: 'testuser@e2e.test' },
          });
      });
    });

    describe('POST /users', () => {
      it('should throw without a token', async () => {
        await pactum.spec().post('/users').withBody(createUserDto).expectStatus(401);
      });

      it('should throw if form is empty', async () => {
        await pactum
          .spec()
          .post('/users')
          .withBearerToken('$S{userAt}')
          .withBody({})
          .expectStatus(400);
      });

      it('should create a user', async () => {
        await pactum
          .spec()
          .post('/users')
          .withBearerToken('$S{adminAt}')
          .withBody(createUserDto)
          .expectStatus(201)
          .expectJsonLike({
            data: { email: createUserDto.email },
          })
          .stores('createdUserId', 'data.id');
      });

      it('should throw if email is taken', async () => {
        await pactum
          .spec()
          .post('/users')
          .withBearerToken('$S{adminAt}')
          .withBody(createUserDto)
          .expectStatus(409);
      });
    });

    describe('PATCH /users/:id', () => {
      it('should throw without a token', async () => {
        await pactum
          .spec()
          .patch('/users/{id}')
          .withPathParams('id', '$S{userId}')
          .withBody({ firstName: 'Updated' })
          .expectStatus(401);
      });

      it('should throw if a user updates someone else', async () => {
        await pactum
          .spec()
          .patch('/users/{id}')
          .withPathParams('id', '$S{otherId}')
          .withBearerToken('$S{userAt}')
          .withBody({ firstName: 'Hacked' })
          .expectStatus(403);
      });

      it('should throw if the new email belongs to another user', async () => {
        await pactum
          .spec()
          .patch('/users/{id}')
          .withPathParams('id', '$S{userId}')
          .withBearerToken('$S{userAt}')
          .withBody({ email: 'other@e2e.test' })
          .expectStatus(409);
      });

      it('should throw if user does not exist', async () => {
        await pactum
          .spec()
          .patch('/users/{id}')
          .withPathParams('id', 'nonexistent-user-id')
          .withBearerToken('$S{adminAt}')
          .withBody({ firstName: 'Ghost' })
          .expectStatus(404);
      });

      it('should update own profile', async () => {
        await pactum
          .spec()
          .patch('/users/{id}')
          .withPathParams('id', '$S{userId}')
          .withBearerToken('$S{userAt}')
          .withBody({ firstName: 'Spidey' })
          .expectStatus(200)
          .expectJsonLike({
            data: { firstName: 'Spidey', email: 'testuser@e2e.test' },
          });
      });

      it('should allow admin to update another user', async () => {
        await pactum
          .spec()
          .patch('/users/{id}')
          .withPathParams('id', '$S{otherId}')
          .withBearerToken('$S{adminAt}')
          .withBody({ lastName: 'UpdatedByAdmin' })
          .expectStatus(200)
          .expectJsonLike({
            data: { lastName: 'UpdatedByAdmin' },
          });
      });
    });

    describe('DELETE /users/:id', () => {
      it('should throw without a token', async () => {
        await pactum
          .spec()
          .delete('/users/{id}')
          .withPathParams('id', '$S{createdUserId}')
          .expectStatus(401);
      });

      it('should throw if a user deletes someone else', async () => {
        await pactum
          .spec()
          .delete('/users/{id}')
          .withPathParams('id', '$S{createdUserId}')
          .withBearerToken('$S{userAt}')
          .expectStatus(403);
      });

      it('should throw if user does not exist', async () => {
        await pactum
          .spec()
          .delete('/users/{id}')
          .withPathParams('id', 'nonexistent-user-id')
          .withBearerToken('$S{adminAt}')
          .expectStatus(404);
      });

      it('should allow admin to delete another user', async () => {
        await pactum
          .spec()
          .delete('/users/{id}')
          .withPathParams('id', '$S{createdUserId}')
          .withBearerToken('$S{adminAt}')
          .expectStatus(204);
      });
    });
  });
});
