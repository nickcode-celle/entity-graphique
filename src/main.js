import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const BODY_COUNT = 93
const SATELLITE_COUNT = 7
const TOTAL = BODY_COUNT + SATELLITE_COUNT

const app = document.querySelector('#app')
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000)
camera.position.z = 420

const goldenAngle = Math.PI * (3 - Math.sqrt(5))

function fibonacciShell(count, radius, phase, rotation) {
  const pts = []
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i + 0.5) * (2 / count)
    const rr = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * goldenAngle + phase
    const p = new THREE.Vector3(
      Math.cos(theta) * rr,
      y,
      Math.sin(theta) * rr
    ).multiplyScalar(radius)
    p.applyQuaternion(q)
    pts.push(p)
  }
  return pts
}

// Corps volontairement construit en couches sphériques non alignées.
// 1 + 14 + 28 + 50 = 93 billes.
function makeBodyCenters() {
  const pts = [new THREE.Vector3(0, 0, 0)]
  pts.push(...fibonacciShell(14, 0.95, 0.27, new THREE.Vector3(0.31, 0.18, -0.22)))
  pts.push(...fibonacciShell(28, 1.90, 1.14, new THREE.Vector3(-0.24, 0.43, 0.16)))
  pts.push(...fibonacciShell(50, 2.85, 2.03, new THREE.Vector3(0.19, -0.37, 0.29)))
  return pts
}

const controls = {
  ECART: 25,
  TAILLE_BILLES: 1,
  V1: 0,
  LIBERTE: 0.34,
  SATELLITES: 3.22,
  CAMERA: 420,
  VOIR_CELLULES: false
}

const centers = makeBodyCenters()
const marbleGeometry = new THREE.SphereGeometry(6, 24, 18)
const marbleMaterial = new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.38, metalness: 0.02 })
const marbles = []
const phases = []

for (let i = 0; i < TOTAL; i++) {
  const mesh = new THREE.Mesh(marbleGeometry, marbleMaterial)
  scene.add(mesh)
  marbles.push(mesh)
  phases.push({
    a: Math.random() * Math.PI * 2,
    b: Math.random() * Math.PI * 2,
    c: Math.random() * Math.PI * 2,
    sx: 0.72 + Math.random() * 0.55,
    sy: 0.72 + Math.random() * 0.55,
    sz: 0.72 + Math.random() * 0.55
  })
}

// Satellites : répartition autour du corps, juste au-delà de l'enveloppe.
const satelliteDirections = []
for (let i = 0; i < SATELLITE_COUNT; i++) {
  const y = 1 - (i + 0.5) * (2 / SATELLITE_COUNT)
  const radius = Math.sqrt(1 - y * y)
  const theta = i * goldenAngle + 0.63
  satelliteDirections.push(new THREE.Vector3(
    Math.cos(theta) * radius,
    y,
    Math.sin(theta) * radius
  ).normalize())
}
const satelliteVariations = [0.98, 1.04, 1.00, 1.07, 0.96, 1.03, 0.99]

const cellGroup = new THREE.Group()
scene.add(cellGroup)
const cellGeometry = new THREE.SphereGeometry(0.5, 10, 8)
const cellMaterial = new THREE.MeshBasicMaterial({ color: 0x6688aa, wireframe: true, transparent: true, opacity: 0.13 })
for (let i = 0; i < BODY_COUNT; i++) {
  const c = new THREE.Mesh(cellGeometry, cellMaterial)
  cellGroup.add(c)
}
cellGroup.visible = false

scene.add(new THREE.HemisphereLight(0xffffff, 0x20242a, 2.2))
const key = new THREE.DirectionalLight(0xffffff, 3.2)
key.position.set(-2, 4, 5)
scene.add(key)
const rim = new THREE.DirectionalLight(0xffffff, 1.4)
rim.position.set(5, -2, -4)
scene.add(rim)

function updateStaticLayout() {
  const spacing = controls.ECART
  marbles.forEach(m => m.scale.setScalar(controls.TAILLE_BILLES))

  for (let i = 0; i < BODY_COUNT; i++) {
    const p = centers[i]
    if (controls.V1 === 0) marbles[i].position.copy(p).multiplyScalar(spacing)
    const cell = cellGroup.children[i]
    cell.position.copy(p).multiplyScalar(spacing)
    cell.scale.setScalar(spacing * controls.LIBERTE * 2)
  }

  for (let i = 0; i < SATELLITE_COUNT; i++) {
    const p = satelliteDirections[i].clone().multiplyScalar(controls.SATELLITES * satelliteVariations[i])
    if (controls.V1 === 0) marbles[BODY_COUNT + i].position.copy(p).multiplyScalar(spacing)
  }
}
updateStaticLayout()

const gui = new GUI({ title: 'ENTITY — SPHERE 93 + 7' })
gui.add(controls, 'ECART', 16, 36, 0.5).name('TAILLE / ECART').onChange(updateStaticLayout)
gui.add(controls, 'TAILLE_BILLES', 0.5, 2.5, 0.05).name('TAILLE BILLES').onChange(updateStaticLayout)
gui.add(controls, 'V1', 0, 3, 0.05).name('V1 — VIE INTERNE')
gui.add(controls, 'LIBERTE', 0.05, 0.48, 0.01).name('LIBERTE CELLULE').onChange(updateStaticLayout)
gui.add(controls, 'SATELLITES', 2.95, 4.0, 0.05).name('DISTANCE SATELLITES').onChange(updateStaticLayout)
gui.add(controls, 'CAMERA', 250, 800, 10).name('CAMERA').onChange(v => camera.position.z = v)
gui.add(controls, 'VOIR_CELLULES').name('VOIR CELLULES').onChange(v => cellGroup.visible = v)

const label = document.createElement('div')
label.textContent = '100 billes — 93 corps + 7 satellites'
Object.assign(label.style, { position:'fixed', left:'14px', bottom:'12px', color:'rgba(255,255,255,.55)', font:'12px Arial', pointerEvents:'none' })
document.body.appendChild(label)

const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const t = clock.getElapsedTime()
  const spacing = controls.ECART
  const amp = spacing * controls.LIBERTE
  const speed = controls.V1

  if (speed > 0) {
    for (let i = 0; i < BODY_COUNT; i++) {
      const p = centers[i], q = phases[i]
      const tt = t * speed
      marbles[i].position.set(
        p.x * spacing + Math.sin(tt * q.sx + q.a) * amp,
        p.y * spacing + Math.sin(tt * q.sy + q.b) * amp,
        p.z * spacing + Math.sin(tt * q.sz + q.c) * amp
      )
    }

    for (let i = 0; i < SATELLITE_COUNT; i++) {
      const idx = BODY_COUNT + i
      const q = phases[idx]
      const base = satelliteDirections[i].clone().multiplyScalar(controls.SATELLITES * satelliteVariations[i] * spacing)
      const tt = t * speed * 0.45
      const satelliteAmp = spacing * 0.12
      marbles[idx].position.set(
        base.x + Math.sin(tt * q.sx + q.a) * satelliteAmp,
        base.y + Math.sin(tt * q.sy + q.b) * satelliteAmp,
        base.z + Math.sin(tt * q.sz + q.c) * satelliteAmp
      )
    }
  }

  renderer.render(scene, camera)
}
animate()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
