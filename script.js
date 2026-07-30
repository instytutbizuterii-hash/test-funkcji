const carousel = document.querySelector("#carousel");
const cards = [...carousel.querySelectorAll(".product-card")];
const progress = document.querySelector("#progress");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const autoplay = document.querySelector("#autoplay");

let active = 0;
let timer = null;

cards.forEach((card, index) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.setAttribute("aria-label", `Pokaż produkt ${index + 1}`);
  dot.addEventListener("click", () => goTo(index));
  progress.append(dot);
});

const dots = [...progress.children];

function updateControls(index) {
  active = index;
  dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === active));
  previous.disabled = active === 0;
  next.disabled = active === cards.length - 1;
  progress.setAttribute("aria-label", `Slajd ${active + 1} z ${cards.length}`);
}

function goTo(index) {
  const target = Math.max(0, Math.min(cards.length - 1, index));
  cards[target].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
}

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) updateControls(Number(visible.target.dataset.index));
  },
  { root: carousel, threshold: [0.55, 0.75, 0.95] },
);

cards.forEach((card) => observer.observe(card));
previous.addEventListener("click", () => goTo(active - 1));
next.addEventListener("click", () => goTo(active + 1));

carousel.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") goTo(active + 1);
  if (event.key === "ArrowLeft") goTo(active - 1);
});

autoplay.addEventListener("click", () => {
  const isOn = autoplay.classList.toggle("on");
  autoplay.setAttribute("aria-pressed", String(isOn));
  autoplay.querySelector("span").textContent = isOn ? "Wł." : "Wył.";
  window.clearInterval(timer);
  timer = isOn
    ? window.setInterval(() => goTo((active + 1) % cards.length), 2800)
    : null;
});

updateControls(0);
