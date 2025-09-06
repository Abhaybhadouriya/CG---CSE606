// Enhanced WebGL Crowd Simulation Renderer - Complete Assignment Implementation
// CSE606 Computer Graphics Assignment 1 - All Requirements Covered

class EnhancedCrowdSimulationRenderer {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

        if (!this.gl) {
            alert('WebGL is not supported by your browser');
            return;
        }
 
        // Application state
        this.currentMode = 'SELECT';
        this.targetDensity = 4;
        this.debugMode = false;
        this.rotationAngle = 15; // degrees
        this.scaleFactor = 1.1;

        // Selection and interaction state
        this.selectedVertex = null;
        this.selectedEdge = null;
        this.selectedTriangle = null;
        this.selectedDot = null;
        this.selectedObstacle = null;
        this.firstSelectedVertex = null;
        this.isDragging = false;
        this.draggedObject = null;
        this.lastMousePos = {x: 0, y: 0};

        // Data structures
        this.vertices = [];
        this.edges = [];
        this.triangles = [];
        this.dots = [];
        this.obstacles = [];
        this.triangulationPoints = []; // For random layout generation

        // ID counters
        this.vertexIdCounter = 0;
        this.edgeIdCounter = 0;
        this.triangleIdCounter = 0;
        this.dotIdCounter = 0;
        this.obstacleIdCounter = 0;

        // WebGL resources
        this.programs = {};
        this.buffers = {};
        this.locations = {};

        // Colors (RGBA format for WebGL)
        this.colors = {
            vertex: [0.2, 0.2, 0.2, 1.0],
            selectedVertex: [1.0, 0.6, 0.0, 1.0],
            edge: [0.4, 0.4, 0.4, 1.0],
            selectedEdge: [1.0, 0.5, 0.0, 1.0],
            triangleUnder: [0.13, 0.59, 0.95, 0.4],  // Blue - under-populated
            triangleOptimal: [0.30, 0.69, 0.31, 0.4], // Green - optimal density
            triangleOver: [0.96, 0.26, 0.21, 0.4],    // Red - over-populated
            dot: [0.0, 0.0, 0.0, 1.0],                // Black dots for people
            selectedDot: [1.0, 0.0, 0.0, 1.0],
            obstacle: [0.6, 0.4, 0.2, 0.8],           // Brown/tan color
            selectedObstacle: [1.0, 0.7, 0.3, 0.9],
            triangulationPoint: [0.7, 0.7, 0.7, 0.6]
        };

