import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const BODY_COUNT = 200

const app = document.querySelector('#app')
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x16181b)

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000)
camera.position.z = 430

const goldenAngle = Math.PI * (3 - Math.sqrt(5))

function fibonacciShell(count, radius, phase, rotation) {
  const pts = []
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rotation.x, rotation.y, rotation.z)
  )

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

// Répartition calculée pour garder une densité de surface proche d'une couche à l'autre.
// Le nombre de points augmente approximativement avec r².
// 1 + 12 + 32 + 56 + 99 = 200.
function makeBodyCenters() {
  const pts = [new THREE.Vector3(0, 0, 0)]

  pts.push(...fibonacciShell(
    12,
    0.95,
    0.18,
    new THREE.Vector3(0.22, -0.14, 0.31)
  ))

  pts.push(...fibonacciShell(
    32,
    1.58,
    1.07,
    new THREE.Vector3(-0.31, 0.27, 0.11)
  ))

  pts.push(...fibonacciShell(
    56,
    2.18,
    2.16,
    new THREE.Vector3(0.17, 0.39, -0.26)
  ))

  pts.push(...fibonacciShell(
    99,
    2.82,
    2.91,
    new THREE.Vector3(-0.21, -0.28, 0.37)
  ))

  return pts
}

const controls = {
  ECART: 19,
  TAILLE_BILLES: 1,
  V1: 0,
  LIBERTE: 0.30,
  CAMERA: 430,
  VOIR_CELLULES: false
}

const centers = makeBodyCenters()

const marbleGeometry = new THREE.SphereGeometry(6, 28, 20)
const marbleMaterial = new THREE.MeshStandardMaterial({
  color: 0xf3f3f3,
  roughness: 0.36,
  metalness: 0.02
})

const marbles = []
const phases = []

for (let i = 0; i < BODY_COUNT; i++) {
  const mesh = new THREE.Mesh(marbleGeometry, marbleMaterial)
  scene.add(mesh)
  marbles.push(mesh)

  phases.push({
    a: Math.random() * Math.PI * 2,
    b: Math.random() * Math.PI * 2,
    c: Math.random() * Math.PI * 2,
    sx: 0.78 + Math.random() * 0.38,
    sy: 0.78 + Math.random() * 0.38,
    sz: 0.78 + Math.random() * 0.38
  })
}

const cellGroup = new THREE.Group()
scene.add(cellGroup)

const cellGeometry = new THREE.SphereGeometry(0.5, 10, 8)
const cellMaterial = new THREE.MeshBasicMaterial({
  color: 0x6688aa,
  wireframe: true,
  transparent: true,
  opacity: 0.12
})

for (let i = 0; i < BODY_COUNT; i++) {
  const cell = new THREE.Mesh(cellGeometry, cellMaterial)
  cellGroup.add(cell)
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

  for (let i = 0; i < BODY_COUNT; i++) {
    const p = centers[i]
    const marble = marbles[i]
    const cell = cellGroup.children[i]

    marble.scale.setScalar(controls.TAILLE_BILLES)

    if (controls.V1 === 0) {
      marble.position.copy(p).multiplyScalar(spacing)
    }

    cell.position.copy(p).multiplyScalar(spacing)
    cell.scale.setScalar(spacing * controls.LIBERTE * 2)
  }
}

updateStaticLayout()

const gui = new GUI({ title: 'ENTITY — BASE 200' })
gui.add(controls, 'ECART', 13, 28, 0.25)
  .name('TAILLE / ECART')
  .onChange(updateStaticLayout)

gui.add(controls, 'TAILLE_BILLES', 0.65, 1.8, 0.05)
  .name('TAILLE BILLES')
  .onChange(updateStaticLayout)

gui.add(controls, 'V1', 0, 3, 0.05)
  .name('V1 — VIE INTERNE')

gui.add(controls, 'LIBERTE', 0.05, 0.45, 0.01)
  .name('LIBERTE CELLULE')
  .onChange(updateStaticLayout)

gui.add(controls, 'CAMERA', 250, 800, 10)
  .name('CAMERA')
  .onChange(v => camera.position.z = v)

gui.add(controls, 'VOIR_CELLULES')
  .name('VOIR CELLULES')
  .onChange(v => cellGroup.visible = v)

const label = document.createElement('div')
label.textContent = 'ENTITY — 200 billes — base sphérique'
Object.assign(label.style, {
  position: 'fixed',
  left: '14px',
  bottom: '12px',
  color: 'rgba(255,255,255,.55)',
  font: '12px Arial',
  pointerEvents: 'none'
})
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
      const p = centers[i]
      const q = phases[i]
      const tt = t * speed

      marbles[i].position.set(
        p.x * spacing + Math.sin(tt * q.sx + q.a) * amp,
        p.y * spacing + Math.sin(tt * q.sy + q.b) * amp,
        p.z * spacing + Math.sin(tt * q.sz + q.c) * amp
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
