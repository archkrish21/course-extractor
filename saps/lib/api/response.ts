import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

interface SuccessMeta {
  has_more?: boolean;
  next_cursor?: string;
  total?: number;
  [key: string]: unknown;
}

export function successResponse<T>(data: T, meta?: SuccessMeta, status = 200) {
  const body: { data: T; meta?: SuccessMeta } = { data };
  if (meta) {
    body.meta = meta;
  }
  return NextResponse.json(body, { status });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...extra,
      },
    },
    { status }
  );
}

/**
 * Log an unexpected error to Sentry and return a 500 response.
 * Use in catch blocks for unexpected/internal errors.
 */
export function serverError(error: unknown, context?: string) {
  Sentry.captureException(error, { tags: { context } });
  return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
}

export function paginatedResponse<T>(
  data: T[],
  hasMore: boolean,
  nextCursor: string | null,
  total?: number
) {
  const meta: SuccessMeta = {
    has_more: hasMore,
  };
  if (nextCursor) {
    meta.next_cursor = nextCursor;
  }
  if (total !== undefined) {
    meta.total = total;
  }
  return successResponse(data, meta);
}
