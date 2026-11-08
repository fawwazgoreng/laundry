export interface response {
    status: number,
    message: string,
    meta?: meta,
    error?: unknown
}

export interface meta {
  firstPage : number,
  currentPage : number,
  lastPage : number,
  count : number,
}

export interface paginatedType<T> {
    data: T,
    count: number,
}

/**
 * Bentuk patch (update): setiap properti opsional DAN boleh bernilai undefined,
 * kompatibel dengan keluaran `.partial()` Zod pada exactOptionalPropertyTypes.
 */
export type patchType<T> = {
    [K in keyof T]?: T[K] | undefined
}
