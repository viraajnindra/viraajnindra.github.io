/* ==========================================================================
   Viraaj Nindra — Summit to Base Camp
   main.js — scroll-driven frame scrub, skills reveal, passions, sparks, elevation
   ========================================================================== */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    if (!prefersReducedMotion) {
      initFrameScrub();
    } else {
      // Static fallback already shown via CSS (.reduced-motion-hero)
    }

    initScrollTriggers();
    initTrailReveal();
    initCairnsReveal();
    initSkillWords();
    initPassions();
    initCampfireSparks();
    initElevationMeter();
  });

  /* ------------------------------------------------------------------------
     Section 1: Frame-sequence video scrub on canvas
     ------------------------------------------------------------------------ */

  var FRAME_COUNT = 254;
  var FRAME_PATH = function (i) {
    return 'frames/frame-' + String(i).padStart(3, '0') + '.webp';
  };

  function initFrameScrub() {
    var canvas = document.getElementById('scrubCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var frames = new Array(FRAME_COUNT + 1); // 1-indexed
    var loadedFlags = new Array(FRAME_COUNT + 1).fill(false);
    var currentFrameIndex = 1;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawFrame(currentFrameIndex);
    }

    // Draw an image onto the canvas with "cover" scaling (fill + center-crop)
    function drawCover(img) {
      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      var scale = Math.max(cw / iw, ch / ih);
      var dw = iw * scale, dh = ih * scale;
      var dx = (cw - dw) / 2, dy = (ch - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    function nearestLoadedIndex(target) {
      if (loadedFlags[target]) return target;
      for (var offset = 1; offset < FRAME_COUNT; offset++) {
        var lo = target - offset, hi = target + offset;
        if (lo >= 1 && loadedFlags[lo]) return lo;
        if (hi <= FRAME_COUNT && loadedFlags[hi]) return hi;
      }
      return null;
    }

    function drawFrame(index) {
      currentFrameIndex = index;
      var useIndex = loadedFlags[index] ? index : nearestLoadedIndex(index);
      if (useIndex === null) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCover(frames[useIndex]);
    }

    // Immediate first paint: poster or frame-001
    var firstImg = new Image();
    firstImg.src = 'assets/poster.webp';
    firstImg.onload = function () {
      frames[1] = firstImg;
      loadedFlags[1] = true;
      resizeCanvas();
    };
    firstImg.onerror = function () {
      loadFrame(1, function () { resizeCanvas(); });
    };

    function loadFrame(i, cb) {
      if (loadedFlags[i]) { if (cb) cb(); return; }
      var img = new Image();
      img.onload = function () {
        var done = function () {
          frames[i] = img;
          loadedFlags[i] = true;
          if (cb) cb();
        };
        if (img.decode) {
          img.decode().then(done).catch(done);
        } else {
          done();
        }
      };
      img.onerror = function () { if (cb) cb(); };
      img.src = FRAME_PATH(i);
    }

    // Progressive async preload of remaining frames after first paint
    function preloadRemaining() {
      var i = 2;
      function next() {
        if (i > FRAME_COUNT) return;
        var batchEnd = Math.min(i + 3, FRAME_COUNT + 1);
        var pending = batchEnd - i;
        for (var j = i; j < batchEnd; j++) {
          (function (idx) {
            loadFrame(idx, function () {
              pending--;
              if (pending === 0) {
                i = batchEnd;
                if ('requestIdleCallback' in window) {
                  requestIdleCallback(next, { timeout: 200 });
                } else {
                  setTimeout(next, 16);
                }
              }
            });
          })(j);
        }
      }
      next();
    }

    window.addEventListener('load', function () {
      setTimeout(preloadRemaining, 50);
    });

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ScrollTrigger: pin canvas for 400vh, scrub frame index across progress
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);

      var overlay = document.getElementById('summitOverlay');
      var scrollHint = document.getElementById('scrollHint');
      var shade = document.getElementById('summitShade');

      ScrollTrigger.create({
        trigger: '.summit-section',
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: function (self) {
          var progress = self.progress;
          var frameIndex = Math.max(1, Math.min(FRAME_COUNT, Math.round(progress * (FRAME_COUNT - 1)) + 1));
          drawFrame(frameIndex);

          // Title + "climb down with me" fade in during the final ~10% of the
          // scrub and stay visible; they leave the screen with the pin release
          var fadeInStart = 0.82;
          var fadeInEnd = 0.92;
          var opacity = 0;
          if (progress >= fadeInStart && progress < fadeInEnd) {
            opacity = (progress - fadeInStart) / (fadeInEnd - fadeInStart);
          } else if (progress >= fadeInEnd) {
            opacity = 1;
          }
          if (overlay) overlay.style.opacity = Math.max(0, Math.min(1, opacity));

          // Descent shade eases in over the last third of the scrub so the
          // frame's lower rocks are fully sunk into #101320 by pin release,
          // matching the top of the blend section below
          if (shade) {
            var shadeStart = 0.6;
            var shadeEnd = 0.92;
            var shadeOpacity = (progress - shadeStart) / (shadeEnd - shadeStart);
            shade.style.opacity = Math.max(0, Math.min(1, shadeOpacity));
          }

          // Scroll hint fades out once scrub progress exceeds ~8%
          // (visibility too — its CSS keyframe animation overrides inline opacity)
          if (scrollHint) {
            var hintFadeLimit = 0.08;
            scrollHint.style.opacity = progress >= hintFadeLimit ? 0 : 1 - (progress / hintFadeLimit);
            scrollHint.style.visibility = progress >= hintFadeLimit ? 'hidden' : 'visible';
          }
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
     GSAP ScrollTriggers: parallax rock layers, trail path draw
     ------------------------------------------------------------------------ */

  function initScrollTriggers() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    // Subtle parallax on decorative rock layers
    var rockLayers = document.querySelectorAll('.rock-layer');
    rockLayers.forEach(function (layer, i) {
      gsap.to(layer, {
        y: (i % 2 === 0 ? -40 : 40),
        ease: 'none',
        scrollTrigger: {
          trigger: layer.closest('section'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });

    // Trail path draws itself on scroll (stroke-dashoffset scrub)
    var trailPath = document.getElementById('trailPath');
    if (trailPath && !prefersReducedMotion) {
      var length = trailPath.getTotalLength();
      trailPath.style.strokeDasharray = length;
      trailPath.style.strokeDashoffset = length;

      gsap.to(trailPath, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '.trail-section',
          start: 'top 70%',
          end: 'bottom bottom',
          scrub: true
        }
      });
    }

  }

  /* ------------------------------------------------------------------------
     Section 4: Role cards fade + slide in on scroll, alternating left/right
     ------------------------------------------------------------------------ */

  function initTrailReveal() {
    var roles = document.querySelectorAll('.trail-role');
    if (!roles.length) return;

    if (prefersReducedMotion) {
      roles.forEach(function (r) { r.style.opacity = 1; r.style.transform = 'none'; });
      return;
    }

    if (window.gsap && window.ScrollTrigger) {
      roles.forEach(function (role) {
        var fromX = role.classList.contains('trail-role--left') ? -40 : 40;
        gsap.fromTo(role,
          { opacity: 0, x: fromX, y: 40 },
          {
            opacity: 1, x: 0, y: 0,
            duration: 0.9,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: role,
              start: 'top 85%',
              toggleActions: 'play none none reverse'
            }
          }
        );
      });
    } else {
      // Fallback: IntersectionObserver
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = 1;
            entry.target.style.transform = 'none';
            entry.target.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
          }
        });
      }, { threshold: 0.2 });
      roles.forEach(function (r) { io.observe(r); });
    }
  }

  /* ------------------------------------------------------------------------
     Section 4.5: Cairn stones stack up (bottom stone first), then card fades in.
     CSS keeps everything visible by default, so no-GSAP / reduced-motion needs
     no fallback here.
     ------------------------------------------------------------------------ */

  function initCairnsReveal() {
    var cairns = document.querySelectorAll('.cairn');
    if (!cairns.length) return;
    if (prefersReducedMotion || !window.gsap || !window.ScrollTrigger) return;

    gsap.registerPlugin(ScrollTrigger);
    cairns.forEach(function (cairn) {
      var stones = cairn.querySelectorAll('.cairn-stone, .cairn-spark');
      var card = cairn.querySelector('.cairn-card');

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: cairn,
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        }
      });

      tl.fromTo(stones,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out' }
      );

      if (card) {
        tl.fromTo(card,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' },
          '-=0.25'
        );
      }
    });
  }

  /* ------------------------------------------------------------------------
     Section 5: Skill words fade up out of the rock as they scroll into view
     ------------------------------------------------------------------------ */

  function initSkillWords() {
    var words = document.querySelectorAll('.skill-word');
    if (!words.length) return;
    if (prefersReducedMotion || !window.gsap || !window.ScrollTrigger) return;

    gsap.registerPlugin(ScrollTrigger);
    words.forEach(function (word, i) {
      gsap.from(word, {
        opacity: 0,
        y: 24,
        duration: 1.1,
        delay: (i % 4) * 0.12,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: word,
          start: 'top 88%',
          toggleActions: 'play none none reverse'
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     Section 6: Passion paintings — tap toggles the carved inscription
     (hover reveal is pure CSS on devices that support hover)
     ------------------------------------------------------------------------ */

  function initPassions() {
    var passions = document.querySelectorAll('.passion');
    if (!passions.length) return;

    function close(p) {
      p.classList.remove('is-open');
      p.setAttribute('aria-expanded', 'false');
    }

    passions.forEach(function (p) {
      p.addEventListener('click', function () {
        var wasOpen = p.classList.contains('is-open');
        passions.forEach(close);
        if (!wasOpen) {
          p.classList.add('is-open');
          p.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.passion')) passions.forEach(close);
    });
  }

  /* ------------------------------------------------------------------------
     Section 7: Campfire rising spark particles
     ------------------------------------------------------------------------ */

  function initCampfireSparks() {
    var container = document.getElementById('sparks');
    if (!container) return;

    var svgNS = 'http://www.w3.org/2000/svg';
    var maxSparks = 12;
    var sparks = [];

    function spawnSpark() {
      if (document.hidden) return;
      var circle = document.createElementNS(svgNS, 'circle');
      var startX = 70 + Math.random() * 20;
      circle.setAttribute('cx', startX);
      circle.setAttribute('cy', 110);
      circle.setAttribute('r', 1 + Math.random() * 1.5);
      circle.setAttribute('class', 'spark');
      container.appendChild(circle);

      var data = {
        el: circle,
        x: startX,
        y: 110,
        vy: -0.4 - Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 0.4,
        life: 0,
        maxLife: 60 + Math.random() * 40
      };
      sparks.push(data);
      if (sparks.length > maxSparks) {
        var old = sparks.shift();
        if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
      }
    }

    var frame = 0;
    function tick() {
      frame++;
      if (frame % 20 === 0) spawnSpark();

      for (var i = sparks.length - 1; i >= 0; i--) {
        var s = sparks[i];
        s.life++;
        s.x += s.vx;
        s.y += s.vy;
        s.el.setAttribute('cx', s.x);
        s.el.setAttribute('cy', s.y);
        var lifeRatio = s.life / s.maxLife;
        s.el.setAttribute('opacity', Math.max(0, 1 - lifeRatio));
        if (s.life >= s.maxLife) {
          if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
          sparks.splice(i, 1);
        }
      }
      requestAnimationFrame(tick);
    }

    // Only animate when base camp section is near viewport
    var basecamp = document.getElementById('basecamp');
    var running = false;
    if ('IntersectionObserver' in window && basecamp) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !running) {
            running = true;
            requestAnimationFrame(tick);
          }
        });
      }, { threshold: 0.05 });
      io.observe(basecamp);
    } else {
      requestAnimationFrame(tick);
    }
  }

  /* ------------------------------------------------------------------------
     Elevation meter: 8,848m -> 0m mapped to total scroll progress
     ------------------------------------------------------------------------ */

  function initElevationMeter() {
    var marker = document.getElementById('elevationMarker');
    var readout = document.getElementById('elevationReadout');
    if (!marker || !readout) return;

    var SUMMIT_M = 8848;

    function update() {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0;
      var elevation = Math.round(SUMMIT_M * (1 - progress));

      marker.style.top = (progress * 100) + '%';
      readout.textContent = elevation.toLocaleString('en-US') + 'm';
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

})();
