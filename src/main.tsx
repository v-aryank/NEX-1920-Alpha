import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
// @ts-ignore CSS side-effect import is handled by the bundler.
import './styles.css';
// @ts-ignore CSS side-effect import is handled by the bundler.
import './refinements.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
