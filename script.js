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
const TAP_MOVE_THRESHOLD = 12;
const DOUBLE_TAP_DELAY = 320;

let scale = 1;
let translateX = 0;
let translateY = 0;
let startScale = 1;
let startDistance = 0;
let startTranslateX = 0;
let startTranslateY = 0;
let dragStartX = 0;
let dragStartY = 0;
let pinchStartCenterX = 0;
let pinchStartCenterY = 0;
let gestureHadPinch = false;
let gestureMoved = false;
let lastTap = 0;
let toastTimer;
const pointers = new Map();
let galleryExpanded = false;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBaseImageSize(rect) {
  if (!image.naturalWidth || !image.naturalHeight) {
    return null;
  }

  const fit = Math.min(
    rect.width / image.naturalWidth,
    rect.height / image.naturalHeight,
  );

  return {
    width: image.naturalWidth * fit,
    height: image.naturalHeight * fit,
  };
}

function constrainPosition(rect, base) {
  const maxX = Math.max(
    0,
    (base.width * scale - rect.width) / 2,
  );

  const maxY = Math.max(
    0,
    (base.height * scale - rect.height) / 2,
  );

  translateX = clamp(translateX, -maxX, maxX);
  translateY = clamp(translateY, -maxY, maxY);
}

function render() {
  const rect = stage.getBoundingClientRect();
  const base = getBaseImageSize(rect);

  if (!base) return;

  constrainPosition(rect, base);

  image.style.width = `${base.width * scale}px`;
  image.style.height = `${base.height * scale}px`;
  image.style.left = `${rect.width / 2 + translateX}px`;
  image.style.top = `${rect.height / 2 + translateY}px`;

  const zoomed = scale > MIN_SCALE + 0.001;
  const imageName = image.alt?.trim() || "Zdjęcie produktu";

  stage.classList.toggle("zooming", zoomed);

  if (!galleryExpanded) {
    toggle.setAttribute("aria-label", "Otwórz galerię zdjęcia");
  } else {
    toggle.setAttribute(
      "aria-label",
      zoomed ? "Przywróć całe zdjęcie" : "Powiększ zdjęcie",
    );
  }

  stage.setAttribute(
    "aria-label",
    `${imageName}. Powiększenie ${Math.round(scale * 100)}%.`,
  );
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
  if (event.target.closest("button, a, input, select, textarea")) {
    return;
  }

  if (pointers.size >= 2) return;

  try {
    stage.setPointerCapture(event.pointerId);
  } catch {
    // Przejęcie wskaźnika nie zawsze jest dostępne.
  }

  pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
  });

  stage.classList.add("gesture-active");

  if (pointers.size === 1) {
    gestureMoved = false;
    gestureHadPinch = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    startTranslateX = translateX;
    startTranslateY = translateY;

    if (scale > MIN_SCALE) {
      stage.classList.add("dragging");
    }
  }

  if (pointers.size === 2) {
    gestureHadPinch = true;
    startDistance = Math.max(pointerDistance(), 1);
    startScale = scale;
    startTranslateX = translateX;
    startTranslateY = translateY;

    const center = pointerCenter();
    const rect = stage.getBoundingClientRect();

    pinchStartCenterX = center.x - rect.left - rect.width / 2;
    pinchStartCenterY = center.y - rect.top - rect.height / 2;
    stage.classList.remove("dragging");
  }
});

stage.addEventListener("pointermove", (event) => {
  const pointer = pointers.get(event.pointerId);

  if (!pointer) return;

  pointer.x = event.clientX;
  pointer.y = event.clientY;

  const movedDistance = Math.hypot(
    pointer.x - pointer.startX,
    pointer.y - pointer.startY,
  );

  if (movedDistance >= TAP_MOVE_THRESHOLD) {
    gestureMoved = true;
  }

  if (galleryExpanded || scale > MIN_SCALE) {
    event.preventDefault();
  }

  if (pointers.size === 2) {
    const center = pointerCenter();
    const rect = stage.getBoundingClientRect();
    const localX = center.x - rect.left - rect.width / 2;
    const localY = center.y - rect.top - rect.height / 2;

    const nextScale = clamp(
      startScale * (pointerDistance() / startDistance),
      MIN_SCALE,
      MAX_SCALE,
    );

    const ratio = nextScale / startScale;
    scale = nextScale;

    translateX =
      localX - (pinchStartCenterX - startTranslateX) * ratio;

    translateY =
      localY - (pinchStartCenterY - startTranslateY) * ratio;

    render();
    return;
  }

  if (pointers.size === 1 && scale > MIN_SCALE) {
    translateX =
      startTranslateX +
      event.clientX -
      dragStartX;

    translateY =
      startTranslateY +
      event.clientY -
      dragStartY;

    render();
  }
});

