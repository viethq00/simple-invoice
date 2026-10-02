import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'admin@simpleinvoice.test';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Password123!';

async function signIn(page: Page) {
  await page.getByLabel('Email address').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Invoices', level: 1 })).toBeVisible();
}

test('protects the app and rejects wrong credentials', async ({ page }) => {
  await page.goto('/invoices');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email address').fill(EMAIL);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toContainText('The email or password is incorrect');
  await expect(page).toHaveURL(/\/login$/);
});

test('signs in, creates an invoice, finds it, opens it and signs out', async ({
  page,
}, testInfo) => {
  const invoiceNumber = `E2E-${Date.now()}-${testInfo.project.name}`;

  await page.goto('/invoices');
  await signIn(page);
  await expect(page.getByText(/^Showing \d+–\d+ of \d+ invoices?$/)).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: 'New invoice' }).click();
  await expect(page.getByRole('heading', { name: 'New invoice', level: 1 })).toBeVisible();
  await page.getByLabel('Customer name').fill('Playwright Pty Ltd');
  await page.getByLabel('Email address').fill('accounts@playwright.example');
  await page.getByLabel('Invoice number').fill(invoiceNumber);
  await page.getByLabel('Item name').fill('End-to-end check');
  await page.getByLabel('Quantity').fill('3');
  // 3 x 0.10 must come to exactly 0.30, a floating-point trap.
  await page.getByLabel('Rate').fill('0.10');
  await page.getByRole('button', { name: 'Create invoice' }).click();

  await expect(page.getByText(`Invoice ${invoiceNumber} created`)).toBeVisible();
  await expect(page).toHaveURL(/\/invoices$/);

  await page.getByRole('searchbox', { name: 'Search invoices' }).fill(invoiceNumber);
  await expect(page.getByText('Showing 1–1 of 1 invoice')).toBeVisible();
  await page.getByRole('link', { name: invoiceNumber }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: `Invoice ${invoiceNumber}` }),
  ).toBeVisible();
  await expect(page.getByText('Status: Draft')).toBeAttached();
  const totals = page.getByRole('region', { name: 'Totals' });
  for (const [term, value] of [
    ['Subtotal', 'AU$0.30'],
    ['Tax (10%)', 'AU$0.03'],
    ['Total', 'AU$0.33'],
    ['Balance due', 'AU$0.33'],
  ] as const) {
    await expect(totals.getByText(term, { exact: true }).locator('xpath=..')).toContainText(value);
  }

  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.goto('/invoices');
  await expect(page).toHaveURL(/\/login$/);
});
