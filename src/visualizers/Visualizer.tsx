import { useRef, useEffect } from 'react'

export interface VisualizerProps {
  frequencyData: React.RefObject<Uint8Array<ArrayBuffer>>
  timeDomainData: React.RefObject<Uint8Array<ArrayBuffer>>
  isActive: boolean
  width: number
  height: number
}

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface Planet {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  angle: number
  orbitRadius: number
  color: string
  freqIndex: number
  glowIntensity: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  maxAge: number
  size: number
}

interface Ripple {
  x: number
  y: number
  radius: number
  maxRadius: number
  age: number
  maxAge: number
}

interface AsteroidBody {
  x: number
  y: number
  vx: number
  vy: number
  size: number
}

const COLORS = {
  bg: '#0a0a0a',
  sun: ['#FFD700', '#FF8C00', '#FF4500'],
  planets: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#87CEEB', '#FF7675'],
  particles: ['#FFFFFF', '#E0E0FF', '#B0B0FF'],
  hud: '#00FF41',
  ripple: '#FF00FF80',
}

const CONFIG = {
  sunMaxRadius: 40,
  sunMinRadius: 25,
  planetCount: 7,
  maxParticles: 200,
  asteroidCount: 60,
  maxRipples: 5,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(Math.max(t, 0), 1)

const drawPixelFilledCircle = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) => {
  const r2 = r * r
  ctx.fillStyle = color

  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
      const d2 = x * x + y * y
      if (d2 <= r2) {
        ctx.fillRect(Math.floor(cx + x), Math.floor(cy + y), 1, 1)
      }
    }
  }
}


const getFrequencyValue = (
  freqData: Uint8Array,
  binStart: number,
  binEnd: number
): number => {
  let sum = 0
  for (let i = binStart; i < binEnd && i < freqData.length; i++) {
    sum += freqData[i]
  }
  return sum / (binEnd - binStart) / 255
}

const getAverageFrequency = (freqData: Uint8Array): number => {
  let sum = 0
  for (let i = 0; i < freqData.length; i++) {
    sum += freqData[i]
  }
  return sum / freqData.length / 255
}