function finishPointer(event, cancelled = false) {
  const pointer = pointers.get(event.pointerId);

  if (!pointer) return;

  pointers.delete(event.pointerId);
  stage.classList.remove("dragging");

  try {
    if (stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
  } catch {
    // Pointer capture mógł zostać zwolniony automatycznie.
  }

  if (pointers.size === 1) {
    const remaining = [...pointers.values()][0];

    dragStartX = remaining.x;
    dragStartY = remaining.y;
    startTranslateX = translateX;
    startTranslateY = translateY;

    if (scale > MIN_SCALE) {
      stage.classList.add("dragging");
    }

    return;
  }

  if (pointers.size !== 0) return;

  stage.classList.remove("gesture-active", "dragging");

  const finalMovement = Math.hypot(
    event.clientX - pointer.startX,
    event.clientY - pointer.startY,
  );

  const isTap =
    !cancelled &&
    !gestureMoved &&
    !gestureHadPinch &&
    finalMovement < TAP_MOVE_THRESHOLD;

  if (scale < 1.08) {
    resetZoom();
  }

  if (isTap) {
    const now = Date.now();

    if (!galleryExpanded) {
      openGallery();
      lastTap = now;
    } else if (
      lastTap &&
      now - lastTap < DOUBLE_TAP_DELAY
    ) {
      if (scale > MIN_SCALE) {
        resetZoom();
      } else {
        zoomAt(
          event.clientX,
          event.clientY,
          DOUBLE_TAP_SCALE,
        );
      }

      lastTap = 0;
    } else {
      lastTap = now;
    }
  }

  gestureMoved = false;
  gestureHadPinch = false;
}

stage.addEventListener("pointerup", (event) => {
  finishPointer(event, false);
});

stage.addEventListener("pointercancel", (event) => {
  finishPointer(event, true);
});

stage.addEventListener(
  "wheel",
  (event) => {
    if (!galleryExpanded) return;

    event.preventDefault();

    zoomAt(
      event.clientX,
      event.clientY,
      scale * Math.exp(-event.deltaY * 0.002),
    );
  },
  { passive: false },
);

stage.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();

    if (galleryExpanded) {
      closeGallery();
    } else if (scale > MIN_SCALE) {
      resetZoom();
    }

    return;
  }

  // Nie przechwytujemy Entera ani spacji z przycisków.
  if (event.target !== stage) return;

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();

  if (!galleryExpanded) {
    openGallery();
    return;
  }

  if (scale > MIN_SCALE) {
    resetZoom();
  } else {
    const rect = stage.getBoundingClientRect();

    zoomAt(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      DOUBLE_TAP_SCALE,
    );
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

    zoomAt(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      DOUBLE_TAP_SCALE,
    );
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

  addButtonLabel.textContent = wasAdded
    ? "Dodano do koszyka"
    : "Dodaj do koszyka";

  bagCount.textContent = wasAdded ? "1" : "0";
  bagCount.classList.toggle("visible", wasAdded);

  if (wasAdded) {
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => toast.classList.remove("visible"),
      2200,
    );
  }
});

wishlist.addEventListener("click", () => {
  const active = wishlist.classList.toggle("active");

  wishlist.querySelector("span").textContent = active ? "♥" : "♡";
  wishlist.setAttribute(
    "aria-label",
    active ? "Usuń z ulubionych" : "Dodaj do ulubionych",
  );
});
