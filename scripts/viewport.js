/* Software 3D renderer for the product preview and the gallery thumbnails.
   Draws depth-cued wireframes on a 2D canvas: no WebGL context, no library,
   ~4 KB, and it degrades to a single static frame when motion is reduced. */
(function () {
  "use strict";

  var TAU = Math.PI * 2;

  function icosahedron() {
    var t = (1 + Math.sqrt(5)) / 2;
    var v = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ];
    var f = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];
    var verts = [];
    var edges = {};
    v.forEach(function (p) {
      var l = Math.hypot(p[0], p[1], p[2]);
      verts.push([p[0] / l, p[1] / l, p[2] / l]);
    });
    f.forEach(function (tri) {
      [[0, 1], [1, 2], [2, 0]].forEach(function (pair) {
        var a = tri[pair[0]];
        var b = tri[pair[1]];
        var k = Math.min(a, b) + ":" + Math.max(a, b);
        edges[k] = [a, b];
      });
    });
    return { verts: verts, edges: Object.keys(edges).map(function (k) { return edges[k]; }) };
  }

  function torus(majorSeg, minorSeg) {
    var verts = [];
    var edges = [];
    var R = 1;
    var r = 0.34;
    for (var i = 0; i < majorSeg; i++) {
      for (var j = 0; j < minorSeg; j++) {
        var u = (i / majorSeg) * TAU;
        var w = (j / minorSeg) * TAU;
        var x = (R + r * Math.cos(w)) * Math.cos(u);
        var y = r * Math.sin(w);
        var z = (R + r * Math.cos(w)) * Math.sin(u);
        verts.push([x, y, z]);
        var idx = i * minorSeg + j;
        var right = i * minorSeg + ((j + 1) % minorSeg);
        var down = ((i + 1) % majorSeg) * minorSeg + j;
        edges.push([idx, right], [idx, down]);
      }
    }
    return { verts: verts, edges: edges };
  }

  function lattice() {
    var verts = [];
    var edges = [];
    var n = 3;
    var step = 0.62;
    var off = ((n - 1) * step) / 2;
    var idx = function (a, b, c) { return (a * n + b) * n + c; };
    for (var a = 0; a < n; a++) {
      for (var b = 0; b < n; b++) {
        for (var c = 0; c < n; c++) {
          verts.push([a * step - off, b * step - off, c * step - off]);
          if (a < n - 1) edges.push([idx(a, b, c), idx(a + 1, b, c)]);
          if (b < n - 1) edges.push([idx(a, b, c), idx(a, b + 1, c)]);
          if (c < n - 1) edges.push([idx(a, b, c), idx(a, b, c + 1)]);
        }
      }
    }
    return { verts: verts, edges: edges };
  }

  function helix() {
    var verts = [];
    var edges = [];
    var turns = 3;
    var count = 72;
    for (var i = 0; i < count; i++) {
      var t = i / count;
      var a = t * TAU * turns;
      var rad = 0.55 + 0.28 * Math.sin(t * Math.PI);
      verts.push([Math.cos(a) * rad, t * 2.2 - 1.1, Math.sin(a) * rad]);
      if (i > 0) edges.push([i - 1, i]);
    }
    return { verts: verts, edges: edges };
  }

  var SHAPES = {
    geodesic: icosahedron,
    torus: function () { return torus(20, 10); },
    lattice: lattice,
    helix: helix,
  };

  function styles() {
    var cs = getComputedStyle(document.documentElement);
    return {
      ink: cs.getPropertyValue("--ink-900").trim() || "#0d1216",
      faint: cs.getPropertyValue("--ink-400").trim() || "#7a858c",
      accent: cs.getPropertyValue("--accent").trim() || "#c4350b",
    };
  }

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var mesh = (SHAPES[opts.shape] || icosahedron)();
    var state = {
      rx: opts.rx != null ? opts.rx : -0.5,
      ry: opts.ry != null ? opts.ry : 0.6,
      auto: !!opts.autoRotate,
      running: false,
      paused: false,
      scale: opts.scale || 1,
      tx: 0,
      ty: 0,
      tz: 0,
      rz: 0,
      fps: 0,
      dragging: false,
      lastX: 0,
      lastY: 0,
      raf: 0,
      last: 0,
    };

    var w = 0;
    var h = 0;
    var dpr = 1;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(p) {
      var x0 = p[0] * state.scale + state.tx;
      var y0 = p[1] * state.scale + state.ty;
      var z0 = p[2] * state.scale + state.tz;

      var cz = Math.cos(state.rz), sz = Math.sin(state.rz);
      var xr = x0 * cz - y0 * sz;
      var yr = x0 * sz + y0 * cz;

      var cy = Math.cos(state.ry), sy = Math.sin(state.ry);
      var x1 = xr * cy + z0 * sy;
      var z1 = -xr * sy + z0 * cy;
      var cx = Math.cos(state.rx), sx = Math.sin(state.rx);
      var y1 = yr * cx - z1 * sx;
      var z2 = yr * sx + z1 * cx;
      var dist = 3.4;
      var f = (Math.min(w, h) * 0.34 * state.scale) / (dist - z2);
      return {
        x: w / 2 + x1 * f,
        y: h / 2 - y1 * f,
        z: z2,
      };
    }

    function draw() {
      if (!w || !h) resize();
      if (!w || !h) return;
      var s = styles();
      ctx.clearRect(0, 0, w, h);
      var pts = mesh.verts.map(project);

      ctx.lineCap = "round";
      for (var i = 0; i < mesh.edges.length; i++) {
        var a = pts[mesh.edges[i][0]];
        var b = pts[mesh.edges[i][1]];
        var depth = (a.z + b.z) / 2;
        var t = Math.max(0, Math.min(1, (depth + 1.2) / 2.4));
        ctx.globalAlpha = 0.14 + t * 0.62;
        ctx.strokeStyle = t > 0.62 ? s.ink : s.faint;
        ctx.lineWidth = t > 0.62 ? 1.15 : 0.85;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      var dots = Math.min(mesh.verts.length, 42);
      ctx.fillStyle = s.accent;
      for (var j = 0; j < dots; j++) {
        var p = pts[j];
        if (p.z < 0.4) continue;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (!state.running) return;
      var dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 0.016;
      state.last = now;
      if (state.auto && !state.paused && !state.dragging && !reduceMotion()) {
        state.ry += dt * 0.32;
      }
      var instant = dt > 0 ? 1 / dt : 0;
      state.fps = state.fps ? state.fps * 0.9 + instant * 0.1 : instant;
      draw();
      state.raf = requestAnimationFrame(frame);
    }

    function reduceMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function start() {
      if (state.running) return;
      state.running = true;
      state.last = 0;
      state.raf = requestAnimationFrame(frame);
    }

    function stop() {
      state.running = false;
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
    }

    resize();
    draw();

    var ro = typeof ResizeObserver === "function" ? new ResizeObserver(function () {
      resize();
      if (!state.running) draw();
    }) : null;
    if (ro) ro.observe(canvas);
    else window.addEventListener("resize", resize);

    var io = typeof IntersectionObserver === "function" ? new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      if (vis && !reduceMotion()) start();
      else {
        stop();
        draw();
      }
    }, { rootMargin: "120px" }) : null;
    if (io) io.observe(canvas);
    else if (!reduceMotion()) start();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else if (!reduceMotion()) start();
    });

    var api = {
      state: state,
      draw: draw,
      setAuto: function (on) {
        state.auto = !!on;
      },
      isAuto: function () {
        return state.auto;
      },
      setTransform: function (key, value) {
        if (key === "rx" || key === "ry" || key === "rz") {
          state[key] = (value * Math.PI) / 180;
        } else if (typeof state[key] === "number") {
          state[key] = value;
        }
        draw();
      },
      reset: function () {
        state.rx = opts.rx != null ? opts.rx : -0.5;
        state.ry = opts.ry != null ? opts.ry : 0.6;
        draw();
      },
      nudge: function (dx, dy) {
        state.ry += dx;
        state.rx += dy;
        draw();
      },
      angles: function () {
        return { rx: state.rx, ry: state.ry };
      },
    };

    if (opts.interactive) {
      canvas.addEventListener("pointerdown", function (e) {
        state.dragging = true;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener("pointermove", function (e) {
        if (!state.dragging) return;
        state.ry += (e.clientX - state.lastX) * 0.008;
        state.rx += (e.clientY - state.lastY) * 0.008;
        state.rx = Math.max(-1.4, Math.min(1.4, state.rx));
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        draw();
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (evt) {
        canvas.addEventListener(evt, function () {
          state.dragging = false;
        });
      });
    }

    return api;
  }

  window.PFViewport = { create: create };
})();
