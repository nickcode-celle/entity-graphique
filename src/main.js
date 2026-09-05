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
  ROTATION: 0.60,
  CAMERA: 430,
  VOIR_CELLULES: false
}

const centers = makeBodyCenters()
const marbleGeometry = new THREE.SphereGeometry(6, 28, 20)
const marbleMaterial = new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.36, metalness: 0.02 })
const marbles = []
const directions = []
const travel = []
const wanderTargets = []
const wanderClocks = []

function randomDirection() {
  return new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1
  ).normalize()
}

for (let i = 0; i < BODY_COUNT; i++) {
  const mesh = new THREE.Mesh(marbleGeometry, marbleMaterial)
  mesh.scale.setScalar(controls.TAILLE_BILLES)
  entityGroup.add(mesh)
  marbles.push(mesh)
  directions.push(randomDirection())
  travel.push(new THREE.Vector3())
  wanderTargets.push(randomDirection())
  wanderClocks.push(Math.random() * 2.5)
}

const cellGroup = new THREE.Group()
entityGroup.add(cellGroup)
const cellGeometry = new THREE.SphereGeometry(0.5, 10, 8)
const cellMaterial = new THREE.MeshBasicMaterial({ color: 0x6688aa, wireframe: true, transparent: true, opacity: 0.12 })
for (let i = 0; i < BODY_COUNT; i++) cellGroup.add(new THREE.Mesh(cellGeometry, cellMaterial))
cellGroup.visible = false

scene.add(new THREE.HemisphereLight(0xffffff, 0x20242a, 2.2))
const key = new THREE.DirectionalLight(0xffffff, 3.2)
key.position.set(-2, 4, 5)
scene.add(key)
const rim = new THREE.DirectionalLight(0xffffff, 1.4)
rim.position.set(5, -2, -4)
scene.add(rim)

function updateLayout() {
  const spacing = controls.ECART
  for (let i = 0; i < BODY_COUNT; i++) {
    marbles[i].scale.setScalar(controls.TAILLE_BILLES)
    marbles[i].position.copy(centers[i]).multiplyScalar(spacing).add(travel[i])
    const cell = cellGroup.children[i]
    cell.position.copy(centers[i]).multiplyScalar(spacing)
    cell.scale.setScalar(spacing * controls.LIBERTE * controls.CHEVAUCHEMENT * 2)
  }
}
updateLayout()

const gui = new GUI({ title: 'ENTITY — BASE 200 — V2 ACTIVE' })
gui.add(controls, 'ROTATION', 0, 2.0, 0.01).name('V2 — VITESSE ROTATION')
gui.add(controls, 'ECART', 13, 28, 0.25).name('TAILLE / ECART').onChange(updateLayout)
gui.add(controls, 'TAILLE_BILLES', 0.4, 1.8, 0.02).name('TAILLE BILLES').onChange(updateLayout)
gui.add(controls, 'V1', 0, 3, 0.05).name('V1 — VIE INTERNE')
gui.add(controls, 'LIBERTE', 0.05, 0.45, 0.01).name('LIBERTE CELLULE').onChange(updateLayout)
gui.add(controls, 'CHEVAUCHEMENT', 1.0, 1.8, 0.05).name('CHEVAUCHEMENT').onChange(updateLayout)
gui.add(controls, 'CAMERA', 250, 800, 10).name('CAMERA').onChange(v => camera.position.z = v)
gui.add(controls, 'VOIR_CELLULES').name('VOIR CELLULES').onChange(v => cellGroup.visible = v)

const label = document.createElement('div')
label.textContent = 'ENTITY — VERSION ROTATION V2 — curseur en haut du panneau'
Object.assign(label.style, {
  position:'fixed', left:'14px', bottom:'12px',
  color:'rgba(255,255,255,.65)', font:'12px Arial', pointerEvents:'none'
})
document.body.appendChild(label)

const clock = new THREE.Clock()
const inward = new THREE.Vector3()
const steer = new THREE.Vector3()
const rotationAxis = randomDirection()
const rotationAxisTarget = randomDirection()
const deltaRotation = new THREE.Quaternion()
let rotationAxisClock = 8 + Math.random() * 8

function animate() {
  requestAnimationFrame(animate)

  const dt = Math.min(clock.getDelta(), 0.04)
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

  // Rotation du corps entier. L'axe dérive lentement et continûment.
  if (controls.ROTATION > 0) {
    rotationAxisClock -= dt
    if (rotationAxisClock <= 0) {
      rotationAxisClock = 8 + Math.random() * 10
      rotationAxisTarget.copy(randomDirection())
      if (rotationAxisTarget.dot(rotationAxis) < -0.7) rotationAxisTarget.multiplyScalar(-1)
    }

    rotationAxis.lerp(rotationAxisTarget, 1 - Math.exp(-dt * 0.22)).normalize()
    deltaRotation.setFromAxisAngle(rotationAxis, controls.ROTATION * dt)
    entityGroup.quaternion.premultiply(deltaRotation).normalize()
  }

  renderer.render(scene, camera)
}
animate()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
