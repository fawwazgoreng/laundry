import { Lock } from "lucide-react"
import { FloatingInput } from "../../../components/FloatingInput"
import { formatDateLong } from "../../../lib/utils"
import type { User } from "../../../lib/types"

interface ProfileSectionProps {
  user: User | null
}

// Susun daftar pengaturan akun yang ditampilkan pada form profil
const buildUserSettings = (user: User | null) => [
  { label: "Username", value: user?.username },
  { label: "Email", value: user?.email },
  { label: "Nomor Hp", value: user?.phone },
  { label: "Bergabung Pada", value: user?.created_at },
]

// Buat URL avatar default (huruf depan nama) sesuai warna brand
const buildAvatarUrl = (username: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=dc2626&color=fff&size=128`

// Bagian profil pengguna: kartu avatar + form pengaturan akun
export const ProfileSection = ({ user }: ProfileSectionProps) => {
  const avatarUrl = user?.username ? buildAvatarUrl(user.username) : undefined
  const userSetting = buildUserSettings(user)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" id="profil">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        {user && (
          <>
            <div className="mt-5 flex flex-col items-center gap-4">
              <img
                src={avatarUrl}
                alt={user.username}
                className="h-30 w-30 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold text-[18px] text-center text-ink-strong">{user.username}</p>
                <p className="text-[14px] text-center text-gray-400">{user.email}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 font-semibold">
              <div className="self-center col-span-1 mx-auto">
                <p className="text-xs text-gray-400">Bergabung sejak</p>
                <p className="text-sm font-medium text-ink-strong">{user.created_at ? formatDateLong(user.created_at) : "-"}</p>
              </div>
              <div className="self-center col-span-1 mx-auto">
                <p className="text-xs text-gray-400">Nomor Hp</p>
                <p className="text-sm font-medium text-ink-strong">{user.phone}</p>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        {user && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {userSetting.map((setting, idx) => (
              <FloatingInput key={idx} label={setting.label} value={setting.value} />
            ))}
          </div>
        )}
        <div className="mt-5 flex gap-3 items-end justify-end">
          <button className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark">
            Simpan
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-ink hover:bg-gray-50">
            <Lock size={13} /> Ubah Sandi
          </button>
        </div>
      </div>
    </div>
  )
}