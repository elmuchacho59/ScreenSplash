import { useState, useEffect } from 'react';

/**
 * InfoPage Component
 * A full-screen widget used as a playlist item to display time, date, and weather.
 */
function InfoPage() {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState(null);

    // Update time every second
    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Fetch weather every 10 minutes
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // Using a default city or config if available in the future
                const res = await fetch('/api/widgets/weather?city=Paris');
                if (res.ok) {
                    const data = await res.json();
                    setWeather(data);
                }
            } catch (err) {
                console.error('Weather fetch error in InfoPage:', err);
            }
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, 600000);
        return () => clearInterval(interval);
    }, []);

    const timeStr = time.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const secondsStr = time.toLocaleTimeString('fr-FR', {
        second: '2-digit'
    });

    const dateStr = time.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Animated Background Elements */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                left: '-10%',
                width: '40%',
                height: '40%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(40px)',
                animation: 'float 20s infinite alternate ease-in-out'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                right: '-10%',
                width: '50%',
                height: '50%',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(50px)',
                animation: 'float 25s infinite alternate-reverse ease-in-out'
            }} />

            <div style={{ zIndex: 1, textAlign: 'center' }}>
                {/* Weather Section */}
                {weather && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '20px',
                        marginBottom: '40px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '15px 30px',
                        borderRadius: '100px',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <span style={{ fontSize: '48px' }}>{weather.icon}</span>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '32px', fontWeight: 700 }}>{weather.temp}°C</div>
                            <div style={{ fontSize: '16px', opacity: 0.7, textTransform: 'capitalize' }}>
                                {weather.description} • {weather.city}
                            </div>
                        </div>
                    </div>
                )}

                {/* Time Section */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
                    <div style={{
                        fontSize: '180px',
                        fontWeight: 800,
                        letterSpacing: '-4px',
                        lineHeight: 1
                    }}>
                        {timeStr}
                    </div>
                    <div style={{
                        fontSize: '60px',
                        fontWeight: 300,
                        marginLeft: '15px',
                        opacity: 0.5
                    }}>
                        {secondsStr}
                    </div>
                </div>

                {/* Date Section */}
                <div style={{
                    fontSize: '36px',
                    fontWeight: 400,
                    marginTop: '20px',
                    opacity: 0.8,
                    textTransform: 'capitalize'
                }}>
                    {dateStr}
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(50px, 30px) scale(1.1); }
                }
            `}</style>
        </div>
    );
}

export default InfoPage;
