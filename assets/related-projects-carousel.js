if (!customElements.get('related-projects-carousel')) {
  customElements.define(
    'related-projects-carousel',
    class RelatedProjectsCarousel extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-track]');
        this.prevButton = this.querySelector('[data-prev]');
        this.nextButton = this.querySelector('[data-next]');
        this.dotsContainer = this.querySelector('[data-dots]');
        this.currentPage = 0;
        this.scrollEndTimer = null;

        if (!this.track) return;

        this.onPrevClick = () => this.goToPage(this.currentPage - 1);
        this.onNextClick = () => this.goToPage(this.currentPage + 1);
        this.onScroll = () => this.onScrollSettle();
        this.onResize = () => this.refresh();

        this.prevButton?.addEventListener('click', this.onPrevClick);
        this.nextButton?.addEventListener('click', this.onNextClick);
        this.track.addEventListener('scroll', this.onScroll, { passive: true });
        window.addEventListener('resize', this.onResize);

        this.refresh();
      }

      disconnectedCallback() {
        this.prevButton?.removeEventListener('click', this.onPrevClick);
        this.nextButton?.removeEventListener('click', this.onNextClick);
        this.track?.removeEventListener('scroll', this.onScroll);
        window.removeEventListener('resize', this.onResize);
        clearTimeout(this.scrollEndTimer);
      }

      // Recomputes how many cards are visible per "page" at the current
      // viewport width and rebuilds the dots to match.
      refresh() {
        const cards = Array.from(this.track.children);
        if (!cards.length) return;

        const cardWidth = cards[0].getBoundingClientRect().width;
        const trackStyle = getComputedStyle(this.track);
        const gap = parseFloat(trackStyle.columnGap || trackStyle.gap) || 0;
        this.step = cardWidth + gap;
        this.slidesPerView = Math.max(1, Math.round((this.track.clientWidth + gap) / this.step));
        const pageCount = Math.max(1, Math.ceil(cards.length / this.slidesPerView));

        if (pageCount !== this.pageCount) {
          this.pageCount = pageCount;
          this.buildDots(pageCount);
        }

        this.currentPage = Math.min(this.pageCount - 1, this.currentPage);
        this.setActiveDot(this.currentPage);
        this.updateArrowState();
      }

      buildDots(pageCount) {
        if (!this.dotsContainer) return;
        this.dotsContainer.innerHTML = '';
        this.dots = [];

        if (pageCount <= 1) return;

        for (let i = 0; i < pageCount; i++) {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'related-projects__dot';
          dot.setAttribute('aria-label', `Go to page ${i + 1}`);
          dot.addEventListener('click', () => this.goToPage(i));
          this.dotsContainer.appendChild(dot);
          this.dots.push(dot);
        }
      }

      // Navigates to a page by index, clamped to valid bounds. Updates the
      // active dot immediately (optimistic) rather than waiting on the
      // async scroll event, so clicks always feel instantly responsive.
      goToPage(index) {
        const clamped = Math.max(0, Math.min(this.pageCount - 1, index));
        const maxScroll = this.track.scrollWidth - this.track.clientWidth;
        const target = Math.min(maxScroll, clamped * this.slidesPerView * this.step);
        this.track.scrollTo({ left: target });
        this.currentPage = clamped;
        this.setActiveDot(clamped);
        this.updateArrowState();
      }

      // Re-syncs from the actual scroll position after native scrolling
      // (touch/trackpad drag) settles, so dots stay accurate even when the
      // user scrolls by hand instead of using the buttons/dots.
      onScrollSettle() {
        clearTimeout(this.scrollEndTimer);
        this.scrollEndTimer = setTimeout(() => {
          const maxScroll = this.track.scrollWidth - this.track.clientWidth;
          let index;
          if (this.track.scrollLeft >= maxScroll - 1) {
            // At the scroll boundary the last page is often partial (fewer
            // cards than slidesPerView), so it never lands on an exact
            // multiple of the page width — treat "at the end" as its own case.
            index = this.pageCount - 1;
          } else if (this.track.scrollLeft <= 1) {
            index = 0;
          } else {
            const activeCardIndex = Math.round(this.track.scrollLeft / this.step);
            index = Math.min(this.pageCount - 1, Math.floor(activeCardIndex / this.slidesPerView));
          }
          this.currentPage = index;
          this.setActiveDot(index);
          this.updateArrowState();
        }, 100);
      }

      setActiveDot(index) {
        if (!this.dots || !this.dots.length) return;
        this.dots.forEach((dot, i) => {
          dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
        });
      }

      // Disables prev/next at the respective boundary, and disables both
      // entirely when there's only one page (not enough items to scroll —
      // e.g. exactly `slidesPerView` cards, no overflow to page through).
      updateArrowState() {
        if (this.prevButton) this.prevButton.disabled = this.currentPage <= 0;
        if (this.nextButton) this.nextButton.disabled = this.currentPage >= this.pageCount - 1;
      }
    }
  );
}
