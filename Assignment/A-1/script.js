// Canvas and context
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');

// Simulation state
let vertices = [];
let edges = [];
let triangles = [];
let people = [];
let obstacle = null;
let interactionMode = 'select';
let selectedVertex = null;
let selectedPerson = null;
let isDragging = false;

// Point classification and constants
const BBOX_POINT_COUNT = 4;
let INNER_POINT_COUNT = 12;
const OBSTACLE_POINT_COUNT = 4;
const PERSON_EDGE_BUFFER = 5; // Min distance a person can be from an edge

// Initialize the simulation
function initSimulation() {
    vertices = [];
    edges = [];
    triangles = [];
    people = [];
    
    const padding = 40;
    const rectWidth = canvas.width - 2 * padding;
    const rectHeight = canvas.height - 2 * padding;
    
    vertices.push({ x: padding, y: padding });
    vertices.push({ x: padding + rectWidth, y: padding });
    vertices.push({ x: padding + rectWidth, y: padding + rectHeight });
    vertices.push({ x: padding, y: padding + rectHeight });
    
    const constraintEdges = [[0, 1], [1, 2], [2, 3], [3, 0]];
    
    const obstacleWidth = 100;
    const obstacleHeight = 70;
    const obstacleX = padding + (rectWidth - obstacleWidth) / 2;
    const obstacleY = padding + (rectHeight - obstacleHeight) / 2;
    
    obstacle = {
        x: obstacleX + obstacleWidth / 2, y: obstacleY + obstacleHeight / 2,
        width: obstacleWidth, height: obstacleHeight, rotation: 0,
        points: [
            { x: obstacleX, y: obstacleY },
            { x: obstacleX + obstacleWidth, y: obstacleY },
            { x: obstacleX + obstacleWidth, y: obstacleY + obstacleHeight },
            { x: obstacleX, y: obstacleY + obstacleHeight }
        ]
    };

    for (let i = 0; i < INNER_POINT_COUNT; i++) {
        let point;
        do {
            const x = padding + 50 + Math.random() * (rectWidth - 100);
            const y = padding + 50 + Math.random() * (rectHeight - 100);
            point = { x, y };
        } while (isPointInsideObstacle(point));
        vertices.push(point);
    }
    
    const obstacleStartIndex = vertices.length;
    for (const point of obstacle.points) {
        vertices.push(point);
    }
    constraintEdges.push(
        [obstacleStartIndex, obstacleStartIndex + 1],
        [obstacleStartIndex + 1, obstacleStartIndex + 2],
        [obstacleStartIndex + 2, obstacleStartIndex + 3],
        [obstacleStartIndex + 3, obstacleStartIndex]
    );
    
    edges = generateInitialEdges(constraintEdges);
    
    for (let i = 0; i < 20; i++) {
        let person;
        do {
            const x = padding + 20 + Math.random() * (rectWidth - 40);
            const y = padding + 20 + Math.random() * (rectHeight - 40);
            person = { x, y };
        } while (isPointInsideObstacle(person) || isPointTooCloseToEdges(person, PERSON_EDGE_BUFFER));
        people.push(person);
    }
    
    triangulate();
    updateStatus('Simulation initialized. Select an interaction mode to begin.');
}

function doesEdgeIntersectObstacle(p1_idx, p2_idx) {
    const obstacleStartIndex = BBOX_POINT_COUNT + INNER_POINT_COUNT;
    for (let i = 0; i < OBSTACLE_POINT_COUNT; i++) {
        const edgeP1 = obstacleStartIndex + i;
        const edgeP2 = obstacleStartIndex + ((i + 1) % OBSTACLE_POINT_COUNT);
        if (doEdgesCross(p1_idx, p2_idx, edgeP1, edgeP2)) {
            return true;
        }
    }
    return false;
}

