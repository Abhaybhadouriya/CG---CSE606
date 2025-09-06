// WebGL Interactive Triangle Mesh Editor for Crowd Simulation
class TriangleMeshEditor {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        this.gl = null;
        this.programs = {};
         
        // Application state
        this.currentMode = 'SELECT';
        this.targetDensity = 4;
        this.selectedVertex = null;
        this.selectedEdge = null;
        this.hoveredVertex = null;
        this.firstSelectedVertex = null;
        this.isDragging = false;
        this.draggedDot = null;
        
        // Data structures
        this.vertices = [];
        this.edges = [];
        this.triangles = [];
        this.dots = [];
        this.vertexIdCounter = 0;
        
        // Colors (RGB format for WebGL)
        this.colors = {
            underPopulated: [0.3, 0.3, 1.0, 0.3],
            optimal: [0.3, 1.0, 0.3, 0.3],
            overPopulated: [1.0, 0.3, 0.3, 0.3],
            vertex: [0.0, 0.0, 0.0],
            edge: [0.2, 0.2, 0.2],
            selected: [1.0, 0.8, 0.0],
            dot: [0.4, 0.2, 0.6],
            boundary: [0.1, 0.1, 0.1]
        };
        
        // Initialize the application
        this.init();
    }
    
    init() {
        // Initialize WebGL
        this.initWebGL();
        this.initShaders();
        this.initBuffers();
        
        // Load initial data
        this.loadInitialData();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start render loop
        this.render();
        
        this.updateUI();
    }
    
    initWebGL() {
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            alert('WebGL is not supported by your browser');
            return;
        }
        
        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Enable blending for transparency
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        
        // Set clear color
        this.gl.clearColor(0.98, 0.98, 0.96, 1.0);
    }
    
    initShaders() {
        // Vertex shader source
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec4 a_color;
            uniform vec2 u_resolution;
            varying vec4 v_color;
            
            void main() {
                vec2 zeroToOne = a_position / u_resolution;
                vec2 zeroToTwo = zeroToOne * 2.0;
                vec2 clipSpace = zeroToTwo - 1.0;
                
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                v_color = a_color;
            }
        `;
        
        // Fragment shader source
        const fragmentShaderSource = `
            precision mediump float;
            varying vec4 v_color;
            
            void main() {
                gl_FragColor = v_color;
            }
        `;
        
        // Create and compile shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        // Create program
        this.programs.main = this.createProgram(vertexShader, fragmentShader);
        
        // Get attribute and uniform locations
        this.programs.main.attribLocations = {
            position: this.gl.getAttribLocation(this.programs.main, 'a_position'),
            color: this.gl.getAttribLocation(this.programs.main, 'a_color')
        };
        
        this.programs.main.uniformLocations = {
            resolution: this.gl.getUniformLocation(this.programs.main, 'u_resolution')
        };
    }
    
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Error compiling shader:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Error linking program:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }
    
    initBuffers() {
        this.positionBuffer = this.gl.createBuffer();
        this.colorBuffer = this.gl.createBuffer();
    }
    
    loadInitialData() {
        // Initial vertices (boundary rectangle + interior points)
        const initialVertices = [
            {x: -300, y: -200, id: 0},
            {x: 300, y: -200, id: 1},
            {x: 300, y: 200, id: 2},
            {x: -300, y: 200, id: 3},
            {x: 0, y: 0, id: 4},
            {x: -150, y: -100, id: 5},
            {x: 150, y: 100, id: 6}
        ];
        
        this.vertices = initialVertices.map(v => ({...v}));
        this.vertexIdCounter = Math.max(...this.vertices.map(v => v.id)) + 1;
        
        // Initial edges
        const initialEdges = [
            {vertex1: 0, vertex2: 1},
            {vertex1: 1, vertex2: 2},
            {vertex1: 2, vertex2: 3},
            {vertex1: 3, vertex2: 0},
            {vertex1: 4, vertex2: 5},
            {vertex1: 5, vertex2: 6}
        ];
        
        this.edges = initialEdges.map(e => ({...e}));
        
        // Reset other state
        this.selectedVertex = null;
        this.selectedEdge = null;
        this.firstSelectedVertex = null;
        this.triangles = [];
        this.dots = [];
        
        this.updateTriangles();
    }
    
    setupEventListeners() {
        // Mode buttons
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.id.replace('-mode', '').replace('-', '_').toUpperCase();
                this.setMode(mode);
            });
        });
        
        // Density slider
        const densitySlider = document.getElementById('density-slider');
        densitySlider.addEventListener('input', (e) => {
            this.targetDensity = parseInt(e.target.value);
            document.getElementById('density-value').textContent = this.targetDensity;
            this.updateTriangleColors();
            this.updateUI();
        });
        
        // Action buttons
        document.getElementById('clear-dots').addEventListener('click', () => {
            this.dots = [];
            this.updateTriangleColors();
            this.updateUI();
            document.getElementById('status-message').textContent = 'All dots cleared.';
        });
        
        document.getElementById('reset-mesh').addEventListener('click', () => {
            this.loadInitialData();
            this.updateUI();
            document.getElementById('status-message').textContent = 'Mesh reset to initial state.';
        });
        
        // Canvas events
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
    }
    
    setMode(mode) {
        this.currentMode = mode;
        this.selectedVertex = null;
        this.firstSelectedVertex = null;
        this.selectedEdge = null;
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.add('btn--secondary');
            btn.classList.remove('btn--primary');
        });
        
        const activeBtn = document.getElementById(mode.toLowerCase().replace('_', '-') + '-mode');
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.classList.add('btn--primary');
            activeBtn.classList.remove('btn--secondary');
        }
        
        // Update status message
        const statusMessages = {
            'SELECT': 'Select mode active - Click to select vertices or edges',
            'ADD_EDGE': 'Add Edge mode - Click two vertices to connect them',
            'DELETE_EDGE': 'Delete Edge mode - Click an edge to remove it',
            'ADD_DOT': 'Add Dot mode - Click inside triangles to add dots'
        };
        
        document.getElementById('status-message').textContent = statusMessages[mode] || 'Ready';
    }
    
    getMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Convert to WebGL coordinates (center origin)
        const canvasX = x - this.canvas.width / 2;
        const canvasY = -(y - this.canvas.height / 2);
        
        return {x: canvasX, y: canvasY};
    }
    
    handleCanvasClick(e) {
        const pos = this.getMousePosition(e);
        
        switch (this.currentMode) {
            case 'SELECT':
                this.handleSelect(pos);
                break;
            case 'ADD_EDGE':
                this.handleAddEdge(pos);
                break;
            case 'DELETE_EDGE':
                this.handleDeleteEdge(pos);
                break;
            case 'ADD_DOT':
                this.handleAddDot(pos);
                break;
        }
    }
    
    handleCanvasMouseMove(e) {
        const pos = this.getMousePosition(e);
        
        if (this.isDragging && this.draggedDot) {
            this.moveDot(this.draggedDot, pos);
            return;
        }
        
        // Update hover state for vertices
        this.hoveredVertex = this.findVertexAt(pos);
        this.canvas.style.cursor = this.hoveredVertex ? 'pointer' : 'crosshair';
    }
    
    handleCanvasMouseDown(e) {
        if (this.currentMode === 'ADD_DOT') {
            const pos = this.getMousePosition(e);
            const dot = this.findDotAt(pos);
            if (dot) {
                this.isDragging = true;
                this.draggedDot = dot;
                this.canvas.style.cursor = 'grabbing';
            }
        }
    }
    
    handleCanvasMouseUp(e) {
        this.isDragging = false;
        this.draggedDot = null;
        this.canvas.style.cursor = 'crosshair';
    }
    
    handleSelect(pos) {
        const vertex = this.findVertexAt(pos);
        const edge = this.findEdgeAt(pos);
        
        if (vertex) {
            this.selectedVertex = vertex;
            this.selectedEdge = null;
            document.getElementById('status-message').textContent = `Vertex ${vertex.id} selected.`;
        } else if (edge) {
            this.selectedEdge = edge;
            this.selectedVertex = null;
            document.getElementById('status-message').textContent = `Edge selected.`;
        } else {
            this.selectedVertex = null;
            this.selectedEdge = null;
            document.getElementById('status-message').textContent = 'Selection cleared.';
        }
    }
    
    handleAddEdge(pos) {
        const vertex = this.findVertexAt(pos);
        
        if (vertex) {
            if (!this.firstSelectedVertex) {
                this.firstSelectedVertex = vertex;
                document.getElementById('status-message').textContent = `Vertex ${vertex.id} selected. Click another vertex to connect.`;
            } else if (this.firstSelectedVertex.id !== vertex.id) {
                // Check if edge already exists
                const edgeExists = this.edges.some(edge => 
                    (edge.vertex1 === this.firstSelectedVertex.id && edge.vertex2 === vertex.id) ||
                    (edge.vertex1 === vertex.id && edge.vertex2 === this.firstSelectedVertex.id)
                );
                
                if (!edgeExists) {
                    this.edges.push({
                        vertex1: this.firstSelectedVertex.id,
                        vertex2: vertex.id
                    });
                    this.updateTriangles();
                    this.updateUI();
                    document.getElementById('status-message').textContent = `Edge added between vertex ${this.firstSelectedVertex.id} and ${vertex.id}. Triangles: ${this.triangles.length}`;
                } else {
                    document.getElementById('status-message').textContent = 'Edge already exists between these vertices.';
                }
                
                this.firstSelectedVertex = null;
            } else {
                this.firstSelectedVertex = null;
                document.getElementById('status-message').textContent = 'Cannot connect vertex to itself. Try again.';
            }
        } else {
            if (this.firstSelectedVertex) {
                document.getElementById('status-message').textContent = 'Click on a vertex to complete the edge.';
            } else {
                document.getElementById('status-message').textContent = 'Click on a vertex to start adding an edge.';
            }
        }
    }
    
    handleDeleteEdge(pos) {
        const edge = this.findEdgeAt(pos);
        
        if (edge) {
            const edgeIndex = this.edges.findIndex(e => 
                (e.vertex1 === edge.vertex1 && e.vertex2 === edge.vertex2) ||
                (e.vertex1 === edge.vertex2 && e.vertex2 === edge.vertex1)
            );
            
            if (edgeIndex >= 0) {
                this.edges.splice(edgeIndex, 1);
                
                // Remove any dots that were in triangles that no longer exist
                const oldTriangleIds = this.triangles.map(t => t.id);
                this.updateTriangles();
                
                // Filter out dots in deleted triangles
                this.dots = this.dots.filter(dot => {
                    const triangle = this.triangles.find(t => t.id === dot.triangleId);
                    if (!triangle) {
                        // Try to reassign dot to a new triangle
                        const newTriangle = this.findTriangleAt(dot);
                        if (newTriangle) {
                            dot.triangleId = newTriangle.id;
                            return true;
                        }
                        return false;
                    }
                    return true;
                });
                
                this.updateTriangleColors();
                this.updateUI();
                document.getElementById('status-message').textContent = `Edge deleted. Triangles: ${this.triangles.length}`;
            }
        } else {
            document.getElementById('status-message').textContent = 'Click on an edge to delete it.';
        }
    }
    
    handleAddDot(pos) {
        const triangle = this.findTriangleAt(pos);
        
        if (triangle) {
            this.dots.push({
                x: pos.x,
                y: pos.y,
                triangleId: triangle.id
            });
            this.updateTriangleColors();
            this.updateUI();
            const dotsInTriangle = this.dots.filter(d => d.triangleId === triangle.id).length;
            document.getElementById('status-message').textContent = `Dot added to triangle. Triangle has ${dotsInTriangle} dots.`;
        } else {
            document.getElementById('status-message').textContent = 'Click inside a triangle to add a dot.';
        }
    }
    
    findVertexAt(pos) {
        const threshold = 15;
        return this.vertices.find(vertex => {
            const dx = vertex.x - pos.x;
            const dy = vertex.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) < threshold;
        });
    }
    
    findEdgeAt(pos) {
        const threshold = 10;
        
        for (const edge of this.edges) {
            const v1 = this.vertices.find(v => v.id === edge.vertex1);
            const v2 = this.vertices.find(v => v.id === edge.vertex2);
            
            if (!v1 || !v2) continue;
            
            const distance = this.pointToLineDistance(pos, v1, v2);
            const isOnSegment = this.isPointOnLineSegment(pos, v1, v2, threshold);
            
            if (distance < threshold && isOnSegment) {
                return edge;
            }
        }
        
        return null;
    }
    
    isPointOnLineSegment(point, lineStart, lineEnd, threshold) {
        const segmentLength = Math.sqrt(
            Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2)
        );
        
        const distToStart = Math.sqrt(
            Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
        );
        
        const distToEnd = Math.sqrt(
            Math.pow(point.x - lineEnd.x, 2) + Math.pow(point.y - lineEnd.y, 2)
        );
        
        return Math.abs(distToStart + distToEnd - segmentLength) < threshold;
    }
    
    findTriangleAt(pos) {
        for (const triangle of this.triangles) {
            if (this.isPointInTriangle(pos, triangle)) {
                return triangle;
            }
        }
        return null;
    }
    
    findDotAt(pos) {
        const threshold = 10;
        return this.dots.find(dot => {
            const dx = dot.x - pos.x;
            const dy = dot.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) < threshold;
        });
    }
    
    moveDot(dot, newPos) {
        const newTriangle = this.findTriangleAt(newPos);
        if (newTriangle) {
            dot.x = newPos.x;
            dot.y = newPos.y;
            dot.triangleId = newTriangle.id;
            this.updateTriangleColors();
            this.updateUI();
        }
    }
    
    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        const param = Math.max(0, Math.min(1, dot / lenSq));
        const xx = lineStart.x + param * C;
        const yy = lineStart.y + param * D;
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    isPointInTriangle(point, triangle) {
        const v1 = this.vertices.find(v => v.id === triangle.vertices[0]);
        const v2 = this.vertices.find(v => v.id === triangle.vertices[1]);
        const v3 = this.vertices.find(v => v.id === triangle.vertices[2]);
        
        if (!v1 || !v2 || !v3) return false;
        
        const denom = (v2.y - v3.y) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.y - v3.y);
        if (Math.abs(denom) < 1e-10) return false;
        
        const a = ((v2.y - v3.y) * (point.x - v3.x) + (v3.x - v2.x) * (point.y - v3.y)) / denom;
        const b = ((v3.y - v1.y) * (point.x - v3.x) + (v1.x - v3.x) * (point.y - v3.y)) / denom;
        const c = 1 - a - b;
        
        return a >= 0 && b >= 0 && c >= 0;
    }
    
    updateTriangles() {
        const oldTriangles = [...this.triangles];
        this.triangles = [];
        let triangleId = 0;
        
        // Find all triangles using edge connectivity
        for (let i = 0; i < this.vertices.length; i++) {
            for (let j = i + 1; j < this.vertices.length; j++) {
                for (let k = j + 1; k < this.vertices.length; k++) {
                    const v1 = this.vertices[i].id;
                    const v2 = this.vertices[j].id;
                    const v3 = this.vertices[k].id;
                    
                    // Check if all three edges exist
                    const edge1 = this.edges.some(e => (e.vertex1 === v1 && e.vertex2 === v2) || (e.vertex1 === v2 && e.vertex2 === v1));
                    const edge2 = this.edges.some(e => (e.vertex1 === v2 && e.vertex2 === v3) || (e.vertex1 === v3 && e.vertex2 === v2));
                    const edge3 = this.edges.some(e => (e.vertex1 === v3 && e.vertex2 === v1) || (e.vertex1 === v1 && e.vertex2 === v3));
                    
                    if (edge1 && edge2 && edge3) {
                        this.triangles.push({
                            id: triangleId++,
                            vertices: [v1, v2, v3]
                        });
                    }
                }
            }
        }
        
        console.log(`Found ${this.triangles.length} triangles`);
        this.updateTriangleColors();
    }
    
    updateTriangleColors() {
        this.triangles.forEach(triangle => {
            const dotsInTriangle = this.dots.filter(dot => dot.triangleId === triangle.id).length;
            
            if (dotsInTriangle < this.targetDensity) {
                triangle.color = [...this.colors.underPopulated];
            } else if (dotsInTriangle === this.targetDensity) {
                triangle.color = [...this.colors.optimal];
            } else {
                triangle.color = [...this.colors.overPopulated];
            }
        });
    }
    
    render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        this.gl.useProgram(this.programs.main);
        this.gl.uniform2f(this.programs.main.uniformLocations.resolution, this.canvas.width, this.canvas.height);
        
        // Render triangles first (background)
        this.renderTriangles();
        
        // Render boundary rectangle
        this.renderBoundary();
        
        // Render edges
        this.renderEdges();
        
        // Render vertices
        this.renderVertices();
        
        // Render dots
        this.renderDots();
        
        requestAnimationFrame(() => this.render());
    }
    
    renderTriangles() {
        if (this.triangles.length === 0) return;
        
        const positions = [];
        const colors = [];
        
        this.triangles.forEach(triangle => {
            const v1 = this.vertices.find(v => v.id === triangle.vertices[0]);
            const v2 = this.vertices.find(v => v.id === triangle.vertices[1]);
            const v3 = this.vertices.find(v => v.id === triangle.vertices[2]);
            
            if (!v1 || !v2 || !v3) return;
            
            // Convert to screen coordinates
            const x1 = v1.x + this.canvas.width / 2;
            const y1 = v1.y + this.canvas.height / 2;
            const x2 = v2.x + this.canvas.width / 2;
            const y2 = v2.y + this.canvas.height / 2;
            const x3 = v3.x + this.canvas.width / 2;
            const y3 = v3.y + this.canvas.height / 2;
            
            positions.push(x1, y1, x2, y2, x3, y3);
            
            const color = triangle.color || this.colors.underPopulated;
            colors.push(...color, ...color, ...color);
        });
        
        if (positions.length === 0) return;
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.programs.main.attribLocations.position);
        this.gl.vertexAttribPointer(this.programs.main.attribLocations.position, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.programs.main.attribLocations.color);
        this.gl.vertexAttribPointer(this.programs.main.attribLocations.color, 4, this.gl.FLOAT, false, 0, 0);
        
        this.gl.drawArrays(this.gl.TRIANGLES, 0, positions.length / 2);
    }
    
    renderBoundary() {
        // Render rectangle boundary
        const boundaryVertices = [0, 1, 2, 3]; // Rectangle vertices
        const positions = [];
        const colors = [];
        
        for (let i = 0; i < boundaryVertices.length; i++) {
            const v1Id = boundaryVertices[i];
            const v2Id = boundaryVertices[(i + 1) % boundaryVertices.length];
            
            const v1 = this.vertices.find(v => v.id === v1Id);
            const v2 = this.vertices.find(v => v.id === v2Id);
            
            if (v1 && v2) {
                positions.push(
                    v1.x + this.canvas.width / 2, v1.y + this.canvas.height / 2,
                    v2.x + this.canvas.width / 2, v2.y + this.canvas.height / 2
                );
                
                colors.push(
                    ...this.colors.boundary, 1.0,
                    ...this.colors.boundary, 1.0
                );
            }
        }
        
        if (positions.length > 0) {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.DYNAMIC_DRAW);
            this.gl.enableVertexAttribArray(this.programs.main.attribLocations.position);
            this.gl.vertexAttribPointer(this.programs.main.attribLocations.position, 2, this.gl.FLOAT, false, 0, 0);
            
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.DYNAMIC_DRAW);
            this.gl.enableVertexAttribArray(this.programs.main.attribLocations.color);
            this.gl.vertexAttribPointer(this.programs.main.attribLocations.color, 4, this.gl.FLOAT, false, 0, 0);
            
            this.gl.drawArrays(this.gl.LINES, 0, positions.length / 2);
        }
    }
    
    renderEdges() {
        if (this.edges.length === 0) return;
        
        const positions = [];
        const colors = [];
        
        this.edges.forEach(edge => {
            const v1 = this.vertices.find(v => v.id === edge.vertex1);
            const v2 = this.vertices.find(v => v.id === edge.vertex2);
            
            if (!v1 || !v2) return;
            
            positions.push(
                v1.x + this.canvas.width / 2, v1.y + this.canvas.height / 2,
                v2.x + this.canvas.width / 2, v2.y + this.canvas.height / 2
            );
            
            const color = (this.selectedEdge === edge) ? this.colors.selected : this.colors.edge;
            colors.push(
                ...color, 1.0,
                ...color, 1.0
            );
        });
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.programs.main.attribLocations.position);
        this.gl.vertexAttribPointer(this.programs.main.attribLocations.position, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.programs.main.attribLocations.color);
        this.gl.vertexAttribPointer(this.programs.main.attribLocations.color, 4, this.gl.FLOAT, false, 0, 0);
        
        this.gl.drawArrays(this.gl.LINES, 0, positions.length / 2);
    }
    
    renderVertices() {
        if (this.vertices.length === 0) return;
        
        this.vertices.forEach(vertex => {
            const isSelected = this.selectedVertex === vertex || this.firstSelectedVertex === vertex;
            this.renderCircle(vertex.x, vertex.y, 6, 
                isSelected ? [...this.colors.selected, 1.0] : [...this.colors.vertex, 1.0]
            );
        });
    }
    
    renderDots() {
        this.dots.forEach(dot => {
            this.renderCircle(dot.x, dot.y, 4, [...this.colors.dot, 1.0]);
        });
    }
    
    renderCircle(x, y, radius, color) {
        const segments = 12;
        const positions = [];
        const colors = [];
        
        const centerX = x + this.canvas.width / 2;
        const centerY = y + this.canvas.height / 2;
        
        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;
            
            // Triangle fan: center, point1, point2
            positions.push(
                centerX, centerY,
                centerX + Math.cos(angle1) * radius, centerY + Math.sin(angle1) * radius,
                centerX + Math.cos(angle2) * radius, centerY + Math.sin(angle2) * radius
            );
            
            colors.push(...color, ...color, ...color);
        }
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.programs.main.attribLocations.position);
        this.gl.vertexAttribPointer(this.programs.main.attribLocations.position, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.programs.main.attribLocations.color);
        this.gl.vertexAttribPointer(this.programs.main.attribLocations.color, 4, this.gl.FLOAT, false, 0, 0);
        
        this.gl.drawArrays(this.gl.TRIANGLES, 0, positions.length / 2);
    }
    
    updateUI() {
        document.getElementById('vertex-count').textContent = this.vertices.length;
        document.getElementById('edge-count').textContent = this.edges.length;
        document.getElementById('triangle-count').textContent = this.triangles.length;
        document.getElementById('dot-count').textContent = this.dots.length;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TriangleMeshEditor();
});