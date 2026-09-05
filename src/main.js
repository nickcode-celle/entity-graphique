import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const BODY_COUNT = 200
const SATELLITE_COUNT = 5

const app = document.querySelector('#app')
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000)
camera.position.z = 350

const entityGroup = new THREE.Group()
scene.add(entityGroup)

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
function fibonacciShell(count, radius, phase, rotation) {
  const pts = []
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i + 0.5) * (2 / count)
    const rr = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * goldenAngle + phase
    const p = new THREE.Vector3(Math.cos(theta) * rr, y, Math.sin(theta) * rr).multiplyScalar(radius)
    p.applyQuaternion(q)
    pts.push(p)
  }
  return pts
}

function makeBodyCenters() {
  const pts = [new THREE.Vector3(0, 0, 0)]
  pts.push(...fibonacciShell(12, 0.95, 0.18, new THREE.Vector3(0.22, -0.14, 0.31)))
  pts.push(...fibonacciShell(32, 1.58, 1.07, new THREE.Vector3(-0.31, 0.27, 0.11)))
  pts.push(...fibonacciShell(56, 2.18, 2.16, new THREE.Vector3(0.17, 0.39, -0.26)))
  pts.push(...fibonacciShell(99, 2.82, 2.91, new THREE.Vector3(-0.21, -0.28, 0.37)))
  return pts
}

const controls = {
  ECART: 28,
  TAILLE_BILLES: 0.90,
  V1: 1.00,
  LIBERTE: 0.15,
  CHEVAUCHEMENT: 1.45,
  ROTATION: 0.11,
  FREQUENCE_INVERSIONS: 12,
  BRILLANCE: 0.62,
  INTENSITE_LUMIERE: 3.65,
  LUMIERE_AMBIANTE: 1.90,
  CAMERA: 350,
  VOIR_CELLULES: false
}

const personality = [
  { name: 'Curiosité', color: 0xffe600, level: 18 },
  { name: 'Humour', color: 0xff6500, level: 58 },
  { name: 'Franchise', color: 0xe5231f, level: 76 },
  { name: 'Chaleur', color: 0xa86a12, level: 27 },
  { name: 'Réserve', color: 0x2468d8, level: 12 },
  { name: 'Contradiction', color: 0x7137c8, level: 68 },
  { name: 'Imagination', color: 0x5146e5, level: 84 },
  { name: 'Spontanéité', color: 0x28c95b, level: 43 },
  { name: 'Sensibilité', color: 0xe95a9d, level: 22 },
  { name: 'Esprit critique', color: 0x13bfc8, level: 63 }
]

const assignments = Array.from({ length: BODY_COUNT }, (_, i) => i % personality.length)
for (let i = assignments.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[assignments[i], assignments[j]] = [assignments[j], assignments[i]]
}

// Règle ENTITY : les billes d'un même sous-domaine peuvent être très différentes,
// mais leur moyenne doit rester exactement égale au niveau global du sous-domaine.
// On construit des paires symétriques autour de la moyenne : par exemple 40/60 pour 50%.
const individualLevels = new Array(BODY_COUNT)
for (let p = 0; p < personality.length; p++) {
  const ids = assignments.map((a, i) => a === p ? i : -1).filter(i => i >= 0)
  const target = personality[p].level
  const maxSymmetricSpread = Math.min(20, target, 100 - target)
  const values = []

  for (let k = 0; k + 1 < ids.length; k += 2) {
    const spread = maxSymmetricSpread * (0.25 + Math.random() * 0.75)
    values.push(target - spread, target + spread)
  }
  if (ids.length % 2 === 1) values.push(target)

  // Mélange pour que les valeurs basses/hautes soient réparties aléatoirement dans le corps.
  for (let k = values.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1))
    ;[values[k], values[j]] = [values[j], values[k]]
  }
  ids.forEach((id, k) => individualLevels[id] = values[k])
}

function personalityColor(index) {
  const p = personality[assignments[index]]
  const vivid = new THREE.Color(p.color)
  const hsl = {}
  vivid.getHSL(hsl)
  const level = individualLevels[index] / 100
  const saturation = level <= 0.40
    ? THREE.MathUtils.lerp(0.62, 0.88, level / 0.40)
    : THREE.MathUtils.lerp(0.88, 1.0, (level - 0.40) / 0.60)
  return new THREE.Color().setHSL(hsl.h, saturation, hsl.l)
}

const allMarbleMaterials = []
function personalityMaterial(index) {
  const material = new THREE.MeshStandardMaterial({
    color: personalityColor(index),
    roughness: 1 - controls.BRILLANCE,
    metalness: 0.02,
    transparent: false,
    opacity: 1
  })
  allMarbleMaterials.push(material)
  return material
}

function updateShine() {
  const roughness = 1 - controls.BRILLANCE
  for (const material of allMarbleMaterials) material.roughness = roughness
}

