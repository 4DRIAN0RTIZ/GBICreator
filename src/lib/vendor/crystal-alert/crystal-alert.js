/**
 * CrystalAlert - Lightweight alert & toast library
 * @version 1.0.0
 */
class CrystalAlert {
  constructor() {
    this.overlay = null;
    this.modal = null;
    this.toastContainer = null;
    this.activeElement = null;
    this.currentTheme = 'default';
    this.themeStylesheet = null;
    this.themePath = 'themes/';
    this.toastPosition = null;
  }

  // Builds the DOM lazily on the first fire()/toast(). Doing it in the
  // constructor breaks when the script loads in <head>, where document.body
  // is still null at import time.
  ensureDom() {
    if (this.overlay && this.toastContainer) return;

    this.overlay = document.querySelector('.ca-overlay');
    if (this.overlay) {
      this.modal = this.overlay.querySelector('.ca-modal');
    } else {
      this.overlay = document.createElement('div');
      this.overlay.className = 'ca-overlay';

      this.modal = document.createElement('div');
      this.modal.className = 'ca-modal';
      this.modal.setAttribute('role', 'dialog');
      this.modal.setAttribute('aria-modal', 'true');

      this.overlay.appendChild(this.modal);
      document.body.appendChild(this.overlay);

      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close(null);
        }
      });
    }

    this.toastContainer = document.querySelector('.ca-toast-container');
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = 'ca-toast-container';
      document.body.appendChild(this.toastContainer);
    }
  }

  /**
   * Configure the path where theme CSS files are located
   * @param {string} path - Path to themes directory (with trailing slash)
   */
  setThemePath(path) {
    this.themePath = path.endsWith('/') ? path : path + '/';
  }

  /**
   * Set the active theme by loading its CSS file
   * @param {string} name - Theme name (default, dark, minimal, or custom)
   * @returns {Promise} Resolves when theme is loaded
   */
  setTheme(name) {
    return new Promise((resolve, reject) => {
      // Remove any existing theme stylesheet, including one from a previous
      // setTheme() call whose onload has not fired yet (avoids duplicate
      // <link id="ca-theme-stylesheet"> on rapid successive calls).
      if (this.themeStylesheet) this.themeStylesheet.remove();
      const stale = document.getElementById('ca-theme-stylesheet');
      if (stale) stale.remove();
      this.themeStylesheet = null;

      // Default theme uses base styles, no additional CSS needed
      if (name === 'default' || name === 'light') {
        this.currentTheme = 'default';
        resolve();
        return;
      }

      // Load theme CSS file
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${this.themePath}crystal-alert-${name}.css`;
      link.id = 'ca-theme-stylesheet';
      this.themeStylesheet = link;

      link.onload = () => {
        this.currentTheme = name;
        resolve();
      };

      link.onerror = () => {
        console.warn(`CrystalAlert: Theme "${name}" not found at ${link.href}`);
        reject(new Error(`Theme "${name}" not found`));
      };

      document.head.appendChild(link);
    });
  }

  /**
   * Get the current theme name
   * @returns {string} Current theme name
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Main Alert Method
   * @param {object} options
   * @param {string} options.title - Alert title
   * @param {string} [options.text] - Plain text content
   * @param {string} [options.html] - HTML content (overrides text)
   * @param {string} [options.icon] - Built-in icon: success, error, warning, info
   * @param {string} [options.iconHtml] - Custom icon HTML (overrides icon)
   * @param {string} [options.confirmButtonText] - Confirm button label
   * @param {boolean} [options.showCancelButton] - Show cancel button
   * @param {string} [options.cancelButtonText] - Cancel button label
   * @param {boolean} [options.showCloseButton] - Show X close button
   * @param {function} [options.preConfirm] - Async function before confirm
   * @param {function} [options.onOpen] - Callback when modal opens
   * @param {function} [options.onClose] - Callback when modal closes
   */
  fire({
    title = 'Alert',
    text = '',
    html = '',
    icon = '',
    iconHtml = '',
    confirmButtonText = 'OK',
    showCancelButton = false,
    cancelButtonText = 'Cancel',
    showCloseButton = false,
    preConfirm = null,
    onOpen = null,
    onClose = null
  } = {}) {
    return new Promise((resolve) => {
      this.ensureDom();
      this.activeElement = document.activeElement;
      this.resolvePromise = resolve;
      this.onCloseCallback = onClose;

      // Icon: custom HTML takes priority
      let iconMarkup = '';
      if (iconHtml) {
        iconMarkup = `<div class="ca-icon custom">${iconHtml}</div>`;
      } else if (icon) {
        iconMarkup = `<div class="ca-icon ${icon}">${this.getIconSVG(icon)}</div>`;
      }

      // Content: html takes priority over text; text goes in via textContent (see below)
      const content = html || (text ? '<p class="ca-text"></p>' : '');

      // Close button
      const closeBtn = showCloseButton
        ? `<button class="ca-close" aria-label="Close">&times;</button>`
        : '';

      // Action buttons
      let buttonsHtml = `
        <button class="ca-btn ca-btn-confirm">
          <span class="ca-btn-text">${confirmButtonText}</span>
          <div class="ca-spinner"></div>
        </button>
      `;

      if (showCancelButton) {
        buttonsHtml = `
          <button class="ca-btn ca-btn-cancel">${cancelButtonText}</button>
          ${buttonsHtml}
        `;
      }

      this.modal.innerHTML = `
        ${closeBtn}
        ${iconMarkup}
        <h2 class="ca-title"></h2>
        ${content}
        <div class="ca-actions">
          ${buttonsHtml}
        </div>
      `;

      this.modal.querySelector('.ca-title').textContent = title;

      if (!html && text) {
        const textEl = this.modal.querySelector('.ca-text');
        if (textEl) textEl.textContent = text;
      }

      const confirmBtn = this.modal.querySelector('.ca-btn-confirm');
      const cancelBtn = this.modal.querySelector('.ca-btn-cancel');
      const closeBtnEl = this.modal.querySelector('.ca-close');

      // Confirm handler with async support
      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          if (preConfirm && typeof preConfirm === 'function') {
            confirmBtn.classList.add('ca-loading');
            confirmBtn.disabled = true;
            if (cancelBtn) cancelBtn.disabled = true;

            try {
              const result = await preConfirm();
              this.close(result !== undefined ? result : true);
            } catch (error) {
              confirmBtn.classList.remove('ca-loading');
              confirmBtn.disabled = false;
              if (cancelBtn) cancelBtn.disabled = false;
              console.error('CrystalAlert preConfirm error:', error);
            }
          } else {
            this.close(true);
          }
        };
        confirmBtn.focus();
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => this.close(false);
      }

      if (closeBtnEl) {
        closeBtnEl.onclick = () => this.close(null);
      }

      // Keyboard: Escape to close
      this._escHandler = (e) => {
        if (e.key === 'Escape') this.close(null);
      };
      document.addEventListener('keydown', this._escHandler);

      this.overlay.classList.add('ca-show');

      if (onOpen && typeof onOpen === 'function') {
        onOpen(this.modal);
      }
    });
  }

  close(result) {
    document.removeEventListener('keydown', this._escHandler);
    if (this.overlay) this.overlay.classList.remove('ca-show');

    // Must match the .ca-modal exit transition (transform 0.4s) in
    // crystal-alert-styles.css so focus/promise settle after it finishes.
    setTimeout(() => {
      if (this.onCloseCallback && typeof this.onCloseCallback === 'function') {
        this.onCloseCallback(result);
      }
      if (this.resolvePromise) {
        this.resolvePromise(result);
        this.resolvePromise = null;
      }
      if (this.activeElement) {
        this.activeElement.focus();
        this.activeElement = null;
      }
    }, 400);
  }

  /**
   * Toast Notification
   * @param {object} options
   * @param {string} options.title - Toast title
   * @param {string} [options.text] - Toast text
   * @param {string} [options.html] - HTML content (overrides text)
   * @param {string} [options.icon] - Built-in icon
   * @param {string} [options.iconHtml] - Custom icon HTML
   * @param {number} [options.duration] - Auto-dismiss in ms (0 = persistent)
   * @param {string} [options.position] - Position: top-right, top-left, bottom-right, bottom-left
   */
  toast({
    title = '',
    text = '',
    html = '',
    icon = 'info',
    iconHtml = '',
    duration = 3000,
    position = 'top-right'
  } = {}) {
    this.ensureDom();

    // Only touch the container class when the position actually changes,
    // otherwise every call reflows the container and visible toasts jump.
    if (this.toastPosition !== position) {
      this.toastContainer.className = `ca-toast-container ca-${position}`;
      this.toastPosition = position;
    }

    const toastEl = document.createElement('div');
    toastEl.className = 'ca-toast';

    const iconColors = {
      success: '#059669',
      error: '#dc2626',
      warning: '#d97706',
      info: '#2563eb'
    };
    const iconColor = iconColors[icon] || '#333';

    // Icon markup
    const iconMarkup = iconHtml
      ? `<div class="ca-toast-icon">${iconHtml}</div>`
      : `<div class="ca-toast-icon" style="color: ${iconColor}">${this.getIconSVG(icon)}</div>`;

    // Content: html takes priority over text; text goes in via textContent (see below)
    const content = html || (text ? '<p class="ca-toast-text"></p>' : '');

    // Progress bar only if duration > 0
    const progressBar = duration > 0
      ? `<div class="ca-progress-bar" style="transition: width ${duration}ms linear; width: 100%;"></div>`
      : '';

    toastEl.innerHTML = `
      ${iconMarkup}
      <div class="ca-toast-content">
        <h3 class="ca-toast-title"></h3>
        ${content}
      </div>
      ${progressBar}
    `;

    toastEl.querySelector('.ca-toast-title').textContent = title;

    if (!html && text) {
      const textEl = toastEl.querySelector('.ca-toast-text');
      if (textEl) textEl.textContent = text;
    }

    this.toastContainer.appendChild(toastEl);

    // Animate progress bar
    if (duration > 0) {
      requestAnimationFrame(() => {
        const bar = toastEl.querySelector('.ca-progress-bar');
        if (bar) bar.style.width = '0%';
      });
    }

    let timeout;
    const removeToast = () => {
      toastEl.classList.add('hide');
      toastEl.addEventListener('transitionend', () => {
        if (toastEl.parentElement) toastEl.remove();
      });
    };

    if (duration > 0) {
      timeout = setTimeout(removeToast, duration);
    }

    toastEl.addEventListener('click', () => {
      if (timeout) clearTimeout(timeout);
      removeToast();
    });

    return toastEl;
  }

  getIconSVG(type) {
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };
    return icons[type] || '';
  }
}

const Crystal = new CrystalAlert();

// ── GBICreator: añadido al vendorizar ─────────────────────────────────────
// El archivo upstream no exporta nada; importado como ES module, `Crystal`
// quedaría encerrado en el scope del módulo. Ver README.md de esta carpeta.
export default Crystal;
