/* =============================================================
   SCRIPT.JS  —  a tiny bit of JavaScript
   =============================================================
   This file does a few small jobs. You probably don't need to
   touch it, but here's what it does so nothing feels like magic.
   ============================================================= */

/* -------------------------------------------------------------
   RELOADING ALWAYS STARTS YOU AT THE TOP
   Browsers often remember your scroll position across a refresh.
   This turns that off, so reloading the page always puts you back
   at the very top (the hero), the same as opening it fresh.
   ------------------------------------------------------------- */
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

/* -------------------------------------------------------------
   ACCOUNT FOR THE STICKY NAV'S HEIGHT
   The hero is meant to fill exactly one screen (100vh), but the
   sticky nav bar sits above it and takes up some of that space too
   — so without this, the hero would actually run a bit taller than
   the screen, pushing anything pinned to its bottom (the scroll
   arrow) down past the edge where it can't be seen. This measures
   the nav's real height and makes it available to styles.css.
   ------------------------------------------------------------- */
const siteHeader = document.querySelector(".site-header");
if (siteHeader) {
  const setNavHeight = () => {
    document.documentElement.style.setProperty("--nav-height", `${siteHeader.offsetHeight}px`);
  };
  setNavHeight();
  window.addEventListener("resize", setNavHeight);
}

/* -------------------------------------------------------------
   COMING BACK FROM A PROJECT PUTS YOU WHERE YOU WERE
   When you click a project on the home page, we tack "?from=1500"
   (how many pixels down you were) onto that project's address.
   The project page then points its "Back to Photography Gallery"
   link at "index.html?y=1500", and the home page jumps straight
   to that spot when it opens. The browser's own Back button does
   the same, using a note saved in sessionStorage (a little
   notepad the browser keeps for this tab). A plain reload, or
   opening the site fresh, still starts at the top.
   ------------------------------------------------------------- */
const SCROLL_KEY = "homeScrollY";
const readNote = (key) => {
  try { return sessionStorage.getItem(key); } catch (error) { return null; }
};
const writeNote = (key, value) => {
  try { sessionStorage.setItem(key, value); } catch (error) { /* no storage — fine */ }
};

const pageParams = new URLSearchParams(window.location.search);
const isHomePage = !!document.querySelector(".hero");

// Any link to a project carries the "where was I" number along with it.
document.addEventListener(
  "click",
  (event) => {
    const link = event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    const href = link.getAttribute("href");
    if (!/^project-\d+\.html(\?.*)?$/.test(href)) return;
    const from = isHomePage ? Math.round(window.scrollY) : parseFloat(pageParams.get("from"));
    if (!isNaN(from)) link.setAttribute("href", href.split("?")[0] + "?from=" + from);
  },
  true
);

if (isHomePage) {
  const navEntry = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
  const navType = navEntry ? navEntry.type : "navigate";
  const paramY = parseFloat(pageParams.get("y"));
  let targetY = NaN;
  if (navType !== "reload") {
    if (!isNaN(paramY)) targetY = paramY; // came via the Back link
    else if (navType === "back_forward") targetY = parseFloat(readNote(SCROLL_KEY)); // browser Back button
  }

  // Tidy "?y=1500" out of the address bar so a later reload starts at the top.
  if (pageParams.has("y")) {
    try { history.replaceState(null, "", window.location.pathname + window.location.hash); } catch (error) { /* ignore */ }
  }

  if (targetY > 0) {
    // "restoring" switches off the slide/fade animations for a moment
    // (see styles.css) so everything simply appears where it should be.
    document.documentElement.classList.add("restoring");
    const jump = () => window.scrollTo({ top: targetY, left: 0, behavior: "instant" });
    jump();
    // Images finish loading a moment later and can nudge the layout, so
    // jump again once everything's loaded — unless you've started scrolling.
    let userMoved = false;
    ["wheel", "touchstart", "keydown", "mousedown"].forEach((name) =>
      window.addEventListener(name, () => { userMoved = true; }, { once: true, passive: true })
    );
    window.addEventListener("load", () => {
      if (!userMoved && Math.abs(window.scrollY - targetY) > 2) jump();
    });
    setTimeout(() => document.documentElement.classList.remove("restoring"), 1200);
  }

  // Remember where we are whenever the page is left (used by the browser's Back button).
  window.addEventListener("pagehide", () => writeNote(SCROLL_KEY, String(window.scrollY)));
} else {
  // Project pages: point the back link at the spot we came from.
  const backLink = document.querySelector(".project__back");
  const from = parseFloat(pageParams.get("from"));
  if (backLink && !isNaN(from)) {
    backLink.setAttribute("href", "index.html?y=" + from);
  }
}
/* -------------------------------------------------------------
   0a. MARK THE PAGE AS "JS READY"
   Added straight away, before anything else. styles.css only
   hides elements for the scroll-reveal effect (below) when this
   class is present — so if JavaScript ever fails to load, the
   page just shows everything normally instead of staying blank.
   ------------------------------------------------------------- */
document.documentElement.classList.add("js");

/* -------------------------------------------------------------
   0b. BACKGROUND  (a few big "Matthew.foto" words that appear and fade)
   A full-screen <canvas> behind every page. A handful of very
   large "Matthew.foto" words, drawn in faint ink, take turns: each
   one fades in at a random spot, drifts very slowly, then fades
   away and a new one appears somewhere else.

   It stays put behind the page as you scroll.

   No external libraries — just 2D canvas drawing.
   Anyone with "Reduce Motion" turned on gets a few still words
   (no fading or drifting).
   ------------------------------------------------------------- */
