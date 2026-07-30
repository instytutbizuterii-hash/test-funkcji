const carousel = document.querySelector("#carousel");
const originalCards = [...carousel.querySelectorAll(".product-card")];
const progress = document.querySelector("#progress");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const autoplay = document.querySelector("#autoplay");
const trackEnd = carousel.querySelector(".track-end");

let active = 0;
let autoTimer = null;
let resumeTimer = null;
let scrollTimer = null;
let autoplayEnabled = true;
let isResetting = false;

// Pełny zestaw po obu stronach sprawia, że korekta pozycji jest niewidoczna.
function cloneSet(position) {
  const fragment = document.createDocumentFragment();
  originalCards.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.dataset.clone = position;
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("button").forEach((button) => (button.tabIndex = -1));
    fragment.append(clone);
  });
  return fragment;
}

const previousSet = cloneSet("previous");
const nextSet = cloneSet("next");
trackEnd.remove();
carousel.prepend(previousSet);
carousel.append(nextSet);

const renderedCards = [...carousel.querySelectorAll(".product-card")];

originalCards.forEach((card, index) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.setAttribute("aria-label", `Pokaż produkt ${index + 1}`);
  dot.addEventListener("click", () => {
    pauseForInteraction();
    goToLogical(index);
  });
  progress.append(dot);
});

const dots = [...progress.children];

function cardLeft(card) {
  const padding = Number.parseFloat(getComputedStyle(carousel).paddingLeft) || 0;
  return card.offsetLeft - padding;
}

function scrollToPhysical(index, behavior = "smooth") {
  const safeIndex = Math.max(0, Math.min(renderedCards.length - 1, index));
  carousel.scrollTo({ left: cardLeft(renderedCards[safeIndex]), behavior });
}

function nearestPhysicalIndex() {
  return renderedCards.reduce(
    (nearest, card, index) => {
      const distance = Math.abs(cardLeft(card) - carousel.scrollLeft);
      return distance < nearest.distance ? { index, distance } : nearest;
    },
    { index: 1, distance: Number.POSITIVE_INFINITY },
  ).index;
}

function updateControls(logicalIndex) {
  active = logicalIndex;
  dots.forEach((dot, index) => dot.classList.toggle("active", index === active));
  progress.setAttribute("aria-label", `Slajd ${active + 1} z ${originalCards.length}`);
}

function settleInfiniteLoop() {
  if (isResetting) return;
  const physical = nearestPhysicalIndex();
  const productCount = originalCards.length;
  const logical = physical % productCount;

  if (physical < productCount) {
    isResetting = true;
    scrollToPhysical(physical + productCount, "auto");
    updateControls(logical);
    requestAnimationFrame(() => (isResetting = false));
    return;
  }

  if (physical >= productCount * 2) {
    isResetting = true;
    scrollToPhysical(physical - productCount, "auto");
    updateControls(logical);
    requestAnimationFrame(() => (isResetting = false));
    return;
  }

  updateControls(logical);
}

function move(direction) {
  const physical = nearestPhysicalIndex();
  scrollToPhysical(physical + direction);
}

function goToLogical(index) {
  const normalized = ((index % originalCards.length) + originalCards.length) % originalCards.length;
  scrollToPhysical(originalCards.length + normalized);
}

function stopAutoplay() {
  window.clearTimeout(autoTimer);
  window.clearInterval(autoTimer);
  window.clearTimeout(resumeTimer);
  autoTimer = null;
  resumeTimer = null;
}

function startAutoplay(firstMoveDelay = 1200) {
  stopAutoplay();
  if (!autoplayEnabled) return;

  autoTimer = window.setTimeout(() => {
    move(1);
    autoTimer = window.setInterval(() => move(1), 3000);
  }, firstMoveDelay);
}

function pauseForInteraction() {
  if (!autoplayEnabled) return;
  stopAutoplay();
  resumeTimer = window.setTimeout(() => startAutoplay(500), 5000);
}

carousel.addEventListener(
  "scroll",
  () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(settleInfiniteLoop, 140);
  },
  { passive: true },
);

carousel.addEventListener("pointerdown", pauseForInteraction);
carousel.addEventListener("wheel", pauseForInteraction, { passive: true });
carousel.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    pauseForInteraction();
    move(1);
  }
  if (event.key === "ArrowLeft") {
    pauseForInteraction();
    move(-1);
  }
});

previous.addEventListener("click", () => {
  pauseForInteraction();
  move(-1);
});

next.addEventListener("click", () => {
  pauseForInteraction();
  move(1);
});

autoplay.addEventListener("click", () => {
  autoplayEnabled = !autoplayEnabled;
  autoplay.classList.toggle("on", autoplayEnabled);
  autoplay.setAttribute("aria-pressed", String(autoplayEnabled));
  autoplay.querySelector("span").textContent = autoplayEnabled ? "Wł." : "Wył.";

  if (autoplayEnabled) startAutoplay(300);
  else stopAutoplay();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAutoplay();
  else if (autoplayEnabled) startAutoplay(500);
});

// Startujemy w środkowym zestawie, więc można przewijać w obie strony.
scrollToPhysical(originalCards.length, "auto");
updateControls(0);
startAutoplay();
