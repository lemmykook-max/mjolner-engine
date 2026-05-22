import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Polyfill window.storage with localStorage for standalone deployment
window.storage = {
  get: async (key) => {
    try {
      const value = localStorage.getItem(key)
      return value ? { key, value } : null
    } catch { return null }
  },
  set: async (key, value) => {
    try {
      localStorage.setItem(key, value)
      return { key, value }
    } catch { return null }
  },
  delete: async (key) => {
    try {
      localStorage.removeItem(key)
      return { key, deleted: true }
    } catch { return null }
  },
  list: async (prefix) => {
    try {
      const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix))
      return { keys }
    } catch { return { keys: [] } }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
