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

// 93 centres pris dans une grille cubique, en gardant les points les plus proches
// du centre. Les cellules sont invisibles : seuls leurs centres structurent le corps.
function makeBodyCenters(count) {
  const candidates = []
  const radius = 3
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const d2 = x*x + y*y + z*z
        candidates.push({ x, y, z, d2, tie: Math.random() })
      }
    }
  }
  candidates.sort((a,b) => a.d2 - b.d2 || a.tie - b.tie)
  return candidates.slice(0, count).map(p => new THREE.Vector3(p.x, p.y, p.z))
}

const controls = {
  ECART: 25,
  TAILLE_BILLES: 1,
  V1: 0,
  LIBERTE: 0.34,
  CAMERA: 420,
  VOIR_CELLULES: false
}

const centers = makeBodyCenters(BODY_COUNT)
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

// Sept satellites : directions et distances fixes pour cette exécution.
const satelliteAnchors = []
for (let i = 0; i < SATELLITE_COUNT; i++) {
  const v = new THREE.Vector3().randomDirection()
  const r = 4.5 + Math.random() * 2.2
  satelliteAnchors.push(v.multiplyScalar(r))
}

const cellGroup = new THREE.Group()
scene.add(cellGroup)
const cellGeometry = new THREE.BoxGeometry(1,1,1)
const cellMaterial = new THREE.MeshBasicMaterial({ color: 0x6688aa, wireframe: true, transparent: true, opacity: 0.16 })
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
  const marbleScale = controls.TAILLE_BILLES
  marbles.forEach(m => m.scale.setScalar(marbleScale))

  for (let i = 0; i < BODY_COUNT; i++) {
    const p = centers[i]
    if (controls.V1 === 0) marbles[i].position.set(p.x * spacing, p.y * spacing, p.z * spacing)
    const cell = cellGroup.children[i]
    cell.position.set(p.x * spacing, p.y * spacing, p.z * spacing)
    cell.scale.setScalar(spacing)
  }

  for (let i = 0; i < SATELLITE_COUNT; i++) {
    const p = satelliteAnchors[i]
    if (controls.V1 === 0) marbles[BODY_COUNT+i].position.set(p.x * spacing, p.y * spacing, p.z * spacing)
  }
}
updateStaticLayout()

const gui = new GUI({ title: 'ENTITY — SPHERE 93 + 7' })
gui.add(controls, 'ECART', 16, 36, 0.5).name('TAILLE / ECART').onChange(updateStaticLayout)
gui.add(controls, 'TAILLE_BILLES', 0.5, 2.5, 0.05).name('TAILLE BILLES').onChange(updateStaticLayout)
gui.add(controls, 'V1', 0, 3, 0.05).name('V1 — VIE INTERNE')
gui.add(controls, 'LIBERTE', 0.05, 0.48, 0.01).name('LIBERTE CELLULE')
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
      // Mouvement continu, sans rebond sur les limites de la cellule.
      const tt = t * speed
      marbles[i].position.set(
        p.x*spacing + Math.sin(tt*q.sx + q.a) * amp,
        p.y*spacing + Math.sin(tt*q.sy + q.b) * amp,
        p.z*spacing + Math.sin(tt*q.sz + q.c) * amp
      )
    }
    for (let i = 0; i < SATELLITE_COUNT; i++) {
      const idx = BODY_COUNT+i, p = satelliteAnchors[i], q = phases[idx]
      const tt = t * speed * 0.55
      const satelliteAmp = spacing * 0.45
      marbles[idx].position.set(
        p.x*spacing + Math.sin(tt*q.sx + q.a)*satelliteAmp,
        p.y*spacing + Math.sin(tt*q.sy + q.b)*satelliteAmp,
        p.z*spacing + Math.sin(tt*q.sz + q.c)*satelliteAmp
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
