/** Ambient types so `tsc` understands Bun's test globals without pulling in bun-types. */
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;
