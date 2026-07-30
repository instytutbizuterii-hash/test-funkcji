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
let galleryTransitioning = false;
let fullResolutionPromise = null;
let galleryRevealX = window.innerWidth / 2;
let galleryRevealY = window.innerHeight / 2;

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

function preloadFullResolution() {
  if (fullResolutionPromise) {
    return fullResolutionPromise;
  }

  const fullSrc = image.dataset.fullSrc;

  fullResolutionPromise = new Promise((resolve, reject) => {
    const fullImage = new Image();

    fullImage.decoding = "async";
    fullImage.onload = async () => {
      try {
        await fullImage.decode();
      } catch {
        // Obraz jest pobrany i może zostać użyty mimo błędu decode().
      }

      resolve(fullSrc);
    };
    fullImage.onerror = () => reject(
      new Error("Nie udało się pobrać zdjęcia w pełnej rozdzielczości."),
    );
    fullImage.src = fullSrc;
  });

  return fullResolutionPromise;
}

async function applyFullResolution() {
  try {
    const fullSrc = await preloadFullResolution();

    if (image.getAttribute("src") === fullSrc) {
      render();
      return true;
    }

    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = fullSrc;
    });

    render();
    return true;
  } catch (error) {
    console.warn(error.message);
    return false;
  }
}

function restoreProductPreview() {
  const previewSrc = image.dataset.previewSrc;

  if (!previewSrc || image.getAttribute("src") === previewSrc) return;

  image.addEventListener("load", () => render(), { once: true });
  image.src = previewSrc;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getRevealGeometry() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const x = clamp(galleryRevealX, 0, width);
  const y = clamp(galleryRevealY, 0, height);
  const radius = Math.hypot(
    Math.max(x, width - x),
    Math.max(y, height - y),
  );

  return { x, y, radius };
}

function animateGalleryControls(opening) {
  const controls = [galleryClose, toggle];

  controls.forEach((control, index) => {
    const controlAnimation = control.animate(
      opening
        ? [
            { opacity: 0, transform: "translateY(-10px) scale(0.72) rotate(-8deg)" },
            { opacity: 1, transform: "translateY(2px) scale(1.06) rotate(1deg)", offset: 0.72 },
            { opacity: 1, transform: "translateY(0) scale(1) rotate(0)" },
          ]
        : [
            { opacity: 1, transform: "translateY(0) scale(1)" },
            { opacity: 0, transform: "translateY(-8px) scale(0.8)" },
          ],
      {
        duration: opening ? 440 : 220,
        delay: opening ? 160 + index * 55 : index * 20,
        easing: opening
          ? "cubic-bezier(0.16, 1, 0.3, 1)"
          : "cubic-bezier(0.4, 0, 1, 1)",
        fill: "both",
      },
    );

    controlAnimation.finished
      .catch(() => {})
      .finally(() => controlAnimation.cancel());
  });
}

async function openGallery() {
  if (galleryExpanded || galleryTransitioning) return;

  galleryTransitioning = true;
  galleryExpanded = true;
  stage.classList.add("expanded");
  document.body.classList.add("gallery-open");
  render();

  const fullQualityReady = applyFullResolution();
  let openingAnimation = Promise.resolve();

  if (!prefersReducedMotion() && stage.animate) {
    const { x, y, radius } = getRevealGeometry();
    const animation = stage.animate(
      [
        {
          clipPath: `circle(0px at ${x}px ${y}px)`,
          opacity: 0.35,
        },
        {
          clipPath: `circle(${radius * 1.035}px at ${x}px ${y}px)`,
          opacity: 1,
          offset: 0.82,
        },
        {
          clipPath: `circle(${radius}px at ${x}px ${y}px)`,
          opacity: 1,
        },
      ],
      {
        duration: 620,
        easing: "cubic-bezier(0.12, 0.78, 0.18, 1)",
      },
    );

    image.animate(
      [
        { filter: "blur(7px) saturate(0.72) brightness(1.1)", opacity: 0.62 },
        { filter: "blur(0) saturate(1.08) brightness(1.02)", opacity: 1, offset: 0.78 },
        { filter: "none", opacity: 1 },
      ],
      {
        duration: 640,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    );

    animateGalleryControls(true);

    if ("vibrate" in navigator) {
      navigator.vibrate(8);
    }

    openingAnimation = animation.finished.catch(() => {
      // Animacja mogła zostać przerwana przez zmianę widoku.
    });
  }

  await Promise.all([openingAnimation, fullQualityReady]);

  galleryTransitioning = false;

  if (pointers.size === 2) {
    preparePinchGesture();
  }

  galleryClose.focus({ preventScroll: true });
}

async function closeGallery(animate = true) {
  if (!galleryExpanded || galleryTransitioning) return;

  galleryTransitioning = true;
  galleryExpanded = false;
  pointers.clear();
  stage.classList.remove("dragging", "gesture-active");
  resetZoom();

  if (animate && !prefersReducedMotion() && stage.animate) {
    const { x, y, radius } = getRevealGeometry();
    const animation = stage.animate(
      [
        {
          clipPath: `circle(${radius}px at ${x}px ${y}px)`,
          opacity: 1,
        },
        {
          clipPath: `circle(0px at ${x}px ${y}px)`,
          opacity: 0.2,
        },
      ],
      {
        duration: 420,
        easing: "cubic-bezier(0.55, 0, 1, 0.45)",
      },
    );

    image.animate(
      [
        { filter: "none", opacity: 1 },
        { filter: "blur(5px) saturate(0.8)", opacity: 0.5 },
      ],
      {
        duration: 360,
        easing: "cubic-bezier(0.4, 0, 1, 1)",
      },
    );

    animateGalleryControls(false);

    try {
      await animation.finished;
    } catch {
      // Animacja mogła zostać przerwana przez zmianę widoku.
    }
  }

  stage.classList.remove("expanded");
  document.body.classList.remove("gallery-open");
  galleryTransitioning = false;
  restoreProductPreview();
  render();
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

function preparePinchGesture() {
  if (pointers.size !== 2) return;

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

stage.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, a, input, select, textarea")) {
    return;
  }

  if (!galleryExpanded) {
    galleryRevealX = event.clientX;
    galleryRevealY = event.clientY;
    preloadFullResolution().catch(() => {
      // applyFullResolution() obsłuży komunikat i ewentualny fallback.
    });
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

    if (!galleryExpanded) {
      const center = pointerCenter();
      galleryRevealX = center.x;
      galleryRevealY = center.y;
      openGallery();
    } else if (!galleryTransitioning) {
      preparePinchGesture();
    }
  }
});

stage.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length !== 2 || galleryExpanded) return;

    event.preventDefault();
    galleryRevealX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    galleryRevealY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    openGallery();
  },
  { passive: false },
);

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

  if (galleryTransitioning) return;

  if (pointers.size === 2 && !galleryExpanded) {
    openGallery();
    return;
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
