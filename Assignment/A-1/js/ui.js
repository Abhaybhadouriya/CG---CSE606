// js/ui.js

import * as state from './state.js';
import * as constants from './constants.js';
import * as geo from './geometry.js';
import * as sim from './simulation.js';
import { draw } from './drawing.js';

function findClosestVertex(x, y, threshold = 15) {
    let minDist = Infinity, closestIndex = -1;
    for (let i = 0; i < state.vertices.length; i++) {
        const v = state.vertices[i];
        const dist = Math.hypot(v.x - x, v.y - y);
        if (dist < minDist && dist < threshold) {
            minDist = dist;
            closestIndex = i;
        }
    }
    return closestIndex;
}

function findClosestEdge(x, y, threshold = 10) {
    let minDist = Infinity, closestEdge = null;
    for (const edge of state.edges) {
        const p0 = state.vertices[edge[0]], p1 = state.vertices[edge[1]];
        const dist = geo.distanceToLineSegment(x, y, p0.x, p0.y, p1.x, p1.y);
        if (dist < minDist && dist < threshold) {
            minDist = dist;
            closestEdge = edge;
        }
    }
    return closestEdge;
}

function findClosestPerson(x, y, threshold = 10) {
    let minDist = Infinity, closestIndex = -1;
    for (let i = 0; i < state.people.length; i++) {
        const person = state.people[i];
        const dist = Math.hypot(person.x - x, person.y - y);
        if (dist < minDist && dist < threshold) {
            minDist = dist;
            closestIndex = i;
        }
    }
    return closestIndex !== -1 ? { person: state.people[closestIndex], index: closestIndex } : null;
}

export function updateSelectionInfo(content) {
    state.selectionInfoElement.innerHTML = content;
    state.selectionInfoElement.style.transition = 'background 0.5s ease';
    state.selectionInfoElement.style.background = '#d1ffd1';
    setTimeout(() => {
        state.selectionInfoElement.style.background = '#f9f9f9';
    }, 500);
}

