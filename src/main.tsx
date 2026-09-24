import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexProvider } from 'convex/react'
import { AuthBootstrap } from './components/AuthBootstrap'
import { isMockApiEnabled } from './constants/mockAuth'
import { MockAuthProvider } from './components/MockAuthProvider'
import { SessionAuthProvider } from './hooks/useSessionAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { convexClient } from './convex/client'
import HomeRedirect from './pages/HomeRedirect'
import './styles/index.css'

const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'))
const RegisterPage = lazy(() => import('./pages/Register/RegisterPage'))
const SignInPage = lazy(() => import('./pages/SignIn/SignInPage'))

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

const useMockApi = isMockApiEnabled()

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <AuthBootstrap>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route
              path="/register"
              element={
                <ProtectedRoute requireAuth requireNoSubmittedRegistration>
                  <RegisterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute requireAuth>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthBootstrap>
    </BrowserRouter>
  </React.StrictMode>
)

const withSession = <SessionAuthProvider>{app}</SessionAuthProvider>

const content = useMockApi ? (
  <MockAuthProvider>
    {convexClient ? (
      <ConvexProvider client={convexClient}>{withSession}</ConvexProvider>
    ) : (
      withSession
    )}
  </MockAuthProvider>
) : convexClient ? (
  <ConvexAuthProvider client={convexClient} storage={window.sessionStorage}>
    {withSession}
  </ConvexAuthProvider>
) : (
  withSession
)

ReactDOM.createRoot(root).render(content)
