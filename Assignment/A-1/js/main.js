// js/main.js

import { initSimulation } from './simulation.js';
import { initializeEventListeners } from './ui.js';
import { draw } from './drawing.js';

// Initialize the simulation state
initSimulation();

// Set up all the button and mouse event listeners
initializeEventListeners();

// Perform the initial draw
draw();

console.log("Simulation loaded and running in modular structure.");