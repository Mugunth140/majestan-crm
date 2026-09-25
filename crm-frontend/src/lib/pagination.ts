// pagination.ts
export interface PageState {
  pageIndex: number;
  pageSize: number;
}

export function resetPageIndex<T extends PageState>(pagination: T): T {
  return { ...pagination, pageIndex: 0 };
}
