import { useEffect, useMemo, useState } from "react"
import { Check, Pencil, Plus, Trash2 } from "lucide-react"
import type {
  AddonGroupInput,
  AddonOptionInput,
  Product,
  Service,
  ServiceAddonGroup,
  ServiceAddonOption,
} from "../../lib/types"
import { addonApi, productApi, serviceApi } from "../../services/api"
import { ApiError } from "../../services/apiClient"
import { useToast } from "../../components/Toast"
import { ErrorState, LoadingState } from "../../components/ui"
import DeletePopup from "../../components/deletePopUp"

type TargetType = "service"

export function AdminAddonManagementPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [groups, setGroups] = useState<ServiceAddonGroup[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [selectionType, setSelectionType] = useState<"single" | "multiple">("single")
  const [isRequired, setIsRequired] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<ServiceAddonGroup | null>(null)
  const [groupDeleting, setGroupDeleting] = useState(false)

  const [editingOptionId, setEditingOptionId] = useState<number | null>(null)
  const [optionName, setOptionName] = useState("")
  const [optionPrice, setOptionPrice] = useState("")
  const [optionMode, setOptionMode] = useState<"per_unit" | "per_order">("per_unit")
  const [optionActive, setOptionActive] = useState(true)
  const [optionSaving, setOptionSaving] = useState(false)
  const [optionDeleteTarget, setOptionDeleteTarget] = useState<ServiceAddonOption | null>(null)
  const [optionDeleting, setOptionDeleting] = useState(false)

  const [targetType, setTargetType] = useState<TargetType>("service")
  const [targetId, setTargetId] = useState(0)
  const [linkedGroupIds, setLinkedGroupIds] = useState<number[]>([])
  const [targetSaving, setTargetSaving] = useState(false)

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )

  const loadGroups = () =>
    addonApi
      .listGroups(true)
      .then((data) => {
        setGroups(data)
        setSelectedGroupId((current) => current ?? data[0]?.id ?? null)
        setLoadError(null)
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Gagal memuat add-on"))

  useEffect(() => {
    Promise.all([
      loadGroups(),
      serviceApi.list().then((data) => setServices(data)).catch(() => undefined),
      productApi.list({ perPage: 100 }).then((page) => setProducts(page.data)).catch(() => undefined),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadTargetLinks = async () => {
      if (!targetId) {
        if (!cancelled) setLinkedGroupIds([])
        return
      }
      try {
        const ids = await addonApi.targetGroups(targetType, targetId)
        if (!cancelled) setLinkedGroupIds(ids)
      } catch {
        if (!cancelled) setLinkedGroupIds([])
      }
    }
    void loadTargetLinks()
    return () => {
      cancelled = true
    }
  }, [targetType, targetId])

  const targets = targetType === "service" ? services : products

  function resetGroupForm() {
    setEditingGroupId(null)
    setCode("")
    setName("")
    setSelectionType("single")
    setIsRequired(false)
    setIsActive(true)
  }

  function editGroup(group: ServiceAddonGroup) {
    setEditingGroupId(group.id)
    setCode(group.code)
    setName(group.name)
    setSelectionType(group.selection_type)
    setIsRequired(group.is_required)
    setIsActive(group.is_active)
  }

  async function saveGroup() {
    if (!code.trim() || !name.trim()) return
    setGroupSaving(true)
    const payload: AddonGroupInput = {
      code: code.trim(),
      name: name.trim(),
      selection_type: selectionType,
      is_required: isRequired,
      is_active: isActive,
    }
    try {
      if (editingGroupId === null) {
        const created = await addonApi.createGroup(payload)
        setSelectedGroupId(created.id)
        toastSuccess("Grup add-on berhasil dibuat")
      } else {
        await addonApi.updateGroup(editingGroupId, payload)
        toastSuccess("Grup add-on berhasil diperbarui")
      }
      resetGroupForm()
      await loadGroups()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menyimpan grup add-on")
    } finally {
      setGroupSaving(false)
    }
  }

  async function confirmDeleteGroup() {
    if (!groupDeleteTarget) return
    setGroupDeleting(true)
    try {
      await addonApi.removeGroup(groupDeleteTarget.id)
      toastSuccess("Grup add-on dinonaktifkan")
      if (selectedGroupId === groupDeleteTarget.id) setSelectedGroupId(null)
      setGroupDeleteTarget(null)
      await loadGroups()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menghapus grup add-on")
    } finally {
      setGroupDeleting(false)
    }
  }

  function resetOptionForm() {
    setEditingOptionId(null)
    setOptionName("")
    setOptionPrice("")
    setOptionMode("per_unit")
    setOptionActive(true)
  }

  function editOption(option: ServiceAddonOption) {
    setEditingOptionId(option.id)
    setOptionName(option.name)
    setOptionPrice(String(option.price))
    setOptionMode(option.price_mode)
    setOptionActive(option.is_active)
  }

  async function saveOption() {
    if (!selectedGroup || !optionName.trim() || !optionPrice) return
    setOptionSaving(true)
    const payload: AddonOptionInput = {
      name: optionName.trim(),
      price: Number(optionPrice),
      price_mode: optionMode,
      is_default: false,
      is_active: optionActive,
    }
    try {
      if (editingOptionId === null) {
        await addonApi.createOption(selectedGroup.id, payload)
        toastSuccess("Pilihan add-on berhasil dibuat")
      } else {
        await addonApi.updateOption(editingOptionId, payload)
        toastSuccess("Pilihan add-on berhasil diperbarui")
      }
      resetOptionForm()
      await loadGroups()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menyimpan pilihan add-on")
    } finally {
      setOptionSaving(false)
    }
  }

  async function confirmDeleteOption() {
    if (!optionDeleteTarget) return
    setOptionDeleting(true)
    try {
      await addonApi.removeOption(optionDeleteTarget.id)
      toastSuccess("Pilihan add-on dinonaktifkan")
      if (editingOptionId === optionDeleteTarget.id) resetOptionForm()
      setOptionDeleteTarget(null)
      await loadGroups()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menghapus pilihan add-on")
    } finally {
      setOptionDeleting(false)
    }
  }

  function toggleLinkedGroup(groupId: number) {
    setLinkedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    )
  }

  async function saveTargets() {
    if (!targetId) return
    setTargetSaving(true)
    try {
      const ids = await addonApi.setTargetGroups(targetType, targetId, linkedGroupIds)
      setLinkedGroupIds(ids)
      toastSuccess("Add-on berhasil dihubungkan ke item")
      await loadGroups()
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "Gagal menyimpan target add-on")
    } finally {
      setTargetSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong">Manajemen Add-on</h1>
        <p className="text-sm text-gray-500">
          Kelola grup, varian harga, dan hubungkan add-on ke layanan laundry maupun produk toko.
        </p>
      </div>

      {loading ? (
        <LoadingState message="Memuat data add-on..." />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => { setLoading(true); loadGroups().finally(() => setLoading(false)) }} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-sm font-semibold text-ink-strong">Grup Add-on</h2>
              <button onClick={resetGroupForm} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-primary" aria-label="Tambah grup add-on">
                <Plus size={14} />
              </button>
            </div>
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => { setSelectedGroupId(group.id); resetOptionForm() }}
                className={`w-full rounded-xl border p-3 text-left ${selectedGroupId === group.id ? "border-primary bg-primary-light/40" : "border-gray-200 hover:bg-gray-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-strong">{group.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${group.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {group.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {group.code} · {group.options.length} varian · {group.selection_type === "single" ? "Pilih satu" : "Bisa banyak"}
                </p>
              </button>
            ))}
            {groups.length === 0 && <p className="px-2 py-6 text-center text-sm text-gray-400">Belum ada grup add-on.</p>}
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink-strong">
                  {editingGroupId === null ? "Tambah / Pilih Grup" : "Edit Grup"}
                </h2>
                {selectedGroup && editingGroupId === null && (
                  <div className="flex gap-2">
                    <button onClick={() => editGroup(selectedGroup)} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-primary" aria-label="Edit grup">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setGroupDeleteTarget(selectedGroup)} className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50" aria-label="Nonaktifkan grup">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Kode, contoh: WARNA" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama grup, contoh: Pilihan Pewangi" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                <select value={selectionType} onChange={(e) => setSelectionType(e.target.value as "single" | "multiple")} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="single">Pilih satu</option>
                  <option value="multiple">Bisa pilih banyak</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-5 text-sm text-ink">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} /> Wajib dipilih
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Aktif
                </label>
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={saveGroup} disabled={groupSaving || !code.trim() || !name.trim()} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                  {groupSaving ? "Menyimpan..." : editingGroupId === null ? "Simpan Grup" : "Simpan Perubahan"}
                </button>
                {editingGroupId !== null && (
                  <button onClick={resetGroupForm} className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50">
                    Batal
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-ink-strong">Varian & Harga</h2>
              {!selectedGroup ? (
                <p className="text-sm text-gray-400">Pilih grup add-on terlebih dahulu.</p>
              ) : (
                <>
                  <div className="mb-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
                    {selectedGroup.options.map((option) => (
                      <div key={option.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-strong">
                            {option.name} {!option.is_active && <span className="text-xs font-normal text-gray-400">(nonaktif)</span>}
                          </p>
                          <p className="text-xs text-gray-400">
                            {option.price.toLocaleString("id-ID")} · {option.price_mode === "per_unit" ? "per unit" : "per order"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => editOption(option)} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-primary" aria-label={`Edit ${option.name}`}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setOptionDeleteTarget(option)} className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50" aria-label={`Hapus ${option.name}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {selectedGroup.options.length === 0 && <p className="px-4 py-5 text-sm text-gray-400">Belum ada varian.</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input value={optionName} onChange={(e) => setOptionName(e.target.value)} placeholder="Nama varian" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                    <input value={optionPrice} onChange={(e) => setOptionPrice(e.target.value)} type="number" placeholder="Harga" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                    <select value={optionMode} onChange={(e) => setOptionMode(e.target.value as "per_unit" | "per_order")} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
                      <option value="per_unit">Harga per unit</option>
                      <option value="per_order">Harga per order</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" checked={optionActive} onChange={(e) => setOptionActive(e.target.checked)} /> Aktif
                    </label>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button onClick={saveOption} disabled={optionSaving || !optionName.trim() || !optionPrice} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                      {optionSaving ? "Menyimpan..." : editingOptionId === null ? "Tambah Varian" : "Simpan Varian"}
                    </button>
                    {editingOptionId !== null && (
                      <button onClick={resetOptionForm} className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50">
                        Batal
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold text-ink-strong">Hubungkan ke Layanan / Produk</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select value={targetType} onChange={(e) => { setTargetType(e.target.value as TargetType); setTargetId(0) }} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="service">Layanan Laundry</option>
                </select>
                <select value={targetId} onChange={(e) => setTargetId(Number(e.target.value))} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value={0}>Pilih item...</option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>{target.name}</option>
                  ))}
                </select>
              </div>
              {targetId > 0 && (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => toggleLinkedGroup(group.id)}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${linkedGroupIds.includes(group.id) ? "border-primary bg-primary-light/40" : "border-gray-200"}`}
                      >
                        <span>{group.name}</span>
                        {linkedGroupIds.includes(group.id) && <Check size={15} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                  <button onClick={saveTargets} disabled={targetSaving} className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                    {targetSaving ? "Menyimpan..." : "Simpan Relasi Add-on"}
                  </button>
                </>
              )}
            </section>
          </div>
        </div>
      )}

      <DeletePopup
        open={groupDeleteTarget !== null}
        dataName={groupDeleteTarget?.name}
        loading={groupDeleting}
        onCancel={() => setGroupDeleteTarget(null)}
        onConfirm={confirmDeleteGroup}
      />
      <DeletePopup
        open={optionDeleteTarget !== null}
        dataName={optionDeleteTarget?.name}
        loading={optionDeleting}
        onCancel={() => setOptionDeleteTarget(null)}
        onConfirm={confirmDeleteOption}
      />
    </div>
  )
}
