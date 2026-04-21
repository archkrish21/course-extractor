import { test, expect } from "@playwright/test";
import {
  listAccountMembers,
  getCurrentAccount,
} from "../helpers/api-client";

/**
 * Account member removal permissions:
 *   - Student (account owner) can remove anyone
 *   - Parent/counselor/guardian can only remove members THEY invited
 *
 * We verify this via the `can_remove` flag returned by the members endpoint,
 * which reflects the server-side permission logic.
 */

test("student sees can_remove=true for linked parent and counselor", async ({ request }) => {
  // Uses student storageState
  const account = await getCurrentAccount(request);
  const members = await listAccountMembers(request, account.id);

  // Non-student members (parent, counselor, guardian). Student is the
  // account owner — the server grants them removal rights for all others.
  const nonStudents = members.filter(
    (m: { role: string }) => m.role !== "student"
  );
  expect(nonStudents.length).toBeGreaterThan(0);

  for (const m of nonStudents) {
    expect(
      m.can_remove,
      `student should be able to remove ${m.email} (role=${m.role})`
    ).toBe(true);
  }
});

test("student cannot remove themselves via the members endpoint", async ({ request }) => {
  const account = await getCurrentAccount(request);
  const members = await listAccountMembers(request, account.id);
  // Find the member row for the student (role=student) rather than matching
  // by studentUserId — the account payload field name varies across SDK
  // versions, but the members list reliably carries `role`.
  const self = members.find((m: { role: string }) => m.role === "student");
  expect(
    self,
    `members: ${JSON.stringify(members.map((m: { role: string; email: string }) => ({ role: m.role, email: m.email })))}`
  ).toBeDefined();
  expect(self.can_remove).toBe(false);
});
