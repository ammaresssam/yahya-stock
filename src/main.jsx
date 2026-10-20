import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// The admin panel is a separate chunk: customers never download it.
const Admin = lazy(() => import('./admin/Admin'))

const isAdminRoute = () => location.hash.startsWith('#/admin')

function Root() {
  const [admin, setAdmin] = useState(isAdminRoute)

  useEffect(() => {
    const onChange = () => setAdmin(isAdminRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return admin ? (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  ) : (
    <App />
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