const centers = makeBodyCenters()
const marbleGeometry = new THREE.SphereGeometry(6, 28, 20)
const marbles = []
const directions = []
const travel = []
const wanderTargets = []
const wanderClocks = []

function randomDirection() {
  return new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize()
}

for (let i = 0; i < BODY_COUNT; i++) {
  const mesh = new THREE.Mesh(marbleGeometry, personalityMaterial(i))
  mesh.scale.setScalar(controls.TAILLE_BILLES)
  mesh.castShadow = true
  mesh.receiveShadow = true
  entityGroup.add(mesh)
  marbles.push(mesh)
  directions.push(randomDirection())
  travel.push(new THREE.Vector3())
  wanderTargets.push(randomDirection())
  wanderClocks.push(Math.random() * 2.5)
}

const satelliteGroup = new THREE.Group()
scene.add(satelliteGroup)
const satellites = []
const satelliteData = [
  { radius: 103, speed: 0.19, phase: 0.40, tiltX: 0.55, tiltZ: 0.18 },
  { radius: 112, speed: -0.14, phase: 1.70, tiltX: -0.38, tiltZ: 0.72 },
  { radius: 98, speed: 0.23, phase: 2.95, tiltX: 0.22, tiltZ: -0.61 },
  { radius: 108, speed: -0.17, phase: 4.15, tiltX: 0.68, phaseOffset: 0.0, tiltZ: -0.27 },
  { radius: 101, speed: 0.15, phase: 5.45, tiltX: -0.52, tiltZ: -0.76 }
]
for (let i = 0; i < SATELLITE_COUNT; i++) {
  const mesh = new THREE.Mesh(marbleGeometry, personalityMaterial(i))
  mesh.scale.setScalar(controls.TAILLE_BILLES)
  mesh.castShadow = true
  mesh.receiveShadow = true
  satelliteGroup.add(mesh)
  satellites.push(mesh)
}

const cellGroup = new THREE.Group()
entityGroup.add(cellGroup)
const cellGeometry = new THREE.SphereGeometry(0.5, 10, 8)
const cellMaterial = new THREE.MeshBasicMaterial({ color: 0x6688aa, wireframe: true, transparent: true, opacity: 0.12 })
for (let i = 0; i < BODY_COUNT; i++) cellGroup.add(new THREE.Mesh(cellGeometry, cellMaterial))
cellGroup.visible = false

const ambientLight = new THREE.HemisphereLight(0xffffff, 0x30343b, controls.LUMIERE_AMBIANTE)
scene.add(ambientLight)

const cameraLightOffset = new THREE.Vector3(42, 28, 0)
const cameraLight = new THREE.SpotLight(0xffffff, controls.INTENSITE_LUMIERE, 0, Math.PI / 3.2, 0.55, 0)
cameraLight.position.copy(camera.position).add(cameraLightOffset)
cameraLight.target.position.set(0, 0, 0)
cameraLight.castShadow = true
cameraLight.shadow.mapSize.set(4096, 4096)
cameraLight.shadow.camera.near = 100
cameraLight.shadow.camera.far = 800
cameraLight.shadow.bias = -0.00015
cameraLight.shadow.normalBias = 0.015
cameraLight.shadow.radius = 3
scene.add(cameraLight)
scene.add(cameraLight.target)

function updateLayout() {
  const spacing = controls.ECART
  for (let i = 0; i < BODY_COUNT; i++) {
    marbles[i].scale.setScalar(controls.TAILLE_BILLES)
    marbles[i].position.copy(centers[i]).multiplyScalar(spacing).add(travel[i])
    const cell = cellGroup.children[i]
    cell.position.copy(centers[i]).multiplyScalar(spacing)
    cell.scale.setScalar(spacing * controls.LIBERTE * controls.CHEVAUCHEMENT * 2)
  }
  for (const satellite of satellites) satellite.scale.setScalar(controls.TAILLE_BILLES)
}
updateLayout()

function updateCameraAndLight() {
  camera.position.z = controls.CAMERA
  cameraLight.position.copy(camera.position).add(cameraLightOffset)
}

