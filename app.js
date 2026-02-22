const canvas = document.getElementById('scene');
const statusBox = document.getElementById('status');
const componentGrid = document.getElementById('componentGrid');

const componentTypes = [
  { id: 'receptacle120', name: 'Receptacle (120V)', detail: 'Standard outlet', color: 0x60a5fa, shape: 'box', size: [0.28, 0.28, 0.1], wallMounted: true, defaultY: 0.35 },
  { id: 'receptacle240', name: 'Receptacle (240V)', detail: 'Dryer/Range outlet', color: 0x3b82f6, shape: 'box', size: [0.3, 0.3, 0.1], wallMounted: true, defaultY: 0.45 },
  { id: 'ceilingLight', name: 'Ceiling Light', detail: 'Main room luminaire', color: 0xfbbf24, shape: 'sphere', radius: 0.18, wallMounted: false, defaultY: 2.8 },
  { id: 'wallSconce', name: 'Wall Fixture', detail: 'Wall-mounted fixture', color: 0xf59e0b, shape: 'sphere', radius: 0.14, wallMounted: true, defaultY: 1.9 },
  { id: 'appliancePlug', name: 'Appliance Plug', detail: 'Dedicated appliance point', color: 0x34d399, shape: 'cylinder', radiusTop: 0.12, radiusBottom: 0.12, height: 0.12, wallMounted: false, defaultY: 0.1 },
  { id: 'usbOutlet', name: 'USB Outlet', detail: 'Low voltage charging point', color: 0x2dd4bf, shape: 'box', size: [0.26, 0.2, 0.08], wallMounted: true, defaultY: 1.1 }
];

let selectedType = componentTypes[0];
let room = { width: 10, depth: 8, wallHeight: 3 };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
camera.position.set(8, 7, 10);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.2, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const directional = new THREE.DirectionalLight(0xffffff, 0.9);
directional.position.set(6, 10, 7);
scene.add(directional);

const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95, metalness: 0.05 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.22, side: THREE.DoubleSide });

let floorMesh;
let wallMeshes = [];
const placedComponents = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let dragging = null;
let selectedObject = null;

function setStatus(message) {
  statusBox.textContent = message;
}

function buildRoom() {
  if (floorMesh) scene.remove(floorMesh);
  wallMeshes.forEach((w) => scene.remove(w));
  wallMeshes = [];

  const floorGeo = new THREE.PlaneGeometry(room.width, room.depth);
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.userData.isFloor = true;
  scene.add(floorMesh);

  const wallGeoX = new THREE.PlaneGeometry(room.width, room.wallHeight);
  const wallGeoZ = new THREE.PlaneGeometry(room.depth, room.wallHeight);

  const backWall = new THREE.Mesh(wallGeoX, wallMat);
  backWall.position.set(0, room.wallHeight / 2, -room.depth / 2);

  const frontWall = new THREE.Mesh(wallGeoX, wallMat);
  frontWall.position.set(0, room.wallHeight / 2, room.depth / 2);
  frontWall.rotation.y = Math.PI;

  const leftWall = new THREE.Mesh(wallGeoZ, wallMat);
  leftWall.position.set(-room.width / 2, room.wallHeight / 2, 0);
  leftWall.rotation.y = Math.PI / 2;

  const rightWall = new THREE.Mesh(wallGeoZ, wallMat);
  rightWall.position.set(room.width / 2, room.wallHeight / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;

  wallMeshes = [backWall, frontWall, leftWall, rightWall];
  wallMeshes.forEach((w) => {
    w.userData.isWall = true;
    scene.add(w);
  });

  placedComponents.splice(0).forEach((component) => scene.remove(component));
  selectedObject = null;

  controls.target.set(0, Math.max(1, room.wallHeight * 0.4), 0);
  controls.update();
  setStatus(`Selected tool: ${selectedType.name}`);
}

function makeGeometry(type) {
  if (type.shape === 'box') return new THREE.BoxGeometry(...type.size);
  if (type.shape === 'sphere') return new THREE.SphereGeometry(type.radius, 20, 20);
  return new THREE.CylinderGeometry(type.radiusTop, type.radiusBottom, type.height, 20);
}

function clampToRoom(position) {
  const margin = 0.1;
  position.x = Math.max(-room.width / 2 + margin, Math.min(room.width / 2 - margin, position.x));
  position.z = Math.max(-room.depth / 2 + margin, Math.min(room.depth / 2 - margin, position.z));
}

function placeComponent(hitPoint, hitObject) {
  const mat = new THREE.MeshStandardMaterial({ color: selectedType.color, emissive: selectedType.color, emissiveIntensity: 0.12, roughness: 0.4 });
  const mesh = new THREE.Mesh(makeGeometry(selectedType), mat);

  if (selectedType.wallMounted && hitObject?.userData.isWall) {
    mesh.position.copy(hitPoint);
    mesh.position.y = Math.max(0.1, Math.min(room.wallHeight - 0.1, selectedType.defaultY));
    const inward = new THREE.Vector3(0, 0, 1).applyQuaternion(hitObject.quaternion);
    mesh.position.addScaledVector(inward, 0.06);
  } else {
    mesh.position.set(hitPoint.x, selectedType.defaultY, hitPoint.z);
    clampToRoom(mesh.position);
  }

  mesh.userData.component = selectedType.id;
  mesh.userData.label = selectedType.name;
  placedComponents.push(mesh);
  scene.add(mesh);
  selectedObject = mesh;
  setStatus(`${selectedType.name} placed. Drag to move, Delete to remove.`);
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener('pointerdown', (event) => {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...placedComponents, floorMesh, ...wallMeshes], false);
  if (!hits.length) return;

  const hit = hits[0];
  if (placedComponents.includes(hit.object)) {
    dragging = hit.object;
    selectedObject = hit.object;
    setStatus(`Selected: ${hit.object.userData.label}. Drag to move, Delete to remove.`);
    return;
  }

  placeComponent(hit.point, hit.object);
});