export function Visualizer({
  frequencyData,
  timeDomainData,
  isActive,
  width,
  height,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({
    planets: [] as Planet[],
    particles: [] as Particle[],
    ripples: [] as Ripple[],
    asteroids: [] as AsteroidBody[],
    sunSize: CONFIG.sunMinRadius,
    sunGlow: 0,
    elapsedTime: 0,
    lastRippleTrigger: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false

    const centerX = width / 2
    const centerY = height / 2
    const state = stateRef.current

    // Initialize planets
    if (state.planets.length === 0) {
      const orbitRadii = [100, 150, 200, 270, 330, 380, 420]
      for (let i = 0; i < CONFIG.planetCount; i++) {
        state.planets.push({
          x: centerX,
          y: centerY,
          vx: 0,
          vy: 0,
          radius: 8 + i * 2,
          angle: Math.random() * Math.PI * 2,
          orbitRadius: orbitRadii[i],
          color: COLORS.planets[i % COLORS.planets.length],
          freqIndex: i,
          glowIntensity: 0,
        })
      }
    }

    // Initialize asteroids
    if (state.asteroids.length === 0) {
      for (let i = 0; i < CONFIG.asteroidCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const r = lerp(210, 260, Math.random())
        state.asteroids.push({
          x: centerX + Math.cos(angle) * r,
          y: centerY + Math.sin(angle) * r,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() > 0.5 ? 1 : 2,
        })
      }
    }

    let frameId: number

    const draw = () => {
      const freqData = frequencyData.current
      const timeData = timeDomainData.current

      if (!freqData || !timeData) {
        frameId = requestAnimationFrame(draw)
        return
      }

      state.elapsedTime += 1 / 60

      // Clear with black background
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, width, height)

      // ===== BACKGROUND STARS =====
      const avgFreq = getAverageFrequency(freqData)
      drawBackgroundStars(ctx, state.elapsedTime, avgFreq, width, height)

      // ===== ORBITS & ASTEROIDS =====
      drawOrbits(ctx, centerX, centerY)
      drawAsteroids(ctx, state.asteroids, centerX, centerY, timeData)

      // ===== RIPPLES =====
      updateAndDrawRipples(ctx, state, centerX, centerY, freqData)

      // ===== PLANETS =====
      updateAndDrawPlanets(ctx, state, freqData, centerX, centerY)

      // ===== SUN =====
      drawSun(ctx, state, freqData, centerX, centerY)

      // ===== PARTICLES =====
      updateAndDrawParticles(ctx, state, freqData, centerX, centerY)

      // ===== HUD =====
      drawHUD(ctx, freqData, width, height)

      frameId = requestAnimationFrame(draw)
    }

    if (isActive) {
      draw()
    } else {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#666666'
      ctx.font = '14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('> awaiting microphone input...', width / 2, height / 2)
    }

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isActive, frequencyData, timeDomainData, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', background: '#0a0a0a' }}
    />
  )
}

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

const drawBackgroundStars = (
  ctx: CanvasRenderingContext2D,
  time: number,
  avgFreq: number,
  width: number,
  height: number
) => {
  const starSizes = [1, 2, 3]
  const starLayers = 3

  for (let layer = 0; layer < starLayers; layer++) {
    const seed = layer * 1000
    const starCount = 50 + layer * 30
    const size = starSizes[layer]
    const baseAlpha = 0.3 + avgFreq * 0.5

    for (let i = 0; i < starCount; i++) {
      const x = ((seed + i * 73) % (width + 100)) - 50
      const y = ((seed * 2 + i * 131) % (height + 100)) - 50
      const twinkle = Math.sin(time * 2 + i) * 0.5 + 0.5
      const flicker = avgFreq > 0.1 ? Math.sin(time * 4 + i * 2) * 0.5 + 0.5 : twinkle

      const alpha = (baseAlpha + flicker * 0.4) * (0.5 + avgFreq * 0.5)
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(alpha, 1)})`
      ctx.fillRect(Math.floor(x), Math.floor(y), size, size)
    }
  }
}

const drawOrbits = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
  const orbitRadii = [100, 150, 200, 270, 330, 380, 420]

  ctx.strokeStyle = 'rgba(100, 150, 200, 0.3)'
  ctx.lineWidth = 1

  for (const r of orbitRadii) {
    // Draw as dashed pixel-style circle
    const segments = Math.ceil(r * 6)
    for (let i = 0; i < segments; i++) {
      if (i % 4 < 2) {
        const a1 = (i / segments) * Math.PI * 2
        const a2 = ((i + 1) / segments) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r)
        ctx.lineTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r)
        ctx.stroke()
      }
    }
  }
}

const drawAsteroids = (
  ctx: CanvasRenderingContext2D,
  asteroids: AsteroidBody[],
  cx: number,
  cy: number,
  timeData: Uint8Array
) => {
  // Calculate spreading from time domain
  let spread = 0
  for (let i = 0; i < timeData.length; i++) {
    spread += Math.abs(timeData[i] - 128)
  }
  spread = (spread / (timeData.length * 128)) * 20

  for (const ast of asteroids) {
    ast.x += ast.vx
    ast.y += ast.vy
    ast.x += (Math.random() - 0.5) * spread * 0.1
    ast.y += (Math.random() - 0.5) * spread * 0.1

    const dx = ast.x - cx
    const dy = ast.y - cy
    const dist = Math.hypot(dx, dy)

    // Keep asteroids in belt
    if (dist < 200 || dist > 270) {
      const angle = Math.atan2(dy, dx)
      const r = 235
      ast.x = cx + Math.cos(angle) * r
      ast.y = cy + Math.sin(angle) * r
    }

    ctx.fillStyle = 'rgba(150, 150, 150, 0.8)'
    ctx.fillRect(Math.floor(ast.x), Math.floor(ast.y), ast.size, ast.size)
  }
}

const updateAndDrawRipples = (
  ctx: CanvasRenderingContext2D,
  state: any,
  cx: number,
  cy: number,
  freqData: Uint8Array
) => {
  const lowFreq = getFrequencyValue(freqData, 0, 50)

  // Trigger ripple on beat
  if (lowFreq > 0.6 && state.elapsedTime - state.lastRippleTrigger > 0.1) {
    if (state.ripples.length < CONFIG.maxRipples) {
      state.ripples.push({
        x: cx,
        y: cy,
        radius: 10,
        maxRadius: 300,
        age: 0,
        maxAge: 0.8,
      })
      state.lastRippleTrigger = state.elapsedTime
    }
  }

  // Draw and update ripples
  for (let i = state.ripples.length - 1; i >= 0; i--) {
    const ripple = state.ripples[i]
    ripple.age += 1 / 60

    if (ripple.age >= ripple.maxAge) {
      state.ripples.splice(i, 1)
      continue
    }

    const progress = ripple.age / ripple.maxAge
    ripple.radius = 10 + progress * (ripple.maxRadius - 10)

    ctx.strokeStyle = COLORS.ripple
    ctx.lineWidth = 2

    // Draw as pixel octagon/square spiral
    const size = ripple.radius
    ctx.beginPath()
    ctx.moveTo(cx + size, cy)
    ctx.lineTo(cx + size, cy + size)
    ctx.lineTo(cx, cy + size)
    ctx.lineTo(cx - size, cy + size)
    ctx.lineTo(cx - size, cy)
    ctx.lineTo(cx - size, cy - size)
    ctx.lineTo(cx, cy - size)
    ctx.lineTo(cx + size, cy - size)
    ctx.closePath()
    ctx.stroke()
  }
}

const updateAndDrawPlanets = (
  ctx: CanvasRenderingContext2D,
  state: any,
  freqData: Uint8Array,
  cx: number,
  cy: number
) => {
  for (const planet of state.planets) {
    const freqBinStart = 50 + (planet.freqIndex * 750) / CONFIG.planetCount
    const freqBinEnd = freqBinStart + (750 / CONFIG.planetCount)
    const energy = getFrequencyValue(freqData, Math.floor(freqBinStart), Math.floor(freqBinEnd))

    // Update glow
    planet.glowIntensity = lerp(planet.glowIntensity, energy, 0.1)

    // Update rotation speed based on energy
    const baseSpeed = 0.005 + planet.freqIndex * 0.001
    const speedBoost = energy * 0.02
    planet.angle += baseSpeed + speedBoost

    // Update size slightly with energy
    const baseRadius = 8 + planet.freqIndex * 2
    const sizeBoost = energy * 3
    planet.radius = baseRadius + sizeBoost

    // Position on orbit
    planet.x = cx + Math.cos(planet.angle) * planet.orbitRadius
    planet.y = cy + Math.sin(planet.angle) * planet.orbitRadius

    // Draw glow if energy is high
    if (planet.glowIntensity > 0.1) {
      ctx.fillStyle = `rgba(200, 200, 255, ${planet.glowIntensity * 0.3})`
      const glowRadius = planet.radius + 8
      drawPixelFilledCircle(ctx, planet.x, planet.y, glowRadius, ctx.fillStyle)
    }

    // Draw planet with pixel style
    drawPixelFilledCircle(ctx, planet.x, planet.y, Math.ceil(planet.radius), planet.color)

    // Draw ring using pixel dots
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + planet.glowIntensity * 0.5})`
    const ringSegments = Math.ceil(planet.radius * 4)
    for (let seg = 0; seg < ringSegments; seg++) {
      const ringAngle = (seg / ringSegments) * Math.PI * 2
      const ringX = planet.x + Math.cos(ringAngle) * planet.radius * 1.6
      const ringY = planet.y + Math.sin(ringAngle) * planet.radius * 0.4
      ctx.fillRect(Math.floor(ringX), Math.floor(ringY), 2, 1)
    }
  }
}

