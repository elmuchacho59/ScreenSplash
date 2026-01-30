import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AssetManager from './pages/AssetManager';
import PlaylistEditor from './pages/PlaylistEditor';
import ScheduleEditor from './pages/ScheduleEditor';
import Settings from './pages/Settings';
import Player from './pages/Player';
import Login from './pages/Login';
import WidgetManager from './pages/WidgetManager';

function ProtectedRoutes({ isAuthenticated, isLoading }) {
    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'var(--color-bg-primary)'
            }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/check', { credentials: 'include' });
            const data = await res.json();

            // If no password is set OR user is authenticated
            if (!data.password_set || data.authenticated) {
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
        } catch (err) {
            // If API fails, assume no auth needed (for initial setup)
            setIsAuthenticated(true);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (err) {
            console.error('Logout error:', err);
        }
        setIsAuthenticated(false);
    };

    return (
        <Router>
            <Routes>
                {/* Public routes */}
                <Route path="/player" element={<Player />} />
                <Route path="/login" element={
                    isAuthenticated
                        ? <Navigate to="/" replace />
                        : <Login onLogin={handleLogin} />
                } />

                {/* Protected admin routes */}
                <Route element={<ProtectedRoutes isAuthenticated={isAuthenticated} isLoading={isLoading} />}>
                    <Route path="/" element={<Layout onLogout={handleLogout} />}>
                        <Route index element={<Dashboard />} />
                        <Route path="assets" element={<AssetManager />} />
                        <Route path="playlists" element={<PlaylistEditor />} />
                        <Route path="playlists/:id" element={<PlaylistEditor />} />
                        <Route path="schedules" element={<ScheduleEditor />} />
                        <Route path="widgets" element={<WidgetManager />} />
                        <Route path="settings" element={<Settings />} />
                    </Route>
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
