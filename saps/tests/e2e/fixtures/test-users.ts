/**
 * Pre-seeded test users (created by global-setup.ts).
 * Each role has its own dedicated account so tests are deterministic.
 */

export const TEST_PASSWORD = "Test1234!";

export const USERS = {
  student: {
    email: "student@test.com",
    password: TEST_PASSWORD,
    role: "student" as const,
  },
  studentB: {
    email: "student-b@test.com",
    password: TEST_PASSWORD,
    role: "student" as const,
  },
  studentOnboarding: {
    email: "student-onboarding@test.com",
    password: TEST_PASSWORD,
    role: "student" as const,
  },
  parent: {
    email: "parent@test.com",
    password: TEST_PASSWORD,
    role: "parent" as const,
  },
  counselor: {
    email: "counselor@test.com",
    password: TEST_PASSWORD,
    role: "counselor" as const,
  },
  consent: {
    email: "consent-test@test.com",
    password: TEST_PASSWORD,
    role: "student" as const,
  },
} as const;

export type TestUser = typeof USERS[keyof typeof USERS];
