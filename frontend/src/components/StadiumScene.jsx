import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Billboard, Html, OrbitControls, RoundedBox, Tube, useTexture } from '@react-three/drei'
import * as THREE from 'three'

const colorsByType = {
  gate: '#39d0ff',
  food: '#ff6bd6',
  restroom: '#86f7c7',
  vip: '#ffd166',
  seat: '#7fa8ff'
}

const imageByType = {
  seat: '/stadium-assets/seating.jpeg',
  food: '/stadium-assets/food-stand.jpeg',
  restroom: '/stadium-assets/restroom.jpeg',
  vip: '/stadium-assets/vip-lounge.jpeg'
}

const gateShellPositions = [
  [-48, 2, 18],
  [48, 2, 18],
  [48, 2, -18],
  [-48, 2, -18]
]

const sectionSeatBands = {
  section_101: { start: 2.45, end: 2.8, radius: 33, rows: 4, rowDepth: 2.1, seatsPerRow: 11, baseY: 5.2, centerX: 0, centerZ: 0 },
  section_102: { start: 2.05, end: 2.38, radius: 34.5, rows: 4, rowDepth: 2.1, seatsPerRow: 10, baseY: 6.3, centerX: 0, centerZ: 0 },
  section_103: { start: 1.68, end: 1.98, radius: 35.5, rows: 4, rowDepth: 2.1, seatsPerRow: 10, baseY: 7.2, centerX: 0, centerZ: 0 },
  section_104: { start: 1.16, end: 1.46, radius: 35.5, rows: 4, rowDepth: 2.1, seatsPerRow: 10, baseY: 7.2, centerX: 0, centerZ: 0 },
  section_105: { start: 0.78, end: 1.1, radius: 34.5, rows: 4, rowDepth: 2.1, seatsPerRow: 10, baseY: 6.3, centerX: 0, centerZ: 0 },
  section_106: { start: 0.36, end: 0.72, radius: 33, rows: 4, rowDepth: 2.1, seatsPerRow: 11, baseY: 5.2, centerX: 0, centerZ: 0 },
  section_107: { start: -0.02, end: 0.3, radius: 42, rows: 4, rowDepth: 2.15, seatsPerRow: 10, baseY: 10.8, centerX: 0, centerZ: 0 },
  section_108: { start: -0.46, end: -0.12, radius: 43, rows: 4, rowDepth: 2.15, seatsPerRow: 10, baseY: 12.4, centerX: 0, centerZ: 0 },
  section_109: { start: 3.28, end: 3.62, radius: 43, rows: 4, rowDepth: 2.15, seatsPerRow: 10, baseY: 12.4, centerX: 0, centerZ: 0 },
  section_110: { start: 2.86, end: 3.2, radius: 42, rows: 4, rowDepth: 2.15, seatsPerRow: 10, baseY: 10.8, centerX: 0, centerZ: 0 },
  section_111: { start: -0.9, end: -0.5, radius: 50, rows: 4, rowDepth: 2.2, seatsPerRow: 11, baseY: 16.2, centerX: 0, centerZ: 0 },
  section_112: { start: 3.72, end: 4.1, radius: 50, rows: 4, rowDepth: 2.2, seatsPerRow: 11, baseY: 16.2, centerX: 0, centerZ: 0 }
}

const continuousSeatBands = [
  { key: 'lower-ring', start: -1.04, end: 4.18, radius: 30.5, rows: 5, rowDepth: 1.75, seatsPerRow: 74, baseY: 4.1, centerX: 0, centerZ: 0 },
  { key: 'mid-ring', start: -1.02, end: 4.16, radius: 39.2, rows: 5, rowDepth: 1.85, seatsPerRow: 88, baseY: 9.5, centerX: 0, centerZ: 0 },
  { key: 'upper-ring', start: -0.98, end: 4.12, radius: 48.8, rows: 5, rowDepth: 1.95, seatsPerRow: 98, baseY: 15.2, centerX: 0, centerZ: 0 }
]

function mixColors(a, b, weight = 0.5) {
  return new THREE.Color(a).lerp(new THREE.Color(b), weight).getStyle()
}