        this.init();
    }

    init() {
        console.log('Initializing Enhanced WebGL Crowd Simulation Renderer...');

        // Initialize WebGL
        this.initWebGL();
        this.initShaders();
        this.initBuffers();

        // Generate initial random layout (Assignment Requirement #1)
        this.generateRandomLayout();

        // Set up event listeners
        this.setupEventListeners();

        // Update UI
        this.updateUI();
        this.updateStatusMessage('Random triangulation layout generated. Ready for interaction.');

        // Start render loop
        this.render();

        console.log('✅ Enhanced initialization complete with random layout');
    }

    // Assignment Requirement #1: Generate random layout of points for triangulation
    generateRandomLayout() {
        console.log('🎲 Generating random triangulation layout...');

        // Clear existing data
        this.clearAll();

        const width = this.canvas.width;
        const height = this.canvas.height;
        const margin = 60;

        // Create boundary rectangle (always needed)
        const boundaryPoints = [
            {x: margin, y: margin},                    // Bottom-left
            {x: width - margin, y: margin},            // Bottom-right
            {x: width - margin, y: height - margin},   // Top-right
            {x: margin, y: height - margin}            // Top-left
        ];

        // Add boundary vertices
        boundaryPoints.forEach(point => {
            this.addVertex(point.x, point.y);
        });

        // Create boundary edges
        for (let i = 0; i < 4; i++) {
            this.addEdge(i, (i + 1) % 4);
        }

        // Generate random interior points for triangulation (6-10 points)
        const numInteriorPoints = 6 + Math.floor(Math.random() * 5);
        const interiorMargin = 120;

        for (let i = 0; i < numInteriorPoints; i++) {
            let attempts = 0;
            let validPoint = false;

            while (!validPoint && attempts < 50) {
                const x = interiorMargin + Math.random() * (width - 2 * interiorMargin);
                const y = interiorMargin + Math.random() * (height - 2 * interiorMargin);

                // Check minimum distance from other points
                let minDistance = Infinity;
                for (let j = 0; j < this.vertices.length; j++) {
                    const dx = this.vertices[j].x - x;
                    const dy = this.vertices[j].y - y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    minDistance = Math.min(minDistance, distance);
                }

                if (minDistance > 80) { // Minimum distance between points
                    this.addVertex(x, y);
                    validPoint = true;
                }
                attempts++;
            }
        }

        // Generate random edges for triangulation (simplified approach)
        this.generateRandomTriangulation();

        console.log(`✅ Generated random layout with ${this.vertices.length} vertices and ${this.edges.length} edges`);
        this.updateStatusMessage(`Random layout generated: ${this.vertices.length} points, ${this.triangles.length} triangles`);
    }

    generateRandomTriangulation() {
        const numVertices = this.vertices.length;
        const numRandomEdges = 8 + Math.floor(Math.random() * 6); // 8-14 additional edges

        // Connect some random vertices to create triangulation
        for (let i = 0; i < numRandomEdges; i++) {
            let attempts = 0;
            while (attempts < 20) {
                const v1 = Math.floor(Math.random() * numVertices);
                const v2 = Math.floor(Math.random() * numVertices);

                if (v1 !== v2 && !this.edgeExists(v1, v2)) {
                    // Check if edge would intersect existing edges (simplified check)
                    if (!this.wouldIntersectExistingEdges(v1, v2)) {
                        this.addEdge(v1, v2);
                        break;
                    }
                }
                attempts++;
            }
        }

        // Connect some vertices to boundary for better triangulation
        for (let i = 4; i < Math.min(numVertices, 8); i++) {
            const boundaryVertex = Math.floor(Math.random() * 4);
            if (!this.edgeExists(i, boundaryVertex)) {
                this.addEdge(i, boundaryVertex);
            }
        }
    }

    // Assignment Requirement #2: Create obstacles with integrated triangulation
    createObstacle() {
        console.log('🏗️ Creating rectangular obstacle...');

        const centerX = this.canvas.width / 2 + (Math.random() - 0.5) * 200;
        const centerY = this.canvas.height / 2 + (Math.random() - 0.5) * 200;
        const width = 80 + Math.random() * 60;  // 80-140px width
        const height = 60 + Math.random() * 40; // 60-100px height

        // Create obstacle vertices
        const obstacleVertices = [
            this.addVertex(centerX - width/2, centerY - height/2), // Bottom-left
            this.addVertex(centerX + width/2, centerY - height/2), // Bottom-right
            this.addVertex(centerX + width/2, centerY + height/2), // Top-right
            this.addVertex(centerX - width/2, centerY + height/2)  // Top-left
        ];

        const startIndex = this.vertices.length - 4;

        // Create obstacle edges
        const obstacleEdges = [
            this.addEdge(startIndex, startIndex + 1),
            this.addEdge(startIndex + 1, startIndex + 2), 
            this.addEdge(startIndex + 2, startIndex + 3),
            this.addEdge(startIndex + 3, startIndex)
        ];

        // Create obstacle object
        const obstacle = {
            id: this.obstacleIdCounter++,
            centerX: centerX,
            centerY: centerY,
            width: width,
            height: height,
            vertices: obstacleVertices,
            edges: obstacleEdges,
            vertexIndices: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3],
            rotation: 0,
            selected: false
        };

        this.obstacles.push(obstacle);

        // Connect obstacle to nearby vertices for triangulation
        this.connectObstacleToTriangulation(obstacle);

        console.log(`✅ Obstacle created at (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
        this.updateStatusMessage('Obstacle created and integrated into triangulation');

        return obstacle;
    }

    connectObstacleToTriangulation(obstacle) {
        // Connect obstacle corners to nearby vertices for proper triangulation
        obstacle.vertexIndices.forEach(obstacleVertexIndex => {
            const obstacleVertex = this.vertices[obstacleVertexIndex];
            let closestVertices = [];

            // Find 2-3 closest non-obstacle vertices
            for (let i = 0; i < this.vertices.length; i++) {
                if (obstacle.vertexIndices.includes(i)) continue;

                const vertex = this.vertices[i];
                const dx = vertex.x - obstacleVertex.x;
                const dy = vertex.y - obstacleVertex.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                closestVertices.push({index: i, distance: distance});
            }

            // Sort by distance and connect to 1-2 closest
            closestVertices.sort((a, b) => a.distance - b.distance);

            for (let i = 0; i < Math.min(2, closestVertices.length); i++) {
                const targetIndex = closestVertices[i].index;
                if (closestVertices[i].distance < 200 && !this.edgeExists(obstacleVertexIndex, targetIndex)) {
                    // Only add if it doesn't intersect obstacle itself
                    if (!this.edgeIntersectsObstacle(obstacleVertexIndex, targetIndex, obstacle)) {
                        this.addEdge(obstacleVertexIndex, targetIndex);
                    }
                }
            }
        });
    }

    // Assignment Requirement #4.1: Rotate obstacles with triangulation updates
    rotateSelectedObstacle() {
        if (!this.selectedObstacle) {
            this.updateStatusMessage('⚠️ No obstacle selected for rotation');
            return;
        }

        console.log(`🔄 Rotating obstacle ${this.selectedObstacle.id} by ${this.rotationAngle}°`);

        const obstacle = this.selectedObstacle;
        const angleRad = (this.rotationAngle * Math.PI) / 180;

        // Store old vertex positions for edge reconnection
        const oldPositions = obstacle.vertexIndices.map(i => ({
            x: this.vertices[i].x,
            y: this.vertices[i].y
        }));

        // Remove existing connections to this obstacle
        this.removeObstacleConnections(obstacle);

        // Rotate vertices around obstacle center
        obstacle.vertexIndices.forEach(vertexIndex => {
            const vertex = this.vertices[vertexIndex];

            // Translate to origin
            const x = vertex.x - obstacle.centerX;
            const y = vertex.y - obstacle.centerY;

            // Rotate
            const newX = x * Math.cos(angleRad) - y * Math.sin(angleRad);
            const newY = x * Math.sin(angleRad) + y * Math.cos(angleRad);

            // Translate back
            vertex.x = obstacle.centerX + newX;
            vertex.y = obstacle.centerY + newY;
        });

        // Update obstacle rotation
        obstacle.rotation += this.rotationAngle;

        // Reconnect to triangulation with new positions
        this.connectObstacleToTriangulation(obstacle);

        // Update triangulation
        this.updateTriangulation();

        console.log(`✅ Obstacle rotated. New rotation: ${obstacle.rotation.toFixed(1)}°`);
        this.updateStatusMessage(`Obstacle rotated by ${this.rotationAngle}° - Triangulation updated`);
    }

    // Assignment Requirement #4.2: Move obstacles with triangulation updates  
    moveSelectedObstacle(deltaX, deltaY) {
        if (!this.selectedObstacle) return;

        const obstacle = this.selectedObstacle;

        // Remove existing connections
        this.removeObstacleConnections(obstacle);

        // Move all obstacle vertices
        obstacle.vertexIndices.forEach(vertexIndex => {
            this.vertices[vertexIndex].x += deltaX;
            this.vertices[vertexIndex].y += deltaY;
        });

        // Update obstacle center
        obstacle.centerX += deltaX;
        obstacle.centerY += deltaY;

        // Reconnect to triangulation
        this.connectObstacleToTriangulation(obstacle);
        this.updateTriangulation();

        this.updateStatusMessage('Obstacle moved - Triangulation updated');
    }

    // Assignment Requirement #4.3: Scale obstacles with triangulation updates
    scaleSelectedObstacle() {
        if (!this.selectedObstacle) {
            this.updateStatusMessage('⚠️ No obstacle selected for scaling');
            return;
        }

        console.log(`📏 Scaling obstacle ${this.selectedObstacle.id} by ${this.scaleFactor}x`);

        const obstacle = this.selectedObstacle;

        // Remove existing connections
        this.removeObstacleConnections(obstacle);

        // Scale vertices around obstacle center
        obstacle.vertexIndices.forEach(vertexIndex => {
            const vertex = this.vertices[vertexIndex];

            // Translate to origin
            const x = vertex.x - obstacle.centerX;
            const y = vertex.y - obstacle.centerY;

            // Scale
            const newX = x * this.scaleFactor;
            const newY = y * this.scaleFactor;

            // Translate back
            vertex.x = obstacle.centerX + newX;
            vertex.y = obstacle.centerY + newY;
        });

        // Update obstacle dimensions
        obstacle.width *= this.scaleFactor;
        obstacle.height *= this.scaleFactor;

        // Reconnect to triangulation
        this.connectObstacleToTriangulation(obstacle);
        this.updateTriangulation();

        console.log(`✅ Obstacle scaled by ${this.scaleFactor}x`);
        this.updateStatusMessage(`Obstacle scaled by ${this.scaleFactor}x - Triangulation updated`);
    }

    removeObstacleConnections(obstacle) {
        // Remove edges connecting to obstacle vertices (but keep obstacle edges)
        const obstacleVertexSet = new Set(obstacle.vertexIndices);
        const obstacleEdgeSet = new Set(obstacle.edges?.map(e => e?.id).filter(id => id !== undefined));

        this.edges = this.edges.filter(edge => {
            // Keep edge if it's an obstacle internal edge
            if (obstacleEdgeSet.has(edge.id)) {
                return true;
            }

            // Remove edge if it connects to obstacle vertex
            const connectsToObstacle = obstacleVertexSet.has(edge.vertex1) || obstacleVertexSet.has(edge.vertex2);
            if (connectsToObstacle) {
                console.log(`Removing connection edge ${edge.id}`);
            }

            return !connectsToObstacle;
        });
    }

    // Assignment Requirement #3: Render black points (people) in triangular spaces
    addDot(x, y) {
        const triangleIndex = this.findTriangleContaining(x, y);

        if (triangleIndex === -1) {
            console.warn('Cannot add person outside of triangulated area');
            this.updateStatusMessage('⚠️ Cannot add person outside triangulated area');
            return null;
        }

        const dot = {
            id: this.dotIdCounter++,
            x: x,
            y: y,
            triangleIndex: triangleIndex,
            selected: false
        };

        this.dots.push(dot);
        this.updateTriangleDensity(triangleIndex);

        console.log(`👤 Added person at (${x.toFixed(0)}, ${y.toFixed(0)}) in triangle ${triangleIndex}`);

        return dot;
    }

    // Assignment Requirement #6: Move dots between triangles with color updates
    moveDot(dot, newX, newY) {
        const oldTriangleIndex = dot.triangleIndex;
        const newTriangleIndex = this.findTriangleContaining(newX, newY);

        dot.x = newX;
        dot.y = newY;

        if (newTriangleIndex !== -1) {
            dot.triangleIndex = newTriangleIndex;

            // Update density for both old and new triangles
            if (oldTriangleIndex !== -1 && oldTriangleIndex !== newTriangleIndex) {
                this.updateTriangleDensity(oldTriangleIndex);
            }
            this.updateTriangleDensity(newTriangleIndex);

            if (oldTriangleIndex !== newTriangleIndex) {
                console.log(`🚶 Person moved from triangle ${oldTriangleIndex} to ${newTriangleIndex}`);
            }
        }
    }

    // Assignment Requirement #4.4 & #4.5: Population density coloring with updates
    updateTriangleDensity(triangleIndex) {
        if (triangleIndex < 0 || triangleIndex >= this.triangles.length) {
            return;
        }

        const triangle = this.triangles[triangleIndex];

        // Count dots in this triangle
        let count = 0;
        this.dots.forEach(dot => {
            if (dot.triangleIndex === triangleIndex) {
                count++;
            }
        });

        triangle.density = count;

        // Assignment Requirement: Color triangles based on density
        if (count < this.targetDensity) {
            triangle.color = [...this.colors.triangleUnder];    // Blue - under-populated
        } else if (count === this.targetDensity) {
            triangle.color = [...this.colors.triangleOptimal]; // Green - optimal density
        } else {
            triangle.color = [...this.colors.triangleOver];    // Red - over-populated
        }

        if (this.debugMode) {
            console.log(`Triangle ${triangleIndex}: ${count}/${this.targetDensity} people - ${this.getDensityStatus(count)}`);
        }
    }

    getDensityStatus(count) {
        if (count < this.targetDensity) return 'Under-populated';
        if (count === this.targetDensity) return 'Optimal density'; 
        return 'Over-populated';
    }

    updateAllTriangleDensities() {
        // Reassign all dots to triangles (important after triangulation changes)
        this.dots.forEach(dot => {
            const newTriangleIndex = this.findTriangleContaining(dot.x, dot.y);
            if (newTriangleIndex !== -1) {
                dot.triangleIndex = newTriangleIndex;
            }
        });

        // Update density for all triangles
        for (let i = 0; i < this.triangles.length; i++) {
            this.updateTriangleDensity(i);
        }
    }

    // Add random people for testing
    addRandomDots() {
        const numDots = 15 + Math.floor(Math.random() * 20); // 15-35 people
        let added = 0;

        for (let attempts = 0; attempts < numDots * 3 && added < numDots; attempts++) {
            const x = 100 + Math.random() * (this.canvas.width - 200);
            const y = 100 + Math.random() * (this.canvas.height - 200);

            if (this.addDot(x, y)) {
                added++;
            }
        }

        console.log(`👥 Added ${added} random people`);
        this.updateStatusMessage(`Added ${added} people randomly in triangulated areas`);
        this.updateUI();
        this.render();
    }

    // WebGL and rendering setup (keeping existing implementation)
    initWebGL() {
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0.95, 0.95, 0.95, 1.0); // Light gray background
    }

    initShaders() {
        // Vertex shader for points and lines
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec4 a_color;
            attribute float a_pointSize;

            uniform vec2 u_resolution;

            varying vec4 v_color;

            void main() {
                vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
                clipSpace.y = -clipSpace.y;

                gl_Position = vec4(clipSpace, 0.0, 1.0);
                gl_PointSize = a_pointSize;
                v_color = a_color;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            varying vec4 v_color;

            void main() {
                gl_FragColor = v_color;
            }
        `;

        const triangleVertexShader = `
            attribute vec2 a_position;
            attribute vec4 a_color;

            uniform vec2 u_resolution;

            varying vec4 v_color;

            void main() {
                vec2 clipSpace = ((a_position / u_resolution) * 2.0) - 1.0;
                clipSpace.y = -clipSpace.y;

                gl_Position = vec4(clipSpace, 0.0, 1.0);
                v_color = a_color;
            }
        `;

        this.programs.main = this.createProgram(vertexShaderSource, fragmentShaderSource);
        this.programs.triangle = this.createProgram(triangleVertexShader, fragmentShaderSource);

        this.getShaderLocations();
    }

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;

        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
        }

        return program;
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    getShaderLocations() {
        const gl = this.gl;

        this.locations.main = {
            position: gl.getAttribLocation(this.programs.main, 'a_position'),
            color: gl.getAttribLocation(this.programs.main, 'a_color'),
            pointSize: gl.getAttribLocation(this.programs.main, 'a_pointSize'),
            resolution: gl.getUniformLocation(this.programs.main, 'u_resolution')
        };

        this.locations.triangle = {
            position: gl.getAttribLocation(this.programs.triangle, 'a_position'),
            color: gl.getAttribLocation(this.programs.triangle, 'a_color'),
            resolution: gl.getUniformLocation(this.programs.triangle, 'u_resolution')
        };
    }

    initBuffers() {
        const gl = this.gl;

        this.buffers = {
            position: gl.createBuffer(),
            color: gl.createBuffer(),
            pointSize: gl.createBuffer(),
            trianglePosition: gl.createBuffer(),
            triangleColor: gl.createBuffer()
        };
    }

    // Utility methods
    addVertex(x, y) {
        const vertex = {
            id: this.vertexIdCounter++,
            x: x,
            y: y,
            selected: false,
            isObstacleVertex: false
        };

        this.vertices.push(vertex);
        return vertex;
    }

    addEdge(vertex1Index, vertex2Index) {
        if (this.edgeExists(vertex1Index, vertex2Index)) {
            return null;
        }

        const edge = {
            id: this.edgeIdCounter++,
            vertex1: vertex1Index,
            vertex2: vertex2Index,
            selected: false
        };

        this.edges.push(edge);
        this.updateTriangulation();
        return edge;
    }

    edgeExists(v1, v2) {
        return this.edges.some(edge => 
            (edge.vertex1 === v1 && edge.vertex2 === v2) ||
            (edge.vertex1 === v2 && edge.vertex2 === v1)
        );
    }

    wouldIntersectExistingEdges(v1, v2) {
        const p1 = this.vertices[v1];
        const p2 = this.vertices[v2];

        // Simple intersection check (can be improved)
        for (const edge of this.edges) {
            const p3 = this.vertices[edge.vertex1];
            const p4 = this.vertices[edge.vertex2];

            if (this.linesIntersect(p1, p2, p3, p4)) {
                return true;
            }
        }
        return false;
    }

    linesIntersect(p1, p2, p3, p4) {
        // Line intersection algorithm
        const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        if (Math.abs(denom) < 1e-10) return false;

        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    edgeIntersectsObstacle(v1Index, v2Index, obstacle) {
        // Check if edge intersects with obstacle edges
        const p1 = this.vertices[v1Index];
        const p2 = this.vertices[v2Index];

        for (let i = 0; i < obstacle.vertexIndices.length; i++) {
            const obstacleV1 = obstacle.vertexIndices[i];
            const obstacleV2 = obstacle.vertexIndices[(i + 1) % obstacle.vertexIndices.length];

            const p3 = this.vertices[obstacleV1];
            const p4 = this.vertices[obstacleV2];

            if (this.linesIntersect(p1, p2, p3, p4)) {
                return true;
            }
        }
        return false;
    }

    updateTriangulation() {
        this.triangles = [];

        // Simple triangulation approach
        for (let i = 0; i < this.edges.length; i++) {
            for (let j = i + 1; j < this.edges.length; j++) {
                for (let k = j + 1; k < this.edges.length; k++) {
                    const triangle = this.findTriangleFromEdges(
                        this.edges[i], this.edges[j], this.edges[k]
                    );

                    if (triangle) {
                        this.triangles.push(triangle);
                    }
                }
            }
        }

        this.updateAllTriangleDensities();
    }

    findTriangleFromEdges(edge1, edge2, edge3) {
        const vertices = new Set([
            edge1.vertex1, edge1.vertex2,
            edge2.vertex1, edge2.vertex2,
            edge3.vertex1, edge3.vertex2
        ]);

        if (vertices.size !== 3) return null;

        const vertexArray = Array.from(vertices);

        if (this.edgesFormTriangle(edge1, edge2, edge3)) {
            return {
                id: this.triangleIdCounter++,
                vertex1: vertexArray[0],
                vertex2: vertexArray[1],
                vertex3: vertexArray[2],
                density: 0,
                color: [...this.colors.triangleUnder],
                selected: false
            };
        }

        return null;
    }

    edgesFormTriangle(edge1, edge2, edge3) {
        const connections = {};

        [edge1, edge2, edge3].forEach(edge => {
            connections[edge.vertex1] = connections[edge.vertex1] || [];
            connections[edge.vertex2] = connections[edge.vertex2] || [];
            connections[edge.vertex1].push(edge.vertex2);
            connections[edge.vertex2].push(edge.vertex1);
        });

        return Object.values(connections).every(conn => conn.length === 2);
    }

    findTriangleContaining(x, y) {
        for (let i = 0; i < this.triangles.length; i++) {
            if (this.pointInTriangle(x, y, this.triangles[i])) {
                return i;
            }
        }
        return -1;
    }

    pointInTriangle(x, y, triangle) {
        const v1 = this.vertices[triangle.vertex1];
        const v2 = this.vertices[triangle.vertex2];
        const v3 = this.vertices[triangle.vertex3];

        const denom = (v2.y - v3.y) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.y - v3.y);
        if (Math.abs(denom) < 1e-10) return false;

        const a = ((v2.y - v3.y) * (x - v3.x) + (v3.x - v2.x) * (y - v3.y)) / denom;
        const b = ((v3.y - v1.y) * (x - v3.x) + (v1.x - v3.x) * (y - v3.y)) / denom;
        const c = 1 - a - b;

        return a >= 0 && b >= 0 && c >= 0;
    }

    // Event handling
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e)); 
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.handleMouseClick(e));

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        this.setupUIEventListeners();
    }

    setupUIEventListeners() {
        // Basic mode buttons
        document.getElementById('mode-select').addEventListener('click', () => this.setMode('SELECT'));
        document.getElementById('mode-add-vertex').addEventListener('click', () => this.setMode('ADD_VERTEX'));
        document.getElementById('mode-add-edge').addEventListener('click', () => this.setMode('ADD_EDGE'));
        document.getElementById('mode-delete-edge').addEventListener('click', () => this.setMode('DELETE_EDGE'));
        document.getElementById('mode-add-dot').addEventListener('click', () => this.setMode('ADD_DOT'));
        document.getElementById('mode-move-dot').addEventListener('click', () => this.setMode('MOVE_DOT'));

        // Obstacle controls
        document.getElementById('create-obstacle').addEventListener('click', () => this.createObstacle());
        document.getElementById('mode-rotate-obstacle').addEventListener('click', () => this.setMode('ROTATE_OBSTACLE'));
        document.getElementById('mode-scale-obstacle').addEventListener('click', () => this.setMode('SCALE_OBSTACLE'));
        document.getElementById('mode-move-obstacle').addEventListener('click', () => this.setMode('MOVE_OBSTACLE'));

        // Action buttons
        document.getElementById('generate-layout').addEventListener('click', () => this.generateRandomLayout());
        document.getElementById('add-random-dots').addEventListener('click', () => this.addRandomDots());
        document.getElementById('clear-dots').addEventListener('click', () => this.clearDots());
        document.getElementById('reset-all').addEventListener('click', () => this.resetAll());
        document.getElementById('toggle-debug').addEventListener('click', () => this.toggleDebug());

        // Sliders
        document.getElementById('density-slider').addEventListener('input', (e) => {
            this.targetDensity = parseInt(e.target.value);
            document.getElementById('density-value').textContent = this.targetDensity;
            this.updateAllTriangleDensities();
            this.render();
        });

        document.getElementById('rotation-slider').addEventListener('input', (e) => {
            this.rotationAngle = parseInt(e.target.value);
            document.getElementById('rotation-value').textContent = this.rotationAngle + '°';
        });

        document.getElementById('scale-slider').addEventListener('input', (e) => {
            this.scaleFactor = parseInt(e.target.value) / 100;
            document.getElementById('scale-value').textContent = this.scaleFactor.toFixed(1) + 'x';
        });
    }

    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    handleMouseClick(event) {
        const coords = this.getCanvasCoordinates(event);

        if (this.debugMode) {
            console.log('Mouse click:', coords);
        }

        switch (this.currentMode) {
            case 'SELECT':
                this.handleSelectClick(coords.x, coords.y);
                break;
            case 'ADD_VERTEX':
                this.addVertex(coords.x, coords.y);
                break;
            case 'ADD_EDGE':
                this.handleAddEdgeClick(coords.x, coords.y);
                break;
            case 'DELETE_EDGE':
                this.handleDeleteEdgeClick(coords.x, coords.y);
                break;
            case 'ADD_DOT':
                this.addDot(coords.x, coords.y);
                break;
            case 'ROTATE_OBSTACLE':
                this.rotateSelectedObstacle();
                break;
            case 'SCALE_OBSTACLE':
                this.scaleSelectedObstacle();
                break;
        }

        this.updateUI();
        this.render();
    }

    handleMouseMove(event) {
        const coords = this.getCanvasCoordinates(event);

        if (this.debugMode) {
            document.getElementById('mouse-coords').textContent = 
                `Canvas: (${coords.x.toFixed(0)}, ${coords.y.toFixed(0)})`;
        }

        if (this.isDragging && this.draggedObject) {
            if (this.draggedObject.type === 'dot') {
                this.moveDot(this.draggedObject.object, coords.x, coords.y);
            } else if (this.draggedObject.type === 'obstacle') {
                const deltaX = coords.x - this.lastMousePos.x;
                const deltaY = coords.y - this.lastMousePos.y;
                this.moveSelectedObstacle(deltaX, deltaY);
                this.lastMousePos = coords;
            }

            this.render();
        }
    }

    handleMouseDown(event) {
        const coords = this.getCanvasCoordinates(event);
        this.lastMousePos = coords;

        if (this.currentMode === 'MOVE_DOT') {
            const dotIndex = this.findClosestDot(coords.x, coords.y);
            if (dotIndex !== -1) {
                this.isDragging = true;
                this.draggedObject = {type: 'dot', object: this.dots[dotIndex]};
                this.canvas.style.cursor = 'grabbing';
            }
        } else if (this.currentMode === 'MOVE_OBSTACLE') {
            const obstacleIndex = this.findObstacleContaining(coords.x, coords.y);
            if (obstacleIndex !== -1) {
                this.selectedObstacle = this.obstacles[obstacleIndex];
                this.isDragging = true;
                this.draggedObject = {type: 'obstacle', object: this.obstacles[obstacleIndex]};
                this.canvas.style.cursor = 'grabbing';
            }
        }
    }

    handleMouseUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            this.draggedObject = null;
            this.canvas.style.cursor = 'crosshair';
        }
    }

    handleSelectClick(x, y) {
        this.clearSelections();

        // Try to select obstacle first
        const obstacleIndex = this.findObstacleContaining(x, y);
        if (obstacleIndex !== -1) {
            this.selectedObstacle = this.obstacles[obstacleIndex];
            this.selectedObstacle.selected = true;
            this.updateStatusMessage(`Obstacle ${obstacleIndex} selected - Use transformation modes`);
            return;
        }

        // Then try vertex
        const vertexIndex = this.findClosestVertex(x, y);
        if (vertexIndex !== -1) {
            this.vertices[vertexIndex].selected = true;
            this.selectedVertex = vertexIndex;
            return;
        }

        // Then try edge
        const edgeIndex = this.findClosestEdge(x, y);
        if (edgeIndex !== -1) {
            this.edges[edgeIndex].selected = true;
            this.selectedEdge = edgeIndex;
            return;
        }

        // Finally try triangle
        const triangleIndex = this.findTriangleContaining(x, y);
        if (triangleIndex !== -1) {
            this.triangles[triangleIndex].selected = true;
            this.selectedTriangle = triangleIndex;
            return;
        }
    }

    handleAddEdgeClick(x, y) {
        const vertexIndex = this.findClosestVertex(x, y);

        if (vertexIndex === -1) return;

        if (this.firstSelectedVertex === null) {
            this.firstSelectedVertex = vertexIndex;
            this.vertices[vertexIndex].selected = true;
        } else {
            if (this.firstSelectedVertex !== vertexIndex) {
                this.addEdge(this.firstSelectedVertex, vertexIndex);
            }

            this.vertices[this.firstSelectedVertex].selected = false;
            this.firstSelectedVertex = null;
        }
    }

    handleDeleteEdgeClick(x, y) {
        const edgeIndex = this.findClosestEdge(x, y);
        if (edgeIndex !== -1) {
            this.edges.splice(edgeIndex, 1);
            this.updateTriangulation();
        }
    }

    handleKeyDown(event) {
        switch (event.key.toLowerCase()) {
            case 's':
                this.setMode('SELECT');
                break;
            case 'a':
                this.setMode('ADD_VERTEX');
                break;
            case 'e':
                this.setMode('ADD_EDGE');
                break;
            case 'd':
                this.setMode('DELETE_EDGE');
                break;
            case 'r':
                if (this.selectedObstacle) this.rotateSelectedObstacle();
                break;
            case 't':
                if (this.selectedObstacle) this.scaleSelectedObstacle();
                break;
            case ' ':
                event.preventDefault();
                this.addRandomDots();
                break;
            case 'escape':
                this.clearSelections();
                this.render();
                break;
        }
    }

    // Utility methods for finding objects
    findClosestVertex(x, y) {
        let closestIndex = -1;
        let minDistance = Infinity;
        const clickRadius = 20;

        for (let i = 0; i < this.vertices.length; i++) {
            const vertex = this.vertices[i];
            const dx = vertex.x - x;
            const dy = vertex.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < clickRadius && distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    findClosestEdge(x, y) {
        let closestIndex = -1;
        let minDistance = Infinity;
        const clickRadius = 15;

        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            const v1 = this.vertices[edge.vertex1];
            const v2 = this.vertices[edge.vertex2];

            const distance = this.pointToLineDistance(x, y, v1.x, v1.y, v2.x, v2.y);

            if (distance < clickRadius && distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    findClosestDot(x, y) {
        let closestIndex = -1;
        let minDistance = Infinity;
        const clickRadius = 12;

        for (let i = 0; i < this.dots.length; i++) {
            const dot = this.dots[i];
            const dx = dot.x - x;
            const dy = dot.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < clickRadius && distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    findObstacleContaining(x, y) {
        for (let i = 0; i < this.obstacles.length; i++) {
            const obstacle = this.obstacles[i];

            // Simple point-in-rectangle test (can be improved for rotated rectangles)
            const minX = Math.min(...obstacle.vertexIndices.map(vi => this.vertices[vi].x));
            const maxX = Math.max(...obstacle.vertexIndices.map(vi => this.vertices[vi].x));
            const minY = Math.min(...obstacle.vertexIndices.map(vi => this.vertices[vi].y));
            const maxY = Math.max(...obstacle.vertexIndices.map(vi => this.vertices[vi].y));

            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                return i;
            }
        }
        return -1;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // UI and utility methods
    setMode(mode) {
        this.currentMode = mode;
        this.clearSelections();

        // Update UI buttons
        document.querySelectorAll('.btn-primary').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.btn-obstacle').forEach(btn => btn.classList.remove('active'));

        const modeMap = {
            'SELECT': 'mode-select',
            'ADD_VERTEX': 'mode-add-vertex',
            'ADD_EDGE': 'mode-add-edge',
            'DELETE_EDGE': 'mode-delete-edge',
            'ADD_DOT': 'mode-add-dot',
            'MOVE_DOT': 'mode-move-dot',
            'ROTATE_OBSTACLE': 'mode-rotate-obstacle',
            'SCALE_OBSTACLE': 'mode-scale-obstacle',
            'MOVE_OBSTACLE': 'mode-move-obstacle'
        };

        const buttonId = modeMap[mode];
        if (buttonId) {
            document.getElementById(buttonId).classList.add('active');
        }

        document.getElementById('mode-indicator').textContent = mode.replace('_', ' ');

        const modeMessages = {
            'SELECT': 'Click to select vertices, edges, triangles, or obstacles',
            'ADD_VERTEX': 'Click to add new vertices to the mesh',
            'ADD_EDGE': 'Click two vertices to connect them with an edge',
            'DELETE_EDGE': 'Click on edges to delete them',
            'ADD_DOT': 'Click inside triangles to add people',
            'MOVE_DOT': 'Drag people between triangles',
            'ROTATE_OBSTACLE': 'Select obstacle and click to rotate it',
            'SCALE_OBSTACLE': 'Select obstacle and click to scale it',
            'MOVE_OBSTACLE': 'Drag obstacles to move them'
        };

        this.updateStatusMessage(modeMessages[mode] || 'Mode selected');

        this.render();
    }

    clearSelections() {
        this.vertices.forEach(v => v.selected = false);
        this.edges.forEach(e => e.selected = false);
        this.triangles.forEach(t => t.selected = false);
        this.dots.forEach(d => d.selected = false);
        this.obstacles.forEach(o => o.selected = false);

        this.selectedVertex = null;
        this.selectedEdge = null;
        this.selectedTriangle = null;
        this.selectedDot = null;
        this.selectedObstacle = null;
        this.firstSelectedVertex = null;
    }

    clearDots() {
        this.dots = [];
        this.updateAllTriangleDensities();
        this.updateStatusMessage('All people cleared from the simulation');
        this.updateUI();
        this.render();
    }

    clearAll() {
        this.vertices = [];
        this.edges = [];
        this.triangles = [];
        this.dots = [];
        this.obstacles = [];

        this.vertexIdCounter = 0;
        this.edgeIdCounter = 0;
        this.triangleIdCounter = 0;
        this.dotIdCounter = 0;
        this.obstacleIdCounter = 0;

        this.clearSelections();
    }

    resetAll() {
        this.clearAll();
        this.generateRandomLayout();
        this.updateStatusMessage('Simulation reset - New random layout generated');
        this.updateUI();
        this.render();
    }

    toggleDebug() {
        this.debugMode = !this.debugMode;
        const debugInfo = document.getElementById('debug-info');
        debugInfo.style.display = this.debugMode ? 'block' : 'none';
        this.updateStatusMessage(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
    }

    updateUI() {
        document.getElementById('vertex-count').textContent = this.vertices.length;
        document.getElementById('edge-count').textContent = this.edges.length;
        document.getElementById('triangle-count').textContent = this.triangles.length;
        document.getElementById('dot-count').textContent = this.dots.length;
        document.getElementById('obstacle-count').textContent = this.obstacles.length;

        if (this.debugMode) {
            if (this.selectedObstacle) {
                document.getElementById('obstacle-info').textContent = 
                    `Obstacle ${this.obstacles.indexOf(this.selectedObstacle)} selected`;
            } else {
                document.getElementById('obstacle-info').textContent = 'No obstacle selected';
            }
        }
    }

    updateStatusMessage(message) {
        document.getElementById('status-message').textContent = message;
    }

    // Rendering methods
    render() {
        const gl = this.gl;

        gl.clear(gl.COLOR_BUFFER_BIT);

        // Render in order: triangles (back), edges (middle), points (front)
        this.renderTriangles();
        this.renderEdges();
        this.renderVertices();
        this.renderDots(); // People rendered as black dots on top
    }

    renderTriangles() {
        if (this.triangles.length === 0) return;

        const gl = this.gl;
        gl.useProgram(this.programs.triangle);

        const positions = [];
        const colors = [];

        this.triangles.forEach(triangle => {
            const v1 = this.vertices[triangle.vertex1];
            const v2 = this.vertices[triangle.vertex2]; 
            const v3 = this.vertices[triangle.vertex3];

            positions.push(v1.x, v1.y, v2.x, v2.y, v3.x, v3.y);

            // Use lighter shades as specified in assignment
            const color = triangle.selected ? 
                [triangle.color[0], triangle.color[1], triangle.color[2], 0.8] : 
                triangle.color;

            for (let i = 0; i < 3; i++) {
                colors.push(...color);
            }
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.trianglePosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.triangle.position);
        gl.vertexAttribPointer(this.locations.triangle.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.triangleColor);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.triangle.color);
        gl.vertexAttribPointer(this.locations.triangle.color, 4, gl.FLOAT, false, 0, 0);

        gl.uniform2f(this.locations.triangle.resolution, this.canvas.width, this.canvas.height);

        gl.drawArrays(gl.TRIANGLES, 0, this.triangles.length * 3);
    }

    renderEdges() {
        if (this.edges.length === 0) return;

        const gl = this.gl;
        gl.useProgram(this.programs.main);

        const positions = [];
        const colors = [];

        this.edges.forEach(edge => {
            const v1 = this.vertices[edge.vertex1];
            const v2 = this.vertices[edge.vertex2];

            positions.push(v1.x, v1.y, v2.x, v2.y);

            const color = edge.selected ? this.colors.selectedEdge : this.colors.edge;
            colors.push(...color, ...color);
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.main.position);
        gl.vertexAttribPointer(this.locations.main.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.main.color);
        gl.vertexAttribPointer(this.locations.main.color, 4, gl.FLOAT, false, 0, 0);

        gl.uniform2f(this.locations.main.resolution, this.canvas.width, this.canvas.height);

        gl.drawArrays(gl.LINES, 0, this.edges.length * 2);
    }

    renderVertices() {
        if (this.vertices.length === 0) return;

        const gl = this.gl;
        gl.useProgram(this.programs.main);

        const positions = [];
        const colors = [];
        const pointSizes = [];

        this.vertices.forEach(vertex => {
            positions.push(vertex.x, vertex.y);

            const color = vertex.selected ? this.colors.selectedVertex : this.colors.vertex;
            colors.push(...color);

            pointSizes.push(vertex.selected ? 15.0 : 10.0);
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.main.position);
        gl.vertexAttribPointer(this.locations.main.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.main.color);
        gl.vertexAttribPointer(this.locations.main.color, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.pointSize);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointSizes), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.main.pointSize);
        gl.vertexAttribPointer(this.locations.main.pointSize, 1, gl.FLOAT, false, 0, 0);

        gl.uniform2f(this.locations.main.resolution, this.canvas.width, this.canvas.height);

        gl.drawArrays(gl.POINTS, 0, this.vertices.length);
    }

    renderDots() {
        if (this.dots.length === 0) return;

        const gl = this.gl;
        gl.useProgram(this.programs.main);

        const positions = [];
        const colors = [];
        const pointSizes = [];

        this.dots.forEach(dot => {
            positions.push(dot.x, dot.y);

            // Assignment Requirement: Render people as black dots
            const color = dot.selected ? this.colors.selectedDot : this.colors.dot;
            colors.push(...color);

            pointSizes.push(8.0);
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.main.position);
        gl.vertexAttribPointer(this.locations.main.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.main.color);
        gl.vertexAttribPointer(this.locations.main.color, 4, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.pointSize);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointSizes), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.main.pointSize);
        gl.vertexAttribPointer(this.locations.main.pointSize, 1, gl.FLOAT, false, 0, 0);

        gl.uniform2f(this.locations.main.resolution, this.canvas.width, this.canvas.height);

        gl.drawArrays(gl.POINTS, 0, this.dots.length);
    }
}

// Initialize the enhanced application
let enhancedCrowdSimulation;

window.addEventListener('load', () => {
    console.log('🚀 Starting Enhanced WebGL Crowd Simulation Renderer...');
    enhancedCrowdSimulation = new EnhancedCrowdSimulationRenderer();
});

// Export for debugging
window.enhancedCrowdSimulation = enhancedCrowdSimulation;