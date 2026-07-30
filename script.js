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

// Kopie skrajnych kart zapewniają niewidoczne przejście między końcem i początkiem.
const firstClone = originalCards[0].cloneNode(true);
const lastClone = originalCards[originalCards.length - 1].cloneNode(true);

firstClone.dataset.clone = "first";
lastClone.dataset.clone = "last";
[firstClone, lastClone].forEach((clone) => {
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("button").forEach((button) => (button.tabIndex = -1));
});

trackEnd.remove();
carousel.prepend(lastClone);
carousel.append(firstClone);

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

  if (physical === 0) {
    isResetting = true;
    scrollToPhysical(originalCards.length, "auto");
    updateControls(originalCards.length - 1);
    requestAnimationFrame(() => (isResetting = false));
    return;
  }

  if (physical === renderedCards.length - 1) {
    isResetting = true;
    scrollToPhysical(1, "auto");
    updateControls(0);
    requestAnimationFrame(() => (isResetting = false));
    return;
  }

  updateControls(physical - 1);
}

function move(direction) {
  const physical = nearestPhysicalIndex();
  scrollToPhysical(physical + direction);
}

function goToLogical(index) {
  const normalized = ((index % originalCards.length) + originalCards.length) % originalCards.length;
  scrollToPhysical(normalized + 1);
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

// Ustawiamy pierwszą prawdziwą kartę bez widocznego przewinięcia.
scrollToPhysical(1, "auto");
updateControls(0);
startAutoplay();