(() => {
  const canvas = document.createElement("canvas");
  canvas.className = "site-bg";
  canvas.setAttribute("aria-hidden", "true");
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const WORD = "Matthew.foto";
  const WORD_COUNT = 5; // how many are alive at once
  const FADE_IN = 2.2; // seconds
  const HOLD = 1.8;
  const FADE_OUT = 2.8;
  const LIFE = FADE_IN + HOLD + FADE_OUT;

  let width = 0;
  let height = 0;
  let words = [];

  // Pick a new random spot, size and tilt for a word.
  const respawn = (w, age) => {
    w.size = Math.min(width, 1400) * (0.11 + Math.random() * 0.1); // font size in px
    w.x = width * (0.1 + Math.random() * 0.8);
    w.y = height * (Math.random() * 1.0); // anywhere, including up into the top bar
    w.rotation = (Math.random() - 0.5) * 0.35; // a slight tilt (radians)
    w.dx = (Math.random() - 0.5) * 6; // slow drift, px per second
    w.dy = (Math.random() - 0.5) * 4;
    w.peak = 0.07 + Math.random() * 0.06; // faint, never louder than this
    w.age = age;
  };

  const seedWords = () => {
    words = Array.from({ length: WORD_COUNT }, (_, i) => {
      const w = {};
      respawn(w, (LIFE / WORD_COUNT) * i); // staggered so they don't all pulse together
      return w;
    });
  };

  const resize = () => {
    const dpr = 1; // faint blurry words don't need a sharp canvas — keeps the page light
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedWords();
  };

  // The words stay on screen the whole time you scroll (the canvas is fixed
  // to the window), so they sit behind every part of every page.
  const scrollOpacity = () => 1;

  // 0 → 1 → 0 over a word's life.
  const lifeOpacity = (age) => {
    if (age < FADE_IN) return age / FADE_IN;
    if (age < FADE_IN + HOLD) return 1;
    return Math.max(0, 1 - (age - FADE_IN - HOLD) / FADE_OUT);
  };

  const style = getComputedStyle(document.documentElement);
  const ink = style.getPropertyValue("--color-text").trim() || "#1a1a1a";
  const fontFamily = style.getPropertyValue("--font-heading").trim() || "sans-serif";
  let lastTime = performance.now();

  const draw = (now) => {
    const time = now || performance.now();
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    ctx.clearRect(0, 0, width, height);

    const fade = scrollOpacity();
    if (fade <= 0) return;

    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    words.forEach((w) => {
      if (!reduceMotion) {
        w.age += dt;
        w.x += w.dx * dt;
        w.y += w.dy * dt;
        if (w.age >= LIFE) respawn(w, 0);
      }
      const level = reduceMotion ? 0.6 : lifeOpacity(w.age);
      const smooth = level * level * (3 - 2 * level);
      ctx.save();
      ctx.globalAlpha = w.peak * smooth * fade;
      ctx.translate(w.x, w.y);
      ctx.rotate(w.rotation);
      ctx.font = `800 ${w.size}px ${fontFamily}`;
      ctx.fillText(WORD, 0, 0);
      ctx.restore();
    });

    // Only copy the top strip into the bar when a word is actually up there.
    const barH = headerBar ? headerBar.offsetHeight : 0;
    const wordInBar = words.some((w) => w.y - w.size * 0.9 < barH && w.y + w.size * 0.9 > 0);
    if (wordInBar) { copyIntoHeader(); headerHadInk = true; }
    else if (headerHadInk) { copyIntoHeader(); headerHadInk = false; }
  };

  // The top bar has its own solid background (so page content scrolling
  // underneath doesn't show through its links). To let the words appear in
  // it too, we copy the top strip of the background onto a second canvas
  // that sits on top of the bar — the words are faint, so they simply look
  // like they carry on through the bar.
  const headerBar = document.querySelector(".site-header");
  let headerCanvas = null;
  let headerCtx = null;
  if (headerBar) {
    headerCanvas = document.createElement("canvas");
    headerCanvas.className = "site-bg-header";
    headerCanvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(headerCanvas, headerBar.nextSibling);
    headerCtx = headerCanvas.getContext("2d");
  }

  let headerHadInk = false;
  const copyIntoHeader = () => {
    if (!headerCanvas) return;
    const dpr = canvas.width / width;
    const barH = Math.round(headerBar.offsetHeight * dpr);
    if (headerCanvas.width !== canvas.width || headerCanvas.height !== barH) {
      headerCanvas.width = canvas.width;
      headerCanvas.height = barH;
      headerCanvas.style.width = width + "px";
      headerCanvas.style.height = headerBar.offsetHeight + "px";
    }
    headerCtx.clearRect(0, 0, headerCanvas.width, barH);
    headerCtx.drawImage(canvas, 0, 0, canvas.width, barH, 0, 0, canvas.width, barH);
  };

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", () => draw(), { passive: true });

  if (reduceMotion) {
    draw();
  } else {
    const loop = (now) => {
      draw(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();
/* -------------------------------------------------------------
   1. MOBILE MENU
   On small screens, tapping the hamburger button shows/hides the
   navigation links.
   ------------------------------------------------------------- */
const toggle = document.querySelector(".nav__toggle");
const links = document.querySelector(".nav__links");

if (toggle && links) {
  toggle.addEventListener("click", () => {
    // Add or remove the "open" class that makes the menu visible.
    const isOpen = links.classList.toggle("nav__links--open");
    // Tell screen readers whether the menu is open, and match the label to it.
    toggle.setAttribute("aria-expanded", isOpen);
    toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  });

  // Close the menu again after tapping a link.
  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      links.classList.remove("nav__links--open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    });
  });
}

/* -------------------------------------------------------------
   1b. PROJECTS DROPDOWN
   Builds the small three-line menu in the nav (next to Photography
   / About) that jumps straight to any project. Added here, once,
   so every page gets the same menu without copy-pasting it into
   all seven HTML files.

   Update the list below any time you rename or add a project.
   ------------------------------------------------------------- */
const projectList = [
  { href: "project-1.html", title: "Antonino's Street Triple" },
  { href: "project-2.html", title: "Dad's XY Typology" },
  { href: "project-3.html", title: "BMW M2 Competition" },
  { href: "project-4.html", title: "Mustang Cali Special" },
  { href: "project-5.html", title: "South Coast Street Signs" },
  { href: "project-6.html", title: "Colonial Knob Bush Walk" },
];

if (links) {
  const dropdown = document.createElement("div");
  dropdown.className = "nav__projects";
  dropdown.innerHTML = `
    <button class="nav__projects-toggle" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Browse all projects">
      <span></span><span></span><span></span>
    </button>
    <ul class="nav__projects-menu">
      ${projectList
        .map((p) => `<li><a href="${p.href}">${p.title}</a></li>`)
        .join("")}
    </ul>
  `;
  links.appendChild(dropdown);

  const projectsToggle = dropdown.querySelector(".nav__projects-toggle");

  const closeDropdown = () => {
    dropdown.classList.remove("is-open");
    projectsToggle.setAttribute("aria-expanded", "false");
  };

  projectsToggle.addEventListener("click", (event) => {
    event.stopPropagation(); // don't let this click also close itself via the listener below
    const isOpen = dropdown.classList.toggle("is-open");
    projectsToggle.setAttribute("aria-expanded", isOpen);
  });

  // Close it if you click anywhere else on the page...
  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      closeDropdown();
    }
  });

  // ...or press Escape...
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDropdown();
    }
  });

  // ...or tap one of the project links in it.
  dropdown.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeDropdown);
  });
}

