import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('shows landing page for unauthenticated users', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Filbert/)
  })

  test('has login and signup links', async ({ page }) => {
    await page.goto('/')
    const loginLink = page.getByRole('link', { name: /zaloguj|log in/i })
    await expect(loginLink).toBeVisible()
  })
})

test.describe('Auth pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('signup page loads', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading')).toBeVisible()
  })
})
