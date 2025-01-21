let timer;

function wakeOverlay(time = 500, autoHide = true) {
  const scriptOverlay = document.getElementById("script-overlay");

  if (timer) clearTimeout(timer);

  if (autoHide) {
    timer = setTimeout(() => {
      scriptOverlay.classList.add("hidden");
    }, time);
  }

  scriptOverlay.classList.remove("hidden");
}

window.addEventListener("load", async () => {
  // disable overlay
  document.querySelector(".nav-overlay").style.display = "none";

  // retrieve content
  const content = document.getElementById("content");
  const url = new URL(`${window.location.protocol}//${domain}${basePath}api/view`);
  url.searchParams.set("path", content.dataset.path);
  const res = await fetch(url).then(r => r.json());

  wakeOverlay(2000);
});

window.addEventListener("mousemove", e => {
  const scriptOverlay = document.getElementById("script-overlay");

  scriptOverlay.querySelectorAll("[data-desktop]").forEach(e => e.style.display = "");

  wakeOverlay(500, e.target.dataset.hover === undefined);
});

window.addEventListener("click", () => {
  const scriptOverlay = document.getElementById("script-overlay");

  console.log(scriptOverlay.querySelectorAll("[data-desktop]"));
  scriptOverlay.querySelectorAll("[data-desktop]").forEach(e => e.style.display = "none");

  wakeOverlay(500, false);
});
