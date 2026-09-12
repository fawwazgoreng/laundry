import { expect, test } from "@playwright/test";
import { addPrimaryAddress, createOrder, login, registerUser, uniqueHandle } from "./helpers";

test("customer registers, orders laundry via FADAROSI Pay and sees it in history", async ({ page }) => {
    const me = uniqueHandle("cst");
    await registerUser(page, me, "User@1234");

    await login(page, me.email, "User@1234");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("link", { name: "Fadarosi" })).toBeVisible();

    await addPrimaryAddress(page, "Jl. Mawar No. 7, Jakarta");

    const orderId = await createOrder(page, { service: "Cuci Setrika", paymentLabel: "FADAROSI Pay / E-Wallet" });

    await expect(page.getByText(/Pembayaran Diterima/)).toBeVisible();
    await expect(page.getByText(orderId)).toBeVisible();

    await page.goto(`/riwayat/${orderId}`);
    await expect(page).toHaveURL(new RegExp(`/riwayat/${orderId}$`));
    await expect(page.getByText(orderId).first()).toBeVisible();
    await expect(page.getByText("Baru").first()).toBeVisible();
});