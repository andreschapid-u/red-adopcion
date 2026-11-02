/**
 * Image fallback without inline handlers, so the site can run under a strict
 * Content-Security-Policy. Loaded as a classic script in <head> to register the
 * capture listener before the parser reaches any <img>.
 *
 * data-fallback="placeholder" swaps a broken image for the local placeholder.
 * data-fallback="hide" hides a broken logo and leaves the initial visible.
 */
(function () {
  var root = document.documentElement;
  var placeholder = root.getAttribute('data-placeholder') || '/images/pet-placeholder.svg';

  document.addEventListener(
    'error',
    function (event) {
      var img = event.target;
      if (!img || img.tagName !== 'IMG') return;

      var mode = img.getAttribute('data-fallback');
      if (mode === 'hide') {
        img.style.display = 'none';
        return;
      }
      if (mode !== 'placeholder') return;
      if (img.getAttribute('src') === placeholder) return;

      img.removeAttribute('srcset');
      img.setAttribute('src', placeholder);
    },
    true,
  );
})();
