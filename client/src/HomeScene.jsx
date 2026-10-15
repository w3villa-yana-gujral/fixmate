import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import heroImage from './assets/fixmate-welcome.webp'
import electricianImage from './assets/fixmate-electrician.webp'
import neighborhoodImage from './assets/fixmate-neighborhood.webp'

const slides = [
  { image: heroImage, label: 'A FixMate professional welcomed by a happy customer' },
  { image: electricianImage, label: 'A FixMate electrician helping a customer at home' },
  { image: neighborhoodImage, label: 'Happy FixMate customers, service professionals, and a FixMate van' }
]

function setCardTargets(cards, activeIndex) {
  cards.forEach((card, index) => {
    const position = (index - activeIndex + cards.length) % cards.length
    const isActive = position === 0
    card.userData.target = {
      x: isActive ? 0 : position === 1 ? 3.9 : -3.9,
      y: isActive ? 0 : -0.08,
      z: isActive ? 0.4 : -0.8,
      scale: isActive ? 1 : 0.74,
      rotationY: isActive ? 0 : position === 1 ? -0.34 : 0.34
    }
  })
}

export default function HomeScene() {
  const containerRef = useRef(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const touchStartRef = useRef(null)
  const sceneApiRef = useRef(null)
  const activeIndexRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)

  const goToSlide = (direction) => {
    const nextIndex = (activeIndexRef.current + direction + slides.length) % slides.length
    activeIndexRef.current = nextIndex
    setActiveIndex(nextIndex)
    const sceneApi = sceneApiRef.current
    if (!sceneApi) return
    setCardTargets(sceneApi.cards, nextIndex)
    if (sceneApi.reducedMotion) {
      sceneApi.cards.forEach((card) => {
        const target = card.userData.target
        card.position.set(target.x, target.y, target.z)
        card.scale.setScalar(target.scale)
        card.rotation.y = target.rotationY
      })
      sceneApi.renderer.render(sceneApi.scene, sceneApi.camera)
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 0, 5.5)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight('#ffffff', '#547366', 2.1))
    const keyLight = new THREE.DirectionalLight('#fff5df', 3)
    keyLight.position.set(-3, 5, 6)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#a4d8ce', 1.5)
    fillLight.position.set(4, 1, -3)
    scene.add(fillLight)

    const cards = slides.map((slide, index) => {
      const card = new THREE.Group()
      card.position.set(index === 1 ? 3.9 : index === 2 ? -3.9 : 0, -0.08, -0.8)
      card.scale.setScalar(0.74)
      card.userData.target = {}
      const backing = new THREE.Mesh(
        new THREE.BoxGeometry(5.08, 2.88, 0.14),
        new THREE.MeshStandardMaterial({ color: '#35766a', roughness: 0.62, metalness: 0.06 })
      )
      backing.position.set(-0.055, -0.045, -0.17)
      backing.castShadow = true
      card.add(backing)
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(4.98, 2.78, 0.2),
        new THREE.MeshStandardMaterial({ color: '#f7f4e9', roughness: 0.52, metalness: 0.08 })
      )
      frame.castShadow = true
      frame.receiveShadow = true
      card.add(frame)
      scene.add(card)
      return card
    })
    setCardTargets(cards, activeIndexRef.current)
    if (reducedMotion) {
      cards.forEach((card) => {
        const target = card.userData.target
        card.position.set(target.x, target.y, target.z)
        card.scale.setScalar(target.scale)
        card.rotation.y = target.rotationY
      })
    }
    const loader = new THREE.TextureLoader()
    const imageTextures = []
    let disposed = false
    slides.forEach((slide, index) => {
      loader.load(slide.image, (texture) => {
        if (disposed) {
          texture.dispose()
          return
        }
        imageTextures.push(texture)
        texture.colorSpace = THREE.SRGBColorSpace
        const image = new THREE.Mesh(
          new THREE.PlaneGeometry(4.82, 4.82 / (texture.image.width / texture.image.height)),
          new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
        )
        image.position.z = 0.111
        cards[index].add(image)
        renderer.render(scene, camera)
      })
    })

    const pointerMove = (event) => {
      const bounds = container.getBoundingClientRect()
      pointerRef.current.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      pointerRef.current.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    const pointerLeave = () => { pointerRef.current = { x: 0, y: 0 } }
    const pointerDown = (event) => { touchStartRef.current = { x: event.clientX, y: event.clientY } }
    const pointerUp = (event) => {
      if (!touchStartRef.current) return
      const deltaX = event.clientX - touchStartRef.current.x
      const deltaY = event.clientY - touchStartRef.current.y
      touchStartRef.current = null
      if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) goToSlide(deltaX < 0 ? 1 : -1)
    }
    const keyDown = (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); goToSlide(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); goToSlide(-1) }
    }
    container.addEventListener('pointermove', pointerMove)
    container.addEventListener('pointerleave', pointerLeave)
    container.addEventListener('pointerdown', pointerDown)
    container.addEventListener('pointerup', pointerUp)
    container.addEventListener('keydown', keyDown)

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      const halfFovTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const distanceForWidth = 5.08 / (2 * halfFovTangent * camera.aspect * 0.94)
      const distanceForHeight = 2.88 / (2 * halfFovTangent * 0.9)
      camera.position.z = Math.max(distanceForWidth, distanceForHeight)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      setCardTargets(cards, activeIndexRef.current)
      renderer.render(scene, camera)
    })
    resizeObserver.observe(container)

    let animationFrame
    sceneApiRef.current = { cards, renderer, scene, camera, reducedMotion }
    let lastFrame = performance.now()
    const render = () => {
      const now = performance.now()
      const delta = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now
      cards.forEach((card) => {
        const target = card.userData.target
        card.position.x = THREE.MathUtils.damp(card.position.x, target.x, 5, delta)
        card.position.y = THREE.MathUtils.damp(card.position.y, target.y + (reducedMotion ? 0 : Math.sin(now / 1000 * 0.8) * 0.045), 5, delta)
        card.position.z = THREE.MathUtils.damp(card.position.z, target.z, 5, delta)
        const targetRotationY = target.rotationY + (card.position.x === target.x ? 0 : pointerRef.current.x * 0.08)
        card.rotation.y = THREE.MathUtils.damp(card.rotation.y, targetRotationY, 5, delta)
        card.rotation.x = THREE.MathUtils.damp(card.rotation.x, reducedMotion ? 0 : pointerRef.current.y * -0.045, 5, delta)
        const scale = THREE.MathUtils.damp(card.scale.x, target.scale, 5, delta)
        card.scale.setScalar(scale)
      })
      renderer.render(scene, camera)
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      container.removeEventListener('pointermove', pointerMove)
      container.removeEventListener('pointerleave', pointerLeave)
      container.removeEventListener('pointerdown', pointerDown)
      container.removeEventListener('pointerup', pointerUp)
      container.removeEventListener('keydown', keyDown)
      sceneApiRef.current = null
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
      imageTextures.forEach((texture) => texture.dispose())
      renderer.domElement.remove()
      disposed = true
    }
  }, [])

  return <div className="home-scene" ref={containerRef} role="region" aria-roledescription="carousel" aria-label="FixMate home services" tabIndex={0}>
    <div className="home-scene-status" aria-live="polite">{slides[activeIndex].label}</div>
    <button className="home-scene-arrow previous" type="button" aria-label="Previous hero image" onClick={() => goToSlide(-1)}>‹</button>
    <button className="home-scene-arrow next" type="button" aria-label="Next hero image" onClick={() => goToSlide(1)}>›</button>
    <div className="home-scene-pagination" aria-label="Choose hero image">
      {slides.map((slide, index) => <button key={slide.image} type="button" className={index === activeIndex ? 'active' : ''} aria-label={`Show image ${index + 1}: ${slide.label}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => goToSlide((index - activeIndexRef.current + slides.length) % slides.length)} />)}
    </div>
  </div>
}