function heatColor(value = 0) {
  if (value < 0.34) return '#5cff9f'
  if (value < 0.67) return '#ffd65c'
  return '#ff6a6a'
}

function interpolateRoute(points, progress) {
  if (points.length < 2) return points[0] || [0, 0, 0]
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)))
  const position = curve.getPoint(Math.min(1, Math.max(0, progress)))
  return [position.x, position.y, position.z]
}

function sectionLabelYOffset(node) {
  return node.position[1] > 4 ? 2.8 : 2.4
}

function amenityPanelOffset(type) {
  if (type === 'vip') return 5.8
  if (type === 'food') return 5.1
  return 4.8
}

function generateSectionSeats(config) {
  const seats = []
  for (let row = 0; row < config.rows; row += 1) {
    const radius = config.radius + row * config.rowDepth
    const y = config.baseY + row * 1.12
    for (let index = 0; index < config.seatsPerRow; index += 1) {
      const t = config.seatsPerRow === 1 ? 0.5 : index / (config.seatsPerRow - 1)
      const angle = config.start + (config.end - config.start) * t
      seats.push({
        position: [config.centerX + Math.cos(angle) * radius, y, config.centerZ + Math.sin(angle) * radius],
        rotation: -angle + Math.PI / 2
      })
    }
  }
  return seats
}

function edgeTransform(source, target) {
  const start = new THREE.Vector3(...source)
  const end = new THREE.Vector3(...target)
  const midpoint = start.clone().lerp(end, 0.5)
  const direction = end.clone().sub(start)
  const length = direction.length()
  const angle = Math.atan2(direction.z, direction.x)
  return { midpoint, length, angle }
}

function Label({ text, position, variant = 'default', distanceFactor = 14 }) {
  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false} position={position}>
      <Html center transform distanceFactor={distanceFactor}>
        <div className={`scene-label ${variant}`}>{text}</div>
      </Html>
    </Billboard>
  )
}

function StadiumSeat({ position, rotation, highlighted, dimmed }) {
  const baseOpacity = dimmed ? 0.18 : 0.96
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.22, -0.16]}>
        <boxGeometry args={[0.56, 0.14, 0.62]} />
        <meshStandardMaterial
          color={highlighted ? '#d7f8ff' : '#87aef8'}
          emissive={highlighted ? '#8ff2ff' : '#2f4f91'}
          emissiveIntensity={highlighted ? 0.9 : 0.18}
          transparent
          opacity={baseOpacity}
        />
      </mesh>
      <mesh position={[0, 0.58, -0.36]}>
        <boxGeometry args={[0.56, 0.54, 0.12]} />
        <meshStandardMaterial
          color={highlighted ? '#b9f2ff' : '#769ce8'}
          emissive={highlighted ? '#7eeaff' : '#234684'}
          emissiveIntensity={highlighted ? 0.75 : 0.16}
          transparent
          opacity={baseOpacity}
        />
      </mesh>
      <mesh position={[-0.2, 0.1, -0.16]}>
        <boxGeometry args={[0.06, 0.24, 0.06]} />
        <meshStandardMaterial color="#5a6e8f" transparent opacity={dimmed ? 0.14 : 0.9} />
      </mesh>
      <mesh position={[0.2, 0.1, -0.16]}>
        <boxGeometry args={[0.06, 0.24, 0.06]} />
        <meshStandardMaterial color="#5a6e8f" transparent opacity={dimmed ? 0.14 : 0.9} />
      </mesh>
    </group>
  )
}

function ImagePanel({ node, routeActive, dimmed }) {
  const texture = useTexture(imageByType[node.type])
  if (!texture) return null

  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  const width = node.type === 'vip' ? 8.2 : 6.4
  const height = node.type === 'vip' ? 4.8 : 4.2
  return (
    <Billboard
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
      position={[node.position[0], node.position[1] + amenityPanelOffset(node.type), node.position[2]]}
    >
      <group>
        <mesh position={[0, 0, -0.08]}>
          <planeGeometry args={[width + 0.5, height + 0.5]} />
          <meshBasicMaterial color={routeActive ? '#dffcff' : '#0f1c2f'} transparent opacity={dimmed ? 0.25 : 0.95} toneMapped={false} />
        </mesh>
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} transparent opacity={dimmed ? 0.25 : 1} />
        </mesh>
        <mesh rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} transparent opacity={dimmed ? 0.25 : 1} />
        </mesh>
      </group>
    </Billboard>
  )
}

