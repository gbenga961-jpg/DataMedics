import { describe, it, expect } from "vitest";
import {
  assertAuthenticated,
  assertOwnership,
  verifyHierarchyOwnership,
  UnauthorizedError,
  NotFoundOrForbiddenError,
  AuthContext,
} from "@/lib/auth";

describe("Authorization and Ownership Boundaries (PRD §18, SECURITY.md)", () => {
  it("allows authenticated user context through", () => {
    const validContext: AuthContext = {
      isAuthenticated: true,
      user: {
        id: "usr-123",
        email: "user@example.com",
      },
    };

    expect(() => assertAuthenticated(validContext)).not.toThrow();
  });

  it("throws UnauthorizedError (401) when user is unauthenticated", () => {
    const unauthContext: AuthContext = {
      isAuthenticated: false,
      user: null,
    };

    expect(() => assertAuthenticated(unauthContext)).toThrow(UnauthorizedError);
  });

  it("permits access when resource owner matches authenticated user", () => {
    expect(() => assertOwnership("usr-123", "usr-123")).not.toThrow();
  });

  it("throws NotFoundOrForbiddenError (404) on ownership mismatch to prevent enumeration", () => {
    try {
      assertOwnership("usr-attacker", "usr-victim");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundOrForbiddenError);
      expect((err as NotFoundOrForbiddenError).statusCode).toBe(404);
      expect((err as NotFoundOrForbiddenError).message).toBe("Resource not found.");
    }
  });

  it("validates entire ownership hierarchy across upload, report, and cleaning runs", () => {
    const currentUserId = "usr-100";

    // Valid hierarchy matching current user
    const valid = verifyHierarchyOwnership({
      currentUserId,
      uploadUserId: currentUserId,
      reportUploadUserId: currentUserId,
      cleaningRunUserId: currentUserId,
    });
    expect(valid).toBe(true);

    // Mismatched upload owner
    const invalidUpload = verifyHierarchyOwnership({
      currentUserId,
      uploadUserId: "other-user",
      reportUploadUserId: currentUserId,
    });
    expect(invalidUpload).toBe(false);

    // Mismatched cleaning run owner
    const invalidCleaning = verifyHierarchyOwnership({
      currentUserId,
      uploadUserId: currentUserId,
      cleaningRunUserId: "other-user",
    });
    expect(invalidCleaning).toBe(false);
  });
});
