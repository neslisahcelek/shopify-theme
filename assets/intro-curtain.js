/**
 * Style Vibeus — Interactive 3D WebGL Boutique Walkthrough
 * -------------------------------------------------------------
 * - Phase 1 (~2.35s): Glass doors slide open & camera walks into store
 * - Phase 2 (Interactive): User stays inside and can freely walk
 *   forward/back (wheel, touch swipe, W/S/Arrows) and look around
 *   left/right (drag, touch pan, A/D/Arrows)
 * - Always-available exit: "Siteye Geç ✕", "Alışverişe Başla →", Esc
 * - Session storage guard ('sv_curtain_seen')
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'sv_curtain_seen';
  var ENTRANCE_DURATION_MS = 2350;
  var FADE_OUT_MS = 380;

  function hasSeenCurtain() {
    try {
      return window.sessionStorage && window.sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markCurtainSeen() {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEY, '1');
      }
    } catch (e) {}
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function createBrandSignTexture(titleText, subText, bgHex, textHex, accentHex) {
    var c = document.createElement('canvas');
    c.width = 1024;
    c.height = 384;
    var ctx = c.getContext('2d');

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, c.width - 48, c.height - 48);

    ctx.fillStyle = textHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 84px "Syne", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(titleText, c.width / 2, c.height / 2 - (subText ? 26 : 0));

    if (subText) {
      ctx.fillStyle = accentHex;
      ctx.font = '600 26px "Manrope", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(subText, c.width / 2, c.height / 2 + 54);
    }

    var tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function initWalkthrough() {
    var curtain = document.getElementById('sv-curtain-intro');
    if (!curtain) return;

    var canvas = document.getElementById('sv-3d-walkthrough-canvas');
    var skipBtn = document.getElementById('sv-curtain-skip');
    var enterShopBtn = document.getElementById('sv-curtain-enter-shop');
    var enteringPill = document.getElementById('sv-curtain-entering');
    var exploreBar = document.getElementById('sv-curtain-explore');

    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (hasSeenCurtain() || prefersReduced || typeof THREE === 'undefined' || !canvas) {
      document.documentElement.classList.add('sv-curtain-dismissed');
      curtain.classList.add('sv-curtain-done');
      curtain.setAttribute('aria-hidden', 'true');
      curtain.style.display = 'none';
      return;
    }

    markCurtainSeen();
    document.body.classList.add('sv-curtain-locked');

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      curtain.classList.add('sv-curtain-done');
      curtain.style.display = 'none';
      document.body.classList.remove('sv-curtain-locked');
      return;
    }

    var width = window.innerWidth || 1440;
    var height = window.innerHeight || 900;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
    }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6eee5);
    scene.fog = new THREE.Fog(0xf6eee5, 11, 34);

    var isMobile = width < 768;
    var camera = new THREE.PerspectiveCamera(isMobile ? 64 : 52, width / height, 0.1, 60);
    camera.position.set(0, 1.68, 13.8);

    // --- Lighting ---
    scene.add(new THREE.HemisphereLight(0xfffaf2, 0xd8cbb8, 0.92));

    var dirLight = new THREE.DirectionalLight(0xfff5e6, 0.75);
    dirLight.position.set(2, 8, 10);
    scene.add(dirLight);

    var aisleLight1 = new THREE.PointLight(0xffe9c8, 1.3, 14);
    aisleLight1.position.set(0, 3.6, 5.0);
    scene.add(aisleLight1);

    var aisleLight2 = new THREE.PointLight(0xffe9c8, 1.4, 15);
    aisleLight2.position.set(0, 3.6, -2.5);
    scene.add(aisleLight2);

    var focalLight = new THREE.PointLight(0xfff2dc, 1.8, 12);
    focalLight.position.set(0, 3.8, -6.5);
    scene.add(focalLight);

    // --- Materials ---
    var travertineMat = new THREE.MeshStandardMaterial({ color: 0xede4d8, roughness: 0.28, metalness: 0.04 });
    var wallMat = new THREE.MeshStandardMaterial({ color: 0xf6eee5, roughness: 0.82, metalness: 0.02 });
    var pillarMat = new THREE.MeshStandardMaterial({ color: 0xe6dccf, roughness: 0.65, metalness: 0.04 });
    var darkBronzeMat = new THREE.MeshStandardMaterial({ color: 0x161413, roughness: 0.35, metalness: 0.75 });
    var brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.88 });
    var ledMat = new THREE.MeshBasicMaterial({ color: 0xfff8ed });
    var glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1817,
      transparent: true,
      opacity: 0.36,
      roughness: 0.08,
      metalness: 0.15,
    });

    // --- 1. Floor & Brass Aisle Inlays ---
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 36), travertineMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 2);
    scene.add(floor);

    var inlayGeo = new THREE.BoxGeometry(0.035, 0.005, 24);
    var inlayLeft = new THREE.Mesh(inlayGeo, brassMat);
    inlayLeft.position.set(-1.55, 0.003, 1.5);
    scene.add(inlayLeft);

    var inlayRight = new THREE.Mesh(inlayGeo, brassMat);
    inlayRight.position.set(1.55, 0.003, 1.5);
    scene.add(inlayRight);

    // --- 2. Walls, Ceiling & Linear Ceiling LEDs ---
    var ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 36), wallMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 4.4, 2);
    scene.add(ceiling);

    var leftWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 4.6), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-5.2, 2.2, 2);
    scene.add(leftWall);

    var rightWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 4.6), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(5.2, 2.2, 2);
    scene.add(rightWall);

    var ledGeo = new THREE.BoxGeometry(0.08, 0.03, 22);
    var ledLeft = new THREE.Mesh(ledGeo, ledMat);
    ledLeft.position.set(-1.6, 4.38, 1.5);
    scene.add(ledLeft);

    var ledRight = new THREE.Mesh(ledGeo, ledMat);
    ledRight.position.set(1.6, 4.38, 1.5);
    scene.add(ledRight);

    // --- 3. Entrance Portal & Sliding Glass Doors (z = 9.5) ---
    var portalZ = 9.5;
    var pillarPortalGeo = new THREE.BoxGeometry(1.8, 4.5, 0.45);
    var portalLeft = new THREE.Mesh(pillarPortalGeo, darkBronzeMat);
    portalLeft.position.set(-4.3, 2.25, portalZ);
    scene.add(portalLeft);

    var portalRight = new THREE.Mesh(pillarPortalGeo, darkBronzeMat);
    portalRight.position.set(4.3, 2.25, portalZ);
    scene.add(portalRight);

    var headerBeam = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1.1, 0.5), darkBronzeMat);
    headerBeam.position.set(0, 3.95, portalZ);
    scene.add(headerBeam);

    var extSignTex = createBrandSignTexture('STYLE VIBEUS', 'FLAGSHIP BOUTIQUE', '#161413', '#fbf8f4', '#d4af37');
    var extSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 0.9),
      new THREE.MeshBasicMaterial({ map: extSignTex })
    );
    extSign.position.set(0, 3.92, portalZ + 0.27);
    scene.add(extSign);

    var doorGroupLeft = new THREE.Group();
    var doorGlassL = new THREE.Mesh(new THREE.BoxGeometry(1.72, 3.4, 0.05), glassMat);
    var doorHandleL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 12), brassMat);
    doorHandleL.position.set(0.68, 0, 0.05);
    var doorTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.4, 0.07), darkBronzeMat);
    doorTrimL.position.set(0.84, 0, 0);
    doorGroupLeft.add(doorGlassL, doorHandleL, doorTrimL);
    doorGroupLeft.position.set(-0.86, 1.7, portalZ);
    scene.add(doorGroupLeft);

    var doorGroupRight = new THREE.Group();
    var doorGlassR = new THREE.Mesh(new THREE.BoxGeometry(1.72, 3.4, 0.05), glassMat);
    var doorHandleR = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 12), brassMat);
    doorHandleR.position.set(-0.68, 0, 0.05);
    var doorTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.4, 0.07), darkBronzeMat);
    doorTrimR.position.set(-0.84, 0, 0);
    doorGroupRight.add(doorGlassR, doorHandleR, doorTrimR);
    doorGroupRight.position.set(0.86, 1.7, portalZ);
    scene.add(doorGroupRight);

    // --- 4. Architectural Columns ---
    var colGeo = new THREE.BoxGeometry(0.55, 4.4, 0.55);
    [6.2, 1.6, -3.0].forEach(function (zPos) {
      var cL = new THREE.Mesh(colGeo, pillarMat);
      cL.position.set(-3.1, 2.2, zPos);
      scene.add(cL);

      var cR = new THREE.Mesh(colGeo, pillarMat);
      cR.position.set(3.1, 2.2, zPos);
      scene.add(cR);
    });

    // --- 5. Left & Right Boutique Clothing Racks ---
    var garmentUrls = [];
    try {
      garmentUrls = JSON.parse(curtain.getAttribute('data-garments') || '[]');
    } catch (e) {}

    var texLoader = new THREE.TextureLoader();
    var rackZPositions = [4.2, -0.4, -4.6];
    var railGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.6, 12);
    railGeo.rotateX(Math.PI / 2);
    var nicheLightGeo = new THREE.BoxGeometry(0.08, 0.04, 2.6);
    var benchGeo = new THREE.BoxGeometry(0.75, 0.42, 2.2);

    var garmentIndex = 0;
    rackZPositions.forEach(function (zPos) {
      [-1, 1].forEach(function (side) {
        var xWall = side * 4.45;
        var rail = new THREE.Mesh(railGeo, brassMat);
        rail.position.set(xWall, 2.45, zPos);
        scene.add(rail);

        var nLight = new THREE.Mesh(nicheLightGeo, ledMat);
        nLight.position.set(xWall, 3.25, zPos);
        scene.add(nLight);

        var bench = new THREE.Mesh(benchGeo, pillarMat);
        bench.position.set(xWall, 0.21, zPos);
        scene.add(bench);

        var url = garmentUrls[garmentIndex % Math.max(garmentUrls.length, 1)];
        garmentIndex++;
        if (url) {
          (function (imgUrl, wx, wz, sSide) {
            texLoader.load(imgUrl, function (tex) {
              if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
              var gMat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                alphaTest: 0.08,
                side: THREE.DoubleSide,
              });
              var gMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.85), gMat);
              gMesh.position.set(wx - sSide * 0.15, 1.52, wz);
              gMesh.rotation.y = sSide > 0 ? -Math.PI / 2 + 0.18 : Math.PI / 2 - 0.18;
              scene.add(gMesh);
            });
          })(url, xWall, zPos, side);
        }
      });
    });

    // --- 6. Center Focal Pedestal & Back Brand Wall ---
    var backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.6), wallMat);
    backWall.position.set(0, 2.3, -9.2);
    scene.add(backWall);

    var backSignTex = createBrandSignTexture('STYLE VIBEUS', 'AUTUMN / WINTER 2026', '#f6eee5', '#111111', '#b8944f');
    var backSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 1.55),
      new THREE.MeshBasicMaterial({ map: backSignTex })
    );
    backSign.position.set(0, 3.05, -9.15);
    scene.add(backSign);

    var pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 1.5), pillarMat);
    pedestal.position.set(0, 0.39, -6.5);
    scene.add(pedestal);

    var pedestalTrim = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.04, 1.54), brassMat);
    pedestalTrim.position.set(0, 0.78, -6.5);
    scene.add(pedestalTrim);

    if (garmentUrls[0]) {
      texLoader.load(garmentUrls[0], function (tex) {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        var heroGarment = new THREE.Mesh(
          new THREE.PlaneGeometry(1.35, 1.6),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08 })
        );
        heroGarment.position.set(0, 1.55, -6.5);
        scene.add(heroGarment);
      });
    }

    // --- Interactive Exploration & State ---
    var startTime = performance.now();
    var rafId = null;
    var isInteractive = false;
    var isFading = false;
    var isDone = false;

    // Camera targets during interactive mode
    var targetZ = 3.2;
    var currentZ = 13.8;
    var targetYaw = 0;
    var currentYaw = 0;
    var targetPitch = 0;
    var currentPitch = 0;

    var isDragging = false;
    var lastPointerX = 0;
    var lastPointerY = 0;
    var keysPressed = {};

    function enterInteractiveMode() {
      if (isInteractive || isFading || isDone) return;
      isInteractive = true;
      targetZ = currentZ;
      curtain.classList.add('is-interactive');
      if (enteringPill) enteringPill.hidden = true;
      if (exploreBar) exploreBar.hidden = false;
    }

    function cleanup() {
      if (isDone) return;
      isDone = true;
      if (rafId) cancelAnimationFrame(rafId);

      curtain.classList.remove('sv-curtain-fading', 'is-interactive', 'is-dragging');
      curtain.classList.add('sv-curtain-done');
      curtain.setAttribute('aria-hidden', 'true');
      curtain.style.display = 'none';
      document.body.classList.remove('sv-curtain-locked');

      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (skipBtn) skipBtn.removeEventListener('click', onExitClick);
      if (enterShopBtn) enterShopBtn.removeEventListener('click', onExitClick);

      try {
        renderer.dispose();
      } catch (e) {}

      try {
        window.dispatchEvent(new CustomEvent('sv:curtain:opened', { bubbles: true }));
      } catch (err) {}
    }

    function triggerExit(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (isFading || isDone) return;
      isFading = true;
      curtain.classList.add('sv-curtain-fading');
      document.body.classList.remove('sv-curtain-locked');
      setTimeout(cleanup, FADE_OUT_MS);
    }

    function onExitClick(e) {
      triggerExit(e);
    }

    function onPointerDown(e) {
      if (!isInteractive || isDone) return;
      isDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      curtain.classList.add('is-dragging');
    }

    function onPointerMove(e) {
      if (!isInteractive || !isDragging || isDone) return;
      var dx = e.clientX - lastPointerX;
      var dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;

      // Drag left/right to look around; on touch screens also walk forward/back with vertical drag
      targetYaw = clamp(targetYaw + dx * 0.0045, -1.18, 1.18);
      if (e.pointerType === 'touch') {
        targetZ = clamp(targetZ - dy * 0.028, -4.4, 7.2);
      } else {
        targetPitch = clamp(targetPitch + dy * 0.0025, -0.25, 0.28);
      }
    }

    function onPointerUp() {
      isDragging = false;
      curtain.classList.remove('is-dragging');
    }

    function onWheel(e) {
      if (!isInteractive || isDone) return;
      e.preventDefault();
      targetZ = clamp(targetZ + e.deltaY * 0.006, -4.4, 7.2);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        triggerExit(e);
        return;
      }
      keysPressed[e.key] = true;
    }

    function onKeyUp(e) {
      delete keysPressed[e.key];
    }

    function onResize() {
      if (isDone) return;
      var w = window.innerWidth || 1440;
      var h = window.innerHeight || 900;
      camera.aspect = w / h;
      camera.fov = w < 768 ? 64 : 52;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }

    window.addEventListener('resize', onResize);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    if (skipBtn) skipBtn.addEventListener('click', onExitClick);
    if (enterShopBtn) enterShopBtn.addEventListener('click', onExitClick);

    function renderLoop(now) {
      if (isDone) return;

      if (!isInteractive) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / ENTRANCE_DURATION_MS, 1);

        // Doors slide open cleanly
        var doorProgress = Math.min(Math.max((progress - 0.03) / 0.42, 0), 1);
        var doorEase = easeOutQuart(doorProgress);
        doorGroupLeft.position.x = -0.86 - doorEase * 2.35;
        doorGroupRight.position.x = 0.86 + doorEase * 2.35;

        // Camera walks inside from z=13.8 to z=3.2
        var walkEase = easeInOutCubic(progress);
        currentZ = 13.8 - walkEase * 10.6;
        var stepBob = Math.sin(progress * Math.PI * 5) * 0.03 * (1 - progress * 0.5);

        camera.position.set(0, 1.68 + stepBob, currentZ);
        camera.lookAt(0, 1.65, currentZ - 6.5);

        if (progress >= 1) {
          enterInteractiveMode();
        }
      } else {
        // Keyboard walking / looking support
        if (keysPressed['ArrowUp'] || keysPressed['w'] || keysPressed['W']) {
          targetZ = clamp(targetZ - 0.12, -4.4, 7.2);
        }
        if (keysPressed['ArrowDown'] || keysPressed['s'] || keysPressed['S']) {
          targetZ = clamp(targetZ + 0.12, -4.4, 7.2);
        }
        if (keysPressed['ArrowLeft'] || keysPressed['a'] || keysPressed['A']) {
          targetYaw = clamp(targetYaw + 0.035, -1.18, 1.18);
        }
        if (keysPressed['ArrowRight'] || keysPressed['d'] || keysPressed['D']) {
          targetYaw = clamp(targetYaw - 0.035, -1.18, 1.18);
        }

        // Silky lerp interpolation
        currentZ += (targetZ - currentZ) * 0.085;
        currentYaw += (targetYaw - currentYaw) * 0.09;
        currentPitch += (targetPitch - currentPitch) * 0.09;

        camera.position.set(0, 1.68, currentZ);
        var lookDist = 6.5;
        var lookX = -Math.sin(currentYaw) * lookDist;
        var lookZ = currentZ - Math.cos(currentYaw) * lookDist;
        var lookY = 1.65 - Math.sin(currentPitch) * 2.2;
        camera.lookAt(lookX, lookY, lookZ);
      }

      renderer.render(scene, camera);

      if (!isDone) {
        rafId = requestAnimationFrame(renderLoop);
      }
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWalkthrough);
  } else {
    initWalkthrough();
  }
})();
