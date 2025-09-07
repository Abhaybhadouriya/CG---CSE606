// js/simulation.js

import * as state from './state.js';
import * as constants from './constants.js';
import * as geo from './geometry.js';
import { draw } from './drawing.js';
import { updateSelectionInfo } from './ui.js';

function generateInitialEdges(constraintEdges) {
    const innerPointStartIndex = constants.BBOX_POINT_COUNT;
    const innerPointEndIndex = constants.BBOX_POINT_COUNT + constants.INNER_POINT_COUNT;
    const obstacleStartIndex = innerPointEndIndex;
    const candidateEdges = [];

    for (let i = 0; i < constants.BBOX_POINT_COUNT; i++) {
        for (let j = innerPointStartIndex; j < innerPointEndIndex; j++) {
            const p1 = state.vertices[i], p2 = state.vertices[j];
            candidateEdges.push({ from: i, to: j, dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) });
        }
    }
    for (let i = innerPointStartIndex; i < innerPointEndIndex; i++) {
        for (let j = i + 1; j < innerPointEndIndex; j++) {
            const p1 = state.vertices[i], p2 = state.vertices[j];
            candidateEdges.push({ from: i, to: j, dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) });
        }
    }
    for (let i = obstacleStartIndex; i < state.vertices.length; i++) {
        for (let j = innerPointStartIndex; j < innerPointEndIndex; j++) {
            const p1 = state.vertices[i], p2 = state.vertices[j];
            candidateEdges.push({ from: i, to: j, dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) });
        }
    }

    candidateEdges.sort((a, b) => a.dist - b.dist);
    const finalEdges = [...constraintEdges];
    const obstacleConnectionCounts = new Array(state.vertices.length).fill(0);

    for (const edge of candidateEdges) {
        if (geo.doesEdgeIntersectObstacle(edge.from, edge.to)) continue;
        let crosses = false;
        for (const finalEdge of finalEdges) {
            if (geo.doEdgesCross(edge.from, edge.to, finalEdge[0], finalEdge[1])) {
                crosses = true;
                break;
            }
        }
        if (crosses) continue;
        if (edge.from >= obstacleStartIndex) {
            if (obstacleConnectionCounts[edge.from] >= 3) continue;
            if (!geo.isLineOfSightClear(edge.from, edge.to)) continue;
            obstacleConnectionCounts[edge.from]++;
        }
        finalEdges.push([edge.from, edge.to]);
    }
    return finalEdges;
}

export function initSimulation() {
    state.setVertices([]);
    state.setEdges([]);
    state.setTriangles([]);
    state.setPeople([]);
    
    const padding = 40;
    const rectWidth = state.canvas.width - 2 * padding;
    const rectHeight = state.canvas.height - 2 * padding;
    
    const newVertices = [
        { x: padding, y: padding, fixed: true },
        { x: padding + rectWidth, y: padding, fixed: true },
        { x: padding + rectWidth, y: padding + rectHeight, fixed: true },
        { x: padding, y: padding + rectHeight, fixed: true }
    ];
    
    const obstacleWidth = 100, obstacleHeight = 70;
    const obstacleX = padding + (rectWidth - obstacleWidth) / 2;
    const obstacleY = padding + (rectHeight - obstacleHeight) / 2;
    
    state.setObstacle({
        x: obstacleX + obstacleWidth / 2, y: obstacleY + obstacleHeight / 2,
        width: obstacleWidth, height: obstacleHeight, rotation: 0,
        points: [
            { x: obstacleX, y: obstacleY }, { x: obstacleX + obstacleWidth, y: obstacleY },
            { x: obstacleX + obstacleWidth, y: obstacleY + obstacleHeight }, { x: obstacleX, y: obstacleY + obstacleHeight }
        ]
    });

    for (let i = 0; i < constants.INNER_POINT_COUNT; i++) {
        let point;
        do {
            point = { x: padding + 50 + Math.random() * (rectWidth - 100), y: padding + 50 + Math.random() * (rectHeight - 100) };
        } while (geo.isPointInsideObstacle(point));
        newVertices.push(point);
    }
    
    const obstacleStartIndex = newVertices.length;
    for (const point of state.obstacle.points) { newVertices.push(point); }
    state.setVertices(newVertices);

    const constraintEdges = [[0, 1], [1, 2], [2, 3], [3, 0], [obstacleStartIndex, obstacleStartIndex + 1], [obstacleStartIndex + 1, obstacleStartIndex + 2], [obstacleStartIndex + 2, obstacleStartIndex + 3], [obstacleStartIndex + 3, obstacleStartIndex]];
    state.setEdges(generateInitialEdges(constraintEdges));
    
    const newPeople = [];
    for (let i = 0; i < 20; i++) {
        let person;
        do {
            person = { x: padding + 20 + Math.random() * (rectWidth - 40), y: padding + 20 + Math.random() * (rectHeight - 40) };
        } while (geo.isPointInsideObstacle(person) || geo.isPointTooCloseToEdges(person, constants.PERSON_EDGE_BUFFER));
        newPeople.push(person);
    }
    state.setPeople(newPeople);
    
    geo.triangulate();
}

