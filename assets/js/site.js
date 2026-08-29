/* Site behaviour. One file, no dependencies, deferred so it never blocks paint.
   Every control that stores state also writes it to the URL so views can be
   shared, bookmarked and restored with Back/Forward. */
(function () {
  "use strict";

  var doc = document;
  var qs = function (s, r) { return (r || doc).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduceMotion = function () {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  /* ---------- shared URL state ---------- */

  function urlParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  function setUrlParam(key, value) {
    var params = new URLSearchParams(window.location.search);
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    var query = params.toString();
    var url = window.location.pathname + (query ? "?" + query : "") + window.location.hash;
    try {
      window.history.replaceState(null, "", url);
    } catch (e) {
      /* Some browsers refuse history writes on file:// origins; the view still updates. */
    }
  }

  /* ---------- toasts ---------- */

  var toastRegion;

  function toast(message, actionLabel, onAction) {
    if (!toastRegion) {
      toastRegion = qs(".toast-region");
      if (!toastRegion) return;
    }
    var el = doc.createElement("div");
    el.className = "toast";
    var span = doc.createElement("span");
    span.textContent = message;
    el.appendChild(span);

    var dismiss = function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    };

    if (actionLabel) {
      var btn = doc.createElement("button");
      btn.type = "button";
      btn.textContent = actionLabel;
      btn.addEventListener("click", function () {
        if (onAction) onAction();
        dismiss();
      });
      el.appendChild(btn);
    }

    var close = doc.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "Close";
    close.addEventListener("click", dismiss);
    el.appendChild(close);

    toastRegion.appendChild(el);
    window.setTimeout(dismiss, actionLabel ? 9000 : 5000);
  }

  /* ---------- focus management for overlays ---------- */

  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var openOverlay = null;

  function trapFocus(event) {
    if (!openOverlay || event.key !== "Tab") return;
    var items = qsa(FOCUSABLE, openOverlay).filter(function (el) {
      return el.offsetParent !== null || el === doc.activeElement;
    });
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function showOverlay(overlay, focusTarget) {
    openOverlay = overlay;
    overlay.hidden = false;
    doc.documentElement.style.overflow = "hidden";
    var target = focusTarget || qs(FOCUSABLE, overlay);
    if (target) window.setTimeout(function () { target.focus(); }, 20);
  }

  function hideOverlay(overlay, returnFocusTo) {
    overlay.hidden = true;
    doc.documentElement.style.overflow = "";
    openOverlay = null;
    if (returnFocusTo && typeof returnFocusTo.focus === "function") returnFocusTo.focus();
  }

  doc.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && openOverlay) {
      var overlay = openOverlay;
      hideOverlay(overlay, overlay._returnFocus);
      return;
    }
    trapFocus(event);
  });

  /* ---------- theme ---------- */

  function initTheme() {
    var btn = qs("[data-theme-toggle]");
    if (!btn) return;
    var root = doc.documentElement;
    var meta = qs('meta[name="theme-color"]');
    var label = qs("[data-theme-label]");

    var apply = function (theme, persist) {
      root.setAttribute("data-theme", theme);
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
      if (meta) meta.setAttribute("content", theme === "dark" ? "#0e1113" : "#f0f1f2");
      if (persist) {
        try {
          localStorage.setItem("pf.theme", theme);
        } catch (e) {
          /* storage blocked; the toggle still works for this page view */
        }
      }
      var canvases = qsa("canvas[data-scene]");
      canvases.forEach(function (c) {
        if (c._pfViewport) c._pfViewport.draw();
      });
    };

    apply(root.getAttribute("data-theme") || "light", false);

    btn.addEventListener("click", function () {
      apply(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
    });
  }

  /* ---------- header, progress, back to top, floating CTA ---------- */

  function initScroll() {
    var header = qs(".site-header");
    var bar = qs(".progress__bar");
    var toTop = qs("[data-to-top]");
    var floating = qs("[data-floating-cta]");
    var footer = qs(".site-footer");
    var queued = false;

    var update = function () {
      queued = false;
      var y = window.scrollY || window.pageYOffset;
      var max = doc.documentElement.scrollHeight - window.innerHeight;
      if (header) header.setAttribute("data-scrolled", y > 8 ? "true" : "false");
      if (bar) bar.style.width = (max > 0 ? Math.min((y / max) * 100, 100) : 0) + "%";
      if (toTop) toTop.setAttribute("data-visible", y > 600 ? "true" : "false");
      if (floating) floating.setAttribute("data-visible", y > 900 ? "true" : "false");
    };

    window.addEventListener(
      "scroll",
      function () {
        if (!queued) {
          queued = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();

    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
      });
    }

    if (floating && footer && typeof IntersectionObserver === "function") {
      new IntersectionObserver(
        function (entries) {
          floating.hidden = entries[0].isIntersecting;
        },
        { rootMargin: "0px" }
      ).observe(footer);
    }
  }

  /* ---------- mobile navigation ---------- */

  function initNav() {
    var toggle = qs("[data-nav-toggle]");
    var panel = qs("#mobile-nav");
    if (!toggle || !panel) return;

    var setOpen = function (open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      doc.documentElement.style.overflow = open ? "hidden" : "";
      if (open) {
        var first = qs("a, button", panel);
        if (first) first.focus();
      }
    };

    toggle.addEventListener("click", function () {
      setOpen(panel.hidden);
    });
    panel.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 896 && !panel.hidden) setOpen(false);
    });
  }

  /* ---------- site search (⌘K) ---------- */

  function initSearch() {
    var triggers = qsa("[data-search-open]");
    var overlay = qs("#search-overlay");
    if (!overlay || !triggers.length) return;

    var input = qs("#search-input", overlay);
    var results = qs("#search-results", overlay);
    var index = null;
    var loaded = false;

    var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    qsa("[data-kbd-platform]").forEach(function (el) {
      el.textContent = isMac ? "⌘" : "Ctrl";
    });

    function loadIndex(done) {
      if (loaded) {
        done(index);
        return;
      }
      var script = doc.createElement("script");
      script.src = "assets/js/search-index.js";
      script.onload = function () {
        loaded = true;
        index = window.PF_SEARCH || [];
        done(index);
      };
      doc.head.appendChild(script);
    }

    function render(query) {
      loadIndex(function (items) {
        var q = query.trim().toLowerCase();
        var matches = items.filter(function (item) {
          if (!q) return true;
          return (item.title + " " + item.text + " " + item.kind).toLowerCase().indexOf(q) > -1;
        });

        results.textContent = "";
        if (!matches.length) {
          var li = doc.createElement("li");
          li.className = "empty-state";
          var strong = doc.createElement("strong");
          strong.textContent = "No matches for “" + query + "”";
          var p = doc.createElement("p");
          p.textContent = "Try “export”, “pricing”, “shortcuts” or “changelog”.";
          var link = doc.createElement("a");
          link.href = "contact.html";
          link.className = "btn btn--secondary btn--sm";
          link.textContent = "Ask a human";
          li.appendChild(strong);
          li.appendChild(p);
          li.appendChild(link);
          results.appendChild(li);
          return;
        }

        matches.slice(0, 8).forEach(function (item) {
          var li = doc.createElement("li");
          var a = doc.createElement("a");
          a.href = item.href;
          var kind = doc.createElement("span");
          kind.className = "search-kind";
          kind.textContent = item.kind;
          var title = doc.createElement("strong");
          title.textContent = item.title;
          var text = doc.createElement("p");
          text.textContent = item.text;
          a.appendChild(kind);
          a.appendChild(title);
          a.appendChild(text);
          a.addEventListener("click", function () {
            hideOverlay(overlay, null);
          });
          li.appendChild(a);
          results.appendChild(li);
        });
      });
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        overlay._returnFocus = trigger;
        showOverlay(overlay, input);
        render("");
      });
    });

    input.addEventListener("input", function () {
      render(input.value);
    });

    qs("[data-search-close]", overlay).addEventListener("click", function () {
      hideOverlay(overlay, overlay._returnFocus);
    });

    doc.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (overlay.hidden) {
          overlay._returnFocus = doc.activeElement;
          showOverlay(overlay, input);
          render("");
        } else {
          hideOverlay(overlay, overlay._returnFocus);
        }
      }
    });
  }

  /* ---------- FAQ ---------- */

  function initFaq() {
    var items = qsa("[data-faq-item]");
    if (!items.length) return;

    items.forEach(function (item) {
      var button = qs(".faq__q", item);
      var index = item.getAttribute("data-faq-item");
      var open = item.getAttribute("data-open") === "true";
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.setAttribute("aria-controls", "faq-panel-" + index);
      var panel = qs(".faq__a", item);
      panel.id = "faq-panel-" + index;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", button.id || "");

      button.addEventListener("click", function () {
        open = item.getAttribute("data-open") !== "true";
        item.setAttribute("data-open", open ? "true" : "false");
        button.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) setUrlParam("faq", index);
        else setUrlParam("faq", null);
      });
    });

    var wanted = urlParam("faq");
    if (!wanted && window.location.hash.indexOf("#faq-") === 0) {
      wanted = window.location.hash.slice(5);
    }
    if (wanted) {
      var target = qs('[data-faq-item="' + wanted + '"]');
      if (target) {
        target.setAttribute("data-open", "true");
        qs(".faq__q", target).setAttribute("aria-expanded", "true");
      }
    }
  }

  /* ---------- copy to clipboard ---------- */

  function initCopy() {
    qsa("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = qs(btn.getAttribute("data-copy"));
        if (!target) return;
        var text = target.textContent;
        var original = btn.getAttribute("data-label") || "Copy";

        var done = function (ok) {
          btn.textContent = ok ? "Copied" : "Press ⌘C";
          toast(ok ? "Copied to clipboard" : "Copy blocked by your browser");
          window.setTimeout(function () {
            btn.textContent = original;
          }, 2000);
        };

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(
            function () { done(true); },
            function () { done(false); }
          );
        } else {
          var area = doc.createElement("textarea");
          area.value = text;
          area.setAttribute("readonly", "");
          area.style.position = "fixed";
          area.style.opacity = "0";
          doc.body.appendChild(area);
          area.select();
          var ok = false;
          try {
            ok = doc.execCommand("copy");
          } catch (e) {
            ok = false;
          }
          doc.body.removeChild(area);
          done(ok);
        }
      });
    });
  }

  /* ---------- forms ---------- */

  var validators = {
    required: function (value) {
      return value.trim().length > 0 ? "" : "This field is required.";
    },
    email: function (value) {
      if (!value.trim()) return "Enter your email address.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
        ? ""
        : "Enter an address like name@studio.com.";
    },
    topic: function (value) {
      return value ? "" : "Choose what this is about.";
    },
    message: function (value) {
      if (value.trim().length < 12) return "Add at least 12 characters so we can help.";
      return "";
    },
    password: function (value) {
      if (value.length < 10) return "Use at least 10 characters.";
      return "";
    },
  };

  function fieldError(field) {
    return qs(".field__error", field);
  }

  function setFieldError(field, message) {
    var slot = fieldError(field);
    field.setAttribute("data-invalid", message ? "true" : "false");
    var control = qs("input, textarea, select", field);
    if (control) control.setAttribute("aria-invalid", message ? "true" : "false");
    if (slot) slot.textContent = message || "";
  }

  function validateField(field) {
    var control = qs("input, textarea, select", field);
    if (!control) return true;
    var rule = control.getAttribute("data-validate");
    if (!rule) return true;
    var message = validators[rule] ? validators[rule](control.value) : "";
    setFieldError(field, message);
    return !message;
  }

  function initForms() {
    qsa("form[data-form]").forEach(function (form) {
      var fields = qsa(".field", form);
      var submit = qs('button[type="submit"]', form);
      var status = qs("[data-form-status]", form.parentElement || form);
      var submitLabel = submit ? submit.textContent : "";

      fields.forEach(function (field) {
        var control = qs("input, textarea, select", field);
        if (!control) return;
        control.addEventListener("blur", function () {
          if (control.value) validateField(field);
        });
        control.addEventListener("input", function () {
          if (field.getAttribute("data-invalid") === "true") validateField(field);
        });
      });

      var dirty = false;
      form.addEventListener("input", function () {
        dirty = true;
      });

      window.addEventListener("beforeunload", function (event) {
        if (!dirty || form.getAttribute("data-submitted") === "true") return;
        event.preventDefault();
        event.returnValue = "";
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();

        var honeypot = qs("[data-honeypot]", form);
        if (honeypot && honeypot.value) {
          if (status) status.setAttribute("data-state", "success");
          return;
        }

        var firstBad = null;
        fields.forEach(function (field) {
          if (!validateField(field) && !firstBad) firstBad = field;
        });
        if (firstBad) {
          var control = qs("input, textarea, select", firstBad);
          if (control) control.focus();
          if (status) {
            status.setAttribute("data-state", "error");
            qs("[data-status-text]", status).textContent =
              "Check the highlighted field and try again.";
          }
          return;
        }

        var started = Date.now();
        if (submit) {
          submit.disabled = true;
          submit.setAttribute("aria-disabled", "true");
          submit.textContent = "Sending…";
          var spinner = doc.createElement("span");
          spinner.className = "spinner";
          spinner.setAttribute("aria-hidden", "true");
          submit.appendChild(spinner);
        }

        /* No endpoint in this build: the delay stands in for the network round
           trip so the loading state behaves the same as it would in production. */
        window.setTimeout(function () {
          if (submit) {
            submit.disabled = false;
            submit.removeAttribute("aria-disabled");
            submit.textContent = submitLabel;
          }
          form.setAttribute("data-submitted", "true");
          dirty = false;
          if (status) {
            status.setAttribute("data-state", "success");
            qs("[data-status-text]", status).textContent =
              status.getAttribute("data-success") || "Message received.";
            status.focus();
          }
          var next = form.getAttribute("data-redirect");
          if (next) window.location.href = next;
          else form.reset();
        }, Math.max(320, 520 - (Date.now() - started)));
      });
    });

    qsa("[data-password-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = qs(btn.getAttribute("data-password-toggle"));
        if (!input) return;
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    });
  }

  /* ---------- cookie banner ---------- */

  function initCookies() {
    var banner = qs("[data-cookie]");
    if (!banner) return;
    var key = "pf.cookies";
    var stored = null;
    try {
      stored = localStorage.getItem(key);
    } catch (e) {
      stored = null;
    }
    if (stored) return;

    window.setTimeout(function () {
      banner.hidden = false;
    }, 600);

    var decide = function (choice) {
      try {
        localStorage.setItem(key, choice);
      } catch (e) {
        /* storage blocked; the banner just returns on the next visit */
      }
      banner.hidden = true;
      toast(choice === "accepted" ? "Preferences saved" : "Non-essential storage declined");
    };

    qs("[data-cookie-accept]", banner).addEventListener("click", function () {
      decide("accepted");
    });
    qs("[data-cookie-reject]", banner).addEventListener("click", function () {
      decide("rejected");
    });
  }

  /* ---------- gallery ---------- */

  function initGallery() {
    var gallery = qs("[data-gallery]");
    if (!gallery) return;
    var grid = qs("[data-gallery-grid]", gallery);
    var cards = qsa("[data-scene]", grid);
    var chips = qsa("[data-filter]", gallery);
    var more = qs("[data-load-more]", gallery);
    var empty = qs("[data-gallery-empty]", gallery);
    var perPage = 3;
    var shown = perPage;
    var filter = urlParam("scene") || "all";

    function visibleCards() {
      return cards.filter(function (card) {
        return filter === "all" || card.getAttribute("data-scene") === filter;
      });
    }

    function paint(skeletons) {
      grid.textContent = "";
      if (skeletons) {
        for (var i = 0; i < Math.min(perPage, 3); i++) {
          var s = doc.createElement("div");
          s.className = "skeleton";
          s.setAttribute("aria-hidden", "true");
          grid.appendChild(s);
        }
        return;
      }

      var list = visibleCards();
      if (!list.length) {
        if (empty) grid.appendChild(empty);
        return;
      }
      list.slice(0, shown).forEach(function (card) {
        grid.appendChild(card);
        if (card._pfScene && card._pfScene.draw) card._pfScene.draw();
      });
      if (more) more.hidden = shown >= list.length;
    }

    chips.forEach(function (chip) {
      var value = chip.getAttribute("data-filter");
      chip.setAttribute("aria-pressed", value === filter ? "true" : "false");
      chip.addEventListener("click", function () {
        filter = value;
        shown = perPage;
        chips.forEach(function (other) {
          other.setAttribute(
            "aria-pressed",
            other.getAttribute("data-filter") === filter ? "true" : "false"
          );
        });
        setUrlParam("scene", filter === "all" ? null : filter);
        paint(true);
        window.setTimeout(function () {
          paint(false);
        }, 420);
      });
    });

    if (more) {
      more.addEventListener("click", function () {
        shown += perPage;
        paint(false);
      });
    }

    paint(false);
  }

  /* ---------- pricing toggle ---------- */

  function initPricing() {
    var toggle = qs("[data-billing-toggle]");
    if (!toggle) return;
    var cycle = urlParam("billing") === "yearly" ? "yearly" : "monthly";

    var apply = function () {
      toggle.setAttribute("aria-pressed", cycle === "yearly" ? "true" : "false");
      qsa("[data-monthly][data-yearly]").forEach(function (el) {
        el.textContent = cycle === "yearly" ? el.getAttribute("data-yearly") : el.getAttribute("data-monthly");
      });
      qsa("[data-cycle-label]").forEach(function (el) {
        el.textContent = cycle === "yearly" ? "per month, billed yearly" : "per month";
      });
    };

    toggle.addEventListener("click", function () {
      cycle = cycle === "yearly" ? "monthly" : "yearly";
      setUrlParam("billing", cycle);
      apply();
    });

    apply();
  }

  /* ---------- confirm + undo (destructive action) ---------- */

  function initResetScene() {
    var overlay = qs("#confirm-overlay");
    var trigger = qs("[data-reset-scene]");
    if (!overlay || !trigger) return;

    var confirmBtn = qs("[data-confirm-action]", overlay);
    var cancelBtn = qs("[data-confirm-cancel]", overlay);
    var previous = null;

    trigger.addEventListener("click", function () {
      overlay._returnFocus = trigger;
      showOverlay(overlay, cancelBtn);
    });

    cancelBtn.addEventListener("click", function () {
      hideOverlay(overlay, trigger);
    });

    confirmBtn.addEventListener("click", function () {
      hideOverlay(overlay, trigger);
      var view = qs("[data-main-viewport]");
      if (view && view._pfViewport) {
        previous = view._pfViewport.angles();
        view._pfViewport.reset();
      }
      toast("Scene reset", "Undo", function () {
        if (view && view._pfViewport && previous) {
          view._pfViewport.state.rx = previous.rx;
          view._pfViewport.state.ry = previous.ry;
          view._pfViewport.draw();
        }
      });
    });
  }

  /* ---------- product viewport ---------- */

  function initViewport() {
    if (!window.PFViewport) return;

    var main = qs("[data-main-viewport]");
    var canvas = qs("[data-main-canvas]");
    if (main && canvas) {
      var readout = qs("[data-viewport-readout]");
      var api = window.PFViewport.create(canvas, {
        shape: "geodesic",
        autoRotate: true,
        interactive: true,
        scale: 1,
      });
      if (!api) return;
      main._pfViewport = api;

      qsa("[data-transform]").forEach(function (input) {
        input.addEventListener("input", function () {
          var value = parseFloat(input.value);
          if (isNaN(value)) return;
          api.setTransform(input.getAttribute("data-transform"), value);
        });
      });

      main.setAttribute("tabindex", "0");
      main.setAttribute("role", "img");
      main.setAttribute(
        "aria-label",
        "Live preview of the PixelForge viewport showing a rotating wireframe geodesic sphere. Drag or use the arrow keys to orbit."
      );

      main.addEventListener("keydown", function (event) {
        var step = 0.12;
        if (event.key === "ArrowLeft") api.nudge(-step, 0);
        else if (event.key === "ArrowRight") api.nudge(step, 0);
        else if (event.key === "ArrowUp") api.nudge(0, -step);
        else if (event.key === "ArrowDown") api.nudge(0, step);
        else return;
        event.preventDefault();
      });

      var pause = qs("[data-viewport-pause]");
      if (pause) {
        var sync = function () {
          qs("[data-pause-label]", pause).textContent = api.isAuto() ? "Pause" : "Play";
        };
        pause.addEventListener("click", function () {
          api.setAuto(!api.isAuto());
          sync();
        });
        sync();
      }

      if (readout) {
        window.setInterval(function () {
          var a = api.angles();
          var deg = function (rad) {
            return ((((rad * 180) / Math.PI) % 360) + 360) % 360;
          };
          var fps = api.state.fps ? Math.round(api.state.fps) + " fps" : "idle";
          readout.textContent =
            "rx " + deg(a.rx).toFixed(0) + "° · ry " + deg(a.ry).toFixed(0) + "° · " + fps;
        }, 500);
      }
    }

    qsa("canvas[data-scene-thumb]").forEach(function (canvas) {
      var api = window.PFViewport.create(canvas, {
        shape: canvas.getAttribute("data-scene-thumb"),
        autoRotate: false,
        interactive: false,
        scale: 0.92,
        rx: -0.42,
        ry: 0.9,
      });
      if (api) canvas._pfViewport = api;
    });
  }

  /* ---------- locale aware dates ---------- */

  function initDates() {
    var locale =
      (navigator.languages && navigator.languages[0]) || navigator.language || "en-GB";
    var fmt = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    qsa("time[data-date]").forEach(function (el) {
      var iso = el.getAttribute("datetime");
      if (!iso) return;
      var date = new Date(iso + "T00:00:00Z");
      if (isNaN(date)) return;
      el.textContent = fmt.format(date);
    });
  }

  /* ---------- campaign attribution ---------- */

  function initUtm() {
    var params = new URLSearchParams(window.location.search);
    var campaign = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"].forEach(function (key) {
      var value = params.get(key);
      if (value) campaign[key] = value;
    });
    if (!Object.keys(campaign).length) return;
    try {
      sessionStorage.setItem("pf.campaign", JSON.stringify(campaign));
    } catch (e) {
      return;
    }
    var query = new URLSearchParams(campaign).toString();
    qsa("[data-append-utm]").forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      link.setAttribute("href", href + (href.indexOf("?") > -1 ? "&" : "?") + query);
    });
  }

  /* ---------- boot ---------- */

  function boot() {
    initTheme();
    initScroll();
    initNav();
    initSearch();
    initFaq();
    initCopy();
    initForms();
    initCookies();
    initGallery();
    initPricing();
    initResetScene();
    initViewport();
    initDates();
    initUtm();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