function handleMouseDown(e) {
    const rect = state.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (state.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (state.canvas.height / rect.height);

    if (state.interactionMode === 'move-point') {
        const closest = findClosestVertex(x, y, 15);
        const obstacleStartIndex = constants.BBOX_POINT_COUNT + constants.INNER_POINT_COUNT;

        if (closest !== -1 && closest < obstacleStartIndex && !state.vertices[closest].fixed) {
            state.setSelectedVertex(closest);
            state.setIsDragging(true);
            updateSelectionInfo(`Moving vertex ${state.selectedVertex}`);
        } else if (closest !== -1 && state.vertices[closest].fixed) {
            updateSelectionInfo('This vertex is fixed and cannot be moved.');
        }
    } else if (state.interactionMode === 'move-person') {
        const personInfo = findClosestPerson(x, y);
        if (personInfo) {
            state.setSelectedPerson(personInfo.index);
            state.setIsDragging(true);
            updateSelectionInfo(`Moving person ${state.selectedPerson + 1}`);
        }
    } else if (state.interactionMode === 'remove-edge') {
        const edgeToRemove = findClosestEdge(x, y);
        if (!edgeToRemove) return;

        const isBboxEdge = edgeToRemove[0] < 4 && edgeToRemove[1] < 4;
        const obstacleStartIndex = constants.BBOX_POINT_COUNT + constants.INNER_POINT_COUNT;
        const isObstacleEdge = edgeToRemove[0] >= obstacleStartIndex && edgeToRemove[1] >= obstacleStartIndex;

        if(isBboxEdge || isObstacleEdge) {
            updateSelectionInfo('Cannot remove a boundary edge.');
            return;
        }

        const edgeIndex = state.edges.findIndex(e => (e[0] === edgeToRemove[0] && e[1] === edgeToRemove[1]) || (e[0] === edgeToRemove[1] && e[1] === edgeToRemove[0]));
        if (edgeIndex > -1) {
            state.edges.splice(edgeIndex, 1);
            geo.triangulate({ bannedEdges: [edgeToRemove] });
            draw();
            updateSelectionInfo('Edge removed.');
        }
    } else if (state.interactionMode === 'add-edge') {
        const clickedVertex = findClosestVertex(x, y, 15);
        if (clickedVertex === -1) return;

        if (state.firstVertexForEdge === null) {
            state.setFirstVertexForEdge(clickedVertex);
            updateSelectionInfo(`Selected vertex ${state.firstVertexForEdge}. Now select the second vertex.`);
        } else {
            if (state.firstVertexForEdge === clickedVertex) {
                updateSelectionInfo('Cannot add edge to same vertex.');
                state.setFirstVertexForEdge(null);
                return;
            }

            const alreadyExists = state.edges.some(e => (e[0] === state.firstVertexForEdge && e[1] === clickedVertex) || (e[1] === state.firstVertexForEdge && e[0] === clickedVertex));
            if (alreadyExists) {
                updateSelectionInfo('Edge already exists.');
                state.setFirstVertexForEdge(null);
                return;
            }

            if (!geo.isLineOfSightClear(state.firstVertexForEdge, clickedVertex)) {
                updateSelectionInfo('Edge crosses obstacle, cannot add.');
                state.setFirstVertexForEdge(null);
                return;
            }

            let crossesAnotherEdge = state.edges.some(edge => geo.doEdgesCross(state.firstVertexForEdge, clickedVertex, edge[0], edge[1]));
            if (crossesAnotherEdge) {
                updateSelectionInfo('New edge would intersect existing edge.');
                state.setFirstVertexForEdge(null);
                return;
            }

            state.edges.push([state.firstVertexForEdge, clickedVertex]);
            geo.triangulate();
            draw();
            updateSelectionInfo(`Edge added between vertex ${state.firstVertexForEdge} and vertex ${clickedVertex}.`);
            state.setFirstVertexForEdge(null);
        }
    } else if (state.interactionMode === 'select') {
        const vertexIdx = findClosestVertex(x, y, 15);
        if (vertexIdx !== -1) {
            state.setSelected({ type: 'vertex', index: vertexIdx, extra: null });
            updateSelectionInfo(`<strong>Vertex Selected:</strong> Index ${vertexIdx}`);
            draw(); return;
        }

        const personInfo = findClosestPerson(x, y);
        if (personInfo) {
            state.setSelected({ type: 'person', index: personInfo.index, extra: null });
            updateSelectionInfo(`<strong>Person Selected:</strong> Index ${personInfo.index + 1}`);
            draw(); return;
        }

        const edge = findClosestEdge(x, y, 10);
        if (edge) {
            state.setSelected({ type: 'edge', index: null, extra: edge });
            updateSelectionInfo(`<strong>Edge Selected:</strong> Between Vertex ${edge[0]} and Vertex ${edge[1]}`);
            draw(); return;
        }

        if (geo.isPointInsideObstacle({ x, y })) {
            state.setSelected({ type: 'obstacle', index: null, extra: null });
            updateSelectionInfo(`<strong>Obstacle Selected</strong>`);
            draw(); return;
        }

        state.setSelected({ type: null, index: null, extra: null });
        updateSelectionInfo('Nothing selected.');
        draw();
    }
}

function handleMouseMove(e) {
    if (!state.isDragging) return;
    const rect = state.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;

    if (state.selectedVertex !== null) {
        const newPos = { x, y };
        const padding = state.vertices[0].x;
        const bbox_max_x = state.vertices[1].x, bbox_max_y = state.vertices[2].y;

        if (geo.isPointInsideObstacle(newPos) || x < padding || x > bbox_max_x || y < padding || y > bbox_max_y) return;

        state.vertices[state.selectedVertex].x = x;
        state.vertices[state.selectedVertex].y = y;
        
        sim.recomputeEdgesAndTriangulate();
        draw();
    } else if (state.selectedPerson !== null) {
        state.people[state.selectedPerson].x = x;
        state.people[state.selectedPerson].y = y;
        draw();
    }
}

function handleMouseUp() {
    state.setIsDragging(false);
    state.setSelectedVertex(null);
    state.setSelectedPerson(null);
    if (state.interactionMode === 'move-person') {
        geo.triangulate();
        draw();
    }
}

function setInteractionMode(mode) {
    state.setInteractionMode(mode);
    document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');
    updateSelectionInfo(`Mode set to: ${mode}`);
}

export function initializeEventListeners() {
    state.canvas.addEventListener('mousedown', handleMouseDown);
    state.canvas.addEventListener('mousemove', handleMouseMove);
    state.canvas.addEventListener('mouseup', handleMouseUp);
    state.canvas.addEventListener('mouseleave', handleMouseUp); // Use same logic as mouseup

    document.getElementById('mode-select').addEventListener('click', () => setInteractionMode('select'));
    document.getElementById('mode-add-edge').addEventListener('click', () => setInteractionMode('add-edge'));
    document.getElementById('mode-remove-edge').addEventListener('click', () => setInteractionMode('remove-edge'));
    document.getElementById('mode-move-point').addEventListener('click', () => setInteractionMode('move-point'));
    document.getElementById('mode-move-person').addEventListener('click', () => setInteractionMode('move-person'));

    document.getElementById('reset-btn').addEventListener('click', () => { sim.initSimulation(); draw(); });
    document.getElementById('add-person').addEventListener('click', sim.addPerson);
    document.getElementById('remove-person').addEventListener('click', sim.removePerson);
    
    document.getElementById('scale-obstacle-up').addEventListener('click', () => sim.scaleObstacle(0.1));
    document.getElementById('scale-obstacle-in').addEventListener('click', () => sim.scaleObstacle(-0.1));
    document.getElementById('rotate-obstacle').addEventListener('click', sim.rotateObstacle);
    
    document.getElementById('deselect-btn').addEventListener('click', () => {
        state.setSelected({ type: null, index: null, extra: null });
        updateSelectionInfo('Nothing selected.');
        draw();
    });
}