function generateInitialEdges(constraintEdges) {
    const innerPointStartIndex = BBOX_POINT_COUNT;
    const innerPointEndIndex = BBOX_POINT_COUNT + INNER_POINT_COUNT;
    const obstacleStartIndex = innerPointEndIndex;
    const candidateEdges = [];

    for (let i = 0; i < BBOX_POINT_COUNT; i++) {
        for (let j = innerPointStartIndex; j < innerPointEndIndex; j++) {
            const p1 = vertices[i], p2 = vertices[j];
            candidateEdges.push({ from: i, to: j, dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) });
        }
    }

    for (let i = innerPointStartIndex; i < innerPointEndIndex; i++) {
        for (let j = i + 1; j < innerPointEndIndex; j++) {
            const p1 = vertices[i], p2 = vertices[j];
            candidateEdges.push({ from: i, to: j, dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) });
        }
    }

    for (let i = obstacleStartIndex; i < vertices.length; i++) {
        for (let j = innerPointStartIndex; j < innerPointEndIndex; j++) {
            const p1 = vertices[i], p2 = vertices[j];
            candidateEdges.push({ from: i, to: j, dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) });
        }
    }

    candidateEdges.sort((a, b) => a.dist - b.dist);
    const finalEdges = [...constraintEdges];
    const obstacleConnectionCounts = new Array(vertices.length).fill(0);

    for (const edge of candidateEdges) {
        if (doesEdgeIntersectObstacle(edge.from, edge.to)) continue;
        let crosses = false;
        for (const finalEdge of finalEdges) {
            if (doEdgesCross(edge.from, edge.to, finalEdge[0], finalEdge[1])) {
                crosses = true;
                break;
            }
        }
        if (crosses) continue;
        if (edge.from >= obstacleStartIndex) {
            if (obstacleConnectionCounts[edge.from] >= 3) continue;
            if (!isLineOfSightClear(edge.from, edge.to)) continue;
            obstacleConnectionCounts[edge.from]++;
        }
        finalEdges.push([edge.from, edge.to]);
    }
    return finalEdges;
}

function isLineOfSightClear(p1_idx, p2_idx) {
    const obstacleStartIndex = BBOX_POINT_COUNT + INNER_POINT_COUNT;
    for (let i = 0; i < OBSTACLE_POINT_COUNT; i++) {
        const edgeP1 = obstacleStartIndex + i;
        const edgeP2 = obstacleStartIndex + ((i + 1) % OBSTACLE_POINT_COUNT);
        if (doEdgesCross(p1_idx, p2_idx, edgeP1, edgeP2)) return false;
    }
    return true;
}

// **UPDATED FUNCTION**
// Now accepts an options object to "ban" certain edges from being re-created.
function triangulate(options = {}) {
    triangles = [];
    const tempEdges = new Set(edges.map(e => e.sort().join('-')));
    const bannedEdges = new Set((options.bannedEdges || []).map(e => e.sort().join('-')));

    for (let i = 0; i < vertices.length; i++) {
        for (let j = i + 1; j < vertices.length; j++) {
            for (let k = j + 1; k < vertices.length; k++) {
                if (isValidTriangle(i, j, k, tempEdges, bannedEdges)) {
                    triangles.push([i, j, k]);
                    [ [i,j], [j,k], [k,i] ].forEach(e => tempEdges.add(e.sort().join('-')));
                }
            }
        }
    }
}

// **UPDATED FUNCTION**
// Now checks against the bannedEdges set.
function isValidTriangle(i, j, k, existingEdges, bannedEdges) {
    const p0 = vertices[i], p1 = vertices[j], p2 = vertices[k];
    if (crossProduct(p0, p1, p2) === 0) return false;
    
    const triEdges = [ [i,j], [j,k], [k,i] ];
    
    // Check if any side of this triangle is a "banned" edge
    for (const edge of triEdges) {
        if (bannedEdges.has(edge.sort().join('-'))) {
            return false;
        }
    }
    
    for (const newEdge of triEdges) {
        if (!existingEdges.has(newEdge.sort().join('-'))) {
             for (const existingEdgeStr of existingEdges) {
                const existingEdge = existingEdgeStr.split('-').map(Number);
                if (doEdgesCross(newEdge[0], newEdge[1], existingEdge[0], existingEdge[1])) return false;
            }
        }
    }

    for (let v_idx = 0; v_idx < vertices.length; v_idx++) {
        if (v_idx === i || v_idx === j || v_idx === k) continue;
        if (isPointInTriangle(vertices[v_idx], p0, p1, p2)) return false;
    }
    return true;
}

