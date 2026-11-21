/**
 * Style Vibeus — Ultra-Premium Interactive 3D WebGL Boutique Walkthrough
 * -------------------------------------------------------------
 * - Procedural Travertine / Limestone textures + roughness maps
 * - PMREMGenerator boutique studio environment map for realistic brass/glass/floor sheen
 * - Recessed dark-bronze framed wall niches with warm cove lighting
 * - 3D brushed-brass hangers & multi-garment curation per alcove
 * - Contact shadows under columns, benches, pedestal & garments
 * - Backlit STYLE VIBEUS architectural monolith wall + floating golden dust motes
 * - Raycaster product hover/tap inspection pill + smooth 60fps drag/scroll exploration
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

  /**
   * Procedural Travertine / Limestone Diffuse & Roughness Texture
   */
  function createTravertineTextures(baseColor, veinColor, repeatX, repeatY) {
    var size = 512;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var ctx = c.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Subtle horizontal travertine mineral striations
    for (var i = 0; i < 65; i++) {
      var y = Math.random() * size;
      var h = 1 + Math.random() * 5;
      ctx.fillStyle = veinColor;
      ctx.globalAlpha = 0.04 + Math.random() * 0.08;
      ctx.fillRect(0, y, size, h);
    }

    // Soft organic mineral veins & travertine pores
    ctx.globalAlpha = 0.09;
    ctx.strokeStyle = veinColor;
    for (var j = 0; j < 18; j++) {
      ctx.lineWidth = 0.6 + Math.random() * 1.6;
      ctx.beginPath();
      var startY = Math.random() * size;
      ctx.moveTo(0, startY);
      ctx.bezierCurveTo(
        size * 0.33,
        startY + (Math.random() - 0.5) * 28,
        size * 0.66,
        startY + (Math.random() - 0.5) * 28,
        size,
        startY + (Math.random() - 0.5) * 14
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    var diffuse = new THREE.CanvasTexture(c);
    diffuse.wrapS = THREE.RepeatWrapping;
    diffuse.wrapT = THREE.RepeatWrapping;
    diffuse.repeat.set(repeatX || 1, repeatY || 1);
    if (THREE.SRGBColorSpace) diffuse.colorSpace = THREE.SRGBColorSpace;
    diffuse.needsUpdate = true;

    return diffuse;
  }

  /**
   * Soft Radial Contact Shadow Texture (prevents floating CAD look)
   */
  function createContactShadowTexture() {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var ctx = c.getContext('2d');
    var grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(17, 15, 13, 0.36)');
    grad.addColorStop(0.55, 'rgba(17, 15, 13, 0.14)');
    grad.addColorStop(1, 'rgba(17, 15, 13, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Studio/Boutique Environment Map using PMREMGenerator for real metallic/floor reflections
   */
  function createBoutiqueEnvMap(renderer) {
    if (!THREE.PMREMGenerator) return null;
    try {
      var pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();

      var envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0xece2d4);

      // Warm overhead studio softboxes
      var boxGeo = new THREE.PlaneGeometry(8, 22);
      var lightBoxMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0, side: THREE.DoubleSide });
      var topBox1 = new THREE.Mesh(boxGeo, lightBoxMat);
      topBox1.rotation.x = Math.PI / 2;
      topBox1.position.set(-2.5, 6, 0);
      envScene.add(topBox1);

      var topBox2 = new THREE.Mesh(boxGeo, lightBoxMat);
      topBox2.rotation.x = Math.PI / 2;
      topBox2.position.set(2.5, 6, 0);
      envScene.add(topBox2);

      // Dark architectural floor & contrast strips
      var darkMat = new THREE.MeshBasicMaterial({ color: 0x2b2520, side: THREE.DoubleSide });
      var envFloor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), darkMat);
      envFloor.rotation.x = -Math.PI / 2;
      envFloor.position.y = -4;
      envScene.add(envFloor);

      var rt = pmrem.fromScene(envScene, 0.04);
      pmrem.dispose();
      return rt.texture;
    } catch (e) {
      return null;
    }
  }

  function createBrandSignTexture(titleText, subText, bgHex, textHex, accentHex, noBorder) {
    var c = document.createElement('canvas');
    c.width = 1024;
    c.height = 384;
    var ctx = c.getContext('2d');

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, c.width, c.height);

    if (!noBorder) {
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 24, c.width - 48, c.height - 48);
    }

    ctx.fillStyle = textHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 84px "Syne", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(titleText, c.width / 2, c.height / 2 - (subText ? 26 : 0));

    if (subText) {
      ctx.fillStyle = accentHex;
      ctx.font = '600 24px "Manrope", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(subText, c.width / 2, c.height / 2 + 54);
    }

    var tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * 3D Minimalist Brushed-Brass Hanger Geometry (Hook + Shoulders)
   */
  function createHangerMesh(brassMat) {
    var group = new THREE.Group();
    var barGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.56, 8);
    barGeo.rotateZ(Math.PI / 2);
    var bar = new THREE.Mesh(barGeo, brassMat);
    bar.position.y = -0.14;
    group.add(bar);

    var stemGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.16, 8);
    var stem = new THREE.Mesh(stemGeo, brassMat);
    stem.position.y = -0.06;
    group.add(stem);

    var hookGeo = new THREE.TorusGeometry(0.032, 0.008, 8, 16, Math.PI * 1.25);
    var hook = new THREE.Mesh(hookGeo, brassMat);
    hook.position.set(0, 0.03, 0);
    hook.rotation.z = -0.35;
    group.add(hook);

    return group;
  }

  function initWalkthrough() {
    var curtain = document.getElementById('sv-curtain-intro');
    if (!curtain) return;

    var canvas = document.getElementById('sv-3d-walkthrough-canvas');
    var skipBtn = document.getElementById('sv-curtain-skip');
    var enterShopBtn = document.getElementById('sv-curtain-enter-shop');
    var enteringPill = document.getElementById('sv-curtain-entering');
    var exploreBar = document.getElementById('sv-curtain-explore');
    var productPill = document.getElementById('sv-curtain-product-pill');
    var pillTitle = productPill && productPill.querySelector('[data-pill-title]');
    var pillPrice = productPill && productPill.querySelector('[data-pill-price]');

    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (hasSeenCurtain() || prefersReduced || typeof THREE === 'undefined' || !canvas) {
      document.documentElement.classList.add('sv-curtain-dismissed');
      curtain.classList.add('sv-curtain-done');
      curtain.setAttribute('aria-hidden', 'true');
      curtain.style.display = 'none';
      return;
    }

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
      renderer.toneMappingExposure = 1.06;
    }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5ede3);
    scene.fog = new THREE.Fog(0xf5ede3, 12, 34);

    var envMap = createBoutiqueEnvMap(renderer);
    if (envMap) {
      scene.environment = envMap;
    }

    var isMobile = width < 768;
    var camera = new THREE.PerspectiveCamera(isMobile ? 64 : 50, width / height, 0.1, 60);
    camera.position.set(0, 1.68, 13.8);

    // --- Lighting ---
    scene.add(new THREE.HemisphereLight(0xfffaf2, 0xcabaa5, 0.85));

    var dirLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
    dirLight.position.set(2.5, 8.5, 10);
    scene.add(dirLight);

    [5.0, 0.0, -4.5].forEach(function (zL) {
      var pt = new THREE.PointLight(0xffe9c8, 1.15, 13);
      pt.position.set(0, 3.85, zL);
      scene.add(pt);
    });

    var focalLight = new THREE.PointLight(0xfff2dc, 1.75, 12);
    focalLight.position.set(0, 3.6, -6.4);
    scene.add(focalLight);

    // --- Procedural Luxury Materials ---
    var floorTex = createTravertineTextures('#ede3d5', '#cbbba6', 4, 8);
    var columnTex = createTravertineTextures('#e7ddd0', '#c7b8a4', 1, 3);
    var shadowTex = createContactShadowTexture();

    var floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.18,
      metalness: 0.06,
      envMapIntensity: 1.15,
    });
    var wallMat = new THREE.MeshStandardMaterial({
      color: 0xf6eee5,
      roughness: 0.86,
      metalness: 0.02,
    });
    var nicheBackMat = new THREE.MeshStandardMaterial({
      color: 0xe9dfd2,
      roughness: 0.72,
      metalness: 0.04,
    });
    var pillarMat = new THREE.MeshStandardMaterial({
      map: columnTex,
      roughness: 0.45,
      metalness: 0.05,
      envMapIntensity: 0.8,
    });
    var darkBronzeMat = new THREE.MeshStandardMaterial({
      color: 0x171514,
      roughness: 0.32,
      metalness: 0.82,
      envMapIntensity: 1.2,
    });
    var brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.2,
      metalness: 0.92,
      envMapIntensity: 1.4,
    });
    var ledMat = new THREE.MeshBasicMaterial({ color: 0xfff8ed });
    var haloMat = new THREE.MeshBasicMaterial({ color: 0xffebd0 });
    var glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1817,
      transparent: true,
      opacity: 0.34,
      roughness: 0.06,
      metalness: 0.18,
      envMapIntensity: 1.4,
    });
    var shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });

    function addContactShadow(x, z, w, d) {
      var s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadowMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.004, z);
      scene.add(s);
    }

    // --- 1. Polished Travertine Floor, Brass Aisle Inlays & Wall Baseboards ---
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 36), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 2);
    scene.add(floor);

    var inlayGeo = new THREE.BoxGeometry(0.035, 0.006, 24);
    var inlayLeft = new THREE.Mesh(inlayGeo, brassMat);
    inlayLeft.position.set(-1.55, 0.003, 1.5);
    scene.add(inlayLeft);

    var inlayRight = new THREE.Mesh(inlayGeo, brassMat);
    inlayRight.position.set(1.55, 0.003, 1.5);
    scene.add(inlayRight);

    var baseboardGeo = new THREE.BoxGeometry(0.08, 0.14, 34);
    var baseL = new THREE.Mesh(baseboardGeo, darkBronzeMat);
    baseL.position.set(-5.16, 0.07, 1.5);
    scene.add(baseL);

    var baseR = new THREE.Mesh(baseboardGeo, darkBronzeMat);
    baseR.position.set(5.16, 0.07, 1.5);
    scene.add(baseR);

    // --- 2. Walls, Ceiling & Linear Recessed LED Strips ---
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

    var extSignTex = createBrandSignTexture('STYLE VIBEUS', 'FLAGSHIP BOUTIQUE', '#161413', '#fbf8f4', '#d4af37', false);
    var extSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 0.9),
      new THREE.MeshBasicMaterial({ map: extSignTex })
    );
    extSign.position.set(0, 3.92, portalZ + 0.27);
    scene.add(extSign);

    var doorGroupLeft = new THREE.Group();
    var doorGlassL = new THREE.Mesh(new THREE.BoxGeometry(1.72, 3.4, 0.05), glassMat);
    var doorHandleL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.15, 12), brassMat);
    doorHandleL.position.set(0.68, 0, 0.05);
    var doorTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.4, 0.07), darkBronzeMat);
    doorTrimL.position.set(0.84, 0, 0);
    doorGroupLeft.add(doorGlassL, doorHandleL, doorTrimL);
    doorGroupLeft.position.set(-0.86, 1.7, portalZ);
    scene.add(doorGroupLeft);

    var doorGroupRight = new THREE.Group();
    var doorGlassR = new THREE.Mesh(new THREE.BoxGeometry(1.72, 3.4, 0.05), glassMat);
    var doorHandleR = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.15, 12), brassMat);
    doorHandleR.position.set(-0.68, 0, 0.05);
    var doorTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.4, 0.07), darkBronzeMat);
    doorTrimR.position.set(-0.84, 0, 0);
    doorGroupRight.add(doorGlassR, doorHandleR, doorTrimR);
    doorGroupRight.position.set(0.86, 1.7, portalZ);
    scene.add(doorGroupRight);

    // --- 4. Travertine Columns with Contact Shadows & Brass Base Caps ---
    var colGeo = new THREE.BoxGeometry(0.56, 4.4, 0.56);
    var colCapGeo = new THREE.BoxGeometry(0.6, 0.06, 0.6);
    [6.2, 1.6, -3.0].forEach(function (zPos) {
      [-3.1, 3.1].forEach(function (xPos) {
        var col = new THREE.Mesh(colGeo, pillarMat);
        col.position.set(xPos, 2.2, zPos);
        scene.add(col);

        var cap = new THREE.Mesh(colCapGeo, darkBronzeMat);
        cap.position.set(xPos, 0.03, zPos);
        scene.add(cap);

        addContactShadow(xPos, zPos, 1.25, 1.25);
      });
    });

    // --- 5. Recessed Luxury Wall Alcoves, 3D Hangers & Multi-Garment Racks ---
    var garmentItems = [];
    try {
      garmentItems = JSON.parse(curtain.getAttribute('data-garments') || '[]');
    } catch (e) {}

    var interactableMeshes = [];
    var texLoader = new THREE.TextureLoader();
    var rackZPositions = [4.4, -0.1, -4.6];
    var railGeo = new THREE.CylinderGeometry(0.022, 0.022, 3.1, 12);
    railGeo.rotateX(Math.PI / 2);
    var nicheLightGeo = new THREE.BoxGeometry(0.12, 0.04, 3.1);
    var benchGeo = new THREE.BoxGeometry(0.76, 0.4, 2.7);
    var alcoveBackGeo = new THREE.BoxGeometry(0.14, 3.25, 3.2);
    var alcoveFrameVGeo = new THREE.BoxGeometry(0.22, 3.35, 0.08);
    var alcoveFrameHGeo = new THREE.BoxGeometry(0.22, 0.08, 3.36);

    var garmentCursor = 0;
    rackZPositions.forEach(function (zPos) {
      [-1, 1].forEach(function (side) {
        var wallX = side * 5.14;
        var rackX = side * 4.45;

        // Recessed Dark-Bronze Framed Alcove
        var backPanel = new THREE.Mesh(alcoveBackGeo, nicheBackMat);
        backPanel.position.set(wallX, 1.78, zPos);
        scene.add(backPanel);

        var frameTop = new THREE.Mesh(alcoveFrameHGeo, darkBronzeMat);
        frameTop.position.set(wallX - side * 0.05, 3.42, zPos);
        scene.add(frameTop);

        [-1.64, 1.64].forEach(function (zOff) {
          var vFrame = new THREE.Mesh(alcoveFrameVGeo, darkBronzeMat);
          vFrame.position.set(wallX - side * 0.05, 1.78, zPos + zOff);
          scene.add(vFrame);
        });

        // Warm Cove LED at top of alcove
        var nLight = new THREE.Mesh(nicheLightGeo, ledMat);
        nLight.position.set(rackX + side * 0.2, 3.32, zPos);
        scene.add(nLight);

        // Brushed Brass Hanging Rail
        var rail = new THREE.Mesh(railGeo, brassMat);
        rail.position.set(rackX, 2.52, zPos);
        scene.add(rail);

        // Travertine Display Bench + Contact Shadow
        var bench = new THREE.Mesh(benchGeo, pillarMat);
        bench.position.set(rackX + side * 0.12, 0.2, zPos);
        scene.add(bench);
        addContactShadow(rackX + side * 0.12, zPos, 1.25, 3.1);

        // Hang 2 Curated Garments per Alcove with 3D Brass Hangers
        [-0.78, 0.78].forEach(function (zSlot) {
          var item = garmentItems[garmentCursor % Math.max(garmentItems.length, 1)];
          garmentCursor++;
          if (!item || !item.url) return;

          var gz = zPos + zSlot;
          var gx = rackX - side * 0.06;

          // 3D Brass Hanger connecting garment to rail
          var hanger = createHangerMesh(brassMat);
          hanger.position.set(gx, 2.48, gz);
          hanger.rotation.y = side > 0 ? -Math.PI / 2 + 0.14 : Math.PI / 2 - 0.14;
          scene.add(hanger);

          (function (gItem, posX, posZ, sSide) {
            texLoader.load(gItem.url, function (tex) {
              if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
              var gMat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                alphaTest: 0.08,
                side: THREE.DoubleSide,
              });
              var gMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.62), gMat);
              gMesh.position.set(posX, 1.56, posZ);
              gMesh.rotation.y = sSide > 0 ? -Math.PI / 2 + 0.14 : Math.PI / 2 - 0.14;
              gMesh.userData = {
                title: gItem.title,
                price: gItem.price,
                href: gItem.href,
                baseScale: 1,
                targetScale: 1,
              };
              scene.add(gMesh);
              interactableMeshes.push(gMesh);
            });
          })(item, gx, gz, side);
        });
      });
    });

    // --- 6. Sculptural Backlit Feature Wall & Center Pedestal ---
    var backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.6), wallMat);
    backWall.position.set(0, 2.3, -9.2);
    scene.add(backWall);

    // Warm halo backlight behind monolith sign
    var haloPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.15, 1.8), haloMat);
    haloPlane.position.set(0, 3.05, -9.16);
    scene.add(haloPlane);

    var backSignTex = createBrandSignTexture('STYLE VIBEUS', 'AUTUMN / WINTER 2026', '#f2e8dc', '#111111', '#b8944f', true);
    var backSign = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 1.5, 0.12),
      new THREE.MeshStandardMaterial({ map: backSignTex, roughness: 0.55, metalness: 0.04 })
    );
    backSign.position.set(0, 3.05, -9.06);
    scene.add(backSign);

    var pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 1.5), pillarMat);
    pedestal.position.set(0, 0.39, -6.5);
    scene.add(pedestal);
    addContactShadow(0, -6.5, 2.2, 2.2);

    var pedestalTrim = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.04, 1.54), brassMat);
    pedestalTrim.position.set(0, 0.78, -6.5);
    scene.add(pedestalTrim);

    if (garmentItems[0]) {
      var centerHanger = createHangerMesh(brassMat);
      centerHanger.position.set(0, 2.36, -6.5);
      scene.add(centerHanger);

      texLoader.load(garmentItems[0].url, function (tex) {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        var heroGarment = new THREE.Mesh(
          new THREE.PlaneGeometry(1.35, 1.6),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08 })
        );
        heroGarment.position.set(0, 1.55, -6.5);
        heroGarment.userData = {
          title: garmentItems[0].title,
          price: garmentItems[0].price,
          href: garmentItems[0].href,
          baseScale: 1,
          targetScale: 1,
        };
        scene.add(heroGarment);
        interactableMeshes.push(heroGarment);
      });
    }

    // --- 7. Atmospheric Floating Golden Dust Motes ---
    var particleCount = 90;
    var pPositions = new Float32Array(particleCount * 3);
    for (var p = 0; p < particleCount; p++) {
      pPositions[p * 3] = (Math.random() - 0.5) * 8.5;
      pPositions[p * 3 + 1] = 0.4 + Math.random() * 3.6;
      pPositions[p * 3 + 2] = -7.5 + Math.random() * 15.5;
    }
    var particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    var particleMat = new THREE.PointsMaterial({
      color: 0xe8d0b2,
      size: 0.032,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    var dustMotes = new THREE.Points(particleGeo, particleMat);
    scene.add(dustMotes);

    // --- Interactive Exploration & Raycaster State ---
    var startTime = performance.now();
    var rafId = null;
    var isInteractive = false;
    var isFading = false;
    var isDone = false;

    var targetZ = 3.2;
    var currentZ = 13.8;
    var targetYaw = 0;
    var currentYaw = 0;
    var targetPitch = 0;
    var currentPitch = 0;

    var isDragging = false;
    var dragTotalDist = 0;
    var lastPointerX = 0;
    var lastPointerY = 0;
    var keysPressed = {};

    var raycaster = new THREE.Raycaster();
    var pointerNDC = new THREE.Vector2();
    var hoveredMesh = null;

    function updateProductPill(mesh) {
      if (!productPill) return;
      if (!mesh || !mesh.userData || !mesh.userData.title) {
        productPill.hidden = true;
        curtain.classList.remove('is-hovering-garment');
        return;
      }
      if (pillTitle) pillTitle.textContent = mesh.userData.title;
      if (pillPrice) pillPrice.textContent = mesh.userData.price || '';
      if (mesh.userData.href) productPill.setAttribute('href', mesh.userData.href);
      productPill.hidden = false;
      curtain.classList.add('is-hovering-garment');
    }

    function performRaycast(clientX, clientY) {
      if (!isInteractive || !interactableMeshes.length) return null;
      var w = window.innerWidth || 1440;
      var h = window.innerHeight || 900;
      pointerNDC.x = (clientX / w) * 2 - 1;
      pointerNDC.y = -(clientY / h) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      var hits = raycaster.intersectObjects(interactableMeshes, false);
      return hits.length ? hits[0].object : null;
    }

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

      curtain.classList.remove('sv-curtain-fading', 'is-interactive', 'is-dragging', 'is-hovering-garment');
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

    function saveInStorePosition() {
      try {
        if (window.sessionStorage) {
          window.sessionStorage.setItem('sv_curtain_in_store', '1');
          window.sessionStorage.setItem('sv_curtain_z', String(currentZ));
          window.sessionStorage.setItem('sv_curtain_yaw', String(currentYaw));
        }
      } catch (e) {}
    }

    function clearInStorePosition() {
      try {
        if (window.sessionStorage) {
          window.sessionStorage.removeItem('sv_curtain_in_store');
          window.sessionStorage.removeItem('sv_curtain_z');
          window.sessionStorage.removeItem('sv_curtain_yaw');
        }
      } catch (e) {}
    }

    function triggerExit(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (isFading || isDone) return;
      markCurtainSeen();
      clearInStorePosition();
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
      dragTotalDist = 0;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      curtain.classList.add('is-dragging');
    }

    function onPointerMove(e) {
      if (!isInteractive || isDone) return;

      if (isDragging) {
        var dx = e.clientX - lastPointerX;
        var dy = e.clientY - lastPointerY;
        dragTotalDist += Math.abs(dx) + Math.abs(dy);
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;

        targetYaw = clamp(targetYaw + dx * 0.0045, -1.18, 1.18);
        if (e.pointerType === 'touch') {
          targetZ = clamp(targetZ - dy * 0.028, -4.4, 7.2);
        } else {
          targetPitch = clamp(targetPitch + dy * 0.0025, -0.25, 0.28);
        }
      } else if (e.pointerType !== 'touch') {
        var hit = performRaycast(e.clientX, e.clientY);
        if (hit !== hoveredMesh) {
          if (hoveredMesh) hoveredMesh.userData.targetScale = 1;
          hoveredMesh = hit;
          if (hoveredMesh) hoveredMesh.userData.targetScale = 1.06;
          updateProductPill(hoveredMesh);
        }
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      curtain.classList.remove('is-dragging');

      // Direct click / tap on a 3D garment navigates straight to its product detail page
      if (isInteractive && dragTotalDist < 8 && e && typeof e.clientX === 'number') {
        var tapped = performRaycast(e.clientX, e.clientY);
        if (tapped && tapped.userData && tapped.userData.href) {
          updateProductPill(tapped);
          saveInStorePosition();
          window.location.href = tapped.userData.href;
        }
      }
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
      camera.fov = w < 768 ? 64 : 50;
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
    if (productPill) {
      productPill.addEventListener('click', function () {
        saveInStorePosition();
      });
    }

    // If returning from a 3D product click, resume directly inside the store at last position
    try {
      if (window.sessionStorage && window.sessionStorage.getItem('sv_curtain_in_store') === '1') {
        var savedZ = parseFloat(window.sessionStorage.getItem('sv_curtain_z'));
        var savedYaw = parseFloat(window.sessionStorage.getItem('sv_curtain_yaw'));
        if (!isNaN(savedZ)) currentZ = clamp(savedZ, -4.4, 7.2);
        if (!isNaN(savedYaw)) {
          currentYaw = clamp(savedYaw, -1.18, 1.18);
          targetYaw = currentYaw;
        }
        doorGroupLeft.position.x = -3.21;
        doorGroupRight.position.x = 3.21;
        enterInteractiveMode();
      }
    } catch (e) {}

    window.addEventListener('pageshow', function (ev) {
      if (ev && ev.persisted && !hasSeenCurtain() && !isDone) {
        document.body.classList.add('sv-curtain-locked');
        if (!rafId) rafId = requestAnimationFrame(renderLoop);
      }
    });

    function renderLoop(now) {
      if (isDone) return;

      // Gentle ambient drift of golden dust motes
      dustMotes.rotation.y = now * 0.00004;

      // Smooth scale animation on hovered garments
      for (var m = 0; m < interactableMeshes.length; m++) {
        var mesh = interactableMeshes[m];
        var sc = mesh.scale.x + (mesh.userData.targetScale - mesh.scale.x) * 0.14;
        mesh.scale.set(sc, sc, 1);
      }

      if (!isInteractive) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / ENTRANCE_DURATION_MS, 1);

        var doorProgress = Math.min(Math.max((progress - 0.03) / 0.42, 0), 1);
        var doorEase = easeOutQuart(doorProgress);
        doorGroupLeft.position.x = -0.86 - doorEase * 2.35;
        doorGroupRight.position.x = 0.86 + doorEase * 2.35;

        var walkEase = easeInOutCubic(progress);
        currentZ = 13.8 - walkEase * 10.6;
        var stepBob = Math.sin(progress * Math.PI * 5) * 0.03 * (1 - progress * 0.5);

        camera.position.set(0, 1.68 + stepBob, currentZ);
        camera.lookAt(0, 1.65, currentZ - 6.5);

        if (progress >= 1) {
          enterInteractiveMode();
        }
      } else {
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
