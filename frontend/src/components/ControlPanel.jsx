import React from 'react'

const typeLabel = {
  food: 'Food',
  restroom: 'Restroom'
}

export default function ControlPanel({
  nodes,
  selectedStart,
  selectedEnd,
  accessible,
  setSelectedStart,
  setSelectedEnd,
  setAccessible,
  route,
  recommendations,
  phase,
  alerts,
  onRecalculate,
  aiAdvice
}) {
  return (
    <aside className="control-panel glass">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Smart Stadium Assistant</p>
          <h1>StadiumVerse</h1>
        </div>
        <span className="phase-pill">{phase}</span>
      </div>

      <div className="panel-section">
        <label>Start</label>
        <select value={selectedStart} onChange={(event) => setSelectedStart(event.target.value)}>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>{node.label}</option>
          ))}
        </select>
      </div>

      <div className="panel-section">
        <label>Destination</label>
        <select value={selectedEnd} onChange={(event) => setSelectedEnd(event.target.value)}>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>{node.label}</option>
          ))}
        </select>
      </div>

      <div className="panel-section toggle-row">
        <div>
          <label>Accessible Routing</label>
          <p className="muted">Avoids non-accessible sections and path segments.</p>
        </div>
        <button
          className={accessible ? 'toggle active' : 'toggle'}
          onClick={() => setAccessible(!accessible)}
          type="button"
        >
          {accessible ? 'On' : 'Off'}
        </button>
      </div>

      <button className="primary-btn" onClick={onRecalculate} type="button">
        Recalculate Route
      </button>

      {route?.reroute_suggestion && (
        <button className="primary-btn" onClick={onRecalculate} type="button">
          Accept Reroute Suggestion
        </button>
      )}

      <div className="panel-section glass inset">
        <div className="section-title-row">
          <h2>Route Summary</h2>
          {route?.reroute_suggestion && <span className="warning-tag">Reroute</span>}
        </div>
        {route ? (
          <>
            <p className="route-chain">{route.labels.join('  •  ')}</p>
            <div className="metric-grid">
              <div>
                <span>Effort</span>
                <strong>{route.estimated_total_effort.toFixed(1)}</strong>
              </div>
              <div>
                <span>Avg Congestion</span>
                <strong>{Math.round(route.average_congestion * 100)}%</strong>
              </div>
              <div>
                <span>Wait Impact</span>
                <strong>{route.estimated_wait_impact.toFixed(1)} min</strong>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Select two points to generate a route.</p>
        )}
      </div>

      <div className="panel-section glass inset">
        <h2>Nearest Amenities</h2>
        <div className="amenity-list">
          {recommendations.map((item) => (
            <div className="amenity-card" key={item.id}>
              <div>
                <span className="mini-label">{typeLabel[item.type]}</span>
                <strong>{item.label}</strong>
              </div>
              <p>{item.reasoning}</p>
              <div className="amenity-metrics">
                <span>{item.walk_distance}m walk</span>
                <span>{item.effective_wait_time}m wait</span>
                <span>{Math.round(item.congestion * 100)}% busy</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section glass inset">
        <h2>Alerts</h2>
        <div className="alerts">
          {alerts.map((alert, index) => (
            <div className="alert-card" key={`${alert}-${index}`}>{alert}</div>
          ))}
        </div>
      </div>

      <div className="panel-section glass inset">
        <h2>AI Advice</h2>
        <p>{aiAdvice?.message || 'Advice appears after route generation.'}</p>
        <span className="muted">Provider: {aiAdvice?.provider || 'pending'}</span>
      </div>
    </aside>
  )
}
