// Darstellung (hell/dunkel) vor dem ersten Zeichnen setzen, damit nichts aufblitzt.
(function () {
  try {
    var t = localStorage.getItem("gesundheit.darstellung");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* ohne Speicher: Systemeinstellung */ }
})();
