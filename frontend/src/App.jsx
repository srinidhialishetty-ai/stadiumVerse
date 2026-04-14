import React, { useEffect, useMemo, useState } from 'react'
import { fetchAdvice, fetchGraph, fetchRecommendations, fetchRoute, openSimulationSocket } from './api'
import ControlPanel from './components/ControlPanel'
import StadiumScene from './components/StadiumScene'

const defaultAlerts = [
  'Live congestion is active across the concourse network.',
  'Guided mode runs once per route request and stops at your destination.'
]

export default function App() {
  const [graph, setGraph] = useState({ nodes: [], edges: [], phase: 'Loading', tick: 0 })
  const [selectedStart, setSelectedStart] = useState('gate_a')
  const [selectedEnd, setSelectedEnd] = useState('section_108')
  const [accessible, setAccessible] = useState(false)
  const [route, setRoute] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [aiAdvice, setAiAdvice] = useState(null)
  const [alerts, setAlerts] = useState(defaultAlerts)
  const [error, setError] = useState('')
  const [guidedMode, setGuidedMode] = useState(false)
  const [lastAutoRerouteTick, setLastAutoRerouteTick] = useState(-1)

  const nonConnectorNodes = useMemo(
    () => graph.nodes.filter((node) => node.type !== 'connector'),
    [graph.nodes]
  )

  const liveAmenitySummary = useMemo(
    () =>
      graph.nodes
        .filter((node) => ['food', 'restroom', 'vip'].includes(node.type))
        .sort((a, b) => (b.sim_congestion || 0) - (a.sim_congestion || 0))
        .slice(0, 3),
    [graph.nodes]
  )

  async function refreshRoute(start = selectedStart, end = selectedEnd, isAccessible = accessible, options = {}) {
    try {
      const [routeData, foodRecommendations, restroomRecommendations] = await Promise.all([
        fetchRoute(start, end, isAccessible),
        fetchRecommendations('food', start, isAccessible),
        fetchRecommendations('restroom', start, isAccessible)
      ])
      setRoute(routeData)
      setRecommendations([...foodRecommendations.slice(0, 2), ...restroomRecommendations.slice(0, 1)])
      setError('')

      const advice = await fetchAdvice({
        start,
        end,
        route_summary: routeData.labels.join(' -> '),
        average_congestion: routeData.average_congestion,
        phase: graph.phase || 'Live Event',
        reroute_suggestion: routeData.reroute_suggestion
      })
      setAiAdvice(advice)

      const nextAlerts = [...defaultAlerts]
      if (routeData.reroute_suggestion) nextAlerts.unshift(routeData.reroute_suggestion)
      if (options.auto && routeData.reroute_suggestion) {
        nextAlerts.unshift(`Auto-reroute: ${routeData.selection_reason}`)
        setLastAutoRerouteTick(graph.tick)
      } else if (guidedMode && !routeData.reroute_suggestion) {
        nextAlerts.unshift('Current route remains optimal.')
      }
      if (graph.phase === 'Halftime Spike') nextAlerts.unshift('Halftime traffic is concentrating around food and restroom zones.')
      if (graph.phase === 'Entry Rush') nextAlerts.unshift('Entry gates are busiest right now. Inner concourses are still smoothing out.')
      if (graph.phase === 'Exit Surge') nextAlerts.unshift('Exit pressure is rising near the south concourse and gate corridors.')
      if (foodRecommendations[0] && foodRecommendations[1]) {
        nextAlerts.unshift(`${foodRecommendations[0].label} is currently faster than ${foodRecommendations[1].label}.`)
      }
      setAlerts(nextAlerts.slice(0, 4))
    } catch (routeError) {
      setError(routeError.message)
      setRoute(null)
    }
  }

  function handleGuidanceComplete() {
    setGuidedMode(false)
    setAlerts((current) => ['Guided navigation complete. You have arrived at your destination.', ...current].slice(0, 4))
  }

  useEffect(() => {
    let socket
    fetchGraph().then((data) => {
      setGraph(data)
    }).catch((graphError) => {
      setError(graphError.message)
    })

    socket = openSimulationSocket((payload) => {
      setGraph(payload)
    })

    return () => {
      socket?.close()
    }
  }, [])

  useEffect(() => {
    if (graph.nodes.length) {
      const shouldAutoReroute = guidedMode && graph.tick !== lastAutoRerouteTick
      refreshRoute(selectedStart, selectedEnd, accessible, { auto: shouldAutoReroute })
    }
  }, [graph.nodes.length, graph.tick])

  return (
    <main className="app-shell">
      <div className="background-grid" />
      <ControlPanel
        nodes={nonConnectorNodes}
        selectedStart={selectedStart}
        selectedEnd={selectedEnd}
        accessible={accessible}
        setSelectedStart={setSelectedStart}
        setSelectedEnd={setSelectedEnd}
        setAccessible={setAccessible}
        route={route}
        recommendations={recommendations}
        phase={graph.phase}
        guidedMode={guidedMode}
        onToggleGuidance={() => setGuidedMode((current) => !current)}
        liveAmenitySummary={liveAmenitySummary}
        alerts={error ? [error, ...alerts] : alerts}
        onRecalculate={() => refreshRoute()}
        aiAdvice={aiAdvice}
      />
      <section className="main-stage">
        <div className="hero-card glass">
          <div>
            <p className="eyebrow">Real-time Coordination</p>
            <h2>Navigate the stadium with crowd-aware guidance.</h2>
          </div>
          <p>
            StadiumVerse combines live congestion, amenity wait conditions, and accessibility-aware routing
            so attendees can move confidently without walking into the busiest choke points.
          </p>
        </div>
        <StadiumScene
          nodes={graph.nodes}
          edges={graph.edges}
          route={route}
          accessible={accessible}
          guidedMode={guidedMode}
          phase={graph.phase}
          startId={selectedStart}
          endId={selectedEnd}
          onGuidanceComplete={handleGuidanceComplete}
        />
      </section>
    </main>
  )
}
