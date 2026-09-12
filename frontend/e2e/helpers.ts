import { expect, type Page } from "@playwright/test";

export const SEED_PASSWORD = "User@1234";

export function toLocalInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function uniqueHandle(prefix: string): { email: string; username: string; phone: string } {
    const stamp = Date.now().toString().slice(-9);
    return {
        email: `e2e.${prefix}.${stamp}@example.com`,
        username: `${prefix}${stamp}`,
        phone: `0812${stamp.padStart(7, "0")}`,
    };
}

export async function registerUser(page: Page, handle: { username: string; phone: string; email: string }, password: string) {
    await page.goto("/register");
    await page.getByLabel("Username").fill(handle.username);
    await page.getByLabel("Nomor Telepon").fill(handle.phone);
    await page.getByLabel("Email").fill(handle.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Register" }).click();
    await page.waitForURL("**/login");
}

export async function login(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL(/\/(dashboard|admin)$/);
}

export async function logout(page: Page) {
    await page.getByRole("button", { name: "Keluar" }).first().click();
    await page.waitForURL("**/");
}

export async function addPrimaryAddress(page: Page, addressText: string) {
    await page.goto("/profil?tab=alamat");
    await page.getByRole("button", { name: "Tambah Alamat" }).click();
    await page.getByPlaceholder("Jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota").fill(addressText);
    await page.getByPlaceholder("-6.2088").fill("-6.2088");
    await page.getByPlaceholder("106.8456").fill("106.8456");
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText(addressText)).toBeVisible();
}

export async function createOrder(
    page: Page,
    opts: { service: string; paymentLabel: string },
): Promise<string> {
    await page.goto("/layanan");

    const serviceCard = page.getByRole("heading", { name: opts.service, exact: true }).locator("xpath=..");
    await serviceCard.getByRole("button", { name: "+ Pilih Layanan" }).click();
    await page.getByRole("button", { name: "Lanjut" }).click();

    const detailSection = page.getByRole("heading", { name: "Detail & Berat Cucian" }).locator("xpath=..");
    const detailRow = detailSection
        .getByText(opts.service, { exact: true })
        .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await detailRow.locator("button").last().click();
    await detailRow.locator("button").last().click();
    await expect(detailRow.getByText("2 Kg")).toBeVisible();
    await page.getByRole("button", { name: "Lanjut" }).click();

    const pickup = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.locator('input[type="datetime-local"]').first().fill(toLocalInput(pickup));
    await expect(page.locator('input[type="datetime-local"]').nth(1)).not.toHaveValue("");
    await page.getByRole("button", { name: "Lanjut" }).click();

    await page.getByRole("radio", { name: opts.paymentLabel }).check();
    await page.getByRole("button", { name: "Buat Pesanan Sekarang" }).click();
    await page.waitForURL(/\/payment\/CLN-\d{8}-\d{3}/);

    return page.url().match(/CLN-\d{8}-\d{3}/)![0];
}