window.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);

  const preferredTargets = dragging.userData.component.includes('receptacle') || dragging.userData.component === 'usbOutlet' || dragging.userData.component === 'wallSconce'
    ? wallMeshes
    : [floorMesh];

  const hits = raycaster.intersectObjects(preferredTargets, false);
  if (!hits.length) return;
  const hit = hits[0];

  if (preferredTargets === wallMeshes) {
    dragging.position.copy(hit.point);
    dragging.position.y = Math.max(0.1, Math.min(room.wallHeight - 0.1, dragging.position.y));
    const inward = new THREE.Vector3(0, 0, 1).applyQuaternion(hit.object.quaternion);
    dragging.position.addScaledVector(inward, 0.06);
  } else {
    dragging.position.set(hit.point.x, dragging.position.y, hit.point.z);
    clampToRoom(dragging.position);
  }
});

window.addEventListener('pointerup', () => {
  dragging = null;
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Delete' || !selectedObject) return;
  scene.remove(selectedObject);
  const idx = placedComponents.indexOf(selectedObject);
  if (idx >= 0) placedComponents.splice(idx, 1);
  setStatus('Component removed.');
  selectedObject = null;
});

function renderComponentCards() {
  componentTypes.forEach((type) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'component-card';
    card.innerHTML = `<strong>${type.name}</strong><span>${type.detail}</span>`;
    if (type.id === selectedType.id) card.classList.add('active');
    card.addEventListener('click', () => {
      selectedType = type;
      document.querySelectorAll('.component-card').forEach((el) => el.classList.remove('active'));
      card.classList.add('active');
      setStatus(`Selected tool: ${selectedType.name}`);
    });
    componentGrid.appendChild(card);
  });
}

function fitRenderer() {
  const parent = canvas.parentElement;
  renderer.setSize(parent.clientWidth, parent.clientHeight);
  camera.aspect = parent.clientWidth / parent.clientHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', fitRenderer);

document.getElementById('createLayout').addEventListener('click', () => {
  room.width = Number(document.getElementById('roomWidth').value) || room.width;
  room.depth = Number(document.getElementById('roomDepth').value) || room.depth;
  room.wallHeight = Number(document.getElementById('wallHeight').value) || room.wallHeight;
  buildRoom();
});

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

renderComponentCards();
buildRoom();
fitRenderer();
animate();
