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

    if (!mobileMenuToggle || !mobileNav) {
      return; // Elements not found, exit gracefully
    }

    ensureMobileNavInBody();

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
    mobileNav.setAttribute('aria-hidden', 'false');
    mobileMenuToggle.setAttribute('aria-expanded', 'true');
    mobileMenuToggle.setAttribute('aria-label', 'Close navigation menu');
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = 'hidden';
    
    // Focus management - focus the close button
    if (mobileNavClose) {
      setTimeout(() => {
        mobileNavClose.focus();
      }, 100);
    }
  }

  function closeMobileMenu() {
    mobileNav.setAttribute('aria-hidden', 'true');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
    mobileMenuToggle.setAttribute('aria-label', 'Open navigation menu');
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Return focus to toggle button
    mobileMenuToggle.focus();
  }

  function handleKeydown(event) {
    // Close menu on Escape key
    if (event.key === 'Escape' && mobileNav.getAttribute('aria-hidden') === 'false') {
      closeMobileMenu();
    }
  }

  function handleResize() {
    // Close mobile menu if viewport becomes desktop size
    if (window.innerWidth > 768 && mobileNav.getAttribute('aria-hidden') === 'false') {
      closeMobileMenu();
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