/* -------------------------------------------------------------
   1c. ARROW BUTTONS
   The scroll-down arrow in the hero and the back-to-top arrows
   beside the section titles. Each button says where it goes in
   its data-scroll-to attribute: "top", or a section like
   "#photography".
   ------------------------------------------------------------- */
// We glide the page ourselves (instead of the browser's built-in smooth
// scroll) because the built-in one can get interrupted when the gallery
// is sliding in or out at the same time.
// Two ways of moving: a plain ease in-out, and a "soft roll" that matches the
// rest of the site's wobbly, rippling motion — it sweeps down, slightly overshoots
// the spot, then rolls back and settles, like the wave settling after it passes.
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const softRoll = (t) => {
  const arrive = 0.7; // the sweep takes the first 70% of the time, the settling the rest
  if (t < arrive) return easeInOut(t / arrive);
  const k = (t - arrive) / (1 - arrive); // 0 → 1 while settling
  return 1 + 0.035 * Math.sin(2 * Math.PI * k) * (1 - k); // a small overshoot, then rest at 1
};

function glideTo(targetY, duration = 800, ease = easeInOut) { // duration in milliseconds
  const startY = window.scrollY;
  const distance = targetY - startY;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || Math.abs(distance) < 2) {
    window.scrollTo(0, targetY);
    return;
  }
  const startTime = performance.now();
  window.__pulseStart = startTime; // the cube (section 7) follows the same clock
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = ease(t);
    // "instant" stops the page's own smooth-scroll setting from fighting each tiny step.
    window.scrollTo({ top: startY + distance * eased, behavior: "instant" });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

document.querySelectorAll("[data-scroll-to]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.scrollTo;
    // The big arrow on the opening screen takes its time and rolls down with a soft wobble,
    // to match the rest of the site; the small arrows use a plain, quicker glide.
    const isHero = button.classList.contains("hero__scroll-hint");
    const duration = isHero ? 2400 : 800; // milliseconds
    const ease = isHero ? softRoll : easeInOut;
    if (target === "top") {
      glideTo(0, duration, ease);
    } else {
      const section = document.querySelector(target);
      if (section) {
        const navHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) || 0;
        glideTo(section.getBoundingClientRect().top + window.scrollY - navHeight, duration, ease);
      }
    }
  });
});

/* -------------------------------------------------------------
   2. AUTOMATIC YEAR IN THE FOOTER
   Fills in the current year so you never have to update it.
   ------------------------------------------------------------- */
const yearSpan = document.getElementById("year");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

/* -------------------------------------------------------------
   3. SCROLL REVEAL
   Images and section text fade/slide into view as you scroll down
   to them, once, the first time. (The Work section's project cards
   have their own repeating slide instead — see below.)
   IntersectionObserver just watches for an element entering the
   screen and adds a class when it does — styles.css handles the
   actual fade/slide with a CSS transition.
   ------------------------------------------------------------- */
const revealTargets = document.querySelectorAll(
  ".about, .project__description, .project__gallery img, .section__head, .section__intro"
);

if (revealTargets.length && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach((el) => {
    el.classList.add("reveal");
    revealObserver.observe(el);
  });
}

/* -------------------------------------------------------------
   3b. VIEW A WHOLE PHOTO  (lightbox)
   Click any photo on a project page and it opens big, fitted to
   your screen so you can see all of it. Use the arrows (on screen
   or on your keyboard) to flick through, and click the dark area,
   press Esc, or hit the X to close.
   ------------------------------------------------------------- */
const galleryPhotos = Array.from(document.querySelectorAll(".project__gallery img"));

