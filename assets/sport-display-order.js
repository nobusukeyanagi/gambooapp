/* Shared keirin / autorace display priority for all Gamboo app screens.
   Persist locally so navigation between standalone HTML screens keeps the order.
   The setting reorders sport content only; bottom navigation stays in a fixed order. */
(function () {
  "use strict";

  var STORAGE_KEY = "gamboo.sport-display-order";
  var order = "keirin";

  function readOrder() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "auto" ? "auto" : "keirin";
    } catch (error) {
      return "keirin";
    }
  }

  function saveOrder(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // The current page still updates if browser storage is unavailable.
    }
  }

  function orderSiblings(keirin, auto, value) {
    if (!keirin || !auto || !keirin.parentNode || keirin.parentNode !== auto.parentNode) return;
    var first = value === "auto" ? auto : keirin;
    var second = value === "auto" ? keirin : auto;
    if (first.nextElementSibling !== second) {
      first.parentNode.insertBefore(first, second);
    }
  }

  function applyHomeVenues(value) {
    var keirin = document.querySelector('[data-home-venues="keirin"]');
    var auto = document.querySelector('[data-home-venues="autorace"]');
    if (!keirin || !auto || keirin.parentNode !== auto.parentNode) return;

    var keirinHeading = keirin.previousElementSibling;
    var autoHeading = auto.previousElementSibling;
    if (!keirinHeading || !autoHeading ||
        !keirinHeading.classList.contains("vgroup-head") ||
        !autoHeading.classList.contains("vgroup-head")) return;

    var parent = keirin.parentNode;
    if (value === "auto") {
      parent.insertBefore(autoHeading, keirinHeading);
      parent.insertBefore(auto, keirinHeading);
    } else {
      parent.insertBefore(keirinHeading, autoHeading);
      parent.insertBefore(keirin, autoHeading);
    }
  }

  function applyOrder(value) {
    order = value;

    // Bottom navigation is fixed on every page, regardless of display preference.
    // Only the sport-specific content below may change order.

    applyHomeVenues(order);

    orderSiblings(
      document.querySelector('.favorite-sport[data-sport="keirin"]'),
      document.querySelector('.favorite-sport[data-sport="auto"]'),
      order
    );

    var results = document.querySelector(".mypage-result-actions");
    if (results) {
      orderSiblings(
        results.querySelector('a[href$="/achievement/keirin"]'),
        results.querySelector('a[href$="/achievement/autorace"]'),
        order
      );
    }

    var selected = document.querySelector(".sport-order-value");
    if (selected) selected.textContent = order === "auto" ? "オートレース" : "競輪";

    var button = document.querySelector(".sport-order-toggle");
    if (button) {
      button.setAttribute("aria-pressed", order === "auto" ? "true" : "false");
      button.setAttribute(
        "aria-label",
        "競輪・オート表示順：" + (order === "auto" ? "オートレース" : "競輪") + "が先。タップして変更"
      );
    }
  }

  applyOrder(readOrder());

  var button = document.querySelector(".sport-order-toggle");
  if (button) {
    button.addEventListener("click", function () {
      var next = order === "keirin" ? "auto" : "keirin";
      saveOrder(next);
      applyOrder(next);
    });
  }

  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) {
      applyOrder(event.newValue === "auto" ? "auto" : "keirin");
    }
  });
})();