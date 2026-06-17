import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@shared/constants';
import type { PaginationMeta, PaginationQuery } from '@shared/types/pagination.types';

export function buildPaginationMeta(total: number, query: PaginationQuery): PaginationMeta {
  const totalPages = Math.ceil(total / query.limit);
  return {
    total,
    page: query.page,
    limit: query.limit,
    totalPages,
    hasNextPage: query.page < totalPages,
    hasPreviousPage: query.page > 1,
  };
}

export function normalizePaginationQuery(raw: Partial<PaginationQuery>): PaginationQuery {
  const page = Math.max(1, raw.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, raw.limit ?? DEFAULT_PAGE_SIZE));
  return {
    page,
    limit,
    sortBy: raw.sortBy,
    sortOrder: raw.sortOrder ?? 'desc',
  };
}

export function toPrismaSkipTake(query: PaginationQuery): { skip: number; take: number } {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  };
}
