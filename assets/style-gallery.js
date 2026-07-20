import { Component } from '@theme/component';
import { debounce } from '@theme/utilities';

/**
 * Wraps the style gallery grid + Load More + picture modal for a single
 * `style` metaobject page.
 *
 * The modal's image/artist-panel elements live inside the nested
 * `<dialog-component>`, which is itself a Component and claims any `ref`
 * inside it first (closest Component wins - see assets/component.js). So
 * this component reaches across that boundary with plain `data-modal-*`
 * hooks + querySelector instead of the `ref` system.
 *
 * @extends {Component}
 */
export class StyleGalleryComponent extends Component {
  /** @type {HTMLElement[]} */
  #items = [];
  #index = 0;
  /** @type {number | null} */
  #moreStylesRaf = null;

  connectedCallback() {
    super.connectedCallback();
    this.#refreshItems();
    this.#initMoreStyles();
  }

  #refreshItems() {
    this.#items = Array.from(this.querySelectorAll('.style-gallery__thumb'));
  }

  /** @param {PointerEvent} event */
  openModal(event) {
    const thumb = /** @type {Element | null} */ (event.target)?.closest('.style-gallery__thumb');
    if (!(thumb instanceof HTMLElement)) return;

    const index = this.#items.indexOf(thumb);
    if (index === -1) return;

    this.#showItem(index);
    this.querySelector('dialog-component')?.showDialog();
  }

  next() {
    if (!this.#items.length) return;
    this.#showItem((this.#index + 1) % this.#items.length);
  }

  prev() {
    if (!this.#items.length) return;
    this.#showItem((this.#index - 1 + this.#items.length) % this.#items.length);
  }

  loadMore() {
    const template = this.querySelector('.style-gallery__templates');
    const grid = this.querySelector('.style-gallery__grid');

    if (template instanceof HTMLTemplateElement && grid) {
      grid.append(template.content.cloneNode(true));
      template.remove();
    }

    this.#refreshItems();
    this.querySelector('.style-gallery__load-more')?.setAttribute('hidden', '');
  }

  /** @param {number} index */
  #showItem(index) {
    const thumb = this.#items[index];
    if (!thumb) return;

    this.#index = index;

    const image = this.querySelector('[data-modal-image]');
    if (image instanceof HTMLImageElement) {
      if (!image.sizes) image.sizes = '(min-width: 750px) 421px, 326px';
      image.srcset = thumb.dataset.modalSrcset ?? '';
      image.src = thumb.dataset.modalSrc ?? '';
      image.alt = thumb.dataset.modalAlt ?? '';
    }

    const counter = this.querySelector('[data-modal-counter]');
    if (counter) counter.textContent = `${index + 1}/${this.#items.length}`;

    const name = this.querySelector('[data-modal-artist-name]');
    if (name) name.textContent = thumb.dataset.artistName ?? '';

    const photo = this.querySelector('[data-modal-artist-photo]');
    if (photo instanceof HTMLImageElement) photo.src = thumb.dataset.artistPhoto ?? '';

    const link = this.querySelector('[data-modal-artist-link]');
    if (link instanceof HTMLAnchorElement) {
      const url = thumb.dataset.artistUrl ?? '';
      link.href = url || '#';
      link.hidden = !url;
    }

    const tags = this.querySelector('[data-modal-artist-tags]');
    if (tags) {
      const specialties = (thumb.dataset.artistSpecialties ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      tags.replaceChildren(
        ...specialties.map((specialty) => {
          const pill = document.createElement('span');
          pill.className = 'picture-modal__tag';
          pill.textContent = specialty;
          return pill;
        })
      );
    }
  }

  moreStylesPrev() {
    const track = this.querySelector('.style-gallery__more-track');
    if (track instanceof HTMLElement) track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
  }

  moreStylesNext() {
    const track = this.querySelector('.style-gallery__more-track');
    if (track instanceof HTMLElement) track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
  }

  #initMoreStyles() {
    const track = this.querySelector('.style-gallery__more-track');
    const dotsWrap = this.querySelector('[data-more-styles-dots]');
    if (!(track instanceof HTMLElement) || !dotsWrap) return;
    if (!track.children.length) return;

    const buildDots = () => {
      const pageCount = Math.max(1, Math.round(track.scrollWidth / track.clientWidth));

      dotsWrap.replaceChildren(
        ...Array.from({ length: pageCount }, (_, pageIndex) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'style-gallery__more-dot';
          dot.setAttribute('aria-label', `Go to slide ${pageIndex + 1}`);
          dot.addEventListener('click', () => {
            track.scrollTo({ left: track.clientWidth * pageIndex, behavior: 'smooth' });
          });
          return dot;
        })
      );

      updateActiveDot();
    };

    const updateActiveDot = () => {
      const activePage = Math.round(track.scrollLeft / track.clientWidth);

      Array.from(dotsWrap.children).forEach((dot, index) => {
        dot.classList.toggle('style-gallery__more-dot--active', index === activePage);
      });
    };

    track.addEventListener('scroll', () => {
      if (this.#moreStylesRaf !== null) return;

      this.#moreStylesRaf = requestAnimationFrame(() => {
        this.#moreStylesRaf = null;
        updateActiveDot();
      });
    });

    window.addEventListener('resize', debounce(buildDots, 200));

    buildDots();
  }
}

if (!customElements.get('style-gallery-component')) {
  customElements.define('style-gallery-component', StyleGalleryComponent);
}
