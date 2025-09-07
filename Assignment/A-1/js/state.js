// js/state.js

// Canvas and context
export const canvas = document.getElementById('simulationCanvas');
export const ctx = canvas.getContext('2d');
export const statusElement = document.getElementById('status');
export const selectionInfoElement = document.getElementById('selection-info');

// Simulation state - using `let` to allow them to be reassigned
export let vertices = [];
export let edges = [];
export let triangles = [];
export let people = [];
export let obstacle = null;
export let interactionMode = 'select';
export let selectedVertex = null;
export let selectedPerson = null;
export let isDragging = false;
export let selected = { type: null, index: null, extra: null };
export let firstVertexForEdge = null;
export let currentScaleFactor = 1.0;

// Setters to modify state from other modules
export function setVertices(newVertices) { vertices = newVertices; }
export function setEdges(newEdges) { edges = newEdges; }
export function setTriangles(newTriangles) { triangles = newTriangles; }
export function setPeople(newPeople) { people = newPeople; }
export function setObstacle(newObstacle) { obstacle = newObstacle; }
export function setInteractionMode(mode) { interactionMode = mode; }
export function setSelectedVertex(vertex) { selectedVertex = vertex; }
export function setSelectedPerson(person) { selectedPerson = person; }
export function setIsDragging(dragging) { isDragging = dragging; }
export function setSelected(newSelected) { selected = newSelected; }
export function setFirstVertexForEdge(vertex) { firstVertexForEdge = vertex; }
export function setCurrentScaleFactor(factor) { currentScaleFactor = factor; }