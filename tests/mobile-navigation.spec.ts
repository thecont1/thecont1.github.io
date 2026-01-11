import { test, expect, Page } from '@playwright/test';

/**
 * Property-Based Tests for Mobile Navigation System
 * Feature: mobile-responsiveness
 */

// Helper function to set viewport and wait for resize
async function setViewportAndWait(page: Page, width: number, height: number = 800): Promise<void> {
  await page.setViewportSize({ width, height });
  // Wait for resize event to be processed
  await page.waitForTimeout(200);
}

// Helper function to check if element is visible
async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }, selector);
}

test.describe('Mobile Navigation System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    
    // Wait for the page to load completely
    await page.waitForSelector('.site-header', { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  /**
   * Property 10: Mobile Navigation Display Toggle
   * Feature: mobile-responsiveness, Property 10: Mobile Navigation Display Toggle
   * Validates: Requirements 4.1
   */
  test('Property 10: Mobile Navigation Display Toggle', async ({ page }) => {
    // Test various mobile viewport widths (≤768px)
    const mobileViewports = [320, 375, 414, 480, 600, 768];
    
    for (const width of mobileViewports) {
      await setViewportAndWait(page, width);
      
      // Check that hamburger menu is visible
      const hamburgerVisible = await isElementVisible(page, '.mobile-menu-toggle');
      expect(hamburgerVisible).toBe(true);
      
      // Check that desktop navigation is hidden
      const desktopNavVisible = await isElementVisible(page, '.desktop-nav');
      expect(desktopNavVisible).toBe(false);
      
      console.log(`Viewport ${width}px: Hamburger menu visible, desktop nav hidden`);
    }
  });

  /**
   * Property 11: Desktop Navigation Display Toggle
   * Feature: mobile-responsiveness, Property 11: Desktop Navigation Display Toggle
   * Validates: Requirements 4.5
   */
  test('Property 11: Desktop Navigation Display Toggle', async ({ page }) => {
    // Test various desktop viewport widths (>768px)
    const desktopViewports = [769, 800, 1024, 1200, 1440, 1920];
    
    for (const width of desktopViewports) {
      await setViewportAndWait(page, width);
      
      // Check that desktop navigation is visible
      const desktopNavVisible = await isElementVisible(page, '.desktop-nav');
      expect(desktopNavVisible).toBe(true);
      
      // Check that hamburger menu is hidden
      const hamburgerVisible = await isElementVisible(page, '.mobile-menu-toggle');
      expect(hamburgerVisible).toBe(false);
      
      console.log(`Viewport ${width}px: Desktop nav visible, hamburger menu hidden`);
    }
  });

  /**
   * Property 12: Mobile Menu Functionality
   * Feature: mobile-responsiveness, Property 12: Mobile Menu Functionality
   * Validates: Requirements 4.2, 4.3
   */
  test('Property 12: Mobile Menu Functionality', async ({ page }) => {
    // Test on mobile viewport
    await setViewportAndWait(page, 375);
    
    // Verify hamburger menu is visible
    const hamburgerVisible = await isElementVisible(page, '.mobile-menu-toggle');
    expect(hamburgerVisible).toBe(true);
    
    // Click hamburger menu to open
    await page.click('.mobile-menu-toggle');
    
    // Wait for menu animation
    await page.waitForTimeout(400);
    
    // Check that mobile menu is now visible
    const mobileMenuOpen = await page.evaluate(() => {
      const mobileNav = document.querySelector('.mobile-nav');
      return mobileNav && mobileNav.getAttribute('aria-hidden') === 'false';
    });
    expect(mobileMenuOpen).toBe(true);
    
    // Check that all navigation items are present and visible
    const expectedNavItems = ['Home', 'The Projects', 'About Me', 'Contact'];
    
    for (const itemText of expectedNavItems) {
      const navItem = await page.locator('.mobile-nav a').filter({ hasText: itemText });
      await expect(navItem).toBeVisible();
    }
    
    // Check that hamburger button shows expanded state
    const hamburgerExpanded = await page.getAttribute('.mobile-menu-toggle', 'aria-expanded');
    expect(hamburgerExpanded).toBe('true');
    
    console.log('Mobile menu opens correctly and shows all navigation items');
  });

  /**
   * Property 13: Mobile Menu Dismissal
   * Feature: mobile-responsiveness, Property 13: Mobile Menu Dismissal
   * Validates: Requirements 4.4
   */
  test('Property 13: Mobile Menu Dismissal', async ({ page }) => {
    // Test on mobile viewport
    await setViewportAndWait(page, 375);
    
    // Open mobile menu first
    await page.click('.mobile-menu-toggle');
    await page.waitForTimeout(400);
    
    // Verify menu is open
    let mobileMenuOpen = await page.evaluate(() => {
      const mobileNav = document.querySelector('.mobile-nav');
      return mobileNav && mobileNav.getAttribute('aria-hidden') === 'false';
    });
    expect(mobileMenuOpen).toBe(true);
    
    // Test 1: Close by clicking the close button
    await page.click('.mobile-nav-close');
    await page.waitForTimeout(400);
    
    mobileMenuOpen = await page.evaluate(() => {
      const mobileNav = document.querySelector('.mobile-nav');
      return mobileNav && mobileNav.getAttribute('aria-hidden') === 'false';
    });
    expect(mobileMenuOpen).toBe(false);
    console.log('Mobile menu closes correctly when close button is clicked');
    
    // Test 2: Close by clicking outside (overlay)
    await page.click('.mobile-menu-toggle');
    await page.waitForTimeout(400);
    
    // Trigger the overlay click event directly since the overlay might be covered
    await page.evaluate(() => {
      const overlay = document.querySelector('.mobile-nav-overlay');
      if (overlay) {
        overlay.click();
      }
    });
    await page.waitForTimeout(400);
    
    mobileMenuOpen = await page.evaluate(() => {
      const mobileNav = document.querySelector('.mobile-nav');
      return mobileNav && mobileNav.getAttribute('aria-hidden') === 'false';
    });
    expect(mobileMenuOpen).toBe(false);
    console.log('Mobile menu closes correctly when overlay is clicked');
    
    // Test 3: Close by pressing Escape key
    await page.click('.mobile-menu-toggle');
    await page.waitForTimeout(400);
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    
    mobileMenuOpen = await page.evaluate(() => {
      const mobileNav = document.querySelector('.mobile-nav');
      return mobileNav && mobileNav.getAttribute('aria-hidden') === 'false';
    });
    expect(mobileMenuOpen).toBe(false);
    console.log('Mobile menu closes correctly when Escape key is pressed');
    
    // Test 4: Close when clicking on navigation link
    await page.click('.mobile-menu-toggle');
    await page.waitForTimeout(400);
    
    // Click on a navigation link
    await page.click('.mobile-nav a[href="/#about"]');
    await page.waitForTimeout(400);
    
    mobileMenuOpen = await page.evaluate(() => {
      const mobileNav = document.querySelector('.mobile-nav');
      return mobileNav && mobileNav.getAttribute('aria-hidden') === 'false';
    });
    expect(mobileMenuOpen).toBe(false);
    console.log('Mobile menu closes correctly when navigation link is clicked');
  });

  /**
   * Additional test: Menu closes when viewport becomes desktop size
   */
  test('Mobile menu closes on viewport resize to desktop', async ({ page }) => {
    // Start with mobile viewport
    await setViewportAndWait(page, 375);
    
    // Open mobile menu
    await page.click('.mobile-menu-toggle');
    await page.waitForTimeout(400);
    
    // Verify menu is open
    let mobileMenuOpen = await page.evaluate(() => {
      const mobileNav = document.querySelector('.mobile-nav');
      return mobileNav && mobileNav.getAttribute('aria-hidden') === 'false';
    });
    expect(mobileMenuOpen).toBe(true);
    
    // Resize to desktop viewport
    await setViewportAndWait(page, 1024);
    
    // Menu should automatically close
    mobileMenuOpen = await page.evaluate(() => {
      const mobileNav = document.querySelector('.mobile-nav');
      return mobileNav && mobileNav.getAttribute('aria-hidden') === 'false';
    });
    expect(mobileMenuOpen).toBe(false);
    
    console.log('Mobile menu closes correctly when viewport resizes to desktop');
  });
});