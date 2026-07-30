const stage = document.querySelector("#zoomStage");
const image = document.querySelector("#productImage");
const toggle = document.querySelector("#zoomToggle");
const galleryClose = document.querySelector("#galleryClose");
const addButton = document.querySelector("#addButton");
const addButtonLabel = document.querySelector("#addButtonLabel");
const bagCount = document.querySelector(".bag-count");
const wishlist = document.querySelector(".wishlist");
const toast = document.querySelector("#toast");

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.6;

let scale = 1;
let translateX = 0;
let translateY = 0;
let startScale = 1;
let startDistance = 0;
let startTranslateX = 0;
let startTranslateY = 0;
let dragStartX = 0;
let dragStartY = 0;
let lastTap = 0;
let toastTimer;
const pointers = new Map();
let galleryExpanded = false;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBaseImageSize() {
  const rect = stage.getBoundingClientRect();
  const naturalWidth = image.naturalWidth || 4810;
  const naturalHeight = image.naturalHeight || 6013;
  const fit = Math.min(rect.width / naturalWidth, rect.height / naturalHeight);

  return {
    width: naturalWidth * fit,
    height: naturalHeight * fit,
  };
}

function constrainPosition() {
  const rect = stage.getBoundingClientRect();
  const base = getBaseImageSize();
  const maxX = Math.max(0, (base.width * scale - rect.width) / 2);
  const maxY = Math.max(0, (base.height * scale - rect.height) / 2);
  translateX = clamp(translateX, -maxX, maxX);
  translateY = clamp(translateY, -maxY, maxY);
}

function render() {
  constrainPosition();
  const rect = stage.getBoundingClientRect();
  const base = getBaseImageSize();

  image.style.width = `${base.width * scale}px`;
  image.style.height = `${base.height * scale}px`;
  image.style.left = `${rect.width / 2 + translateX}px`;
  image.style.top = `${rect.height / 2 + translateY}px`;

  const zoomed = scale > MIN_SCALE;
  stage.classList.toggle("zooming", zoomed);
  toggle.setAttribute("aria-label", zoomed ? "Przywróć całe zdjęcie" : "Powiększ zdjęcie");
  stage.setAttribute("aria-label", `Naszyjnik Lunéa No. 06. Powiększenie ${Math.round(scale * 100)}%.`);
}

function zoomAt(clientX, clientY, nextScale) {
  const rect = stage.getBoundingClientRect();
  const oldScale = scale;
  const localX = clientX - rect.left - rect.width / 2;
  const localY = clientY - rect.top - rect.height / 2;

  scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  const ratio = scale / oldScale;
  translateX = localX - (localX - translateX) * ratio;
  translateY = localY - (localY - translateY) * ratio;
  if (scale === MIN_SCALE) {
    translateX = 0;
    translateY = 0;
  }
  render();
}

function resetZoom() {
  scale = MIN_SCALE;
  translateX = 0;
  translateY = 0;
  render();
}

function openGallery() {
  if (galleryExpanded) return;
  galleryExpanded = true;
  stage.classList.add("expanded");
  document.body.classList.add("gallery-open");
  galleryClose.focus({ preventScroll: true });
  render();
}

function closeGallery() {
  galleryExpanded = false;
  pointers.clear();
  stage.classList.remove("expanded", "dragging", "gesture-active");
  document.body.classList.remove("gallery-open");
  resetZoom();
  toggle.focus({ preventScroll: true });
}

function pointerDistance() {
  const [first, second] = [...pointers.values()];
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointerCenter() {
  const [first, second] = [...pointers.values()];
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

stage.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  stage.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  stage.classList.add("gesture-active");

  if (pointers.size === 1) {
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    startTranslateX = translateX;
    startTranslateY = translateY;
    if (scale > MIN_SCALE) stage.classList.add("dragging");
  } else if (pointers.size === 2) {
    startDistance = pointerDistance();
    startScale = scale;
    startTranslateX = translateX;
    startTranslateY = translateY;
  }
});

stage.addEventListener("pointermove", (event) => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 2) {
    const center = pointerCenter();
    const nextScale = clamp(startScale * (pointerDistance() / startDistance), MIN_SCALE, MAX_SCALE);
    const rect = stage.getBoundingClientRect();
    const localX = center.x - rect.left - rect.width / 2;
    const localY = center.y - rect.top - rect.height / 2;
    const ratio = nextScale / startScale;
    scale = nextScale;
    translateX = localX - (localX - startTranslateX) * ratio;
    translateY = localY - (localY - startTranslateY) * ratio;
    render();
  } else if (pointers.size === 1 && scale > MIN_SCALE) {
    translateX = startTranslateX + event.clientX - dragStartX;
    translateY = startTranslateY + event.clientY - dragStartY;
    render();
  }
});

function finishPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  stage.classList.remove("dragging");

  if (pointers.size === 0) {
    stage.classList.remove("gesture-active");
    if (scale < 1.08) resetZoom();

    const moved = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY);
    const now = Date.now();
    if (moved < 12 && !galleryExpanded) {
      openGallery();
      lastTap = now;
    } else if (moved < 12 && now - lastTap < 320) {
      if (scale > MIN_SCALE) {
        resetZoom();
      } else {
        zoomAt(event.clientX, event.clientY, DOUBLE_TAP_SCALE);
      }
      lastTap = 0;
    } else if (moved < 12) {
      lastTap = now;
    }
  } else if (pointers.size === 1) {
    const remaining = [...pointers.values()][0];
    dragStartX = remaining.x;
    dragStartY = remaining.y;
    startTranslateX = translateX;
    startTranslateY = translateY;
  }
}

stage.addEventListener("pointerup", finishPointer);
stage.addEventListener("pointercancel", finishPointer);

stage.addEventListener(
  "wheel",
  (event) => {
    if (!event.ctrlKey && scale === MIN_SCALE) return;
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, scale * Math.exp(-event.deltaY * 0.002));
  },
  { passive: false },
);

stage.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (scale > MIN_SCALE) resetZoom();
    else {
      const rect = stage.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, DOUBLE_TAP_SCALE);
    }
  }
  if (event.key === "Escape") {
    if (galleryExpanded) closeGallery();
    else resetZoom();
  }
});

toggle.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!galleryExpanded) {
    openGallery();
  } else if (scale > MIN_SCALE) {
    resetZoom();
  } else {
    const rect = stage.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, DOUBLE_TAP_SCALE);
  }
});

galleryClose.addEventListener("click", (event) => {
  event.stopPropagation();
  closeGallery();
});

window.addEventListener("resize", () => render());
image.addEventListener("load", () => render());
render();

addButton.addEventListener("click", () => {
  const wasAdded = addButton.classList.toggle("added");
  addButtonLabel.textContent = wasAdded ? "Dodano do koszyka" : "Dodaj do koszyka";
  bagCount.textContent = wasAdded ? "1" : "0";
  bagCount.classList.toggle("visible", wasAdded);

  if (wasAdded) {
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
  }
});

wishlist.addEventListener("click", () => {
  const active = wishlist.classList.toggle("active");
  wishlist.querySelector("span").textContent = active ? "♥" : "♡";
  wishlist.setAttribute("aria-label", active ? "Usuń z ulubionych" : "Dodaj do ulubionych");
});
