/**
 * Style Vibeus — 3D WebGL Boutique Walkthrough Intro
 * -------------------------------------------------------------
 * - Procedural Three.js luxury travertine & cream showroom
 * - Sliding smoked-glass entrance doors + illuminated ceiling strips
 * - Left/right clothing racks with real product cutouts
 * - Center focal pedestal & STYLE VIBEUS brand wall
 * - Smooth ~2.25s camera walkthrough + seamless fade into storefront
 * - Session storage guard ('sv_curtain_seen'), Skip button, tap/Esc exit
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'sv_curtain_seen';
  var WALK_DURATION_MS = 2250;
  var FADE_OUT_MS = 420;
  var FAST_SKIP_MS = 260;

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

    // Subtle border trim
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, c.width - 48, c.height - 48);

    // Main brand title
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
    var camera = new THREE.PerspectiveCamera(isMobile ? 62 : 50, width / height, 0.1, 60);
    camera.position.set(0, 1.68, 13.8);

    // --- Lighting ---
    var hemiLight = new THREE.HemisphereLight(0xfffaf2, 0xd8cbb8, 0.92);
    scene.add(hemiLight);

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
    var travertineMat = new THREE.MeshStandardMaterial({
      color: 0xede4d8,
      roughness: 0.28,
      metalness: 0.04,
    });
    var wallMat = new THREE.MeshStandardMaterial({
      color: 0xf6eee5,
      roughness: 0.82,
      metalness: 0.02,
    });
    var pillarMat = new THREE.MeshStandardMaterial({
      color: 0xe6dccf,
      roughness: 0.65,
      metalness: 0.04,
    });
    var darkBronzeMat = new THREE.MeshStandardMaterial({
      color: 0x161413,
      roughness: 0.35,
      metalness: 0.75,
    });
    var brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.88,
    });
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

    // Ceiling LED light strips
    var ledGeo = new THREE.BoxGeometry(0.08, 0.03, 22);
    var ledLeft = new THREE.Mesh(ledGeo, ledMat);
    ledLeft.position.set(-1.6, 4.38, 1.5);
    scene.add(ledLeft);

    var ledRight = new THREE.Mesh(ledGeo, ledMat);
    ledRight.position.set(1.6, 4.38, 1.5);
    scene.add(ledRight);

    // --- 3. Entrance Architectural Portal & Sliding Glass Doors (z = 9.5) ---
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

    // Overhead illuminated fascia sign on exterior
    var extSignTex = createBrandSignTexture('STYLE VIBEUS', 'FLAGSHIP BOUTIQUE', '#161413', '#fbf8f4', '#d4af37');
    var extSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 0.9),
      new THREE.MeshBasicMaterial({ map: extSignTex })
    );
    extSign.position.set(0, 3.92, portalZ + 0.27);
    scene.add(extSign);

    // Sliding Glass Doors
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

    // --- 4. Architectural Columns along Aisle ---
    var colGeo = new THREE.BoxGeometry(0.55, 4.4, 0.55);
    var colZPositions = [6.2, 1.6, -3.0];
    colZPositions.forEach(function (zPos) {
      var cL = new THREE.Mesh(colGeo, pillarMat);
      cL.position.set(-3.1, 2.2, zPos);
      scene.add(cL);

      var cR = new THREE.Mesh(colGeo, pillarMat);
      cR.position.set(3.1, 2.2, zPos);
      scene.add(cR);
    });

    // --- 5. Left & Right Boutique Clothing Racks with Real Products ---
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
        // Brass rail
        var rail = new THREE.Mesh(railGeo, brassMat);
        rail.position.set(xWall, 2.45, zPos);
        scene.add(rail);

        // Warm top niche strip
        var nLight = new THREE.Mesh(nicheLightGeo, ledMat);
        nLight.position.set(xWall, 3.25, zPos);
        scene.add(nLight);

        // Display bench underneath
        var bench = new THREE.Mesh(benchGeo, pillarMat);
        bench.position.set(xWall, 0.21, zPos);
        scene.add(bench);

        // Hanging Garment Plane
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
      new THREE.PlaneGeometry(4.8, 1.75),
      new THREE.MeshBasicMaterial({ map: backSignTex })
    );
    backSign.position.set(0, 2.35, -9.15);
    scene.add(backSign);

    var pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.5), pillarMat);
    pedestal.position.set(0, 0.425, -6.5);
    scene.add(pedestal);

    var pedestalTrim = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.04, 1.54), brassMat);
    pedestalTrim.position.set(0, 0.84, -6.5);
    scene.add(pedestalTrim);

    // Center hero garment hovering above pedestal
    if (garmentUrls[0]) {
      texLoader.load(garmentUrls[0], function (tex) {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        var heroGarment = new THREE.Mesh(
          new THREE.PlaneGeometry(1.45, 1.75),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08 })
        );
        heroGarment.position.set(0, 1.82, -6.5);
        scene.add(heroGarment);
      });
    }

    // --- Animation & Lifecycle State ---
    var startTime = performance.now();
    var rafId = null;
    var isFading = false;
    var isDone = false;
    var pointerX = 0;
    var pointerY = 0;

    function cleanup() {
      if (isDone) return;
      isDone = true;
      if (rafId) cancelAnimationFrame(rafId);

      curtain.classList.remove('sv-curtain-fading');
      curtain.classList.add('sv-curtain-done');
      curtain.setAttribute('aria-hidden', 'true');
      curtain.style.display = 'none';
      document.body.classList.remove('sv-curtain-locked');

      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      curtain.removeEventListener('click', onSkip);
      curtain.removeEventListener('touchstart', onSkip);
      document.removeEventListener('keydown', onKeyDown);
      if (skipBtn) skipBtn.removeEventListener('click', onSkip);

      try {
        renderer.dispose();
      } catch (e) {}

      try {
        window.dispatchEvent(new CustomEvent('sv:curtain:opened', { bubbles: true }));
      } catch (err) {}
    }

    function triggerFadeOut(ms) {
      if (isFading || isDone) return;
      isFading = true;
      curtain.classList.add('sv-curtain-fading');
      document.body.classList.remove('sv-curtain-locked');
      setTimeout(cleanup, ms || FADE_OUT_MS);
    }

    function onSkip(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      triggerFadeOut(FAST_SKIP_MS);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        triggerFadeOut(FAST_SKIP_MS);
      }
    }

    function onPointerMove(e) {
      pointerX = (e.clientX / (window.innerWidth || 1) - 0.5) * 2;
      pointerY = (e.clientY / (window.innerHeight || 1) - 0.5) * 2;
    }

    function onResize() {
      if (isDone) return;
      var w = window.innerWidth || 1440;
      var h = window.innerHeight || 900;
      camera.aspect = w / h;
      camera.fov = w < 768 ? 62 : 50;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    curtain.addEventListener('click', onSkip, { passive: true });
    curtain.addEventListener('touchstart', onSkip, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    if (skipBtn) skipBtn.addEventListener('click', onSkip);

    function renderLoop(now) {
      if (isDone) return;
      var elapsed = now - startTime;
      var progress = Math.min(elapsed / WALK_DURATION_MS, 1);

      // Doors slide open cleanly during first 42% of walkthrough
      var doorProgress = Math.min(Math.max((progress - 0.03) / 0.38, 0), 1);
      var doorEase = easeOutQuart(doorProgress);
      doorGroupLeft.position.x = -0.86 - doorEase * 2.25;
      doorGroupRight.position.x = 0.86 + doorEase * 2.25;

      // Camera walks smoothly from z=13.8 through doorway down aisle to z=-2.6
      var walkEase = easeInOutCubic(progress);
      var camZ = 13.8 - walkEase * 16.4;
      var stepBob = Math.sin(progress * Math.PI * 5) * 0.032 * (1 - progress * 0.4);

      camera.position.set(
        pointerX * 0.22,
        1.68 + stepBob - pointerY * 0.08,
        camZ
      );
      camera.lookAt(pointerX * 0.35, 1.65 - pointerY * 0.14, camZ - 6.5);

      renderer.render(scene, camera);

      if (progress >= 1 && !isFading) {
        triggerFadeOut(FADE_OUT_MS);
      }

      if (!isDone) {
        rafId = requestAnimationFrame(renderLoop);
      }
    }

    rafId = requestAnimationFrame(renderLoop);

    // Safety fallback timer
    setTimeout(function () {
      if (!isDone) triggerFadeOut(FADE_OUT_MS);
    }, WALK_DURATION_MS + 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWalkthrough);
  } else {
    initWalkthrough();
  }
})();