function ZoneImagePanel({ imageType, position, width = 9.4, height = 5.8, dimmed = false }) {
  const texture = useTexture(imageByType[imageType])
  if (!texture) return null

  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false} position={position}>
      <group>
        <mesh position={[0, 0, -0.08]}>
          <planeGeometry args={[width + 0.45, height + 0.45]} />
          <meshBasicMaterial color="#0d1a2d" transparent opacity={dimmed ? 0.22 : 0.95} toneMapped={false} />
        </mesh>
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} transparent opacity={dimmed ? 0.22 : 1} />
        </mesh>
        <mesh rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} transparent opacity={dimmed ? 0.22 : 1} />
        </mesh>
      </group>
    </Billboard>
  )
}

function RouteMarker({ routePoints, guidedMode, onComplete }) {
  const [progress, setProgress] = useState(0)
  const completedRef = useRef(false)

  useEffect(() => {
    setProgress(0)
    completedRef.current = false
  }, [routePoints, guidedMode])

  useFrame((_, delta) => {
    if (!guidedMode || routePoints.length < 2 || completedRef.current) return
    setProgress((current) => {
      const next = Math.min(1, current + delta * 0.15)
      if (next >= 1 && !completedRef.current) {
        completedRef.current = true
        onComplete?.()
      }
      return next
    })
  })

  if (!routePoints.length) return null
  const [x, y, z] = interpolateRoute(routePoints, progress)
  return (
    <mesh position={[x, y + 1.6, z]} renderOrder={20}>
      <sphereGeometry args={[0.9, 24, 24]} />
      <meshBasicMaterial color="#a9f7ff" toneMapped={false} />
    </mesh>
  )
}

