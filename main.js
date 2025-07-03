//------------- Main Three.js scene setup------------------//
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// == Star field background ==
function createStars() {
    // Create random star positions in 3D space---------------
    const vertices = [];
    for (let i = 0; i < 10000; i++) {
        vertices.push(
            (Math.random() - 0.5) * 2000,
            (Math.random() - 0.5) * 2000,
            (Math.random() - 0.5) * 2000
        );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({ 
        color: 0xffffff, 
        size: 0.1, 
        transparent: true, 
        opacity: 0.8 
    });
    scene.add(new THREE.Points(geometry, material));
}
createStars();

// == Lighting setup ==-----------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0); // Off by default for "Real view"
scene.add(ambientLight);

// Sun as a light source
const sunLight = new THREE.PointLight(0xffffff, 4, 300);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

//--------Camera controls --------
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth camera movement
controls.dampingFactor = 0.05;
controls.minDistance = 20; // Zoom limits
controls.maxDistance = 300;
camera.position.set(0, 50, 150); // Starting camera position
controls.update();

// -------Texture loading helper --------
const textureLoader = new THREE.TextureLoader();
function loadTexture(path) {
    return new Promise(resolve => {
        textureLoader.load(
            path, 
            tex => { 
                tex.encoding = THREE.sRGBEncoding; 
                resolve(tex); 
            }, 
            undefined, 
            () => {
                // Fallback gray texture if loading fails
                const canvas = document.createElement("canvas");
                canvas.width = canvas.height = 256;
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#888"; 
                ctx.fillRect(0,0,256,256);
                resolve(new THREE.CanvasTexture(canvas));
            }
        );
    });
}

// ________Solar system data_____________
const planetData = [
    { name: "Sun", size: 15, texture: "images/sun.jpg", orbitRadius: 0, rotationSpeed: 0.005, orbitSpeed: 0 },
    { name: "Mercury", size: 3.2, color: 0xb5b5b5, texture: "images/mercury.jpg", orbitRadius: 28, rotationSpeed: 0.006, orbitSpeed: 0.02 },
    { name: "Venus", size: 5.8, color: 0xe6c229, texture: "images/venus.jpg", orbitRadius: 44, rotationSpeed: 0.002, orbitSpeed: 0.017 },
    { name: "Earth", size: 6, color: 0x3498db, texture: "images/earth.jpg", orbitRadius: 62, rotationSpeed: 0.03, orbitSpeed: 0.01, hasMoon: true },
    { name: "Mars", size: 4, color: 0xe67e22, texture: "images/mars.jpg", orbitRadius: 78, rotationSpeed: 0.010, orbitSpeed: 0.008 },
    { name: "Jupiter", size: 12, color: 0xf1c40f, texture: "images/jupiter.jpg", orbitRadius: 100, rotationSpeed: 0.04, orbitSpeed: 0.004 },
    { name: "Saturn", size: 10, color: 0xf39c12, texture: "images/saturn.jpg", orbitRadius: 138, rotationSpeed: 0.017, orbitSpeed: 0.003, hasRings: true, ring: { innerRadius: 10, outerRadius: 20, texture: "images/saturn_ring.png" } },
    { name: "Uranus", size: 7, color: 0x1abc9c, texture: "images/uranus.jpg", orbitRadius: 176, rotationSpeed: 0.012, orbitSpeed: 0.002, hasRings: true, ring: { innerRadius: 7, outerRadius: 12, texture: "images/uranus_ring.png" } },
    { name: "Neptune", size: 7, color: 0x3498db, texture: "images/neptune.jpg", orbitRadius: 200, rotationSpeed: 0.01, orbitSpeed: 0.001 },
];

// Arrays to store created objects
const planets = [], moons = [], paths = [];
let sunMesh; // Reference to sun mesh for visibility toggling

//  Orbit path creation 
function createOrbitPath(radius, color = 0xffffff) {
    const segments = 100, points = [];
    // Calculate points in a circle
    for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        points.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });
    const path = new THREE.LineLoop(geom, mat);
    scene.add(path);
    paths.push(path);
}

