/* Gamboo home: carousel, payout visibility, and demo deadline states. DOM runs after markup. */
// Seven repeating runs provide enough buffer that a fast swipe never
      // collides with the physical end of the track.
      document.querySelectorAll(".bn-carousel").forEach(function (box) {
        var track = box.querySelector(".bn-track");
        var dots = Array.from(box.querySelectorAll(".bn-dots i"));
        var originals = Array.from(track.children);
        var count = originals.length;
        if (count < 2) return;
        var ms = +box.getAttribute("data-interval") || 3500;
        var touching = false;
        var pauseUntil = 0;
        var settleTimer;
        var normalizationPending = false;
        var copiesEachSide = 3;
        var centerIndex = copiesEachSide * count;
        var wheelUntil = 0;

        // Repeat to both sides, and start in the center of the track.
        function copyRun() {
          var fragment = document.createDocumentFragment();
          originals.forEach(function (slide) {
            var clone = slide.cloneNode(true);
            clone.setAttribute("aria-hidden", "true");
            fragment.appendChild(clone);
          });
          return fragment;
        }
        for (var n = 0; n < copiesEachSide; n++) {
          track.insertBefore(copyRun(), track.firstChild);
          track.appendChild(copyRun());
        }

        function step() {
          return track.children[1].offsetLeft - track.children[0].offsetLeft;
        }
        function logicalIndex() {
          var index = Math.round(track.scrollLeft / step()) - centerIndex;
          return ((index % count) + count) % count;
        }
        function syncDots() {
          var selected = logicalIndex();
          dots.forEach(function (dot, index) {
            dot.classList.toggle("on", index === selected);
          });
        }
        function jumpWithoutAnimation(left) {
          normalizationPending = true;
          var snap = track.style.scrollSnapType;
          var behavior = track.style.scrollBehavior;
          track.style.scrollSnapType = "none";
          track.style.scrollBehavior = "auto";
          track.scrollLeft = left;
          // Re-enable snap after the browser has applied the invisible jump.
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              track.style.scrollSnapType = snap;
              track.style.scrollBehavior = behavior;
              normalizationPending = false;
              syncDots();
            });
          });
        }
        function recenter() {
          if (touching || normalizationPending || Date.now() < wheelUntil) return;
          var stride = step();
          if (!stride) return;
          var position = Math.round(track.scrollLeft / stride);
          var cycles = Math.floor((position - centerIndex) / count);
          if (cycles) {
            // Preserve the fractional offset during the invisible rebase.
            jumpWithoutAnimation(track.scrollLeft - cycles * count * stride);
          }
        }
        function scheduleRecenter() {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(recenter, 350);
        }
        track.addEventListener("scroll", function () {
          syncDots();
          if (!normalizationPending) scheduleRecenter();
        }, { passive: true });
        // scrollend is used when available; the debounce above is the fallback.
        track.addEventListener("scrollend", recenter);
        track.addEventListener("pointerdown", function () {
          touching = true;
          pauseUntil = Date.now() + ms;
        });
        function endTouch() {
          touching = false;
          scheduleRecenter();
        }
        window.addEventListener("pointerup", endTouch);
        window.addEventListener("pointercancel", endTouch);
        track.addEventListener("wheel", function () {
          pauseUntil = Date.now() + ms;
          wheelUntil = Date.now() + 280;
          scheduleRecenter();
        }, { passive: true });

        track.querySelectorAll("img").forEach(function (img) {
          img.addEventListener("error", function () { img.parentElement.classList.add("noimg"); });
          if (img.complete && !img.naturalWidth) img.parentElement.classList.add("noimg");
        });

        // Start from the middle run, so swiping either direction works.
        jumpWithoutAnimation(centerIndex * step());
        window.addEventListener("resize", function () {
          // Read the selected dot, rather than using an old scroll offset
          // with a newly calculated responsive slide width.
          var current = dots.findIndex(function (dot) { return dot.classList.contains("on"); });
          jumpWithoutAnimation((centerIndex + Math.max(0, current)) * step());
        });
        setInterval(function () {
          if (touching || normalizationPending || Date.now() < pauseUntil) return;
          var stride = step();
          if (!stride) return;
          var position = Math.round(track.scrollLeft / stride);
          var cycles = Math.floor((position - centerIndex) / count);
          var next = position + 1;
          if (cycles) {
            jumpWithoutAnimation(track.scrollLeft - cycles * count * stride);
            // Wait for the snap settings to be restored before animating.
            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                track.scrollTo({ left: (next - cycles * count) * stride, behavior: "smooth" });
              });
            });
          } else {
            track.scrollTo({ left: next * stride, behavior: "smooth" });
          }
        }, ms);
      });

;

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

;

/* Demo-only reference clock. Kept independent from the removed OS
         status bar so that the five-minute closing warnings still render. */
      (function () {
        var demoClock = "20:28";
        var deadlineItems = Array.from(document.querySelectorAll(".venue-grid.g3 .vcard-dl[data-deadline]"));
        function minutes(value) {
          var match = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
          if (!match || +match[1] > 23 || +match[2] > 59) return null;
          return +match[1] * 60 + +match[2];
        }
        function updateDeadlineWarnings() {
          var now = minutes(demoClock);
          deadlineItems.forEach(function (el) {
            var cutoff = minutes(el.dataset.deadline);
            var diff = now !== null && cutoff !== null ? cutoff - now : -1;
            var soon = diff > 0 && diff <= 5;
            el.classList.toggle("soon", soon);
            el.closest(".vcard").classList.toggle("deadline-soon", soon);
            if (soon) {
              el.setAttribute("aria-label", "締切まで" + diff + "分 " + el.dataset.deadline);
              el.setAttribute("title", "締切まで" + diff + "分");
            } else {
              el.removeAttribute("aria-label");
              el.removeAttribute("title");
            }
          });
        }
        updateDeadlineWarnings();
        setInterval(updateDeadlineWarnings, 30000);
      })();