if (galleryPhotos.length) {
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "Photo viewer");
  lightbox.hidden = true;
  lightbox.innerHTML =
    '<button type="button" class="lightbox__btn lightbox__close" aria-label="Close photo">&times;</button>' +
    // The prev/next arrows use the same drawing as the scroll arrows on the home page.
    '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Previous photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg></button>' +
    '<img class="lightbox__image" alt="" />' +
    '<button type="button" class="lightbox__btn lightbox__next" aria-label="Next photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></button>';
  document.body.appendChild(lightbox);

  const lightboxImage = lightbox.querySelector(".lightbox__image");
  const closeButton = lightbox.querySelector(".lightbox__close");
  let currentIndex = 0;
  let lastFocused = null;

  function showPhoto(index) {
    currentIndex = (index + galleryPhotos.length) % galleryPhotos.length;
    const photo = galleryPhotos[currentIndex];
    lightboxImage.src = photo.currentSrc || photo.src;
    lightboxImage.alt = photo.alt;
  }

  function openLightbox(index) {
    lastFocused = document.activeElement;
    showPhoto(index);
    lightbox.hidden = false;
    document.body.style.overflow = "hidden"; // stop the page scrolling behind
    closeButton.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  galleryPhotos.forEach((photo, index) => {
    photo.classList.add("is-zoomable");
    photo.tabIndex = 0;
    photo.setAttribute("role", "button");
    photo.addEventListener("click", () => openLightbox(index));
    photo.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(index);
      }
    });
  });

  closeButton.addEventListener("click", closeLightbox);
  lightbox.querySelector(".lightbox__prev").addEventListener("click", () => showPhoto(currentIndex - 1));
  lightbox.querySelector(".lightbox__next").addEventListener("click", () => showPhoto(currentIndex + 1));

  // Clicking the dark area around the photo closes it.
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") showPhoto(currentIndex - 1);
    if (event.key === "ArrowRight") showPhoto(currentIndex + 1);
  });
}

/* -------------------------------------------------------------
   4. PHOTOGRAPHY GALLERY SLIDE  (repeats every time you scroll)
   Unlike the one-shot reveal above, the Work grid keeps sliding
   and fading in from the left every time it scrolls into view.
   It then stays put while you keep scrolling down into About —
   it only slides back out, to the right, if you scroll back up
   past it towards the top again.

   IMPORTANT: we don't watch the grid itself for this. Once it's
   slid off to the side, it's geometrically outside the viewport —
   so a browser checking "has this element scrolled into view"
   would never say yes, because it genuinely isn't there any more.
   Instead we watch an invisible marker left behind in the grid's
   normal (untransformed) position, and move the grid based on that.
   ------------------------------------------------------------- */
const galleryGrid = document.querySelector("#photography .grid");

if (galleryGrid && "IntersectionObserver" in window) {
  const gallerySentinel = document.createElement("div");
  gallerySentinel.setAttribute("aria-hidden", "true");
  galleryGrid.parentNode.insertBefore(gallerySentinel, galleryGrid);

  galleryGrid.classList.add("gallery-slide");
  let hasEnteredOnce = false;

  // Coming back from a project we may land with the gallery already on
  // screen (or scrolled past) — show it straight away instead of waiting
  // for a scroll that never happens. (Animations are off for a moment
  // while "restoring", so it simply appears.)
  if (
    document.documentElement.classList.contains("restoring") &&
    gallerySentinel.getBoundingClientRect().top < window.innerHeight * 0.45
  ) {
    galleryGrid.classList.add("in-view");
    hasEnteredOnce = true;
  }

  // Track which way the page is currently being scrolled, so we
  // can tell "scrolled further down past it" (stay visible) apart
  // from "scrolled back up past it" (slide out to the right).
  let lastScrollY = window.scrollY;
  let scrollDirection = "down";
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      scrollDirection = y < lastScrollY ? "up" : "down";
      lastScrollY = y;
    },
    { passive: true }
  );

  const galleryObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!galleryGrid.classList.contains("in-view")) {
            if (hasEnteredOnce) {
              // Snap straight back to the "hidden on the left" start
              // point with no transition (it's invisible right now
              // anyway), so the next animation always plays in from
              // the left — never a leftover slide from the right.
              galleryGrid.classList.add("no-transition");
              galleryGrid.classList.remove("exit-right", "in-view");
              void galleryGrid.offsetWidth; // flush the style change above
              galleryGrid.classList.remove("no-transition");
            }
            requestAnimationFrame(() => galleryGrid.classList.add("in-view"));
          }
          hasEnteredOnce = true;
        } else if (hasEnteredOnce && scrollDirection === "up") {
          galleryGrid.classList.remove("in-view");
          galleryGrid.classList.add("exit-right");
        }
      });
    },
    // The negative bottom margin shrinks the zone the browser treats
    // as "the screen" by over half, just for this check — so leaving
    // is detected while the gallery is still mostly on screen (you
    // can actually watch it slide out), not only once it's already
    // scrolled completely out of sight.
    { threshold: 0.15, rootMargin: "0px 0px -55% 0px" }
  );

  galleryObserver.observe(gallerySentinel);
}

/* -------------------------------------------------------------
   4. HERO PICTURE DISSOLVES AWAY (a wobbly, morphing edge)
   As you scroll down (or press the down arrow), the picture of you
   at the top of the home page dissolves from the bottom up through
   a wobbly, blob-like edge that keeps changing shape as it travels,
   until the picture is gone. Scroll back up and it re-forms the
   same way.

   How: the picture has a CSS "mask" (a stencil that hides part of
   it). We draw the stencil here with a <canvas>: opaque above a
   wavy line, see-through below it, built from a few sine waves of
   different sizes so it looks like organic blobs. Scrolling slides
   the stencil up the picture and sideways, so the wavy edge sweeps
   across and its outline keeps changing. Skipped for anyone with
   "Reduce Motion" turned on — they just see the picture as normal.
   ------------------------------------------------------------- */
