export interface response {
    status: number,
    message: string,
    meta?: meta,
    error?: any 
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