function doEdgesCross(a1, b1, a2, b2) {
    if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) return false;
    const p0 = vertices[a1], p1 = vertices[b1], p2 = vertices[a2], p3 = vertices[b2];
    const dir1 = crossProduct(p0, p1, p2) * crossProduct(p0, p1, p3);
    const dir2 = crossProduct(p2, p3, p0) * crossProduct(p2, p3, p1);
    return dir1 < 0 && dir2 < 0;
}

function crossProduct(p0, p1, p2) {
    return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTriangles();
    drawEdges();
    drawVertices();
    drawObstacle();
    drawPeople();
}

function drawTriangles() {
    for (const triangle of triangles) {
        const [i, j, k] = triangle;
        const p0 = vertices[i], p1 = vertices[j], p2 = vertices[k];
        const count = countPeopleInTriangle(p0, p1, p2);
        let color;
        if (count > 4) color = 'rgba(255, 0, 0, 0.6)';
        else if (count < 4) color = 'rgba(0, 0, 255, 0.6)';
        else color = 'rgba(0, 255, 0, 0.6)';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
}

function countPeopleInTriangle(p0, p1, p2) {
    return people.filter(p => isPointInTriangle(p, p0, p1, p2)).length;
}

function isPointInTriangle(p, p0, p1, p2) {
    const denom = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);
    if (denom === 0) return false;
    const a = ((p1.y - p2.y) * (p.x - p2.x) + (p2.x - p1.x) * (p.y - p2.y)) / denom;
    const b = ((p2.y - p0.y) * (p.x - p2.x) + (p0.x - p2.x) * (p.y - p2.y)) / denom;
    const c = 1 - a - b;
    return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
}

function isPointInsideObstacle(point) {
    if (!obstacle) return false;
    const [p0, p1, p2, p3] = obstacle.points;
    const minX = Math.min(p0.x, p1.x, p2.x, p3.x);
    const maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
    const minY = Math.min(p0.y, p1.y, p2.y, p3.y);
    const maxY = Math.max(p0.y, p1.y, p2.y, p3.y);
    return point.x > minX && point.x < maxX && point.y > minY && point.y < maxY;
}

function isPointTooCloseToEdges(point, buffer) {
    for (const edge of edges) {
        const p0 = vertices[edge[0]];
        const p1 = vertices[edge[1]];
        const distance = distanceToLineSegment(point.x, point.y, p0.x, p0.y, p1.x, p1.y);
        if (distance < buffer) return true;
    }
    return false;
}

