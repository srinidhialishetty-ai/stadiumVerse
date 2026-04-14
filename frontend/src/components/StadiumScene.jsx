import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox, Tube } from '@react-three/drei'
import * as THREE from 'three'

const colorsByType = {
  gate: '#39d0ff',
  food: '#ff6bd6',
  restroom: '#86f7c7',
  vip: '#ffd166',
  seat: '#7fa8ff'
}

function interpolateRoute(points, progress) {
  if (points.length < 2) return points[0] || [0, 0, 0]
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)))
  const position = curve.getPoint(Math.min(1, Math.max(0, progress)))
  return [position.x, position.y, position.z]
}

function RouteMarker({ routePoints, guidedMode }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setProgress(0)
  }, [routePoints])

  useFrame((_, delta) => {
    if (!guidedMode || routePoints.length < 2) return
    setProgress((current) => Math.min(1, current + delta * 0.15))
  })

  if (!routePoints.length) return null
  const [x, y, z] = interpolateRoute(routePoints, progress)
  return (
    <mesh position={[x, y + 1.6, z]}>
      <sphereGeometry args={[0.9, 24, 24]} />
      <meshStandardMaterial color="#a9f7ff" emissive="#52e1ff" emissiveIntensity={2} />
    </mesh>
  )
}

function StadiumModel({ nodes, routeIds, accessibleHighlights, guidedMode }) {
  const routeLookup = useMemo(() => new Set(routeIds), [routeIds])
  const routePoints = useMemo(
    () => routeIds.map((id) => nodes.find((node) => node.id === id)?.position).filter(Boolean),
    [nodes, routeIds]
  )
  const routeCurve = useMemo(() => {
    if (routePoints.length < 2) return null
    return new THREE.CatmullRomCurve3(routePoints.map((point) => new THREE.Vector3(point[0], point[1] + 0.2, point[2])))
  }, [routePoints])

  return (
    <group>
      <ambientLight intensity={0.8} />
      <directionalLight position={[30, 40, 20]} intensity={1.8} color="#9fdcff" />
      <pointLight position={[0, 20, 0]} intensity={24} color="#8f7dff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <cylinderGeometry args={[62, 62, 1.5, 64]} />
        <meshStandardMaterial color="#081325" metalness={0.45} roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <ringGeometry args={[18, 50, 80]} />
        <meshStandardMaterial color="#0e223a" emissive="#143761" emissiveIntensity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <ringGeometry args={[12, 18, 80]} />
        <meshStandardMaterial color="#06111f" emissive="#10253c" emissiveIntensity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 6, 0]}>
        <torusGeometry args={[32, 7, 16, 90]} />
        <meshStandardMaterial color="#11274a" emissive="#1e4f86" emissiveIntensity={0.45} />
      </mesh>

      {[[-48, 2, 18], [48, 2, 18], [48, 2, -18], [-48, 2, -18]].map((position, index) => (
        <RoundedBox key={index} args={[7, 5, 4]} radius={0.4} position={position}>
          <meshStandardMaterial color="#153252" emissive="#2dbdff" emissiveIntensity={0.8} />
        </RoundedBox>
      ))}

      {nodes.filter((node) => node.type === 'seat').map((node) => (
        <mesh key={node.id} position={node.position}>
          <boxGeometry args={[5.2, 2.5, 3.8]} />
          <meshStandardMaterial
            color={colorsByType.seat}
            emissive={accessibleHighlights.has(node.id) ? '#72ffd2' : '#314f8f'}
            emissiveIntensity={accessibleHighlights.has(node.id) ? 1.2 : 0.25}
          />
        </mesh>
      ))}

      {nodes.filter((node) => ['food', 'restroom', 'vip', 'gate'].includes(node.type)).map((node) => (
        <group key={node.id} position={node.position}>
          <RoundedBox args={[4.2, node.type === 'vip' ? 3.6 : 2.8, 4.2]} radius={0.35}>
            <meshStandardMaterial
              color={colorsByType[node.type]}
              emissive={routeLookup.has(node.id) ? '#ffffff' : colorsByType[node.type]}
              emissiveIntensity={routeLookup.has(node.id) ? 1.3 : 0.55}
            />
          </RoundedBox>
          <Html center position={[0, 3.5, 0]} distanceFactor={14} sprite>
            <div className={`scene-label ${routeLookup.has(node.id) ? 'active' : ''}`}>{node.label}</div>
          </Html>
        </group>
      ))}

      {routeCurve && (
        <Tube args={[routeCurve, 64, 0.55, 12, false]}>
          <meshStandardMaterial color="#87ebff" emissive="#87ebff" emissiveIntensity={2.2} />
        </Tube>
      )}

      <RouteMarker routePoints={routePoints} guidedMode={guidedMode} />
    </group>
  )
}

export default function StadiumScene({ nodes, route, accessible }) {
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
        <p>The route becomes a glowing floor path. Orbit, pan, and zoom stay fully in your control.</p>
      </div>
      <Canvas camera={{ position: [0, 55, 78], fov: 42 }}>
        <Suspense fallback={null}>
          <StadiumModel
            nodes={nodes}
            routeIds={route?.path || []}
            accessibleHighlights={accessibleHighlights}
            guidedMode={Boolean(route?.path?.length)}
          />
        </Suspense>
        <OrbitControls enablePan enableZoom enableRotate maxPolarAngle={Math.PI / 2.1} minDistance={40} maxDistance={120} />
      </Canvas>
    </div>
  )
}