// == Main solar system creation ==
async function createSolarSystem() {
    // Load all textures in parallel
    const textures = await Promise.all(planetData.map(p => loadTexture(p.texture)));
    const moonTex = await loadTexture("images/moon.jpg");
    const saturnRingTex = await loadTexture("images/saturn_ring.png");
    const uranusRingTex = await loadTexture("images/uranus_ring.png");

    // Create each planet
    planetData.forEach((data, idx) => {
        const geom = new THREE.SphereGeometry(data.size, 32, 32);
        // Sun uses basic material (no lighting), planets use phong material
        const material = idx === 0
            ? new THREE.MeshBasicMaterial({ map: textures[idx] })      //for sun
            : new THREE.MeshPhongMaterial({ map: textures[idx] });      //for plantes
        const planet = new THREE.Mesh(geom, material);

        if (idx === 0) {
            //________SUN_________//
            const orbitGroup = new THREE.Group(); // Group allows self-rotation
            scene.add(orbitGroup);
            orbitGroup.add(planet);
            planet.position.set(0, 0, 0);
            sunMesh = planet; // Store reference

            planets.push({
                group: orbitGroup,
                mesh: planet,
                rotationSpeed: data.rotationSpeed,
                orbitSpeed: 0,
                name: data.name
            });
        } else {
            // == PLANETS ==
            const orbitGroup = new THREE.Group();
            scene.add(orbitGroup);
            orbitGroup.add(planet);
            planet.position.x = data.orbitRadius;
            createOrbitPath(data.orbitRadius);

            planets.push({
                group: orbitGroup,
                mesh: planet,
                rotationSpeed: data.rotationSpeed,
                orbitSpeed: data.orbitSpeed,
                name: data.name
            });

            // Create moon for Earth
            if (data.hasMoon) {
                const moonGeom = new THREE.SphereGeometry(data.size * 0.3, 32, 32);
                const moonMat = new THREE.MeshPhongMaterial({ map: moonTex });
                const moon = new THREE.Mesh(moonGeom, moonMat);
                const moonGroup = new THREE.Group();
                planet.add(moonGroup);
                moonGroup.add(moon);
                moon.position.x = data.size * 1.5;
                moons.push({ group: moonGroup, mesh: moon, orbitSpeed: 0.05 });
            }

            // Create rings for Saturn and Uranus
            if (data.hasRings) {
                const ringTex = data.name === "Saturn" ? saturnRingTex : uranusRingTex;
                const ringGeom = new THREE.RingGeometry(
                    data.ring.innerRadius, 
                    data.ring.outerRadius, 
                    64
                );
                const ringMat = new THREE.MeshPhongMaterial({ 
                    map: ringTex, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    opacity: 0.8 
                });
                const ring = new THREE.Mesh(ringGeom, ringMat);
                ring.rotation.x = Math.PI / 3; // Tilt the rings
                planet.add(ring);
            }
        }
    });

    // == UI Controls ==
    // Toggle visibility of planet speed controls
    let speedControlsVisible = true;
    document.getElementById("toggleSpeedControls").addEventListener("click", () => {
        speedControlsVisible = !speedControlsVisible;
        planets.slice(1).forEach(p => {
            const controlGroup = document.getElementById(`speed-${p.name}`).parentElement;
            controlGroup.style.display = speedControlsVisible ? "block" : "none";
        });
        document.getElementById("toggleSpeedControls").textContent = 
            speedControlsVisible ? "Hide Planet Speeds" : "Show Planet Speeds";
    });

    // Create individual planet speed controls
    const globalSpeedCtl = document.getElementById("globalSpeed");
    const globalSpeedVal = document.getElementById("globalSpeedValue");
    const ctlContainer = document.getElementById("controls");

    planets.slice(1).forEach(p => {
        const grp = document.createElement("div"); 
        grp.className = "control-group";
        
        const lbl = document.createElement("label"); 
        lbl.htmlFor = `speed-${p.name}`; 
        lbl.textContent = `${p.name}: `;
        
        const span = document.createElement("span"); 
        span.className = "speed-value"; 
        span.id = `speedValue-${p.name}`; 
        span.textContent = "1";
        
        lbl.appendChild(span); 
        lbl.appendChild(document.createTextNode("x"));
        
        const input = document.createElement("input"); 
        input.type = "range"; 
        input.id = `speed-${p.name}`; 
        input.min = "0"; 
        input.max = "5"; 
        input.step = "0.1"; 
        input.value = "1";
        
        input.addEventListener("input", () => span.textContent = input.value);
        
        grp.appendChild(lbl); 
        grp.appendChild(input);
        ctlContainer.appendChild(grp);
    });

    // dat.GUI controls
    const gui = new dat.GUI({ autoPlace: false });
    document.getElementById("gui-container").appendChild(gui.domElement);
    const guiOpts = { 
        "Real view": true,  // Toggles ambient light
        "Show paths": true, // Toggles orbit paths
        "Global Speed": 1   // Global speed control
    };

    gui.add(guiOpts, "Real view").onChange(v => {
        ambientLight.intensity = v ? 0 : 0.5; // Toggle ambient light
        if (sunMesh) sunMesh.visible = true; // Always keep sun visible
    });
    
    gui.add(guiOpts, "Show paths").onChange(v => 
        paths.forEach(p => p.visible = v)
    );
    
    // Start animation loop
    animate();
}

// == Animation loop ==
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const globalSpd = +document.getElementById("globalSpeed").value;

    // Update planet positions and rotations
    planets.forEach(p => {
        p.group.rotation.y += p.orbitSpeed * delta * globalSpd;      // Orbit
        p.mesh.rotation.y += p.rotationSpeed * delta * globalSpd;    /// Self-rotation
        
        // Apply individual speed adjustments
        const speedCtl = document.getElementById(`speed-${p.name}`);
        if (speedCtl && p.group) {
            const sf = +speedCtl.value;
            p.group.rotation.y += p.orbitSpeed * delta * (sf - 1);
        }
    });

    // Update moon positions
    moons.forEach(m => m.group.rotation.y += m.orbitSpeed * delta * globalSpd);
    
    // Update camera controls and render
    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize the solar system
createSolarSystem();