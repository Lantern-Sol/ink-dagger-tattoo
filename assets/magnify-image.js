import { isDesktopBreakpoint, mediaQueryLarge } from '@theme/utilities';

const ZOOM_SCALE = 2.5;

/**
 * Desktop hover magnifier. Deliberately NOT a `Component` subclass: it can be
 * nested inside `<drag-zoom-wrapper>` (which IS a Component and owns
 * `ref="image"` on the shared `<img>`) without competing for that ref — see
 * the Component ref-ownership model in assets/component.js, where the
 * closest actual Component instance claims a `ref`, regardless of what
 * plain custom elements sit in between.
 */
export class MagnifyImage extends HTMLElement {
  /** @type {HTMLImageElement | null} */
  #image = null;
  /** @type {number | null} */
  #rafId = null;

  connectedCallback() {
    const image = this.querySelector('img');
    this.#image = image instanceof HTMLImageElement ? image : null;

    mediaQueryLarge.addEventListener('change', this.#handleBreakpointChange);
    this.#updateListener();
  }

  disconnectedCallback() {
    mediaQueryLarge.removeEventListener('change', this.#handleBreakpointChange);
    this.#detach();
  }

  #handleBreakpointChange = () => this.#updateListener();

  #updateListener() {
    if (isDesktopBreakpoint()) {
      this.addEventListener('mousemove', this.#handleMouseMove);
      this.addEventListener('mouseleave', this.#reset);
    } else {
      this.#detach();
    }
  }

  #detach() {
    this.removeEventListener('mousemove', this.#handleMouseMove);
    this.removeEventListener('mouseleave', this.#reset);
    this.#reset();
  }

  /** @param {MouseEvent} event */
  #handleMouseMove = (event) => {
    if (this.#rafId !== null) return;

    this.#rafId = requestAnimationFrame(() => {
      this.#rafId = null;

      const rect = this.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      this.style.setProperty('--zoom-x', `${clamp(x)}%`);
      this.style.setProperty('--zoom-y', `${clamp(y)}%`);
      this.style.setProperty('--zoom-scale', `${ZOOM_SCALE}`);
    });
  };

  #reset = () => {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    this.style.removeProperty('--zoom-x');
    this.style.removeProperty('--zoom-y');
    this.style.removeProperty('--zoom-scale');
  };
}

/**
 * @param {number} value
 * @returns {number}
 */
function clamp(value) {
  return Math.min(100, Math.max(0, value));
}

if (!customElements.get('magnify-image')) {
  customElements.define('magnify-image', MagnifyImage);
}
