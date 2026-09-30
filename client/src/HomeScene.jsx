import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function makeBox(width, height, depth, color, materialOptions = {}) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.76, ...materialOptions })
  )
}

function makeRoofPanel(points, color) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide }))
}

function addWindow(group, x, z) {
  const windowGroup = new THREE.Group()
  windowGroup.position.set(x, 1.07, z)
  const frame = makeBox(0.57, 0.62, 0.08, '#f8f4e8')
  const pane = makeBox(0.45, 0.5, 0.04, '#77b8bb', { metalness: 0.12, roughness: 0.28 })
  pane.position.z = 0.05
  const verticalBar = makeBox(0.035, 0.5, 0.04, '#f8f4e8')
  verticalBar.position.z = 0.08
  const horizontalBar = makeBox(0.45, 0.035, 0.04, '#f8f4e8')
  horizontalBar.position.z = 0.08
  windowGroup.add(frame, pane, verticalBar, horizontalBar)
  group.add(windowGroup)
}

function makeTree(x, z, scale = 1) {
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.42, 6), new THREE.MeshStandardMaterial({ color: '#9b7655', roughness: 1 }))
  trunk.position.y = 0.24
  const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.86, 7), new THREE.MeshStandardMaterial({ color: '#4f9274', roughness: 0.95, flatShading: true }))
  foliage.position.y = 0.78
  tree.add(trunk, foliage)
  tree.position.set(x, 0.11, z)
  tree.scale.setScalar(scale)
  return tree
}

export default function HomeScene() {
  const containerRef = useRef(null)
  const pointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(4.8, 3.6, 7.8)
    camera.lookAt(0, 1.05, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight('#f7fff9', '#94b7ac', 2.15))
    const keyLight = new THREE.DirectionalLight('#fff0cf', 3.1)
    keyLight.position.set(-3.5, 7, 5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#86cbd0', 1.2)
    fillLight.position.set(5, 3, -4)
    scene.add(fillLight)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#dcebe4', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.14
    floor.receiveShadow = true
    scene.add(floor)

    const house = new THREE.Group()
    scene.add(house)
    const island = makeBox(4.3, 0.22, 3.65, '#bdd9cc')
    island.position.set(0, 0, 0)
    island.castShadow = true
    island.receiveShadow = true
    house.add(island)

    const lawn = makeBox(3.75, 0.04, 3.12, '#8cbd91')
    lawn.position.set(0, 0.12, 0)
    lawn.receiveShadow = true
    house.add(lawn)

    const walkway = makeBox(0.84, 0.035, 1.42, '#e8d8bd')
    walkway.position.set(0, 0.16, 1.55)
    house.add(walkway)

    const walls = makeBox(2.75, 1.85, 2.35, '#ecede0')
    walls.position.set(0, 1.12, -0.1)
    walls.castShadow = true
    walls.receiveShadow = true
    house.add(walls)

    const gable = new THREE.BufferGeometry()
    gable.setAttribute('position', new THREE.Float32BufferAttribute([
      -1.38, 2.02, 1.085,
      1.38, 2.02, 1.085,
      0, 2.83, 1.085
    ], 3))
    gable.computeVertexNormals()
    const gableMesh = new THREE.Mesh(gable, new THREE.MeshStandardMaterial({ color: '#e7e9dc', side: THREE.DoubleSide, roughness: 0.86 }))
    house.add(gableMesh)

    const roofLeft = makeRoofPanel([
      [-1.58, 2.03, -1.38], [0, 2.94, -1.38], [0, 2.94, 1.28], [-1.58, 2.03, 1.28]
    ], '#c9785c')
    const roofRight = makeRoofPanel([
      [0, 2.94, -1.38], [1.58, 2.03, -1.38], [1.58, 2.03, 1.28], [0, 2.94, 1.28]
    ], '#d98768')
    roofLeft.castShadow = true
    roofRight.castShadow = true
    house.add(roofLeft, roofRight)

    const chimney = makeBox(0.35, 0.9, 0.38, '#b76c55')
    chimney.position.set(0.78, 2.57, -0.55)
    chimney.castShadow = true
    house.add(chimney)
    const chimneyTop = makeBox(0.44, 0.09, 0.48, '#a85f4c')
    chimneyTop.position.set(0.78, 3.05, -0.55)
    house.add(chimneyTop)

    const door = makeBox(0.63, 1.16, 0.11, '#287d76')
    door.position.set(0, 0.77, 1.12)
    house.add(door)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshStandardMaterial({ color: '#f4c57a', metalness: 0.55, roughness: 0.32 }))
    knob.position.set(0.2, 0.75, 1.2)
    house.add(knob)
    addWindow(house, -0.87, 1.12)
    addWindow(house, 0.87, 1.12)

    const frontStep = makeBox(0.92, 0.12, 0.38, '#e8e0d2')
    frontStep.position.set(0, 0.23, 1.34)
    frontStep.castShadow = true
    house.add(frontStep)
    house.add(makeTree(-1.66, 0.78, 0.86), makeTree(1.68, -0.83, 0.92))

    const pointerMove = (event) => {
      const bounds = container.getBoundingClientRect()
      pointerRef.current.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      pointerRef.current.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    const pointerLeave = () => { pointerRef.current = { x: 0, y: 0 } }
    container.addEventListener('pointermove', pointerMove)
    container.addEventListener('pointerleave', pointerLeave)

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      renderer.render(scene, camera)
    })
    resizeObserver.observe(container)

    let animationFrame
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startedAt = performance.now()
    const render = () => {
      const time = (performance.now() - startedAt) / 1000
      house.position.y = reducedMotion ? 0 : Math.sin(time * 0.8) * 0.055
      house.rotation.y += ((pointerRef.current.x * 0.11) - house.rotation.y) * 0.035
      house.rotation.x += ((pointerRef.current.y * -0.035) - house.rotation.x) * 0.035
      renderer.render(scene, camera)
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      container.removeEventListener('pointermove', pointerMove)
      container.removeEventListener('pointerleave', pointerLeave)
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div className="home-scene" ref={containerRef} role="img" aria-label="An animated 3D model of a FixMate home" />
}