const gui = new GUI({ title: 'ENTITY — PERSONNALITÉ / COULEUR' })
gui.add(controls, 'ROTATION', 0, 2.0, 0.01).name('V2 — VITESSE ROTATION')
gui.add(controls, 'FREQUENCE_INVERSIONS', 0, 12, 0.1).name('FREQUENCE INVERSIONS / MIN')
gui.add(controls, 'BRILLANCE', 0, 1, 0.01).name('BRILLANCE BILLES').onChange(updateShine)
gui.add(controls, 'INTENSITE_LUMIERE', 0, 6, 0.05).name('INTENSITÉ LUMIÈRE').onChange(v => cameraLight.intensity = v)
gui.add(controls, 'LUMIERE_AMBIANTE', 0, 3, 0.05).name('LUMIÈRE AMBIANTE').onChange(v => ambientLight.intensity = v)
gui.add(controls, 'ECART', 13, 28, 0.25).name('TAILLE / ECART').onChange(updateLayout)
gui.add(controls, 'TAILLE_BILLES', 0.4, 1.8, 0.02).name('TAILLE BILLES').onChange(updateLayout)
gui.add(controls, 'V1', 0, 3, 0.05).name('V1 — VIE INTERNE')
gui.add(controls, 'LIBERTE', 0.05, 0.45, 0.01).name('LIBERTE CELLULE').onChange(updateLayout)
gui.add(controls, 'CHEVAUCHEMENT', 1.0, 1.8, 0.05).name('CHEVAUCHEMENT').onChange(updateLayout)
gui.add(controls, 'CAMERA', 250, 800, 10).name('CAMERA').onChange(updateCameraAndLight)
gui.add(controls, 'VOIR_CELLULES').name('VOIR CELLULES').onChange(v => cellGroup.visible = v)

const label = document.createElement('div')
label.textContent = 'ENTITY — Personnalité : moyenne globale exacte + fortes disparités individuelles'
Object.assign(label.style, { position:'fixed', left:'14px', bottom:'12px', color:'rgba(255,255,255,.65)', font:'12px Arial', pointerEvents:'none' })
document.body.appendChild(label)

const clock = new THREE.Clock()
const inward = new THREE.Vector3()
const steer = new THREE.Vector3()
const rotationAxis = randomDirection()
const rotationAxisTarget = randomDirection()
const deltaRotation = new THREE.Quaternion()
let rotationAxisClock = 8 + Math.random() * 8
let rotationSense = 1
let elapsed = 0
const satelliteEuler = new THREE.Euler()
const satellitePos = new THREE.Vector3()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.04)
  elapsed += dt
  const spacing = controls.ECART
  const softRadius = spacing * controls.LIBERTE
  const maxRadius = softRadius * controls.CHEVAUCHEMENT
  const speed = controls.V1 * spacing * 0.42

  for (let i = 0; i < BODY_COUNT; i++) {
    if (speed > 0) {
      wanderClocks[i] -= dt
      if (wanderClocks[i] <= 0) {
        wanderClocks[i] = 0.8 + Math.random() * 2.4
        wanderTargets[i].lerp(randomDirection(), 0.65).normalize()
      }
      const d = travel[i].length()
      const normalized = maxRadius > 0 ? d / maxRadius : 0
      const returnStrength = THREE.MathUtils.smoothstep(normalized, 0.55, 1.0)
      inward.copy(travel[i])
      if (inward.lengthSq() > 0.000001) inward.normalize().multiplyScalar(-1)
      else inward.set(0, 0, 0)
      steer.copy(wanderTargets[i]).multiplyScalar(0.30)
      steer.addScaledVector(inward, returnStrength * 1.55)
      directions[i].addScaledVector(steer, dt).normalize()
      travel[i].addScaledVector(directions[i], speed * dt)
      if (travel[i].length() > maxRadius) {
        travel[i].setLength(maxRadius)
        directions[i].lerp(inward, 0.06).normalize()
      }
    }
    marbles[i].position.copy(centers[i]).multiplyScalar(spacing).add(travel[i])
  }

  if (controls.ROTATION > 0) {
    rotationAxisClock -= dt
    if (rotationAxisClock <= 0) {
      rotationAxisClock = 8 + Math.random() * 10
      rotationAxisTarget.copy(randomDirection())
      if (rotationAxisTarget.dot(rotationAxis) < -0.7) rotationAxisTarget.multiplyScalar(-1)
    }
    rotationAxis.lerp(rotationAxisTarget, 1 - Math.exp(-dt * 0.22)).normalize()
    const inversionsPerSecond = controls.FREQUENCE_INVERSIONS / 60
    const reverseProbabilityThisFrame = 1 - Math.exp(-inversionsPerSecond * dt)
    if (Math.random() < reverseProbabilityThisFrame) rotationSense *= -1
    deltaRotation.setFromAxisAngle(rotationAxis, controls.ROTATION * rotationSense * dt)
    entityGroup.quaternion.premultiply(deltaRotation).normalize()
  }

  for (let i = 0; i < SATELLITE_COUNT; i++) {
    const s = satelliteData[i]
    const a = s.phase + elapsed * s.speed
    satellitePos.set(Math.cos(a) * s.radius, 0, Math.sin(a) * s.radius)
    satelliteEuler.set(s.tiltX, 0, s.tiltZ)
    satellitePos.applyEuler(satelliteEuler)
    satellites[i].position.copy(satellitePos)
  }

  cameraLight.position.copy(camera.position).add(cameraLightOffset)
  renderer.render(scene, camera)
}
animate()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
