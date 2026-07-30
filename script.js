const stage = document.querySelector("#zoomStage");
const image = document.querySelector("#productImage");
const toggle = document.querySelector("#zoomToggle");
const galleryClose = document.querySelector("#galleryClose");
const addButton = document.querySelector("#addButton");
const addButtonLabel = document.querySelector("#addButtonLabel");
const bagCount = document.querySelector(".bag-count");
const wishlist = document.querySelector(".wishlist");
const toast = document.querySelector("#toast");
const versionButtons = document.querySelectorAll(".version-button");

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
let activeVersion = "a";
let fullResolutionLoaded = true;
let fullResolutionLoading = false;
let fullResolutionPromise = null;
let galleryOriginRect = null;
let galleryTransitioning = false;

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

function loadFullResolution() {
  const fullSrc = image.dataset.fullSrc;

  if (!fullSrc || activeVersion !== "b") {
    return Promise.resolve(false);
  }

  if (fullResolutionLoaded) {
    return Promise.resolve(true);
  }

  if (fullResolutionPromise) {
    return fullResolutionPromise;
  }

  fullResolutionLoading = true;
  stage.classList.add("full-image-loading");

  fullResolutionPromise = new Promise((resolve) => {
    const fullImage = new Image();

    fullImage.decoding = "async";
    fullImage.src = fullSrc;

    fullImage.onload = async () => {
      try {
        await fullImage.decode();
      } catch {
        // Zdjęcie jest już pobrane, więc można kontynuować.
      }

      if (activeVersion !== "b") {
        fullResolutionLoading = false;
        fullResolutionPromise = null;
        stage.classList.remove("full-image-loading");
        resolve(false);
        return;
      }

      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      image.classList.add("switching-resolution");

      image.addEventListener(
        "load",
        () => {
          fullResolutionLoaded = true;
          fullResolutionLoading = false;
          fullResolutionPromise = null;

          stage.classList.remove("full-image-loading");
          image.classList.remove("switching-resolution");
          image.classList.add("full-resolution-loaded");

          render();
          resolve(true);
        },
        { once: true },
      );

      requestAnimationFrame(() => {
        image.src = fullSrc;
      });
    };

    fullImage.onerror = () => {
      fullResolutionLoading = false;
      fullResolutionPromise = null;

      stage.classList.remove("full-image-loading");
      image.classList.remove("switching-resolution");

      console.warn(
        "Nie udało się załadować zdjęcia w pełnej rozdzielczości.",
      );

      resolve(false);
    };
  });

  return fullResolutionPromise;
}

function selectVersion(version) {
  if (version === activeVersion) return;

  if (galleryExpanded) {
    closeGallery(false);
  } else {
    resetZoom();
  }

  activeVersion = version;
  fullResolutionPromise = null;
  fullResolutionLoading = false;
  stage.classList.remove("full-image-loading");
  image.classList.remove("switching-resolution", "full-resolution-loaded");

  if (version === "b") {
    fullResolutionLoaded = false;
    image.src = image.dataset.previewSrc;
  } else {
    fullResolutionLoaded = true;
    image.src = image.dataset.fullSrc;
  }

  versionButtons.forEach((button) => {
    const selected = button.dataset.version === version;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function galleryTransform(fromRect, toRect) {
  return {
    x: fromRect.left - toRect.left,
    y: fromRect.top - toRect.top,
    scaleX: fromRect.width / toRect.width,
    scaleY: fromRect.height / toRect.height,
  };
}

async function openGallery() {
  if (galleryExpanded || galleryTransitioning) return;

  galleryTransitioning = true;
  galleryOriginRect = stage.getBoundingClientRect();
  galleryExpanded = true;
  stage.classList.add("expanded");
  document.body.classList.add("gallery-open");
  render();
  loadFullResolution();

  const expandedRect = stage.getBoundingClientRect();
  const start = galleryTransform(galleryOriginRect, expandedRect);

  if (!prefersReducedMotion() && stage.animate) {
    const animation = stage.animate(
      [
        {
          borderRadius: "12px",
          transform: `translate(${start.x}px, ${start.y}px) scale(${start.scaleX}, ${start.scaleY})`,
        },
        {
          borderRadius: "0",
          transform: "translate(0, 0) scale(1, 1)",
        },
      ],
      {
        duration: 380,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );

    try {
      await animation.finished;
    } catch {
      // Animacja mogła zostać przerwana przez zmianę widoku.
    }
  }

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

  const expandedRect = stage.getBoundingClientRect();
  const targetRect = galleryOriginRect || expandedRect;
  const end = galleryTransform(targetRect, expandedRect);

  if (animate && !prefersReducedMotion() && stage.animate) {
    const animation = stage.animate(
      [
        {
          borderRadius: "0",
          transform: "translate(0, 0) scale(1, 1)",
        },
        {
          borderRadius: "12px",
          transform: `translate(${end.x}px, ${end.y}px) scale(${end.scaleX}, ${end.scaleY})`,
        },
      ],
      {
        duration: 300,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    );

    try {
      await animation.finished;
    } catch {
      // Animacja mogła zostać przerwana przez zmianę widoku.
    }
  }

  stage.classList.remove("expanded");
  document.body.classList.remove("gallery-open");
  galleryTransitioning = false;
  galleryOriginRect = null;
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

versionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectVersion(button.dataset.version);
  });
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
