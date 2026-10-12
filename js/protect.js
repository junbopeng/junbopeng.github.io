/* Discourage casual saving of the photographs.

   Be clear-eyed about what this is. A browser has to download an image before
   it can draw it, so by the time a photograph is on screen the file is already
   on the visitor's machine. DevTools' network panel, view-source, and a plain
   screenshot all walk straight past everything below. Treat it as a speed bump
   against an absent-minded right-click, not as protection.

   What actually limits the damage is upstream of this file: the largest image
   ever published is 2400px — plenty to look at, not enough to print large or
   licence. See README. */

(function () {
  'use strict';

  var PHOTO = 'img, .shot, .jtile, .series-cover, .lightbox-stage';

  // Only over photographs — the rest of the page keeps its normal context menu,
  // so "open link in new tab" and spell-check still work where they should.
  document.addEventListener('contextmenu', function (e) {
    if (e.target.closest(PHOTO)) e.preventDefault();
  });

  // Stops dragging a photo out to the desktop or into another tab.
  document.addEventListener('dragstart', function (e) {
    if (e.target.closest('img')) e.preventDefault();
  });
})();
