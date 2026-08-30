/* Runs blocking in <head> so the stored theme is applied before first paint.
   Kept separate (and small) to stay CSP-friendly without inline scripts. */
(function () {
  var STORE = "pf.theme";
  var root = document.documentElement;
  var saved = null;
  try {
    saved = localStorage.getItem(STORE);
  } catch (e) {
    saved = null;
  }
  var dark =
    saved === "dark" ||
    (saved !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0e1113" : "#f0f1f2");
})();
