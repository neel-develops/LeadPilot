import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './theme.css'
import './paytm.css'
import './light.css'

// Paytm light theme across the whole app
document.documentElement.dataset.theme = 'light'

createRoot(document.getElementById('root')).render(<App />)