const drawSun = (
  ctx: CanvasRenderingContext2D,
  state: any,
  freqData: Uint8Array,
  cx: number,
  cy: number
) => {
  const lowFreq = getFrequencyValue(freqData, 0, 50)

  // Update sun size
  const targetSize = CONFIG.sunMinRadius + lowFreq * (CONFIG.sunMaxRadius - CONFIG.sunMinRadius)
  state.sunSize = lerp(state.sunSize, targetSize, 0.08)

  // Update glow
  state.sunGlow = lerp(state.sunGlow, lowFreq, 0.1)

  // Draw outer glow
  if (state.sunGlow > 0.05) {
    for (let i = 4; i >= 1; i--) {
      const alpha = (state.sunGlow * (5 - i)) / 20
      ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`
      ctx.beginPath()
      ctx.arc(
        Math.floor(cx),
        Math.floor(cy),
        state.sunSize + i * 6,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
  }

  // Draw sun body with pixel style
  const baseColor = COLORS.sun[Math.floor(lowFreq * 2)]
  drawPixelFilledCircle(ctx, cx, cy, Math.floor(state.sunSize), baseColor)

  // Draw sun rays (thicker pixel-style rays)
  ctx.fillStyle = '#FF8C00'
  const rayCount = 12
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2
    const rayLength = 15
    const rayThickness = 4

    // Draw thick ray as set of pixels
    for (let r = 0; r < rayLength; r++) {
      const dist = state.sunSize + r
      for (let t = -Math.ceil(rayThickness / 2); t <= Math.ceil(rayThickness / 2); t++) {
        const rx = Math.cos(angle) * dist + Math.sin(angle) * t
        const ry = Math.sin(angle) * dist - Math.cos(angle) * t
        ctx.fillRect(
          Math.floor(cx + rx),
          Math.floor(cy + ry),
          1,
          1
        )
      }
    }
  }

  // Draw sunspots (noise pattern)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  for (let i = 0; i < 5; i++) {
    const angle = state.elapsedTime * 0.3 + i
    const spotX = Math.floor(cx + Math.cos(angle) * (state.sunSize * 0.4))
    const spotY = Math.floor(cy + Math.sin(angle) * (state.sunSize * 0.4))
    ctx.fillRect(spotX - 2, spotY - 2, 4, 4)
  }
}

const updateAndDrawParticles = (
  ctx: CanvasRenderingContext2D,
  state: any,
  freqData: Uint8Array,
  cx: number,
  cy: number
) => {
  const highFreq = getFrequencyValue(freqData, 800, 1024)

  // Spawn new particles based on high frequency
  const particleSpawnRate = Math.floor(highFreq * 5)
  for (let i = 0; i < particleSpawnRate; i++) {
    if (state.particles.length < CONFIG.maxParticles) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + highFreq * 3
      state.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        maxAge: 1.5,
        size: Math.random() > 0.5 ? 1 : 2,
      })
    }
  }

  // Update and draw particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]
    p.age += 1 / 60

    if (p.age >= p.maxAge) {
      state.particles.splice(i, 1)
      continue
    }

    p.x += p.vx
    p.y += p.vy

    const progress = p.age / p.maxAge
    const alpha = (1 - progress) * 0.8
    const colorIdx = Math.floor(Math.random() * COLORS.particles.length)

    ctx.fillStyle = COLORS.particles[colorIdx].replace(')', `, ${alpha})`) || `rgba(255, 255, 255, ${alpha})`
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size)
  }
}

const drawHUD = (
  ctx: CanvasRenderingContext2D,
  freqData: Uint8Array,
  width: number,
  height: number
) => {
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.hud

  // Title with scan line effect
  ctx.font = 'bold 16px monospace'
  ctx.fillText('SOLAR RESONANCE', 20, 30)

  ctx.font = '10px monospace'

  // Frequency info (right side)
  const lowFreq = getFrequencyValue(freqData, 0, 50)
  const midFreq = getFrequencyValue(freqData, 100, 400)
  const highFreq = getFrequencyValue(freqData, 800, 1024)
  const avgFreq = getAverageFrequency(freqData)

  ctx.textAlign = 'right'
  ctx.fillText(`FREQ: ${Math.floor(avgFreq * 100)}%`, width - 20, 30)
  ctx.fillText(`LOW: ${Math.floor(lowFreq * 100)}%`, width - 20, 45)
  ctx.fillText(`MID: ${Math.floor(midFreq * 100)}%`, width - 20, 60)
  ctx.fillText(`HIGH: ${Math.floor(highFreq * 100)}%`, width - 20, 75)

  // Simple frequency bar graph (right bottom)
  ctx.textAlign = 'right'
  const barX = width - 100
  const barY = height - 40
  ctx.fillText('FREQ:', barX - 10, barY)

  const barCount = 16
  const barWidth = 4
  const spacing = 1

  for (let i = 0; i < barCount; i++) {
    const freqIdx = Math.floor((i / barCount) * 1024)
    const value = freqData[freqIdx] / 255
    const barHeight = value * 25

    ctx.fillStyle = COLORS.hud
    ctx.fillRect(barX + i * (barWidth + spacing), barY - barHeight, barWidth, barHeight)
  }

  // Scan line effect overlay
  ctx.strokeStyle = 'rgba(0, 255, 65, 0.05)'
  ctx.lineWidth = 1
  for (let y = 0; y < height; y += 2) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}
