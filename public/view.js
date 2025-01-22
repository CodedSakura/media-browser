const cacheExpireTime = 3600; // seconds

let timer;
let data;
let cache = new Map();

function wakeOverlay(time = 500, autoHide = true, isMobile = false) {
  const scriptOverlay = document.getElementById("script-overlay");

  if (timer) clearTimeout(timer);

  if (autoHide) {
    timer = setTimeout(() => {
      scriptOverlay.classList.add("hidden");
    }, time);
  }

  scriptOverlay.querySelectorAll("[data-desktop]").forEach(e => e.style.display = isMobile ? "none" : "");

  scriptOverlay.classList.remove("hidden");
}
function hideOverlay() {
  const scriptOverlay = document.getElementById("script-overlay");
  scriptOverlay.classList.add("hidden");
}

function toggleOverlay(...opts) {
  const scriptOverlay = document.getElementById("script-overlay");

  if (scriptOverlay.classList.contains("hidden")) {
    wakeOverlay(...opts);
  } else {
    hideOverlay();
  }
}


function loadNext() {
  console.log(data);
  console.log("load", data.next);
}

function loadPrev() {
  console.log("load", data.prev);
}

function goBack() {
  console.log("back", data.base);
}


function normalizeAngle(angle) {
  while (angle < 0) angle += Math.PI * 2;
  return angle % (Math.PI * 2);
}

function fetchApi(endpoint, params) {
  const url = new URL(endpoint, `${window.location.protocol}//${domain}${basePath}api/`);
  Object.entries(params).forEach(([ k, v ]) => url.searchParams.set(k, v));
  return fetch(url).then(r => r.json());
}

async function fetchPath(path) {
  if (cache.has(path)) {
    if (cache.get(path).created > Date.now() - cacheExpireTime) {
      return cache.get(path).data;
    } else {
      cache.delete(path);
    }
  }
  const data = await fetchApi("view", { path: path })
  cache.set(path, { created: Date.now(), data });
  return data;
}


window.addEventListener("load", async () => {
  // disable overlay
  document.querySelector(".nav-overlay").style.display = "none";

  // retrieve content
  data = await fetchPath(content.dataset.path);
  // pre-cache neighbor pages
  Promise.all([ fetchPath(data.next), fetchPath(data.prev) ]);

  wakeOverlay(2000);
});

window.addEventListener("mousemove", e =>
      wakeOverlay(500, e.target?.dataset?.hover === undefined));
window.addEventListener("click", () => wakeOverlay(500, false));
document.documentElement.addEventListener("mouseleave", () => hideOverlay());

window.addEventListener("touch:tap", () => toggleOverlay(500, false, true));
window.addEventListener("touch:swipe:left", () => loadNext());
window.addEventListener("touch:swipe:right", () => loadPrev());
window.addEventListener("touch:swipe:up", () => goBack());


const touchData = {
  thresholds: {
    tap: 5, // maximum distance moved to be a tap (vmin)
    swipe: 10, // minimum distance moved to be a swipe (vmin)
    direction: Math.PI / 8, // maximum angle from perfect to be a swipe (rad)
  },
  start: null,
  pos: null,
  cancel() {
    this.start = null;
    this.pos = null;
  },
  end() {
    const dx = this.pos.screenX - this.start.screenX;
    const dy = this.pos.screenY - this.start.screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = normalizeAngle(Math.atan2(dy, dx));
    const vminUnit = Math.min(window.screen.width, window.screen.height) / 100;
    if (dist < this.thresholds.tap * vminUnit) {
      window.dispatchEvent(new CustomEvent("touch:tap", { detail: this.pos }));
    } else if (dist > this.thresholds.swipe) {
      if (angle < normalizeAngle(this.thresholds.direction) ||
            angle > normalizeAngle(-this.thresholds.direction)) {
        window.dispatchEvent(new CustomEvent("touch:swipe:right"));
      }
      for (const [ evt, a ] of [
            ["touch:swipe:left", Math.PI],
            ["touch:swipe:up", Math.PI/2],
            ["touch:swipe:down", -Math.PI/2],
      ]) {
        if (angle < normalizeAngle(a + this.thresholds.direction) &&
              angle > normalizeAngle(a - this.thresholds.direction)) {
          window.dispatchEvent(new CustomEvent(evt));
        }
      }
    }
    this.cancel();
  },
};

window.addEventListener("touchstart", e => {
  e.preventDefault();
  if (e.touches.length > 1) {
    touchData.cancel();
  } else {
    touchData.start = e.touches[0];
    touchData.pos = e.touches[0];
  }
}, { passive: false });

window.addEventListener("touchmove", e => {
  e.preventDefault();
  if (touchData.start) {
    touchData.pos = e.touches[0];
  }
}, { passive: false });

window.addEventListener("touchend", e => {
  e.preventDefault();
  touchData.end();
}, { passive: false });

window.addEventListener("touchcancel", e => {
  e.preventDefault();
  touchData.cancel();
}, { passive: false });
