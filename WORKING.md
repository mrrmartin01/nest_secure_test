# How We Work — Developer Guide

Welcome to the team. This file tells you **exactly where to put things** and **how to write code** in this project. Read it once before you start coding. Refer back to it whenever you're unsure.

If you're ever confused about where something goes, look at the `users/` or `auth/` folder — they are the reference examples that every new feature should follow.

---

## Table of Contents

1. [The Big Picture — How the Project is Organized](#1-the-big-picture--how-the-project-is-organized)
2. [Where Does My File Go?](#2-where-does-my-file-go)
3. [How to Add a New Feature (Step by Step)](#3-how-to-add-a-new-feature-step-by-step)
4. [Controllers — The Front Door](#4-controllers--the-front-door)
5. [Services — The Brain](#5-services--the-brain)
6. [Repositories — The Database Talker](#6-repositories--the-database-talker)
7. [DTOs — What Goes In and What Comes Out](#7-dtos--what-goes-in-and-what-comes-out)
8. [Entities — The Database Row Wrapper](#8-entities--the-database-row-wrapper)
9. [Modules — The Registration Form](#9-modules--the-registration-form)
10. [Naming Things](#10-naming-things)
11. [Imports — How to Reference Other Files](#11-imports--how-to-reference-other-files)
12. [Never Do These Things](#12-never-do-these-things)
13. [Ready-to-Use Code Patterns](#13-ready-to-use-code-patterns)

---

## 1. The Big Picture — How the Project is Organized

Think of the project like a restaurant:

| Part of the restaurant | Part of the project | Folder |
|---|---|---|
| The **waiter** takes orders from customers and brings food back | **Controller** — takes HTTP requests, sends responses | `src/modules/<feature>/` |
| The **chef** decides what goes in each dish | **Service** — business logic, decisions, rules | `src/modules/<feature>/` |
| The **pantry** stores and retrieves ingredients | **Repository** — reads and writes to the database | `src/modules/<feature>/repositories/` |
| The **order form** the waiter writes on | **DTO** — the shape of data coming in and going out | `src/modules/<feature>/dto/` |
| The **recipe card** describing the ingredient | **Entity** — the shape of data stored in the database | `src/modules/<feature>/entities/` |

The project is split into four main zones:

```
src/
├── core/        Things that apply to EVERY request (security, logging, error handling)
├── modules/     Your features live here (users, products, orders, etc.)
├── shared/      Helper tools, types, and settings used across the whole app
└── database/    The database connection (you rarely need to touch this)
```

**The golden rule:** Each file does ONE thing. If you can't describe what a file does in one sentence, it's doing too much.

---

## 2. Where Does My File Go?

Use this table whenever you create a new file.

| What you're creating | Where it goes |
|---|---|
| A route that handles HTTP requests (`GET`, `POST`, etc.) | `src/modules/<feature>/<feature>.controller.ts` |
| Business logic (rules, decisions, calculations) | `src/modules/<feature>/<feature>.service.ts` |
| Database queries (reading/writing to the DB) | `src/modules/<feature>/repositories/<feature>.repository.ts` |
| The shape of data the API **receives** (POST/PUT body) | `src/modules/<feature>/dto/create-<feature>.dto.ts` |
| The shape of data the API **receives** for updates (PATCH) | `src/modules/<feature>/dto/update-<feature>.dto.ts` |
| The shape of data the API **sends back** to the client | `src/modules/<feature>/dto/<feature>-response.dto.ts` |
| The shape of a database row | `src/modules/<feature>/entities/<feature>.entity.ts` |
| The module file that registers everything | `src/modules/<feature>/<feature>.module.ts` |
| A setting/config that reads from `.env` | `src/shared/config/` |
| A TypeScript type or interface used by multiple features | `src/shared/types/` |
| A reusable helper function (pure logic, no database) | `src/shared/utils/` |
| A shared constant (a fixed string or number used everywhere) | `src/shared/constants/index.ts` |
| A unit test | Same folder as the file you're testing, named `<name>.spec.ts` |
| An end-to-end test (tests the full API) | `test/` folder, named `<feature>.e2e-spec.ts` |

---

## 3. How to Add a New Feature (Step by Step)

Let's say you're building a **Products** feature. Follow these steps in order every time.

---

### Step 1 — Create the folders

```
src/modules/products/
├── dto/
├── entities/
└── repositories/
```

---

### Step 2 — Add the database model

Open `prisma/schema.prisma` and add your model at the bottom:

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  price       Float
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("products")
}
```

Then run:
```bash
bun run prisma:migrate
```

This creates the table in the database and updates the Prisma client.

---

### Step 3 — Create the Entity

**File:** `src/modules/products/entities/product.entity.ts`

The entity wraps the raw database row and controls what fields are visible in API responses.

```typescript
import { Exclude, Expose } from 'class-transformer';
import type { Product as PrismaProduct } from '@prisma/client';

@Exclude() // Hide all fields by default
export class ProductEntity implements PrismaProduct {
  @Expose() id!: string;
  @Expose() name!: string;
  @Expose() price!: number;
  @Expose() description!: string | null;
  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;

  constructor(partial: PrismaProduct) {
    Object.assign(this, partial);
  }
}
```

---

### Step 4 — Create the DTOs

**File:** `src/modules/products/dto/create-product.dto.ts` — what the API accepts on POST

```typescript
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value.trim())
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @IsOptional()
  description?: string;
}
```

**File:** `src/modules/products/dto/update-product.dto.ts` — all fields become optional

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

**File:** `src/modules/products/dto/product-response.dto.ts` — what the API sends back

```typescript
import { Exclude, Expose } from 'class-transformer';
import type { ProductEntity } from '../entities/product.entity';

@Exclude()
export class ProductResponseDto {
  @Expose() id!: string;
  @Expose() name!: string;
  @Expose() price!: number;
  @Expose() createdAt!: Date;

  constructor(product: ProductEntity) {
    Object.assign(this, {
      id: product.id,
      name: product.name,
      price: product.price,
      createdAt: product.createdAt,
    });
  }
}
```

---

### Step 5 — Create the Repository

**File:** `src/modules/products/repositories/products.repository.ts`

This is the only file that talks to the database.

```typescript
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma/prisma.service';
import { ProductEntity } from '../entities/product.entity';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ProductCreateInput): Promise<ProductEntity> {
    const product = await this.prisma.product.create({ data });
    return new ProductEntity(product);
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    return product ? new ProductEntity(product) : null;
  }

  async findAll(): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    return products.map((p) => new ProductEntity(p));
  }

  async update(id: string, data: Prisma.ProductUpdateInput): Promise<ProductEntity> {
    const product = await this.prisma.product.update({ where: { id }, data });
    return new ProductEntity(product);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }
}
```

---

### Step 6 — Create the Service

**File:** `src/modules/products/products.service.ts`

The service contains your business logic. It uses the repository to access data.

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { ProductEntity } from './entities/product.entity';
import { ProductsRepository } from './repositories/products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    return this.productsRepository.create(dto);
  }

  async findAll(): Promise<ProductEntity[]> {
    return this.productsRepository.findAll();
  }

  async findOne(id: string): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    await this.findOne(id); // throws 404 if not found
    return this.productsRepository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // throws 404 if not found
    await this.productsRepository.delete(id);
  }
}
```

---

### Step 7 — Create the Controller

**File:** `src/modules/products/products.controller.ts`

The controller handles incoming HTTP requests and sends responses. It doesn't make decisions — it just calls the service and formats the output.

```typescript
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.productsService.create(dto);
    return new ProductResponseDto(product);
  }

  @Get()
  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.productsService.findAll();
    return products.map((p) => new ProductResponseDto(p));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    const product = await this.productsService.findOne(id);
    return new ProductResponseDto(product);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto): Promise<ProductResponseDto> {
    const product = await this.productsService.update(id, dto);
    return new ProductResponseDto(product);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.productsService.remove(id);
  }
}
```

---

### Step 8 — Create the Module

**File:** `src/modules/products/products.module.ts`

This file just tells NestJS what exists inside this feature.

```typescript
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repositories/products.repository';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService], // only add exports if another module needs to use ProductsService
})
export class ProductsModule {}
```

---

### Step 9 — Register it in AppModule

Open `src/app.module.ts` and add your new module to the imports list:

```typescript
import { ProductsModule } from '@modules/products/products.module';

@Module({
  imports: [
    // ... existing modules
    ProductsModule, // ← add this
  ],
})
export class AppModule {}
```

---

### Step 10 — Write the tests

**File:** `src/modules/products/products.service.spec.ts`

```typescript
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repositories/products.repository';

const mockProduct = { id: '1', name: 'Widget', price: 9.99 } as any;

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<ProductsRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ProductsService);
    repository = module.get(ProductsRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('findOne', () => {
    it('returns the product when it exists', async () => {
      repository.findById.mockResolvedValue(mockProduct);
      const result = await service.findOne('1');
      expect(result).toEqual(mockProduct);
    });

    it('throws NotFoundException when the product does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## 4. Controllers — The Front Door

The controller is like the front door of your feature. Its only job is to:
- Receive the HTTP request
- Hand it off to the service
- Send the response back

**It makes zero decisions.** All decisions happen in the service.

### Quick rules for controllers

- Always return a **response DTO** — never return an entity directly
- `POST` routes → add `@HttpCode(HttpStatus.CREATED)`
- `DELETE` routes → add `@HttpCode(HttpStatus.NO_CONTENT)`
- To get the logged-in user, use `@CurrentUser()` — don't access `request.user` yourself
- Routes are **protected by default** — you don't need to do anything special

### Making a route public (no login required)

Add `@Public()` above the route decorator:

```typescript
@Public()
@Post('register')
@HttpCode(HttpStatus.CREATED)
async register(@Body() dto: RegisterDto): Promise<AuthTokens> {
  return this.authService.register(dto);
}
```

---

## 5. Services — The Brain

The service is where all the thinking happens. It:
- Applies business rules ("can this user do this?", "does this already exist?")
- Calls the repository to read/write data
- Throws errors when something goes wrong

### Quick rules for services

- Use `Logger` to log things — never `console.log`
- Throw NestJS errors for problems: `NotFoundException`, `ConflictException`, `ForbiddenException`
- Never call Prisma directly — always go through the repository
- Return entities from service methods — let the controller turn them into response DTOs

### Common errors to throw

```typescript
// Something was not found in the database
throw new NotFoundException('Product not found');

// Something already exists (e.g., duplicate email)
throw new ConflictException('A product with this name already exists');

// The user doesn't have permission
throw new ForbiddenException('You can only edit your own products');

// The request is missing something or has bad data
throw new BadRequestException('Start date must be before end date');
```

---

## 6. Repositories — The Database Talker

The repository is the only file that talks to the database. Everything that involves reading or writing data lives here.

### Quick rules for repositories

- Always return an **Entity** instance — never return a raw Prisma object
- Name methods clearly: `findById`, `findByEmail`, `findAll`, `create`, `update`, `delete`, `exists`
- No business logic here — no throwing errors based on what the data contains (that's the service's job)
- For operations that must all succeed or all fail together, use `this.prisma.$transaction([...])`

---

## 7. DTOs — What Goes In and What Comes Out

DTO stands for **Data Transfer Object**. Think of it as a form:
- The **create DTO** is the form a user fills out when creating something
- The **update DTO** is the form for editing (all fields optional)
- The **response DTO** is what we send back — we choose exactly which fields to include

### Why do we have both an entity and a response DTO?

The entity contains everything from the database, including sensitive things like `password`. The response DTO is what we actually send to the client — we pick only the safe, relevant fields.

### Quick rules for DTOs

- Add validation decorators (`@IsString()`, `@IsEmail()`, `@IsNotEmpty()`, etc.) to every field in the create DTO
- Use `@Transform` to clean up input (trim whitespace, lowercase emails)
- Declare all required properties with `!` at the end: `name!: string`
- Declare optional properties with `?`: `description?: string`
- Never put database queries or business logic inside a DTO

---

## 8. Entities — The Database Row Wrapper

The entity wraps whatever Prisma returns from the database. It also controls which fields get included when the response is serialized.

### Quick rules for entities

- Put `@Exclude()` on the class — this hides everything by default
- Put `@Expose()` on each field you want to show
- **Never** put `@Expose()` on sensitive fields like `password`, `resetToken`, etc.
- Always declare properties with `!`: `id!: string`
- The constructor always does `Object.assign(this, partial)` — copy-paste this every time

---

## 9. Modules — The Registration Form

The module file is just a registration form that tells NestJS what exists in your feature. It doesn't contain any logic.

### Quick rules for modules

- `controllers` → list this feature's controller
- `providers` → list the service AND the repository
- `exports` → only add a service here if another module needs to use it
- You do NOT need to import the database module — it's already available everywhere

---

## 10. Naming Things

Follow these names exactly. Consistency makes the codebase easy to navigate.

### Files — always `kebab-case`

```
create-product.dto.ts       ✅
CreateProductDTO.ts         ❌
createProduct.dto.ts        ❌
```

### Classes — always `PascalCase` with the right suffix

```typescript
ProductsController    // controller
ProductsService       // service
ProductsRepository    // repository
ProductEntity         // entity (singular)
CreateProductDto      // DTO
UpdateProductDto      // DTO
ProductResponseDto    // DTO
ProductsModule        // module
```

### Methods and variables — always `camelCase`

```typescript
async findById(id: string) { ... }
const hashedPassword = await hashPassword(plain);
const totalPages = Math.ceil(total / limit);
```

### Constants — always `SCREAMING_SNAKE_CASE`

```typescript
export const BCRYPT_ROUNDS = 12;
export const JWT_STRATEGY = 'jwt';
```

### Routes — always `kebab-case`

```
/products              ✅
/product-categories    ✅
/productCategories     ❌
/ProductCategories     ❌
```

### Folder names — always `plural` and `kebab-case`

```
src/modules/products/           ✅
src/modules/product/            ❌
src/modules/productOrders/      ❌
src/modules/product-orders/     ✅
```

---

## 11. Imports — How to Reference Other Files

We use **path aliases** instead of long relative paths. They're shorter, cleaner, and don't break when files move.

```typescript
// ✅ Use these aliases
import { UsersService } from '@modules/users/users.service';
import { hashPassword } from '@shared/utils/hash.util';
import { PrismaService } from '@database/prisma/prisma.service';
import { JwtAuthGuard } from '@core/guards/jwt-auth.guard';

// ❌ Never do this — relative paths across folders
import { UsersService } from '../../../modules/users/users.service';
```

**The only time relative imports are fine** is inside the same module:

```typescript
// ✅ Fine — same module, same folder
import { ProductsRepository } from './repositories/products.repository';
import { ProductEntity } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
```

---

## 12. Never Do These Things

These are hard rules. Most of them are caught automatically by ESLint or TypeScript. The rest are caught in code review.

---

### ❌ Never use `process.env` directly

```typescript
// ❌ Wrong
const port = process.env.PORT;

// ✅ Right — use ConfigService
const port = this.configService.get<number>('app.port');
```

**Why:** `process.env` gives you an untyped string and bypasses the startup validation that catches missing or invalid config.

---

### ❌ Never use `console.log`

```typescript
// ❌ Wrong
console.log('User created:', user);

// ✅ Right
private readonly logger = new Logger(ProductsService.name);
this.logger.log('Product created');
```

**Why:** `console.log` is unstructured and invisible in production. The logger formats output as JSON and includes the correlation ID.

---

### ❌ Never use `any` as a type

```typescript
// ❌ Wrong
async findOne(id: any): Promise<any> { ... }

// ✅ Right
async findOne(id: string): Promise<ProductEntity> { ... }
```

**Why:** `any` turns off TypeScript. It defeats the entire purpose of using TypeScript.

---

### ❌ Never call Prisma directly from a service

```typescript
// ❌ Wrong — service touching the database directly
async findProduct(id: string) {
  return this.prisma.product.findUnique({ where: { id } }); // ← NO
}

// ✅ Right — service uses the repository
async findProduct(id: string) {
  return this.productsRepository.findById(id);
}
```

**Why:** If the database query needs to change, you change it in one place (the repository), not everywhere it's used.

---

### ❌ Never put business logic in a controller

```typescript
// ❌ Wrong — decision-making in the controller
async create(@Body() dto: CreateProductDto) {
  if (dto.price < 0) throw new BadRequestException('Price cannot be negative'); // ← NO
  if (await this.prisma.product.count() > 100) throw new Error('Too many products'); // ← NO
  return this.productsService.create(dto);
}

// ✅ Right — all logic lives in the service
async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
  const product = await this.productsService.create(dto);
  return new ProductResponseDto(product);
}
```

**Why:** Logic in controllers can't be unit tested without spinning up an HTTP server.

---

### ❌ Never return a raw Prisma object from a repository

```typescript
// ❌ Wrong — raw Prisma object
async findById(id: string) {
  return this.prisma.product.findUnique({ where: { id } }); // returns raw object
}

// ✅ Right — wrapped in an Entity
async findById(id: string): Promise<ProductEntity | null> {
  const product = await this.prisma.product.findUnique({ where: { id } });
  return product ? new ProductEntity(product) : null;
}
```

**Why:** Without wrapping in an Entity, the `@Exclude`/`@Expose` decorators don't apply, and sensitive fields can leak into responses.

---

### ❌ Never commit `.env` files

```
.env          ← NEVER commit this (it has real secrets)
.env.example  ← ALWAYS keep this updated (it has example values, no real secrets)
```

**Why:** Secrets committed to Git can never be fully removed and are a security incident waiting to happen.

---

### ❌ Never access another module's repository directly

```typescript
// ❌ Wrong — products module reaching into users' repository
class ProductsService {
  constructor(private readonly usersRepository: UsersRepository) {} // ← NO
}

// ✅ Right — use the exported service instead
class ProductsService {
  constructor(private readonly usersService: UsersService) {} // ← YES, if UsersModule exports it
}
```

**Why:** Repositories are internal to their module. Using another module's service keeps the boundary clean.

---

## 13. Ready-to-Use Code Patterns

Copy these exactly when you need them.

---

### A route that requires login (the default — no extra code needed)

Every route is protected by default. Just write the handler normally:

```typescript
@Get(':id')
async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
  const product = await this.productsService.findOne(id);
  return new ProductResponseDto(product);
}
```

---

### A route that does NOT require login

Add `@Public()` above it:

```typescript
@Public()
@Get('featured')
async getFeatured(): Promise<ProductResponseDto[]> {
  const products = await this.productsService.getFeatured();
  return products.map((p) => new ProductResponseDto(p));
}
```

---

### Getting the currently logged-in user

```typescript
@Get('my-products')
async getMyProducts(@CurrentUser() user: RequestUser): Promise<ProductResponseDto[]> {
  const products = await this.productsService.findByOwner(user.id);
  return products.map((p) => new ProductResponseDto(p));
}
```

---

### Checking if a record already exists before creating

```typescript
// In the service
async create(dto: CreateProductDto): Promise<ProductEntity> {
  const exists = await this.productsRepository.exists({ name: dto.name });
  if (exists) throw new ConflictException('A product with this name already exists');
  return this.productsRepository.create(dto);
}

// In the repository
async exists(where: Prisma.ProductWhereUniqueInput): Promise<boolean> {
  const count = await this.prisma.product.count({ where });
  return count > 0;
}
```

---

### Checking ownership before allowing an update

```typescript
// In the controller
@Patch(':id')
async update(
  @Param('id') id: string,
  @Body() dto: UpdateProductDto,
  @CurrentUser() user: RequestUser,
): Promise<ProductResponseDto> {
  const product = await this.productsService.update(id, dto, user.id);
  return new ProductResponseDto(product);
}

// In the service
async update(id: string, dto: UpdateProductDto, requestingUserId: string): Promise<ProductEntity> {
  const product = await this.findOne(id); // throws 404 if not found
  if (product.ownerId !== requestingUserId) {
    throw new ForbiddenException('You can only edit your own products');
  }
  return this.productsRepository.update(id, dto);
}
```

---

### Logging inside a service

```typescript
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    const product = await this.productsRepository.create(dto);
    this.logger.log(`Product created with id ${product.id}`);
    return product;
  }
}
```

---

### A unit test (the structure to follow every time)

```typescript
describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<ProductsRepository>;

  // Set up fresh instances before each test
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ProductsService);
    repository = module.get(ProductsRepository);
  });

  // Reset mocks after each test so they don't bleed into each other
  afterEach(() => jest.restoreAllMocks());

  describe('findOne', () => {
    it('returns the product when it exists', async () => {
      repository.findById.mockResolvedValue(mockProduct);

      const result = await service.findOne('product-id');

      expect(result).toEqual(mockProduct);
    });

    it('throws NotFoundException when the product does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
```
