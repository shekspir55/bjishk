import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function App() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [instanceName, setInstanceName] = useState('Bjishk Monitor')
  const [refreshInterval, setRefreshInterval] = useState(30)

  // Default to last 24 hours in local time
  const formatLocalDateTime = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const [startDate, setStartDate] = useState(formatLocalDateTime(yesterday))
  const [endDate, setEndDate] = useState(formatLocalDateTime(now))

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/config`)
      if (response.ok) {
        const data = await response.json()
        setInstanceName(data.instance_name || 'Bjishk Monitor')
        setRefreshInterval(data.refresh_interval || 30)
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
    }
  }

  const fetchPatients = async () => {
    try {
      let url = `${API_URL}/patients`
      const params = new URLSearchParams()

      if (startDate) {
        params.append('start', new Date(startDate).toISOString())
      }
      if (endDate) {
        params.append('end', new Date(endDate).toISOString())
      }

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch patients')
      const data = await response.json()
      setPatients(data || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
    fetchPatients()
  }, [])

  useEffect(() => {
    fetchPatients()
  }, [startDate, endDate])

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchPatients, refreshInterval * 1000)
      return () => clearInterval(interval)
    }
  }, [refreshInterval])

  const getStatusColor = (status) => {
    switch (status) {
      case 'up': return '#22c55e'
      case 'down': return '#ef4444'
      default: return '#94a3b8'
    }
  }

  const getStatusEmoji = (status) => {
    switch (status) {
      case 'up': return '🟢'
      case 'down': return '🔴'
      default: return '⚪'
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const formatColumnHeader = (timestamp) => {
    if (!timestamp) return { date: '', time: '' }
    const date = new Date(timestamp)
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    return { date: dateStr, time: timeStr }
  }

  const formatResponseTime = (ms) => {
    if (ms === null || ms === undefined) return '-'
    return `${ms}ms`
  }

  const getDomain = (url) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  if (loading) {
    return <div className="container">Loading...</div>
  }

  if (error) {
    return <div className="container error">Error: {error}</div>
  }

  return (
    <div className="container">
      <header>
        <h1>🩺 {instanceName}</h1>
        <p className="subtitle">{patients.length} patient{patients.length !== 1 ? 's' : ''} monitored</p>

        <div className="filter-bar">
          <label>
            From: <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            To: <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate('') }}>Clear</button>
          )}
        </div>
      </header>

      {patients.length === 0 ? (
        <div className="no-patients">No patients configured</div>
      ) : (
        <div className="table-container">
          <table className="patients-table">
            <thead>
              <tr>
                <th className="service-col">Service</th>
                {patients[0]?.logs && patients[0].logs.slice().reverse().map((log, idx) => {
                  const { date, time } = formatColumnHeader(log.created_at)
                  return (
                    <th key={idx} className="time-col">
                      <div className="time-header">
                        <div className="time-date">{date}</div>
                        <div className="time-time">{time}</div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => {
                const logs = (patient.logs || []).slice().reverse()
                return (
                  <tr key={patient.id}>
                    <td className="service-cell">
                      <a href={patient.url} target="_blank" rel="noopener noreferrer" className="service-link">
                        <span className="status-emoji">{getStatusEmoji(patient.status)}</span>
                        {patient.is_bjishk && <span className="emoji-badge">🩺</span>}
                        {patient.name || getDomain(patient.url)}
                      </a>
                    </td>
                    {logs.map((log, idx) => (
                      <td
                        key={idx}
                        className="status-cell"
                        style={{ backgroundColor: getStatusColor(log.status) }}
                        title={`${log.status.toUpperCase()}\n${formatTime(log.created_at)}\nResponse: ${formatResponseTime(log.response_time)}`}
                      >
                        <div className="status-indicator"></div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="footer">
        <a href="https://github.com/shekspir55/bjishk" target="_blank" rel="noopener noreferrer">
          Contribute to bjishk 🔗
        </a>
      </footer>
    </div>
  )
}

export default App
