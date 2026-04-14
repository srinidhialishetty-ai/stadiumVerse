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

  const nonConnectorNodes = useMemo(
    () => graph.nodes.filter((node) => node.type !== 'connector'),
    [graph.nodes]
  )

  async function refreshRoute(start = selectedStart, end = selectedEnd, isAccessible = accessible) {
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
      if (graph.phase === 'Halftime Spike') nextAlerts.unshift('Halftime traffic is concentrating around food and restroom zones.')
      setAlerts(nextAlerts.slice(0, 4))
    } catch (routeError) {
      setError(routeError.message)
      setRoute(null)
    }
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
      refreshRoute()
    }
  }, [graph.tick])

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
        <StadiumScene nodes={graph.nodes} route={route} accessible={accessible} />
      </section>
    </main>
  )
}
