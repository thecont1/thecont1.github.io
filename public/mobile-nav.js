/**
 * Mobile Navigation Menu Handler
 * Handles hamburger menu toggle, overlay interactions, and responsive behavior
 */
(function() {
  'use strict';

  let mobileMenuToggle = null;
  let mobileNav = null;
  let mobileNavClose = null;
  let mobileNavOverlay = null;
  let mobileNavContent = null;
  let lastFocusedElement = null;
  let closeButtonFocusTimer = null;

  function ensureMobileNavInBody() {
    if (!mobileNav) return;
    // If the nav is inside some transformed/filtered container, it can get trapped
    // behind content due to stacking contexts. Portaling it to <body> avoids this.
    if (mobileNav.parentElement !== document.body) {
      document.body.appendChild(mobileNav);
    }
  }

  function initMobileNav() {
    // Get DOM elements
    mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    mobileNav = document.querySelector('.mobile-nav');
    mobileNavClose = document.querySelector('.mobile-nav-close');
    mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
    mobileNavContent = document.querySelector('.mobile-nav-content');

    if (!mobileMenuToggle || !mobileNav) {
      return; // Elements not found, exit gracefully
    }

    if (mobileNav.dataset.initialized === 'true') {
      syncMenuState(false);
      return;
    }

    mobileNav.dataset.initialized = 'true';

    ensureMobileNavInBody();
    syncMenuState(false);

    // Add event listeners
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    
    if (mobileNavClose) {
      mobileNavClose.addEventListener('click', closeMobileMenu);
    }
    
    if (mobileNavOverlay) {
      mobileNavOverlay.addEventListener('click', closeMobileMenu);
    }

    // Close menu when clicking on navigation links
    const mobileNavLinks = mobileNav.querySelectorAll('a');
    mobileNavLinks.forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Handle escape key
    document.addEventListener('keydown', handleKeydown);

    // Handle viewport resize
    window.addEventListener('resize', handleResize, { passive: true });
  }

  function toggleMobileMenu() {
    const isOpen = mobileNav.getAttribute('aria-hidden') === 'false';
    
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  function openMobileMenu() {
    lastFocusedElement = document.activeElement;
    syncMenuState(true);

    if (closeButtonFocusTimer) {
      clearTimeout(closeButtonFocusTimer);
    }

    if (mobileNavClose) {
      closeButtonFocusTimer = setTimeout(() => {
        closeButtonFocusTimer = null;
        if (mobileNav.getAttribute('aria-hidden') === 'false' && !mobileNav.hasAttribute('inert')) {
          mobileNavClose.focus();
        }
      }, 100);
    }
  }

  function closeMobileMenu() {
    if (closeButtonFocusTimer) {
      clearTimeout(closeButtonFocusTimer);
      closeButtonFocusTimer = null;
    }

    syncMenuState(false);

    const focusTarget = lastFocusedElement instanceof HTMLElement ? lastFocusedElement : mobileMenuToggle;
    focusTarget?.focus();
    lastFocusedElement = null;
  }

  function handleKeydown(event) {
    const isOpen = mobileNav.getAttribute('aria-hidden') === 'false';

    if (event.key === 'Escape' && isOpen) {
      closeMobileMenu();
      return;
    }

    if (event.key === 'Tab' && isOpen) {
      trapFocus(event);
    }
  }

  function handleResize() {
    // Close mobile menu if viewport becomes desktop size
    if (window.innerWidth > 768 && mobileNav.getAttribute('aria-hidden') === 'false') {
      closeMobileMenu();
    }
  }

  function syncMenuState(isOpen) {
    mobileNav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    mobileMenuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    mobileMenuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');

    if (isOpen) {
      mobileNav.removeAttribute('inert');
    } else {
      mobileNav.setAttribute('inert', '');
    }

    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  function trapFocus(event) {
    if (!mobileNavContent) return;

    const focusableElements = mobileNavContent.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements.length) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  // Initialize on DOM content loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }

  // Re-initialize on Astro page transitions
  document.addEventListener('astro:page-load', initMobileNav);
})();