function distanceToLineSegment(x, y, x1, y1, x2, y2) {
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

function drawEdges() {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    for (const edge of edges) {
        const p0 = vertices[edge[0]], p1 = vertices[edge[1]];
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
    }
    const obstacleStartIndex = vertices.length - OBSTACLE_POINT_COUNT;
    ctx.strokeStyle = '#a52a2a';
    ctx.lineWidth = 3;
    for (let i = 0; i < OBSTACLE_POINT_COUNT; i++) {
        const p0 = vertices[obstacleStartIndex + i];
        const p1 = vertices[obstacleStartIndex + ((i + 1) % OBSTACLE_POINT_COUNT)];
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
    }
}

function drawVertices() {
    const obstacleStartIndex = vertices.length - OBSTACLE_POINT_COUNT;
    for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        ctx.beginPath();
        if (i >= obstacleStartIndex) { ctx.fillStyle = '#a52a2a'; ctx.arc(v.x, v.y, 6, 0, Math.PI * 2); }
        else { ctx.fillStyle = '#fff'; ctx.arc(v.x, v.y, 5, 0, Math.PI * 2); }
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function drawObstacle() {
    if (!obstacle) return;
    ctx.fillStyle = 'rgba(128, 128, 128)';
    ctx.beginPath();
    ctx.moveTo(obstacle.points[0].x, obstacle.points[0].y);
    for (let i = 1; i < obstacle.points.length; i++) ctx.lineTo(obstacle.points[i].x, obstacle.points[i].y);
    ctx.closePath();
    ctx.fill();
}

function drawPeople() {
    for (const person of people) {
        ctx.beginPath();
        ctx.arc(person.x, person.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
    }
}

function findClosestVertex(x, y, threshold = 15) {
    let minDist = Infinity, closestIndex = -1;
    for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
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
    for (const edge of edges) {
        const p0 = vertices[edge[0]], p1 = vertices[edge[1]];
        const dist = distanceToLineSegment(x, y, p0.x, p0.y, p1.x, p1.y);
        if (dist < minDist && dist < threshold) {
            minDist = dist;
            closestEdge = edge;
        }
    }
    return closestEdge;
}

function findClosestPerson(x, y, threshold = 10) {
    let minDist = Infinity, closestIndex = -1;
    for (let i = 0; i < people.length; i++) {
        const person = people[i];
        const dist = Math.hypot(person.x - x, person.y - y);
        if (dist < minDist && dist < threshold) {
            minDist = dist;
            closestIndex = i;
        }
    }
    return closestIndex !== -1 ? { person: people[closestIndex], index: closestIndex } : null;
}

function addPerson() {
    const padding = 40;
    const rectWidth = canvas.width - 2 * padding;
    const rectHeight = canvas.height - 2 * padding;
    let person;
    do {
        const x = padding + 20 + Math.random() * (rectWidth - 40);
        const y = padding + 20 + Math.random() * (rectHeight - 40);
        person = { x, y };
    } while (isPointInsideObstacle(person) || isPointTooCloseToEdges(person, PERSON_EDGE_BUFFER));
    people.push(person);
    triangulate(); 
    draw();
    updateStatus('Added a person. Total: ' + people.length);
}

function removePerson() {
    if (people.length > 0) {
        people.pop();
        triangulate(); 
        draw();
        updateStatus('Removed a person. Total: ' + people.length);
    } else {
        updateStatus('No people to remove.');
    }
}

function reconnectObstacle() {
    initSimulation();
    draw();
    updateStatus('Reconnected and re-triangulated the simulation.');
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    
    if (interactionMode === 'move-point') {
       const closest = findClosestVertex(x, y, 15);
        const obstacleStartIndex = BBOX_POINT_COUNT + INNER_POINT_COUNT;

        // Prevent selecting obstacle vertices
        if (closest !== -1 && closest < obstacleStartIndex) {
            selectedVertex = closest;
            isDragging = true;
            updateStatus(`Moving vertex ${selectedVertex}`);
        }
    } else if (interactionMode === 'move-person') {
        const personInfo = findClosestPerson(x, y);
        if (personInfo) {
            selectedPerson = personInfo.index;
            isDragging = true;
            updateStatus(`Moving person ${selectedPerson + 1}`);
        }
    } else if (interactionMode === 'remove-edge') {
        const edgeToRemove = findClosestEdge(x, y);
        if (!edgeToRemove) return;

        const isBboxEdge = edgeToRemove[0] < 4 && edgeToRemove[1] < 4;
        const obstacleStartIndex = BBOX_POINT_COUNT + INNER_POINT_COUNT;
        const isObstacleEdge = edgeToRemove[0] >= obstacleStartIndex && edgeToRemove[1] >= obstacleStartIndex;

        if(isBboxEdge || isObstacleEdge) {
            updateStatus('Cannot remove a boundary edge.');
            return;
        }

        const edgeIndex = edges.findIndex(e => (e[0] === edgeToRemove[0] && e[1] === edgeToRemove[1]) || (e[0] === edgeToRemove[1] && e[1] === edgeToRemove[0]));
        if (edgeIndex > -1) {
            edges.splice(edgeIndex, 1);
            // Re-triangulate, "banning" the removed edge to force a new tiling
            triangulate({ bannedEdges: [edgeToRemove] });
            draw();
            updateStatus('Edge removed.');
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;

    if (selectedVertex !== null) {
        const newPos = { x, y };
        const padding = vertices[0].x;
        const bbox_max_x = vertices[1].x;
        const bbox_max_y = vertices[2].y;

        if (isPointInsideObstacle(newPos) || x < padding || x > bbox_max_x || y < padding || y > bbox_max_y) {
            return;
        }

        vertices[selectedVertex].x = x;
        vertices[selectedVertex].y = y;
        
        const constraintEdges = [];
        const obstacleStartIndex = vertices.length - OBSTACLE_POINT_COUNT;
        constraintEdges.push([0,1],[1,2],[2,3],[3,0]);
        constraintEdges.push(
            [obstacleStartIndex, obstacleStartIndex + 1],
            [obstacleStartIndex + 1, obstacleStartIndex + 2],
            [obstacleStartIndex + 2, obstacleStartIndex + 3],
            [obstacleStartIndex + 3, obstacleStartIndex]
        );
        edges = generateInitialEdges(constraintEdges);
        triangulate();
        draw();
    } else if (selectedPerson !== null) {
        people[selectedPerson].x = x;
        people[selectedPerson].y = y;
        draw();
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    selectedVertex = null;
    selectedPerson = null;
    if (interactionMode === 'move-person') {
        triangulate();
        draw();
    }
});

canvas.addEventListener('mouseleave', () => { isDragging = false; selectedVertex = null; selectedPerson = null; });

function setInteractionMode(mode) {
    interactionMode = mode;
    document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');
    updateStatus(`Mode set to: ${mode}`);
}

const MAX_SCALE_FACTOR = 1.5;   // Max allowed scaling (50% increase)
const MIN_SCALE_FACTOR = 1.0;   // Minimum (original size)
let currentScaleFactor = 1.0;

function scaleObstacle(factorChange) {
    const newScale = currentScaleFactor + factorChange;

    if (newScale > MAX_SCALE_FACTOR || newScale < MIN_SCALE_FACTOR) return;

    const centerX = obstacle.x;
    const centerY = obstacle.y;

    // Calculate new scaled obstacle points
    const newPoints = obstacle.points.map(point => {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        return {
            x: centerX + dx * (newScale / currentScaleFactor),
            y: centerY + dy * (newScale / currentScaleFactor)
        };
    });

    // Backup current obstacle points
    const oldPoints = [...obstacle.points];

    // Apply scaling temporarily
    obstacle.points = newPoints;

    const obstacleStartIndex = BBOX_POINT_COUNT + INNER_POINT_COUNT;
    for (let i = 0; i < OBSTACLE_POINT_COUNT; i++) {
        vertices[obstacleStartIndex + i] = { ...newPoints[i] };
    }

    // Recompute edges based on new obstacle points
    const constraintEdges = [
        [0,1],[1,2],[2,3],[3,0],
        [obstacleStartIndex, obstacleStartIndex + 1],
        [obstacleStartIndex + 1, obstacleStartIndex + 2],
        [obstacleStartIndex + 2, obstacleStartIndex + 3],
        [obstacleStartIndex + 3, obstacleStartIndex]
    ];
    edges = generateInitialEdges(constraintEdges);

    // Handle intersecting edges
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            const e1 = edges[i];
            const e2 = edges[j];

            if (e1[0] === e2[0] || e1[0] === e2[1] || e1[1] === e2[0] || e1[1] === e2[1]) continue;

            if (doEdgesCross(e1[0], e1[1], e2[0], e2[1])) {
                const p1 = vertices[e1[0]], p2 = vertices[e1[1]];
                const p3 = vertices[e2[0]], p4 = vertices[e2[1]];

                const dist1 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                const dist2 = Math.hypot(p3.x - p4.x, p3.y - p4.y);

                const edgeToRemove = dist1 > dist2 ? e1 : e2;
                const indexToRemove = edges.findIndex(e => (e[0] === edgeToRemove[0] && e[1] === edgeToRemove[1]) || (e[0] === edgeToRemove[1] && e[1] === edgeToRemove[0]));

                if (indexToRemove !== -1) {
                    edges.splice(indexToRemove, 1);
                }
            }
        }
    }

    // Remove people inside the obstacle after scaling
    const originalPeopleCount = people.length;
    people = people.filter(person => !isPointInsideObstacle(person));
    const removedPeopleCount = originalPeopleCount - people.length;

    triangulate();
    currentScaleFactor = newScale;
    draw();

    let msg = `Obstacle scaled to ${Math.round(currentScaleFactor * 100)}%`;
    if (removedPeopleCount > 0) {
        msg += ` | Removed ${removedPeopleCount} person(s) that entered obstacle.`;
    }

    updateStatus(msg);
};




document.getElementById('scale-obstacle-up').addEventListener('click', () => {
    scaleObstacle(0.1);  // Increase size by 10%
});

document.getElementById('scale-obstacle-in').addEventListener('click', () => {
    scaleObstacle(-0.1); // Decrease size by 10%
});

function rotateObstacle() {
    const angle = (15 * Math.PI) / 180;  // 15 degrees in radians
    const centerX = obstacle.x;
    const centerY = obstacle.y;

    const newPoints = obstacle.points.map(point => {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        return {
            x: centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: centerY + dx * Math.sin(angle) + dy * Math.cos(angle)
        };
    });

    // Apply the rotation
    obstacle.points = newPoints;

    const obstacleStartIndex = BBOX_POINT_COUNT + INNER_POINT_COUNT;
    for (let i = 0; i < OBSTACLE_POINT_COUNT; i++) {
        vertices[obstacleStartIndex + i] = { ...newPoints[i] };
    }

    // Recompute edges based on new rotated obstacle
    const constraintEdges = [
        [0,1],[1,2],[2,3],[3,0],
        [obstacleStartIndex, obstacleStartIndex + 1],
        [obstacleStartIndex + 1, obstacleStartIndex + 2],
        [obstacleStartIndex + 2, obstacleStartIndex + 3],
        [obstacleStartIndex + 3, obstacleStartIndex]
    ];
    edges = generateInitialEdges(constraintEdges);

    // Handle intersecting edges (like in scaling)
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            const e1 = edges[i];
            const e2 = edges[j];

            if (e1[0] === e2[0] || e1[0] === e2[1] || e1[1] === e2[0] || e1[1] === e2[1]) continue;

            if (doEdgesCross(e1[0], e1[1], e2[0], e2[1])) {
                const p1 = vertices[e1[0]], p2 = vertices[e1[1]];
                const p3 = vertices[e2[0]], p4 = vertices[e2[1]];

                const dist1 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                const dist2 = Math.hypot(p3.x - p4.x, p3.y - p4.y);

                const edgeToRemove = dist1 > dist2 ? e1 : e2;
                const indexToRemove = edges.findIndex(e => (e[0] === edgeToRemove[0] && e[1] === edgeToRemove[1]) || (e[0] === edgeToRemove[1] && e[1] === edgeToRemove[0]));

                if (indexToRemove !== -1) {
                    edges.splice(indexToRemove, 1);
                }
            }
        }
    }

    // Remove people inside obstacle after rotation
    const originalPeopleCount = people.length;
    people = people.filter(person => !isPointInsideObstacle(person));
    const removedPeopleCount = originalPeopleCount - people.length;

    triangulate();
    draw();

    let msg = 'Obstacle rotated by 15°.';
    if (removedPeopleCount > 0) {
        msg += ` Removed ${removedPeopleCount} person(s) that entered obstacle.`;
    }

    updateStatus(msg);
};


document.getElementById('rotate-obstacle').addEventListener('click', rotateObstacle);


document.getElementById('mode-select').addEventListener('click', () => setInteractionMode('select'));
document.getElementById('mode-add-edge').addEventListener('click', () => {
    setInteractionMode('add-edge');
    updateStatus('Mode Add-Edge is disabled; layout is auto-generated.');
});
document.getElementById('mode-remove-edge').addEventListener('click', () => setInteractionMode('remove-edge'));
document.getElementById('mode-move-point').addEventListener('click', () => setInteractionMode('move-point'));
document.getElementById('mode-move-person').addEventListener('click', () => setInteractionMode('move-person'));
document.getElementById('reset-btn').addEventListener('click', () => { initSimulation(); draw(); });
document.getElementById('add-person').addEventListener('click', addPerson);
document.getElementById('remove-person').addEventListener('click', removePerson);
document.getElementById('reconnect-obstacle').addEventListener('click', reconnectObstacle);

initSimulation();
draw();