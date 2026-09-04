import * as THREE from 'three'
import GUI from 'lil-gui'
import './style.css'

const app = document.querySelector('#app')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050505)

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 11)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
app.appendChild(renderer.domElement)

const params = {
  cohesion: 0.0024,
  separation: 0.052,
  alignment: 0.085,
  centering: 0.0032,
  flow: 0.010,
  flowSpeed: 0.16,
  maxSpeed: 0.030,
  neighbourRadius: 2.15,
  comfortDistance: 0.46,
  depth: 0.42,
  sheetForce: 0.028,
  wave: 0.42,
  breathing: 0.025,
  breathingSpeed: 0.26,
}

const gui = new GUI({ title: 'ENTITY — Murmuration V4' })
gui.add(params, 'cohesion', 0, 0.02, 0.0001).name('Cohésion')
gui.add(params, 'separation', 0, 0.15, 0.001).name('Séparation')
gui.add(params, 'alignment', 0, 0.14, 0.001).name('Alignement')
gui.add(params, 'centering', 0, 0.02, 0.0001).name('Rappel centre')
gui.add(params, 'flow', 0, 0.03, 0.0005).name('Flux collectif')
gui.add(params, 'flowSpeed', 0.05, 0.6, 0.01).name('Rythme du flux')
gui.add(params, 'maxSpeed', 0.005, 0.08, 0.001).name('Vitesse')
gui.add(params, 'neighbourRadius', 0.5, 3.5, 0.05).name('Rayon voisins')
gui.add(params, 'comfortDistance', 0.2, 1, 0.01).name('Distance confort')
gui.add(params, 'depth', 0.08, 1.2, 0.01).name('Profondeur')
gui.add(params, 'wave', 0, 1.1, 0.01).name('Ondulation')
gui.add(params, 'breathing', 0, 0.15, 0.005).name('Respiration')
gui.add(params, 'breathingSpeed', 0.1, 1, 0.05).name('Rythme respiration')

const swarm = new THREE.Group()
scene.add(swarm)

const geometry = new THREE.SphereGeometry(0.105, 18, 18)
const material = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.38, metalness: 0.06 })
scene.add(new THREE.AmbientLight(0xffffff, 0.85))
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
keyLight.position.set(5, 6, 8)
scene.add(keyLight)
const fillLight = new THREE.DirectionalLight(0xffffff, 0.7)
fillLight.position.set(-5, -2, 4)
scene.add(fillLight)

const marbles = []
for (let i = 0; i < 100; i++) {
  const mesh = new THREE.Mesh(geometry, material)

  // Nappe large et peu profonde, plutôt qu'un nuage sphérique.
  const x = (Math.random() - 0.5) * 8.2
  const envelope = 1.3 + 0.75 * (1 - Math.min(Math.abs(x) / 4.1, 1))
  const y = (Math.random() - 0.5) * envelope * 2.0
  const z = (Math.random() - 0.5) * params.depth * 2

  mesh.position.set(x, y, z)

  const velocity = new THREE.Vector3(1, 0, 0)
    .add(new THREE.Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.04))
    .normalize()
    .multiplyScalar(params.maxSpeed * (0.78 + Math.random() * 0.12))

  marbles.push({ mesh, velocity })
  swarm.add(mesh)
}

const center = new THREE.Vector3()
const cohesionForce = new THREE.Vector3()
const separationForce = new THREE.Vector3()
const alignmentForce = new THREE.Vector3()
const centeringForce = new THREE.Vector3()
const flowForce = new THREE.Vector3()
const globalFlow = new THREE.Vector3()
const delta = new THREE.Vector3()
const tmp = new THREE.Vector3()
const clock = new THREE.Clock()

function limitSpeed(v, max) {
  if (v.lengthSq() > max * max) v.setLength(max)
}

function updateSwarm(dt, elapsed) {
  center.set(0, 0, 0)
  for (const m of marbles) center.add(m.mesh.position)
  center.divideScalar(marbles.length)

  centeringForce.set(-center.x * params.centering, -center.y * params.centering, -center.z * params.centering * 1.8)

  globalFlow.set(
    Math.cos(elapsed * params.flowSpeed),
    Math.sin(elapsed * params.flowSpeed * 0.83) * 0.42,
    0
  ).normalize()

  for (let i = 0; i < marbles.length; i++) {
    const marble = marbles[i]

    cohesionForce.copy(center).sub(marble.mesh.position)
    cohesionForce.z *= 0.25
    cohesionForce.multiplyScalar(params.cohesion)

    separationForce.set(0, 0, 0)
    alignmentForce.set(0, 0, 0)
    let neighbours = 0

    for (let j = 0; j < marbles.length; j++) {
      if (i === j) continue
      const other = marbles[j]
      delta.copy(marble.mesh.position).sub(other.mesh.position)
      const d2 = delta.lengthSq()

      if (d2 < params.neighbourRadius ** 2) {
        alignmentForce.add(other.velocity)
        neighbours++
      }

      if (d2 > 0 && d2 < params.comfortDistance ** 2) {
        const d = Math.sqrt(d2)
        separationForce.add(tmp.copy(delta).normalize().multiplyScalar((params.comfortDistance - d) / params.comfortDistance))
      }
    }

    if (neighbours) {
      alignmentForce.divideScalar(neighbours).sub(marble.velocity).multiplyScalar(params.alignment)
    }
    separationForce.multiplyScalar(params.separation)

    // Flux partagé : les zones voisines suivent la même vague au lieu d'agir séparément.
    const p = marble.mesh.position
    const localWave = Math.sin(p.x * 0.72 + elapsed * params.flowSpeed * 4.0)
    const secondaryWave = Math.sin(p.x * 0.31 - elapsed * params.flowSpeed * 2.1)

    flowForce.copy(globalFlow)
    flowForce.y += localWave * params.wave * 0.34 + secondaryWave * params.wave * 0.14
    flowForce.x += Math.cos(p.y * 0.55 + elapsed * params.flowSpeed * 1.6) * 0.08
    flowForce.z = 0
    flowForce.normalize().multiplyScalar(params.flow)

    // La profondeur est volontairement limitée : la murmuration reste une nappe 3D.
    const targetZ = Math.sin(p.x * 0.38 + elapsed * params.flowSpeed * 2.2) * params.depth * 0.32
    const sheetPull = (targetZ - p.z) * params.sheetForce

    marble.velocity
      .addScaledVector(cohesionForce, dt * 60)
      .addScaledVector(separationForce, dt * 60)
      .addScaledVector(alignmentForce, dt * 60)
      .addScaledVector(centeringForce, dt * 60)
      .addScaledVector(flowForce, dt * 60)

    marble.velocity.z += sheetPull * dt * 60
    marble.velocity.z *= 0.92

    limitSpeed(marble.velocity, params.maxSpeed)
    marble.mesh.position.addScaledVector(marble.velocity, dt * 60)
  }

  const breath = Math.sin(elapsed * params.breathingSpeed * Math.PI * 2) * params.breathing
  const breathScale = 1 + breath * 0.00028 * dt * 60
  for (const m of marbles) {
    m.mesh.position.x = center.x + (m.mesh.position.x - center.x) * breathScale
    m.mesh.position.y = center.y + (m.mesh.position.y - center.y) * breathScale
  }
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 1 / 30)
  updateSwarm(dt, clock.elapsedTime)
  renderer.render(scene, camera)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
