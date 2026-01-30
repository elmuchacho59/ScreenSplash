import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global error reporter for debugging on Raspberry Pi
window.onerror = function (message, source, lineno, colno, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.height = '100%';
    errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '20px';
    errorDiv.style.zIndex = '100000';
    errorDiv.style.fontFamily = 'monospace';
    errorDiv.style.overflow = 'auto';
    errorDiv.innerHTML = `
        <h1 style="color: yellow">Fichier/Erreur détectée</h1>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Source:</strong> ${source}</p>
        <p><strong>Ligne:</strong> ${lineno}:${colno}</p>
        <pre style="background: rgba(0,0,0,0.5); padding: 10px; margin-top: 10px;">${error?.stack || 'No stack trace'}</pre>
        <button onclick="location.reload()" style="padding: 10px 20px; background: white; color: black; border: none; border-radius: 5px; cursor: pointer; margin-top: 20px;">Redémarrer l'interface</button>
    `;
    document.body.appendChild(errorDiv);
    return false;
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

