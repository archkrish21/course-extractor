import { NextResponse } from "next/server";

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
