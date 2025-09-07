// js/drawing.js

import * as state from './state.js';
import * as constants from './constants.js';
import { isPointInTriangle } from './geometry.js';

function countPeopleInTriangle(p0, p1, p2) {
    return state.people.filter(p => isPointInTriangle(p, p0, p1, p2)).length;
}

function drawTriangles() {
    for (const triangle of state.triangles) {
        const [i, j, k] = triangle;
        const p0 = state.vertices[i], p1 = state.vertices[j], p2 = state.vertices[k];
        const count = countPeopleInTriangle(p0, p1, p2);
        let color;
        if (count > 4) color = 'rgba(255, 0, 0, 0.6)';
        else if (count < 4) color = 'rgba(0, 0, 255, 0.6)';
        else color = 'rgba(0, 255, 0, 0.6)';
        state.ctx.beginPath();
        state.ctx.moveTo(p0.x, p0.y);
        state.ctx.lineTo(p1.x, p1.y);
        state.ctx.lineTo(p2.x, p2.y);
        state.ctx.closePath();
        state.ctx.fillStyle = color;
        state.ctx.fill();
    }
}

function drawEdges() {
    state.ctx.lineWidth = 2;
    for (const edge of state.edges) {
        const p0 = state.vertices[edge[0]], p1 = state.vertices[edge[1]];
        state.ctx.beginPath();
        state.ctx.moveTo(p0.x, p0.y);
        state.ctx.lineTo(p1.x, p1.y);

        if (state.selected.type === 'edge' &&
            ((state.selected.extra[0] === edge[0] && state.selected.extra[1] === edge[1]) ||
             (state.selected.extra[0] === edge[1] && state.selected.extra[1] === edge[0]))) {
            state.ctx.strokeStyle = 'red';
            state.ctx.lineWidth = 3;
        } else {
            state.ctx.strokeStyle = '#ccc';
            state.ctx.lineWidth = 2;
        }
        state.ctx.stroke();
    }
}

function drawVertices() {
    const obstacleStartIndex = state.vertices.length - constants.OBSTACLE_POINT_COUNT;
    for (let i = 0; i < state.vertices.length; i++) {
        const v = state.vertices[i];
        state.ctx.beginPath();
        state.ctx.arc(v.x, v.y, 6, 0, Math.PI * 2);

        if (state.selected.type === 'vertex' && state.selected.index === i) {
            state.ctx.fillStyle = 'red';
        } else if (i >= obstacleStartIndex) {
            state.ctx.fillStyle = '#a52a2a';  // Obstacle vertex
        } else {
            state.ctx.fillStyle = '#fff';
        }

        state.ctx.fill();
        state.ctx.strokeStyle = '#000';
        state.ctx.lineWidth = 1;
        state.ctx.stroke();
    }
}

function drawObstacle() {
    if (!state.obstacle) return;
    state.ctx.fillStyle = (state.selected.type === 'obstacle') ? 'darkgray' : 'rgba(128, 128, 128, 1)';
    state.ctx.beginPath();
    state.ctx.moveTo(state.obstacle.points[0].x, state.obstacle.points[0].y);
    for (let i = 1; i < state.obstacle.points.length; i++) {
        state.ctx.lineTo(state.obstacle.points[i].x, state.obstacle.points[i].y);
    }
    state.ctx.closePath();
    state.ctx.fill();
}

function drawPeople() {
     for (let i = 0; i < state.people.length; i++) {
        const person = state.people[i];
        state.ctx.beginPath();
        state.ctx.arc(person.x, person.y, 3, 0, Math.PI * 2);
        state.ctx.fillStyle = (state.selected.type === 'person' && state.selected.index === i) ? 'red' : '#000';
        state.ctx.fill();
    }
}

export function draw() {
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    drawTriangles();
    drawEdges();
    drawVertices();
    drawObstacle();
    drawPeople();
}