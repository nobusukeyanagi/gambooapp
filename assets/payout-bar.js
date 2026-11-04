/* Shared balance visibility control: identical on home and mypage. */
"use strict";
document.querySelectorAll(".pay-toggle").forEach(function (el) {

        el.addEventListener("click", function () {
          var m = !el.classList.contains("masked");
          el.classList.toggle("masked", m);
          el.setAttribute("aria-pressed", m ? "true" : "false");
        });
        el.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            el.click();
          }
        });
      });