export function recomputeEdgesAndTriangulate() {
    const obstacleStartIndex = constants.BBOX_POINT_COUNT + constants.INNER_POINT_COUNT;
    const constraintEdges = [[0,1],[1,2],[2,3],[3,0], [obstacleStartIndex, obstacleStartIndex + 1], [obstacleStartIndex + 1, obstacleStartIndex + 2], [obstacleStartIndex + 2, obstacleStartIndex + 3], [obstacleStartIndex + 3, obstacleStartIndex]];
    state.setEdges(generateInitialEdges(constraintEdges));
    geo.triangulate();
}

export function addPerson() {
    const padding = 40;
    const rectWidth = state.canvas.width - 2 * padding;
    const rectHeight = state.canvas.height - 2 * padding;
    let person;
    do {
        person = { x: padding + 20 + Math.random() * (rectWidth - 40), y: padding + 20 + Math.random() * (rectHeight - 40) };
    } while (geo.isPointInsideObstacle(person) || geo.isPointTooCloseToEdges(person, constants.PERSON_EDGE_BUFFER));
    
    state.people.push(person);
    geo.triangulate(); 
    draw();
    updateSelectionInfo('Added a person. Total: ' + state.people.length);
}

export function removePerson() {
    if (state.people.length > 0) {
        state.people.pop();
        geo.triangulate(); 
        draw();
        updateSelectionInfo('Removed a person. Total: ' + state.people.length);
    } else {
        updateSelectionInfo('No people to remove.');
    }
}

function handleEdgeIntersections() {
    for (let i = 0; i < state.edges.length; i++) {
        for (let j = i + 1; j < state.edges.length; j++) {
            const e1 = state.edges[i], e2 = state.edges[j];
            if (e1[0] === e2[0] || e1[0] === e2[1] || e1[1] === e2[0] || e1[1] === e2[1]) continue;

            if (geo.doEdgesCross(e1[0], e1[1], e2[0], e2[1])) {
                const p1 = state.vertices[e1[0]], p2 = state.vertices[e1[1]];
                const p3 = state.vertices[e2[0]], p4 = state.vertices[e2[1]];
                const dist1 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                const dist2 = Math.hypot(p3.x - p4.x, p3.y - p4.y);
                const edgeToRemove = dist1 > dist2 ? e1 : e2;
                const indexToRemove = state.edges.findIndex(e => (e[0] === edgeToRemove[0] && e[1] === edgeToRemove[1]) || (e[0] === edgeToRemove[1] && e[1] === edgeToRemove[0]));
                if (indexToRemove !== -1) {
                    state.edges.splice(indexToRemove, 1);
                }
            }
        }
    }
}

export function scaleObstacle(factorChange) {
    const newScale = state.currentScaleFactor + factorChange;
    if (newScale > constants.MAX_SCALE_FACTOR || newScale < constants.MIN_SCALE_FACTOR) return;

    const { x: centerX, y: centerY } = state.obstacle;
    const newPoints = state.obstacle.points.map(point => ({
        x: centerX + (point.x - centerX) * (newScale / state.currentScaleFactor),
        y: centerY + (point.y - centerY) * (newScale / state.currentScaleFactor)
    }));
    
    state.obstacle.points = newPoints;
    const obstacleStartIndex = constants.BBOX_POINT_COUNT + constants.INNER_POINT_COUNT;
    for (let i = 0; i < constants.OBSTACLE_POINT_COUNT; i++) {
        state.vertices[obstacleStartIndex + i] = { ...newPoints[i] };
    }

    recomputeEdgesAndTriangulate();
    handleEdgeIntersections();
    
    const originalPeopleCount = state.people.length;
    state.setPeople(state.people.filter(person => !geo.isPointInsideObstacle(person)));
    const removedPeopleCount = originalPeopleCount - state.people.length;

    geo.triangulate();
    state.setCurrentScaleFactor(newScale);
    draw();

    let msg = `Obstacle scaled to ${Math.round(state.currentScaleFactor * 100)}%`;
    if (removedPeopleCount > 0) msg += ` | Removed ${removedPeopleCount} person(s) that entered obstacle.`;
    updateSelectionInfo(msg);
}

export function rotateObstacle() {
    const angle = (15 * Math.PI) / 180;
    const { x: centerX, y: centerY } = state.obstacle;

    const newPoints = state.obstacle.points.map(point => {
        const dx = point.x - centerX, dy = point.y - centerY;
        return {
            x: centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: centerY + dx * Math.sin(angle) + dy * Math.cos(angle)
        };
    });

    state.obstacle.points = newPoints;
    const obstacleStartIndex = constants.BBOX_POINT_COUNT + constants.INNER_POINT_COUNT;
    for (let i = 0; i < constants.OBSTACLE_POINT_COUNT; i++) {
        state.vertices[obstacleStartIndex + i] = { ...newPoints[i] };
    }
    
    recomputeEdgesAndTriangulate();
    handleEdgeIntersections();

    const originalPeopleCount = state.people.length;
    state.setPeople(state.people.filter(person => !geo.isPointInsideObstacle(person)));
    const removedPeopleCount = originalPeopleCount - state.people.length;

    geo.triangulate();
    draw();

    let msg = 'Obstacle rotated by 15°.';
    if (removedPeopleCount > 0) msg += ` Removed ${removedPeopleCount} person(s) that entered obstacle.`;
    updateSelectionInfo(msg);
}