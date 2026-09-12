import { expect, test } from "@playwright/test";
import { addPrimaryAddress, createOrder, login, logout, registerUser, uniqueHandle } from "./helpers";

const ADMIN = { email: "admin@fadarosi.id", password: "Admin@1234" };

test("admin drives a COD order through the full status lifecycle", async ({ page }) => {
    const customer = uniqueHandle("cso");
    await registerUser(page, customer, "User@1234");
    await login(page, customer.email, "User@1234");

    await addPrimaryAddress(page, "Jl. Kenanga No. 12, Bandung");
    const orderId = await createOrder(page, { service: "Cuci Kering", paymentLabel: "Bayar di Tempat (COD)" });

    await expect(page.getByText(/Bayar di Tempat/)).toBeVisible();
    await expect(page.getByText(orderId)).toBeVisible();

    await logout(page);

    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/pesanan");
    await page.getByPlaceholder("Cari no. pesanan / nama pelanggan").fill(orderId);
    await expect(page.getByText(orderId)).toBeVisible();
    await page.locator(`a[href="/admin/pesanan/${orderId}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/pesanan/${orderId}$`));
    await expect(page.getByText(orderId)).toBeVisible();

    const transitions = [
        { click: "Diterima", expect: "Diterima" },
        { click: "Diproses", expect: "Diproses" },
        { click: "Siap Antar", expect: "Siap Antar" },
        { click: "Selesai", expect: "Selesai" },
    ];

    for (const step of transitions) {
        await page.getByRole("button", { name: "Ubah Status" }).click();
        await page.getByRole("button", { name: step.click, exact: true }).click();
        await page.getByRole("button", { name: "Simpan" }).click();
        await expect(page.getByText(step.expect)).toBeVisible();
    }

    await expect(page.getByRole("button", { name: "Ubah Status" })).toBeDisabled();
});