const heroFigures = Array.from(document.querySelectorAll(".hero__figure, .hero__logo-wrap")); // the two pictures + the logo
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (heroFigures.length && !reduceMotion) {
  // --- draw the wobbly stencil once ---
  const maskW = 1024;
  const maskH = 2048; // stretched to 4x the picture's height by styles.css
  const waves = [ // [cycles across the width, height of the wobble in px, phase]
    [2, 110, 0.7],
    [3, 70, 2.1],
    [5, 40, 4.0],
    [7, 22, 1.3],
    [11, 10, 5.2],
  ];
  const wobbleMax = waves.reduce((sum, wave) => sum + wave[1], 0);
  const feather = 16; // how soft the edge is
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskW;
  maskCanvas.height = maskH;
  const maskCtx = maskCanvas.getContext("2d");
  const maskData = maskCtx.createImageData(maskW, maskH);
  for (let x = 0; x < maskW; x++) {
    let edge = maskH / 2;
    waves.forEach(([cycles, amp, phase]) => {
      edge += amp * Math.sin((2 * Math.PI * cycles * x) / maskW + phase);
    });
    for (let y = 0; y < maskH; y++) {
      const t = Math.min(Math.max((edge - y) / feather, 0), 1); // 1 above the line, 0 below
      maskData.data[(y * maskW + x) * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  maskCtx.putImageData(maskData, 0, 0);
  const maskUrl = `url(${maskCanvas.toDataURL("image/png")})`;
  // The stencil is only switched on while you're scrolling away from the top of the page.
  // At the very top there is nothing to hide, and a stencil on the spinning cube and the
  // moving pictures would make the browser redo a lot of work every frame.

  const wobbleInHeights = wobbleMax / (maskH / 4); // wobble size, in picture-heights
  // Share the stencil so the project collages (section 8) can use the same wobbly edge.
  window.__wobble = { url: maskUrl, heights: wobbleInHeights };

  const updateFade = () => {
    // Scroll needed to dissolve it fully. Kept short so the picture is gone
    // quickly, before its flat bottom edge has risen far enough to be seen.
    const fadeDistance = Math.max(window.innerHeight * 0.45, 220);
    const progress = Math.min(window.scrollY / fadeDistance, 1);
    heroFigures.forEach((figure, index) => {
      const stencil = progress > 0 ? maskUrl : "none";
      if (figure.style.maskImage !== stencil) {
        figure.style.webkitMaskImage = stencil;
        figure.style.maskImage = stencil;
      }
      const h = figure.offsetHeight;
      const w = figure.offsetWidth;
      // The stencil's wavy line sits in the middle of the stencil (2 picture-heights down).
      const startY = (1 + wobbleInHeights + 0.03 - 2) * h; // line below the picture: all visible
      const endY = (-wobbleInHeights - 0.03 - 2) * h; // line above the picture: all gone
      figure.style.setProperty("--mask-y", `${startY + (endY - startY) * progress}px`);
      // Sideways drift = morphing shape. The second picture starts part-way
      // along the stencil so the two dissolve through different blobs.
      figure.style.setProperty("--mask-x", `${w * Number(figure.dataset.maskIndex ?? index) * 0.8 - progress * w * 1.4}px`);
    });
  };

  updateFade();
  window.addEventListener("scroll", updateFade, { passive: true });
  window.addEventListener("resize", updateFade);
}

/* -------------------------------------------------------------
   5. COMING BACK FROM A PROJECT: KEEP THE HERO PICTURE HIDDEN
   index.html marks the page "returning" before anything is drawn.
   While you're down in the gallery the picture of you stays hidden;
   it comes back (fading in) once you scroll back up to the top.
   ------------------------------------------------------------- */
const rootElement = document.documentElement;
if (rootElement.classList.contains("returning")) {
  const showHeroAgain = () => {
    if (window.scrollY <= 20) {
      rootElement.classList.remove("returning");
      window.removeEventListener("scroll", showHeroAgain);
    }
  };
  window.addEventListener("scroll", showHeroAgain, { passive: true });
  showHeroAgain();
}

/* -------------------------------------------------------------
   6. RIPPLE ACROSS THE LOGO AND THE TWO PICTURES OF YOU
   A single slow pulse travels across the top of the home page —
   through the picture of you on the left and then the picture of you
   on the right (the logo in the middle is a spinning 3D logo now,
   see section 7) — then bounces and travels back, forever.

   How: each picture is copied onto its own <canvas> in thin vertical
   slices, and each slice is nudged up a little when the pulse is
   passing it. The pulse is one moving point on the screen, shared by
   all three, so it looks like one wave moving through them. (The
   pictures are anchored at the bottom, so they stretch upwards
   instead of floating off the ground.) The ordinary <img>s stay
   underneath as a fallback and for screen readers. Skipped entirely
   for anyone with "Reduce Motion" turned on — they just see the
   still pictures.
   ------------------------------------------------------------- */
const rippleLogoWrap = document.querySelector(".hero__logo-wrap");
const rippleLogoImage = rippleLogoWrap ? rippleLogoWrap.querySelector(".hero__logo") : null;

if (document.querySelector(".hero__figure") && !reduceMotion) {
  const tripSeconds = 4.5; // time for the pulse to cross the whole screen one way
  const startTime = performance.now();
  const slice = 4; // slice width in canvas pixels
  const dprNow = () => Math.min(window.devicePixelRatio || 1, 2);

  // Everything that ripples: { canvas, source image, how it sits, ... }
  const rippleItems = [];


  // --- the two pictures of you (each gets a twin canvas with the same look) ---
  document.querySelectorAll(".hero__figure").forEach((image, index) => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = image.className; // same position, flip and dissolve as the picture
    image.parentNode.insertBefore(canvas, image.nextSibling);
    // The dissolve stencil follows along on the twin too.
    canvas.style.webkitMaskImage = image.style.webkitMaskImage;
    canvas.style.maskImage = image.style.maskImage;
    canvas.dataset.maskIndex = String(heroFigures.indexOf(image));
    heroFigures.push(canvas);
    rippleItems.push({ kind: "figure", canvas, ctx: canvas.getContext("2d"), image, flipped: image.classList.contains("hero__figure--right"), pad: 0, amplitude: 0.035 });
  });

  let ready = false;

  const sizeCanvases = () => {
    const dpr = dprNow();
    rippleItems.forEach((item) => {
      if (item.kind === "logo") {
        item.canvas.width = Math.max(1, Math.round(item.wrap.clientWidth * dpr));
        item.canvas.height = Math.max(1, Math.round(item.wrap.clientHeight * dpr));
      } else {
        // A little extra room above the picture for the stretch.
        const w = item.image.offsetWidth;
        const h = item.image.offsetHeight;
        item.pad = Math.ceil(h * item.amplitude) + 2;
        item.canvas.style.width = w + "px";
        item.canvas.style.height = h + item.pad + "px";
        item.canvas.width = Math.max(1, Math.round(w * dpr));
        item.canvas.height = Math.max(1, Math.round((h + item.pad) * dpr));
      }
    });
  };

  const draw = (now) => {
    requestAnimationFrame(draw);
    if (!ready || window.scrollY > window.innerHeight * 1.2) return; // off-screen: don't waste effort

    // Keep each canvas matched to its picture's current size (layout can
    // settle a moment after the page loads, or change when the window resizes).
    const dprCheck = dprNow();
    const stale = rippleItems.some((item) => {
      const w = item.kind === "logo" ? item.wrap.clientWidth : item.image.offsetWidth;
      return w > 0 && Math.abs(item.canvas.width - Math.round(w * dprCheck)) > 1;
    });
    if (stale) sizeCanvases();

    const t = (now - startTime) / 1000;
    const vw = window.innerWidth;
    const pulseWidth = Math.min(Math.max(vw * 0.05, 50), 95); // how wide the bump is (screen px)
    // The pulse eases to a stop at each side, like a bounce.
    const swing = 0.5 - 0.5 * Math.cos((Math.PI * t) / tripSeconds); // 0 → 1 → 0 → 1 ...
    const centre = -pulseWidth * 2 + swing * (vw + pulseWidth * 4);
    const dpr = dprNow();

    rippleItems.forEach((item) => {
      const { canvas, ctx, image } = item;
      const W = canvas.width;
      const H = canvas.height;
      const rect = canvas.getBoundingClientRect();
      if (rect.right < 0 || rect.left > vw) return;
      ctx.clearRect(0, 0, W, H);
      const naturalW = image.naturalWidth;
      const naturalH = image.naturalHeight;
      if (!naturalW) return;

      let top, picH, lift;
      if (item.kind === "logo") {
        top = (H - image.clientHeight * dpr) / 2; // space above/below the logo
        picH = H - top * 2;
        lift = picH * item.amplitude;
      } else {
        picH = H - item.pad * dpr;
        top = item.pad * dpr;
        lift = picH * item.amplitude;
      }

      for (let x = 0; x < W; x += slice) {
        const frac = (x + slice / 2) / W;
        // Where this slice appears on the screen (the right-hand picture is flipped).
        const screenX = item.flipped ? rect.right - frac * rect.width : rect.left + frac * rect.width;
        const d = screenX - centre;
        const bump = Math.exp(-(d * d) / (2 * pulseWidth * pulseWidth));
        const dy = lift * bump;
        if (item.kind === "logo") {
          // The logo simply lifts.
          ctx.drawImage(image, (x / W) * naturalW, 0, (slice / W) * naturalW, naturalH, x, top - dy, slice, picH);
        } else {
          // The pictures stay planted at the bottom and stretch upwards.
          ctx.drawImage(image, (x / W) * naturalW, 0, (slice / W) * naturalW, naturalH, x, top - dy, slice, picH + dy);
        }
      }
    });
  };

  const start = () => {
    if (!ready && rippleItems.every((item) => item.image.complete && item.image.naturalWidth)) {
      sizeCanvases();
      ready = true;
      rippleItems.forEach((item) => { if (item.kind === "figure") item.image.classList.add("is-source-hidden"); });
    }
  };

  rippleItems.forEach((item) => {
    if (!(item.image.complete && item.image.naturalWidth)) item.image.addEventListener("load", start);
  });
  start();
  window.addEventListener("resize", sizeCanvases);
  requestAnimationFrame(draw);
}

/* -------------------------------------------------------------
   7. SPINNING 3D CUBE WITH A LOGO-SHAPED TUNNEL THROUGH IT
   The big logo in the middle of the home page is a square cube that
   slowly spins. The logo is cut clean through it, front to back and
   side to side, like a cookie cutter pushed through a block: the rest
   of the cube stays solid, and you can see right through the logo
   shape and out the other side.

   How: the cube is six flat faces (4 sides, top, bottom) built from
   plain <div>s, each turned and pushed out into 3D space with CSS
   ("rotateY" and "translateZ"). The four sides have the logo shape
   cut out of them with a CSS mask (a stencil). Every side is two thin
   skins back to back — a light outside and a dark inside. Opposite
   sides use the logo flipped left-to-right, because the far side is
   seen from behind, so the two holes line up when you look through.
   The walls of the tunnel are made from ~28 thin outlines of the logo
   stacked front to back along each direction (the "rings").

   The pulse (section 6) passes through it too: the wave runs through the
   cube's lines (the logo outlines inside the tunnel), lifting each one as it
   passes, the same wiggle as the pictures of you. Skipped for anyone with
   "Reduce Motion" turned on — they just see the flat, still logo.
   ------------------------------------------------------------- */
(() => {
  const wrap = document.querySelector(".hero__logo-wrap");
  const front = wrap ? wrap.querySelector(".hero__logo") : null;
  if (!wrap || !front || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const stage = document.createElement("div");
  stage.className = "logo-cube-stage";
  stage.setAttribute("aria-hidden", "true");

  const cube = document.createElement("div");
  cube.className = "logo-cube";

  // Every face is really two thin layers back to back: a light outer skin and,
  // just inside it, a dark inner skin facing inwards. Each is only visible from
  // its own side. `flipped` faces use the left-right mirrored logo shape.
  const addFace = (rotation, flipped, extraClass, turn = 0) => {
    const outer = document.createElement("div");
    outer.className = "logo-cube__face " + (extraClass || "") + (flipped ? " logo-cube__face--flip" : "");
    outer.style.transform = `${rotation} translateZ(calc(var(--cube) / 2))`;
    cube.appendChild(outer);

    // The inner skin is turned round, so its stencil needs the opposite flip to line up.
    const inner = document.createElement("div");
    inner.className = "logo-cube__face logo-cube__face--inner " + (extraClass || "") + (flipped ? "" : " logo-cube__face--flip");
    inner.style.transform = `${rotation} translateZ(calc(var(--cube) / 2 - 3px)) rotateY(180deg)`;
    cube.appendChild(inner);
  };
  // Four sides, each a quarter-turn further round. The far pair (180°, 270°) are flipped.
  addFace("rotateY(0deg)", false, "", 0);
  addFace("rotateY(90deg)", false, "", 90);
  addFace("rotateY(180deg)", true, "", 180);
  addFace("rotateY(270deg)", true, "", 270);
  // Top and bottom (plain, no cut-out), so the cube is solid.
  addFace("rotateX(90deg)", false, "logo-cube__face--cap");
  addFace("rotateX(-90deg)", false, "logo-cube__face--cap");

  // The tunnel walls: thin outlines of the logo, stacked along both horizontal directions.
  const RINGS = 20; // per direction — more lines, but each one costs the browser effort
  const rings = [];
  // Three ready-shaded versions of the outline (dark grey near the faces, black deep inside),
  // so no per-layer filters are needed — that keeps the page light.
  const ringSrcFor = (frac) => {
    const depth = Math.abs(frac) * 2; // 1 at the faces … 0 in the middle
    return depth > 0.66 ? "assets/logo-ring-1.png" : depth > 0.33 ? "assets/logo-ring-2.png" : "assets/logo-ring-3.png";
  };
  [0, 90].forEach((turn) => {
    for (let i = 0; i < RINGS; i++) {
      const ring = document.createElement("div");
      ring.className = "logo-cube__ring";
      const img = document.createElement("img");
      img.src = ringSrcFor((i + 0.5) / RINGS - 0.5);
      img.alt = "";
      ring.appendChild(img);
      cube.appendChild(ring);
      rings.push({ el: ring, turn, index: i, frac: (i + 0.5) / RINGS - 0.5 });
    }
  });
  stage.appendChild(cube);
  wrap.appendChild(stage);
  wrap.classList.add("is-3d");

  // Put each outline at its depth inside the cube (kept just inside the faces).
  // `lift` is how far the wave is currently raising it (px).
  const placeRings = (liftFor) => {
    rings.forEach((r, i) => {
      const lift = liftFor ? liftFor(r) : 0;
      r.el.style.transform = `rotateY(${r.turn}deg) translateZ(calc(var(--cube) * ${(r.frac * 0.97).toFixed(4)})) translateY(${(-lift).toFixed(2)}px)`;
    });
  };
  placeRings(null);

  // --- the wave, following the same clock and shape as section 6 ---
  // The whole cube rises and tilts as the wave passes it, and the wave also runs through its lines (the logo outlines inside the
  // tunnel): each line is lifted according to where it is on the screen right
  // now, so as the pulse sweeps across, the lines swell and settle one after
  // another — the same wiggle as the pictures of you.
  const tripSeconds = 4.5;
  const pulseClock = window.__pulseStart || performance.now();
  const spin = cube.getAnimations ? cube.getAnimations()[0] : null;
  const SPIN_MS = 12000;
  const tick = (now) => {
    requestAnimationFrame(tick);
    // Scrolled past the top of the page: pause the spin and the wave (saves effort).
    const away = window.scrollY > window.innerHeight * 1.2;
    wrap.classList.toggle("is-paused", away);
    if (away) return;
    const t = (now - pulseClock) / 1000;
    const vw = window.innerWidth;
    const pulseWidth = Math.min(Math.max(vw * 0.05, 50), 95);
    const swing = 0.5 - 0.5 * Math.cos((Math.PI * t) / tripSeconds);
    const centre = -pulseWidth * 2 + swing * (vw + pulseWidth * 4);
    const rect = wrap.getBoundingClientRect();
    const middle = rect.left + rect.width / 2;
    const cubePx = rect.width * 0.58; // the cube's side length in px
    const lift = rect.width * 0.022; // how far the wave lifts a line (px)
    // The whole cube rides the wave: it rises as the wave reaches it and tilts along
    // the slope of the wave (the side the wave has reached is higher), then settles.
    // The lines inside add their own wiggle on top.
    const cubeHalf = rect.width * 0.29; // half the cube's width
    const cubeLift = rect.width * 0.035;
    const waveAt = (x) => cubeLift * Math.exp(-((x - centre) * (x - centre)) / (2 * pulseWidth * pulseWidth * 1.96));
    const tilt = (Math.atan2(-(waveAt(middle + cubeHalf) - waveAt(middle - cubeHalf)), cubeHalf * 2) * 180) / Math.PI;
    stage.style.transform = `translateY(${(-waveAt(middle)).toFixed(2)}px) rotateZ(${(-tilt * 0.8).toFixed(3)}deg)`;
    // Where the cube is in its spin right now.
    const angle = spin && spin.currentTime != null ? (((spin.currentTime % SPIN_MS) / SPIN_MS) * 2 * Math.PI) : 0;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    placeRings((r) => {
      // Position of this line's middle in the cube (px), turned by the spin, then
      // shrunk/grown by the perspective, gives where it appears across the screen.
      const depth = r.frac * 0.97 * cubePx;
      const worldX = r.turn === 0 ? depth * sin : depth * cos;
      const worldZ = r.turn === 0 ? depth * cos : -depth * sin;
      const screenX = middle + worldX * (1600 / (1600 - worldZ));
      const d = screenX - centre;
      return lift * Math.exp(-(d * d) / (2 * pulseWidth * pulseWidth));
    });
  };
  requestAnimationFrame(tick);})();

/* -------------------------------------------------------------
   8. HOVER A PROJECT: QUICK PHOTO COLLAGE
   When you hover over a project card on the home page, all of that
   project's photos flick down onto the card one after another over
   about 2 seconds — each at a random spot with a slight tilt, piling
   up into a quick collage. Move the mouse away and it clears.

   How: the project's photo count is listed below (photoCounts). For
   each photo we make a small <img> from the project's "thumbs" folder
   (small versions of the photos, so this stays quick), and drop them
   in on a timer. CSS in styles.css animates each one landing.
   Only runs where there's a real mouse (not on touch screens), and
   not for anyone with "Reduce Motion" turned on.
   ------------------------------------------------------------- */
(() => {
  const photoCounts = { 1: 19, 2: 18, 3: 20, 4: 20, 5: 20, 6: 20 }; // project number → how many photos
  const canHover = window.matchMedia("(hover: hover)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canHover || reduce) return;

  const TOTAL_MS = 2000; // time to lay down every photo
  const HOLD_MS = 1000; // how long the finished collage stays up before it closes by itself
  const WIPE_MS = 1200; // how long the wobbly dissolve takes to wipe the collage in or out

  document.querySelectorAll(".card").forEach((card) => {
    const match = (card.getAttribute("href") || "").match(/project-(\d+)\.html/);
    const count = match ? photoCounts[match[1]] : 0;
    if (!count) return;
    const folder = `assets/project-${match[1]}/thumbs/`;

    let collage = null;
    let timers = [];
    let hasPlayed = false; // true once it has played through, until the mouse leaves the card

    // Wipe the collage in or out through the same wobbly, blob-edged stencil the
    // pictures of you dissolve with. `show` true = reveal it, false = dissolve it away.
    const wipe = (el, show, ms, done) => {
      const wobble = window.__wobble;
      if (!wobble || !el.animate) { if (done) done(); return; }
      el.style.webkitMaskImage = wobble.url;
      el.style.maskImage = wobble.url;
      const h = el.offsetHeight;
      const w = el.offsetWidth;
      const visibleY = (1 + wobble.heights + 0.03 - 2) * h; // the edge sits below: all shown
      const goneY = (-wobble.heights - 0.03 - 2) * h; // the edge sits above: all hidden
      const from = show ? goneY : visibleY;
      const to = show ? visibleY : goneY;
      const x = (p) => (show ? (1 - p) : p) * -w * 1.4; // sideways drift = morphing blob shape
      const frames = [
        { maskPosition: `${x(0)}px ${from}px`, webkitMaskPosition: `${x(0)}px ${from}px` },
        { maskPosition: `${x(1)}px ${to}px`, webkitMaskPosition: `${x(1)}px ${to}px` },
      ];
      const animation = el.animate(frames, { duration: ms, easing: "ease-in-out", fill: "forwards" });
      animation.onfinish = () => {
        if (show) { el.style.webkitMaskImage = "none"; el.style.maskImage = "none"; } // fully shown: no stencil needed
        if (done) done();
      };
    };

    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
      if (collage) {
        const old = collage;
        collage = null;
        wipe(old, false, WIPE_MS, () => old.remove());
      }
    };

    const start = () => {
      if (hasPlayed) return; // already played this visit: move off and back on to see it again
      clear();
      collage = document.createElement("div");
      collage.className = "card__collage";
      collage.setAttribute("aria-hidden", "true");
      card.appendChild(collage);
      wipe(collage, true, WIPE_MS);

      // Shuffle so the order is different every time.
      const order = Array.from({ length: count }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      order.forEach((number, step) => {
        const img = new Image();
        img.className = "card__collage-photo";
        img.alt = "";
        img.src = folder + String(number).padStart(2, "0") + ".jpg";
        img.style.left = (Math.random() * 56).toFixed(1) + "%";
        img.style.top = (Math.random() * 52).toFixed(1) + "%";
        img.style.setProperty("--tilt", ((Math.random() - 0.5) * 26).toFixed(1) + "deg");
        img.style.setProperty("--sway-delay", (0.6 + Math.random() * 0.8).toFixed(2) + "s"); // so they don't all sway in step
        timers.push(setTimeout(() => {
          if (!collage) return;
          collage.appendChild(img);
          requestAnimationFrame(() => img.classList.add("is-down"));
        }, (TOTAL_MS / count) * step));
      });
      // Once every photo is down and it has been on show for a moment, close it by itself,
      // even if the mouse is still on the card.
      timers.push(setTimeout(() => {
        hasPlayed = true;
        clear();
      }, TOTAL_MS + 400 + HOLD_MS));
    };
    card.addEventListener("mouseenter", start);
    card.addEventListener("mouseleave", () => {
      hasPlayed = false; // leaving the card resets it, so the next hover plays again
      clear();
    });
    card.addEventListener("blur", clear);
  });
})();