const stage = document.querySelector("#zoomStage");
const image = document.querySelector("#productImage");
const lens = document.querySelector("#lens");
const toggle = document.querySelector("#zoomToggle");
const addButton = document.querySelector("#addButton");
const addButtonLabel = document.querySelector("#addButtonLabel");
const bagCount = document.querySelector(".bag-count");
const wishlist = document.querySelector(".wishlist");
const toast = document.querySelector("#toast");

let zoomActive = false;
let toastTimer;
const zoom = 2.6;

function setZoom(active) {
  zoomActive = active;
  stage.classList.toggle("zooming", active);
  toggle.setAttribute("aria-label", active ? "Wyłącz powiększenie" : "Włącz powiększenie");
}

function moveLens(clientX, clientY) {
  if (!zoomActive) return;

  const rect = stage.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
  const lensSize = lens.offsetWidth;

  lens.style.left = `${x}px`;
  lens.style.top = `${y}px`;
  lens.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
  lens.style.backgroundPosition = `${-(x * zoom - lensSize / 2)}px ${-(y * zoom - lensSize / 2)}px`;
}

function activateAt(event) {
  setZoom(true);
  const point = event.touches?.[0] ?? event;
  moveLens(point.clientX, point.clientY);
}

stage.addEventListener("pointerdown", (event) => {
  if (event.target === toggle) return;
  if (zoomActive) {
    moveLens(event.clientX, event.clientY);
  } else {
    activateAt(event);
  }
});

stage.addEventListener("pointermove", (event) => {
  if (zoomActive) moveLens(event.clientX, event.clientY);
});

stage.addEventListener("pointerleave", () => {
  if (window.matchMedia("(hover: hover)").matches) setZoom(false);
});

stage.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setZoom(!zoomActive);
    if (zoomActive) {
      const rect = stage.getBoundingClientRect();
      moveLens(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }
  if (event.key === "Escape") setZoom(false);
});

toggle.addEventListener("click", (event) => {
  event.stopPropagation();
  setZoom(!zoomActive);
  if (zoomActive) {
    const rect = stage.getBoundingClientRect();
    moveLens(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
});

image.addEventListener("load", () => {
  lens.style.backgroundImage = `url("${image.currentSrc || image.src}")`;
});

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
  wishlist.setAttribute(
    "aria-label",
    active ? "Usuń z ulubionych" : "Dodaj do ulubionych",
  );
});
