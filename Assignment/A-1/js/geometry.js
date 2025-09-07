// js/geometry.js

import * as state from './state.js';
import * as constants from './constants.js';

export function crossProduct(p0, p1, p2) {
    return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
}

export function doEdgesCross(a1, b1, a2, b2) {
    if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) return false;
    const p0 = state.vertices[a1], p1 = state.vertices[b1], p2 = state.vertices[a2], p3 = state.vertices[b2];
    const dir1 = crossProduct(p0, p1, p2) * crossProduct(p0, p1, p3);
    const dir2 = crossProduct(p2, p3, p0) * crossProduct(p2, p3, p1);
    return dir1 < 0 && dir2 < 0;
}

export function isPointInTriangle(p, p0, p1, p2) {
    const denom = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);
    if (denom === 0) return false;
    const a = ((p1.y - p2.y) * (p.x - p2.x) + (p2.x - p1.x) * (p.y - p2.y)) / denom;
    const b = ((p2.y - p0.y) * (p.x - p2.x) + (p0.x - p2.x) * (p.y - p2.y)) / denom;
    const c = 1 - a - b;
    return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
}

export function isPointInsideObstacle(point) {
    if (!state.obstacle) return false;
    const [p0, p1, p2, p3] = state.obstacle.points;
    const minX = Math.min(p0.x, p1.x, p2.x, p3.x);
    const maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
    const minY = Math.min(p0.y, p1.y, p2.y, p3.y);
    const maxY = Math.max(p0.y, p1.y, p2.y, p3.y);
    return point.x > minX && point.x < maxX && point.y > minY && point.y < maxY;
}

export function distanceToLineSegment(x, y, x1, y1, x2, y2) {
    const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.hypot(x - xx, y - yy);
}

export function isPointTooCloseToEdges(point, buffer) {
    for (const edge of state.edges) {
        const p0 = state.vertices[edge[0]];
        const p1 = state.vertices[edge[1]];
        const distance = distanceToLineSegment(point.x, point.y, p0.x, p0.y, p1.x, p1.y);
        if (distance < buffer) return true;
    }
    return false;
}

export function isLineOfSightClear(p1_idx, p2_idx) {
    const obstacleStartIndex = constants.BBOX_POINT_COUNT + constants.INNER_POINT_COUNT;
    for (let i = 0; i < constants.OBSTACLE_POINT_COUNT; i++) {
        const edgeP1 = obstacleStartIndex + i;
        const edgeP2 = obstacleStartIndex + ((i + 1) % constants.OBSTACLE_POINT_COUNT);
        if (doEdgesCross(p1_idx, p2_idx, edgeP1, edgeP2)) return false;
    }
    return true;
}

function isValidTriangle(i, j, k, existingEdges, bannedEdges) {
    const p0 = state.vertices[i], p1 = state.vertices[j], p2 = state.vertices[k];
    if (crossProduct(p0, p1, p2) === 0) return false;
    
    const triEdges = [ [i,j], [j,k], [k,i] ];
    
    for (const edge of triEdges) {
        if (bannedEdges.has(edge.sort().join('-'))) return false;
    }
    
    for (const newEdge of triEdges) {
        if (!existingEdges.has(newEdge.sort().join('-'))) {
             for (const existingEdgeStr of existingEdges) {
                const existingEdge = existingEdgeStr.split('-').map(Number);
                if (doEdgesCross(newEdge[0], newEdge[1], existingEdge[0], existingEdge[1])) return false;
            }
        }
    }

    for (let v_idx = 0; v_idx < state.vertices.length; v_idx++) {
        if (v_idx === i || v_idx === j || v_idx === k) continue;
        if (isPointInTriangle(state.vertices[v_idx], p0, p1, p2)) return false;
    }
    return true;
}

export function triangulate(options = {}) {
    const newTriangles = [];
    const tempEdges = new Set(state.edges.map(e => e.sort().join('-')));
    const bannedEdges = new Set((options.bannedEdges || []).map(e => e.sort().join('-')));

    for (let i = 0; i < state.vertices.length; i++) {
        for (let j = i + 1; j < state.vertices.length; j++) {
            for (let k = j + 1; k < state.vertices.length; k++) {
                if (isValidTriangle(i, j, k, tempEdges, bannedEdges)) {
                    newTriangles.push([i, j, k]);
                    [ [i,j], [j,k], [k,i] ].forEach(e => tempEdges.add(e.sort().join('-')));
                }
            }
        }
    }
    state.setTriangles(newTriangles);
}

export function doesEdgeIntersectObstacle(p1_idx, p2_idx) {
    const obstacleStartIndex = constants.BBOX_POINT_COUNT + constants.INNER_POINT_COUNT;
    for (let i = 0; i < constants.OBSTACLE_POINT_COUNT; i++) {
        const edgeP1 = obstacleStartIndex + i;
        const edgeP2 = obstacleStartIndex + ((i + 1) % constants.OBSTACLE_POINT_COUNT);
        if (doEdgesCross(p1_idx, p2_idx, edgeP1, edgeP2)) {
            return true;
        }
    }
    return false;
}