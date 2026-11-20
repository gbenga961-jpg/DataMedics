/**
 * Authentication & Authorization Boundaries (PRD §15.13, §18 and Docs/.agent/rules/.security.md)
 * Gated by OD-01 (Authentication approach).
 */

import { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./session";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthContext {
  user: SessionUser | null;
  isAuthenticated: boolean;
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;
  constructor(message: string = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundOrForbiddenError extends Error {
  public readonly statusCode = 404;
  constructor(message: string = "Resource not found.") {
    // Standard 404 to prevent resource existence enumeration (SECURITY.md)
    super(message);
    this.name = "NotFoundOrForbiddenError";
  }
}

/**
 * Extracts the authenticated user from the request session cookie.
 */
export function getAuthenticatedUser(req: NextRequest): SessionUser | null {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie || !cookie.value) {
    return null;
  }
  return verifySessionToken(cookie.value);
}

/**
 * Ensures the request is authenticated.
 */
export function assertAuthenticated(context: AuthContext): asserts context is { user: SessionUser; isAuthenticated: true } {
  if (!context.isAuthenticated || !context.user || !context.user.id) {
    throw new UnauthorizedError();
  }
}

/**
 * Enforces ownership of a private resource.
 * Throws a 404 error if ownership does not match, preventing enumeration.
 */
export function assertOwnership(resourceUserId: string, authenticatedUserId: string): void {
  if (!resourceUserId || !authenticatedUserId || resourceUserId !== authenticatedUserId) {
    throw new NotFoundOrForbiddenError();
  }
}

/**
 * Validates cascading ownership across upload, report, cleaning-run, and cleaned-file hierarchies.
 */
export function verifyHierarchyOwnership(params: {
  currentUserId: string;
  uploadUserId: string;
  reportUploadUserId?: string;
  cleaningRunUserId?: string;
}): boolean {
  const { currentUserId, uploadUserId, reportUploadUserId, cleaningRunUserId } = params;

  if (uploadUserId !== currentUserId) {
    return false;
  }
  if (reportUploadUserId !== undefined && reportUploadUserId !== currentUserId) {
    return false;
  }
  if (cleaningRunUserId !== undefined && cleaningRunUserId !== currentUserId) {
    return false;
  }
  return true;
}

export * from "./password";
export * from "./session";
