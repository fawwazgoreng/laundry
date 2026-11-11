export interface PageResult<T> {
    data: T[]
    meta?: {
        lastPage: number
    }
}

// Ambil seluruh halaman dari endpoint ber-paginasi agar filter/pencarian
// dan hitungan per kategori tetap akurat di sisi klien.
export async function fetchAllPages<T>(
    fetchPage: (page: number, perPage: number) => Promise<PageResult<T>>,
    perPage = 100,
): Promise<T[]> {
    const first = await fetchPage(1, perPage)
    const lastPage = Math.max(1, first.meta?.lastPage ?? 1)
    const all = [...first.data]
    for (let page = 2; page <= lastPage; page++) {
        const next = await fetchPage(page, perPage)
        all.push(...next.data)
    }
    return all
}

// Potong daftar untuk halaman aktif dan jaga agar nomor halaman tetap valid
// ketika filter berubah atau data berkurang setelah penghapusan.
export function pageSlice<T>(items: T[], page: number, perPage: number) {
    const totalPages = Math.max(1, Math.ceil(items.length / perPage))
    const safePage = Math.min(Math.max(1, page), totalPages)
    const start = (safePage - 1) * perPage
    return {
        items: items.slice(start, start + perPage),
        totalPages,
        safePage,
    }
}
