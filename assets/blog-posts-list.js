import PaginatedList from '@theme/paginated-list';
import { sectionRenderer } from '@theme/section-renderer';

/**
 * A custom element that renders a paginated blog posts list.
 *
 * Adds soft-reload (section-renderer) behaviour for the category tabs strip
 * so clicking a tag tab swaps the article grid in place instead of doing a
 * full page navigation.
 */
export default class BlogPostsList extends PaginatedList {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.#handleTabClick);
    this.addEventListener('click', this.#handleLoadMoreClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.#handleTabClick);
    this.removeEventListener('click', this.#handleLoadMoreClick);
  }

  /**
   * Intercepts clicks on the category tabs and re-renders the section in place.
   * @param {MouseEvent} event
   */
  #handleTabClick = (event) => {
    // Only intercept primary, unmodified clicks on a tab link.
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = /** @type {HTMLElement} */ (event.target);
    const link = /** @type {HTMLAnchorElement | null} */ (target.closest('.blog-category-tabs__link'));
    if (!link || !this.contains(link)) return;
    if (link.classList.contains('is-active')) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    this.#navigateToTab(link.href);
  };

  /**
   * @param {string} href - The destination URL (e.g. /blogs/news/tagged/lifestyle)
   */
  async #navigateToTab(href) {
    const url = new URL(href, window.location.origin);

    // Drop ?page=… so we always land on page 1 of the filtered set.
    url.searchParams.delete('page');

    // Reflect the new URL right away for accessibility (hash change, back button).
    history.pushState({}, '', url.toString());

    this.dataset.loading = 'true';

    try {
      await sectionRenderer.renderSection(this.sectionId, { url, cache: false });
      // Clear cached pages from the parent PaginatedList so further "view more"
      // requests fetch from the new filtered URL.
      this.pages?.clear?.();
    } finally {
      delete this.dataset.loading;
    }
  }

  /**
   * Handles clicks on the "Load more stories" button: fetches the next page
   * and appends its cards to the grid in place, rather than swapping the
   * whole section (numbered pagination) or auto-loading on scroll.
   * @param {MouseEvent} event
   */
  #handleLoadMoreClick = async (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = /** @type {HTMLElement} */ (event.target);
    const button = /** @type {HTMLAnchorElement | null} */ (target.closest('[data-load-more-button]'));
    if (!button || !this.contains(button)) return;

    event.preventDefault();

    const { grid } = this.refs;
    const nextUrl = button.dataset.nextUrl;
    if (!grid || !nextUrl || button.getAttribute('aria-busy') === 'true') return;

    const url = new URL(nextUrl, window.location.origin);
    button.setAttribute('aria-busy', 'true');

    try {
      const html = await sectionRenderer.getSectionHTML(this.sectionId, true, url);
      const parsedPage = new DOMParser().parseFromString(html, 'text/html');
      const newGrid = parsedPage.querySelector('[ref="grid"]');
      const newCards = newGrid?.querySelectorAll(':scope > [ref="cards[]"]');

      if (newCards?.length) {
        grid.append(...newCards);
      }

      history.pushState({}, '', url.toString());

      // Swap in the next page's own load-more button (pointing at page + 2),
      // or drop it entirely once there are no more pages left.
      const newButton = parsedPage.querySelector('[data-load-more-button]');
      if (newButton) {
        button.replaceWith(newButton);
      } else {
        button.closest('.blog-posts-load-more')?.remove();
      }
    } finally {
      button.removeAttribute('aria-busy');
    }
  };
}

if (!customElements.get('blog-posts-list')) {
  customElements.define('blog-posts-list', BlogPostsList);
}