function StadiumModel({
  nodes,
  edges,
  routeIds,
  accessibleHighlights,
  guidedMode,
  startId,
  endId,
  onGuidanceComplete
}) {
  const routeLookup = useMemo(() => new Set(routeIds), [routeIds])
  const importantLookup = useMemo(() => new Set([startId, endId, ...routeIds]), [startId, endId, routeIds])
  const nodeLookup = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes])
  const routeEdgeLookup = useMemo(
    () =>
      new Set(
        routeIds.slice(0, -1).map((nodeId, index) => [nodeId, routeIds[index + 1]].sort().join('|'))
      ),
    [routeIds]
  )
  const routePoints = useMemo(
    () => routeIds.map((id) => nodeLookup[id]?.position).filter(Boolean),
    [nodeLookup, routeIds]
  )
  const routeCurve = useMemo(() => {
    if (routePoints.length < 2) return null
    return new THREE.CatmullRomCurve3(routePoints.map((point) => new THREE.Vector3(point[0], point[1] + 0.2, point[2])))
  }, [routePoints])

  const gateNodes = nodes.filter((node) => node.type === 'gate')
  const seatNodes = nodes.filter((node) => node.type === 'seat')
  const amenityNodes = nodes.filter((node) => ['food', 'restroom', 'vip'].includes(node.type))
  const seatLayouts = useMemo(
    () => seatNodes.map((node) => ({ node, seats: generateSectionSeats(sectionSeatBands[node.id]) })).filter((entry) => entry.seats),
    [seatNodes]
  )
  const continuousSeatLayouts = useMemo(
    () => continuousSeatBands.map((band) => ({ key: band.key, seats: generateSectionSeats(band) })),
    []
  )

  return (
    <group>
      <ambientLight intensity={0.8} />
      <directionalLight position={[30, 40, 20]} intensity={1.8} color="#9fdcff" />
      <pointLight position={[0, 20, 0]} intensity={24} color="#8f7dff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <cylinderGeometry args={[62, 62, 1.5, 64]} />
        <meshStandardMaterial color="#081325" metalness={0.45} roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[20, 55, 96]} />
        <meshStandardMaterial color="#0a1727" emissive="#143761" emissiveIntensity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <ringGeometry args={[18, 50, 80]} />
        <meshStandardMaterial color="#0e223a" emissive="#143761" emissiveIntensity={0.35} side={THREE.DoubleSide} transparent opacity={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <ringGeometry args={[12, 18, 80]} />
        <meshStandardMaterial color="#06111f" emissive="#10253c" emissiveIntensity={0.6} side={THREE.DoubleSide} transparent opacity={0.86} />
      </mesh>
      <mesh position={[0, 12.2, 0]}>
        <torusGeometry args={[39, 7.5, 24, 120]} />
        <meshStandardMaterial color="#152c4b" emissive="#264f82" emissiveIntensity={0.32} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 6, 0]}>
        <torusGeometry args={[32, 7, 16, 90]} />
        <meshStandardMaterial color="#11274a" emissive="#1e4f86" emissiveIntensity={0.45} transparent opacity={0.8} />
      </mesh>

      {edges.map((edge, index) => {
        const source = nodeLookup[edge.source]
        const target = nodeLookup[edge.target]
        if (!source || !target) return null
        const routeKey = [edge.source, edge.target].sort().join('|')
        const onRoute = routeEdgeLookup.has(routeKey)
        const heat = edge.congestion ?? 0
        const { midpoint, length, angle } = edgeTransform(source.position, target.position)
        return (
          <mesh
            key={`${routeKey}-${index}`}
            position={[midpoint.x, 0.35, midpoint.z]}
            rotation={[-Math.PI / 2, 0, angle]}
            renderOrder={onRoute ? 10 : 2}
          >
            <planeGeometry args={[length, onRoute ? 2.3 : 1.5]} />
            <meshBasicMaterial
              color={onRoute ? mixColors('#a5f3ff', heatColor(heat), 0.2) : heatColor(heat)}
              transparent
              opacity={guidedMode ? (onRoute ? 0.88 : 0.16) : (onRoute ? 0.78 : 0.42)}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}

      {gateShellPositions.map((position, index) => (
        <group key={index} position={position}>
          <RoundedBox args={[8.5, 5.2, 4.5]} radius={0.4}>
            <meshStandardMaterial color="#153252" emissive="#2dbdff" emissiveIntensity={0.5} />
          </RoundedBox>
          <mesh position={[0, -0.2, 2.4]}>
            <boxGeometry args={[6.1, 3.8, 0.35]} />
            <meshStandardMaterial color="#0c1320" emissive="#55d9ff" emissiveIntensity={0.15} transparent opacity={0.62} />
          </mesh>
          <mesh position={[-3.2, -0.1, 0]}>
            <boxGeometry args={[0.18, 3.8, 5.4]} />
            <meshStandardMaterial color="#8ea0bc" />
          </mesh>
          <mesh position={[3.2, -0.1, 0]}>
            <boxGeometry args={[0.18, 3.8, 5.4]} />
            <meshStandardMaterial color="#8ea0bc" />
          </mesh>
        </group>
      ))}

      {Array.from({ length: 28 }).map((_, index) => {
        const angle = (index / 28) * Math.PI * 2
        const radius = index % 2 === 0 ? 41.4 : 46.2
        const y = index % 2 === 0 ? 4.2 : 10.2
        return (
          <mesh key={`rail-${index}`} position={[Math.cos(angle) * radius, y, Math.sin(angle) * radius]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[3.2, 0.18, 0.18]} />
            <meshStandardMaterial color="#b8c5d7" emissive="#68ddff" emissiveIntensity={0.08} transparent opacity={guidedMode ? 0.28 : 0.92} />
          </mesh>
        )
      })}

      {continuousSeatLayouts.map(({ key, seats }, bandIndex) => (
        <group key={key}>
          {seats.map((seat, index) => (
            <StadiumSeat
              key={`${key}-${index}`}
              position={seat.position}
              rotation={seat.rotation}
              highlighted={false}
              dimmed={guidedMode}
            />
          ))}
          <mesh position={[0, 3.6 + bandIndex * 5.55, 0]}>
            <torusGeometry args={[31.8 + bandIndex * 8.7, 0.28, 12, 120, 5.22]} />
            <meshStandardMaterial color="#294563" emissive="#14345a" emissiveIntensity={0.14} transparent opacity={guidedMode ? 0.22 : 0.8} />
          </mesh>
        </group>
      ))}

      {seatLayouts.map(({ node, seats }) => {
        const highlighted = routeLookup.has(node.id) || accessibleHighlights.has(node.id) || node.id === endId
        const dimmed = guidedMode && !highlighted
        return (
          <group key={node.id}>
            {seats.map((seat, index) => (
              <StadiumSeat
                key={`${node.id}-${index}`}
                position={seat.position}
                rotation={seat.rotation}
                highlighted={highlighted}
                dimmed={dimmed}
              />
            ))}
            <mesh position={[node.position[0], node.position[1] - 0.45, node.position[2]]} rotation={[0, -Math.atan2(node.position[2], node.position[0]) + Math.PI / 2, 0]}>
              <boxGeometry args={[7.4, 0.3, 4.8]} />
              <meshStandardMaterial color="#2f446b" emissive="#133356" emissiveIntensity={0.18} transparent opacity={dimmed ? 0.24 : 0.95} />
            </mesh>
            <Label text={node.label} position={[node.position[0], node.position[1] + sectionLabelYOffset(node), node.position[2]]} variant={highlighted ? 'active' : 'section'} distanceFactor={12} />
          </group>
        )
      })}

      <ZoneImagePanel imageType="seat" position={[-22, 15.5, 26]} width={8.5} height={5.2} dimmed={guidedMode} />
      <ZoneImagePanel imageType="seat" position={[22, 15.5, -26]} width={8.5} height={5.2} dimmed={guidedMode} />

      {gateNodes.map((node) => {
        const heat = node.sim_congestion ?? 0
        const highlighted = importantLookup.has(node.id)
        const dimmed = guidedMode && !highlighted
        return (
          <group key={node.id}>
            <mesh position={node.position}>
              <cylinderGeometry args={[2.9, 2.9, 0.9, 18]} />
              <meshStandardMaterial
                color={mixColors(colorsByType.gate, heatColor(heat), 0.55)}
                emissive={highlighted ? '#dffcff' : heatColor(heat)}
                emissiveIntensity={highlighted ? 1.2 : 0.38}
                transparent
                opacity={dimmed ? 0.22 : 0.85}
              />
            </mesh>
            <Label
              text={node.label}
              position={[node.position[0], node.position[1] + 5.3, node.position[2]]}
              variant={highlighted ? 'active' : 'major'}
              distanceFactor={15}
            />
          </group>
        )
      })}

      {amenityNodes.map((node) => {
        const heat = node.sim_congestion ?? 0
        const highlighted = importantLookup.has(node.id)
        const dimmed = guidedMode && !highlighted
        return (
          <group key={node.id} position={node.position}>
            <RoundedBox args={[5.6, node.type === 'vip' ? 4.2 : 3.3, 4.8]} radius={0.35}>
              <meshStandardMaterial
                color={mixColors(colorsByType[node.type], heatColor(heat), 0.35)}
                emissive={highlighted ? '#ffffff' : heatColor(heat)}
                emissiveIntensity={highlighted ? 1.1 : 0.32}
                transparent
                opacity={dimmed ? 0.22 : 0.9}
              />
            </RoundedBox>
            {node.type === 'food' && (
              <>
                <mesh position={[0, 0.6, 2.55]}>
                  <boxGeometry args={[5.1, 1.1, 0.5]} />
                  <meshStandardMaterial color="#dbe8f9" emissive="#91ebff" emissiveIntensity={0.12} transparent opacity={dimmed ? 0.22 : 0.95} />
                </mesh>
                <mesh position={[0, 2.3, 0]}>
                  <boxGeometry args={[5.9, 0.3, 4.9]} />
                  <meshStandardMaterial color="#1f2f49" transparent opacity={dimmed ? 0.2 : 1} />
                </mesh>
              </>
            )}
            {node.type === 'restroom' && (
              <>
                <mesh position={[-1.2, 0.1, 2.5]}>
                  <boxGeometry args={[1.2, 2.6, 0.25]} />
                  <meshStandardMaterial color="#b2c3d8" transparent opacity={dimmed ? 0.22 : 0.95} />
                </mesh>
                <mesh position={[1.2, 0.1, 2.5]}>
                  <boxGeometry args={[1.2, 2.6, 0.25]} />
                  <meshStandardMaterial color="#b2c3d8" transparent opacity={dimmed ? 0.22 : 0.95} />
                </mesh>
              </>
            )}
            {node.type === 'vip' && (
              <>
                <mesh position={[0, 1.4, 0]}>
                  <boxGeometry args={[4.4, 0.18, 3.7]} />
                  <meshStandardMaterial color="#59431f" transparent opacity={dimmed ? 0.22 : 0.96} />
                </mesh>
                <mesh position={[-1.2, 0.55, 0.8]}>
                  <boxGeometry args={[0.9, 0.6, 0.9]} />
                  <meshStandardMaterial color="#dec6a0" transparent opacity={dimmed ? 0.22 : 0.96} />
                </mesh>
                <mesh position={[1.2, 0.55, 0.8]}>
                  <boxGeometry args={[0.9, 0.6, 0.9]} />
                  <meshStandardMaterial color="#dec6a0" transparent opacity={dimmed ? 0.22 : 0.96} />
                </mesh>
              </>
            )}
            <ImagePanel node={node} routeActive={highlighted} dimmed={dimmed} />
            <Label
              text={node.label}
              position={[0, amenityPanelOffset(node.type) + (node.type === 'vip' ? 3.2 : 2.7), 0]}
              variant={highlighted ? 'active' : 'major'}
              distanceFactor={15}
            />
          </group>
        )
      })}

      <Label text="Stadium Seats" position={[0, 16, 26]} variant="zone" distanceFactor={18} />
      <Label text="Food Stand" position={[0, 10.5, 33]} variant="zone" distanceFactor={17} />
      <Label text="Restrooms" position={[0, 10.2, -35]} variant="zone" distanceFactor={17} />
      <Label text="VIP Lounge" position={[0, 13.4, -2]} variant="zone vip-zone" distanceFactor={18} />

      {routeCurve && (
        <Tube args={[routeCurve, 64, 0.7, 12, false]} renderOrder={15}>
          <meshBasicMaterial color="#a5f3ff" transparent opacity={0.98} toneMapped={false} />
        </Tube>
      )}

      <RouteMarker routePoints={routePoints} guidedMode={guidedMode} onComplete={onGuidanceComplete} />
    </group>
  )
}

export default function StadiumScene({
  nodes,
  edges,
  route,
  accessible,
  guidedMode,
  phase,
  startId,
  endId,
  onGuidanceComplete
}) {
  const accessibleHighlights = useMemo(
    () => new Set(nodes.filter((node) => accessible && node.accessible && node.type !== 'connector').map((node) => node.id)),
    [nodes, accessible]
  )

  return (
    <div className="scene-shell glass">
      <div className="scene-overlay">
        <div>
          <span className="overlay-label">Live Venue Twin</span>
          <h2>Guided Stadium Scene</h2>
        </div>
        <p>The route becomes a glowing floor path while live crowd heat reveals the easiest way through the venue.</p>
      </div>
      <div className="scene-legend glass">
        <span className="overlay-label">{phase}</span>
        <div className="legend-row"><span className="swatch clear" /> Clear</div>
        <div className="legend-row"><span className="swatch moderate" /> Moderate</div>
        <div className="legend-row"><span className="swatch busy" /> Heavy</div>
        <p>{guidedMode ? 'Focus mode is active. Non-route zones are dimmed.' : 'Explore freely, then start guided mode when ready.'}</p>
      </div>
      <Canvas camera={{ position: [0, 55, 78], fov: 42 }}>
        <Suspense fallback={null}>
          <StadiumModel
            nodes={nodes}
            edges={edges}
            routeIds={route?.path || []}
            accessibleHighlights={accessibleHighlights}
            guidedMode={guidedMode}
            startId={startId}
            endId={endId}
            onGuidanceComplete={onGuidanceComplete}
          />
        </Suspense>
        <OrbitControls enablePan enableZoom enableRotate maxPolarAngle={Math.PI / 2.1} minDistance={40} maxDistance={120} />
      </Canvas>
    </div>
  )
}
