const canvas = document.createElement("canvas");
document.body.appendChild(canvas);


canvas.style.width = "800px";
canvas.style.height = "800px";
canvas.style.border = "1px solid black";


canvas.width = 400;
canvas.height = 400;

const gl = canvas.getContext("webgl");
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.1, 0.1, 0.1, 1.0);

const vertShaderSource = `
    attribute vec2 position;
    // Texture coordinates for the background
    varying vec2 textCoords;

    void main() {
      textCoords = (position + 1.0) / 2.0;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

const fragShaderSource_DistFromCursor = `
  precision highp float;
varying vec2 textCoords;
uniform vec2 u_mouse;
uniform vec4 u_boxBounds1; // First box bounds
uniform vec4 u_boxBounds2; // Second box bounds
// Add more uniforms for additional boxes as needed

// Function to check if point is in shadow of a specific box
bool isInShadowSingleBox(vec2 point, vec2 lightSource, vec4 boxBounds) {
  // Existing shadow calculation code
  vec2 lightToPoint = point - lightSource;
  
  if ((lightSource.x < boxBounds.x && point.x < boxBounds.x) || 
      (lightSource.x > boxBounds.z && point.x > boxBounds.z) || 
      (lightSource.y < boxBounds.y && point.y < boxBounds.y) || 
      (lightSource.y > boxBounds.w && point.y > boxBounds.w)) {
    return false;
  }
  
  float tMinX = (boxBounds.x - lightSource.x) / lightToPoint.x;
  float tMaxX = (boxBounds.z - lightSource.x) / lightToPoint.x;
  float tMinY = (boxBounds.y - lightSource.y) / lightToPoint.y;
  float tMaxY = (boxBounds.w - lightSource.y) / lightToPoint.y;
  
  float tXmin = min(tMinX, tMaxX);
  float tXmax = max(tMinX, tMaxX);
  float tYmin = min(tMinY, tMaxY);
  float tYmax = max(tMinY, tMaxY);
  
  float tIn = max(tXmin, tYmin);
  float tOut = min(tXmax, tYmax);
  
  bool intersectsBox = tIn <= tOut && tOut > 0.0;
  
  return intersectsBox && length(lightToPoint) > tOut * length(lightToPoint);
}

// Combined function that checks all boxes
bool isInShadow(vec2 point, vec2 lightSource) {
  // Check against each box - if in shadow of ANY box, return true
  if (isInShadowSingleBox(point, lightSource, u_boxBounds1)) return true;
  if (isInShadowSingleBox(point, lightSource, u_boxBounds2)) return true;
  // Add more checks for additional boxes
  return false;
}

void main() {
  vec2 ndcCoords = textCoords * 2.0 - 1.0;

  bool insideBox1 = ndcCoords.x > u_boxBounds1.x && ndcCoords.x < u_boxBounds1.z &&
                   ndcCoords.y > u_boxBounds1.y && ndcCoords.y < u_boxBounds1.w;
  bool insideBox2 = ndcCoords.x > u_boxBounds2.x && ndcCoords.x < u_boxBounds2.z &&
                   ndcCoords.y > u_boxBounds2.y && ndcCoords.y < u_boxBounds2.w;
  
  if (insideBox1 || insideBox2) {
    // Make this transparent so the boxes show through
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // For fragments outside boxes, calculate if they're in shadow of ANY box
  bool inShadow = isInShadow(ndcCoords, u_mouse);
  
  if (inShadow) {
    // In shadow - make it dark
    gl_FragColor = vec4(0.1, 0.1, 0.1, 0.7);
    return;
  }
  
  // Normal lighting calculation
  float distanceToMouse = length(u_mouse - ndcCoords);
  float opacity = clamp(1.0 - distanceToMouse/2.5, 0.1, 1.0);
  gl_FragColor = vec4(1.0, 1.0, 1.0, opacity);
}
`;

const yellowFragShaderSource = `
  precision highp float;
  uniform vec2 u_mouse;
  uniform vec4 u_boxBounds1;
  uniform vec4 u_boxBounds2;
  varying vec2 textCoords;

  void main() {
    vec2 ndcCoords = textCoords * 2.0 - 1.0;
    
    // Check which box this fragment is in
    bool fragmentInsideBox1 = ndcCoords.x > u_boxBounds1.x && ndcCoords.x < u_boxBounds1.z &&
                            ndcCoords.y > u_boxBounds1.y && ndcCoords.y < u_boxBounds1.w;
    
    bool fragmentInsideBox2 = ndcCoords.x > u_boxBounds2.x && ndcCoords.x < u_boxBounds2.z &&
                            ndcCoords.y > u_boxBounds2.y && ndcCoords.y < u_boxBounds2.w;
    
    if (fragmentInsideBox1) {
      // Box 1 rendering
      bool mouseInsideBox = u_mouse.x > u_boxBounds1.x && u_mouse.x < u_boxBounds1.z &&
                           u_mouse.y > u_boxBounds1.y && u_mouse.y < u_boxBounds1.w;
      
      if (mouseInsideBox) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red
      } else {
        gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0); // Yellow
      }
    } 
    else if (fragmentInsideBox2) {
      // Box 2 rendering - different color to distinguish
      bool mouseInsideBox = u_mouse.x > u_boxBounds2.x && u_mouse.x < u_boxBounds2.z &&
                           u_mouse.y > u_boxBounds2.y && u_mouse.y < u_boxBounds2.w;
      
      if (mouseInsideBox) {
        gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0); // Cyan
      } else {
        gl_FragColor = vec4(0.0, 0.5, 1.0, 1.0); // Blue
      }
    }
    else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
  }
`;


function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(vertSrc, fragSrc) {
  const vertShader = createShader(gl.VERTEX_SHADER, vertSrc);
  const fragShader = createShader(gl.FRAGMENT_SHADER, fragSrc);

  if (!vertShader || !fragShader) {
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}


const bgProgram = createProgram(
  vertShaderSource,
  fragShaderSource_DistFromCursor
);
const boxProgram = createProgram(vertShaderSource, yellowFragShaderSource);


const bgPositionLoc = gl.getAttribLocation(bgProgram, "position");

const boxPositionLoc = gl.getAttribLocation(boxProgram, "position");


const bgMouseUniformLoc = gl.getUniformLocation(bgProgram, "u_mouse");
const boxMouseUniformLoc = gl.getUniformLocation(boxProgram, "u_mouse");

// Enable blending for transparency
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// Full screen quad
const bgVertices = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);

const bgBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
gl.bufferData(gl.ARRAY_BUFFER, bgVertices, gl.STATIC_DRAW);

// Small center box
const boxVertices1 = new Float32Array([
  -0.3, -0.3, 0.3, -0.3, 0.3, 0.3, -0.3, -0.3, 0.3, 0.3, -0.3, 0.3,
]);
const boxVertices2 = new Float32Array([
  0.4, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6,
]);

// Get uniform locations
// const bgBoxBoundsUniformLoc = gl.getUniformLocation(bgProgram, "u_boxBounds");
// const boxBoxBoundsUniformLoc = gl.getUniformLocation(boxProgram, "u_boxBounds");

// Function to extract bounds from vertices
function getBoxBounds(vertices) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (let i = 0; i < vertices.length; i += 2) {
    const x = vertices[i];
    const y = vertices[i + 1];

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX, maxY];
}

// const boxBuffer = gl.createBuffer();
// gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer);
// gl.bufferData(gl.ARRAY_BUFFER, boxVertices1, gl.STATIC_DRAW);

const boxBuffer1 = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer1);
gl.bufferData(gl.ARRAY_BUFFER, boxVertices1, gl.STATIC_DRAW);

const boxBuffer2 = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer2);
gl.bufferData(gl.ARRAY_BUFFER, boxVertices2, gl.STATIC_DRAW);


const bgBoxBounds1UniformLoc = gl.getUniformLocation(bgProgram, "u_boxBounds1");
const bgBoxBounds2UniformLoc = gl.getUniformLocation(bgProgram, "u_boxBounds2");
const boxBoxBounds1UniformLoc = gl.getUniformLocation(
  boxProgram,
  "u_boxBounds1"
);
const boxBoxBounds2UniformLoc = gl.getUniformLocation(
  boxProgram,
  "u_boxBounds2"
);

// Mouse tracking
let mouse = { x: 0, y: 0 };

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();

  // Calculate mouse position in NDC coordinates (-1 to 1)
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1; // Y is flipped

  mouse.x = x;
  mouse.y = y;

  drawScene(); // Redraw on mouse move
});


function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT);


  const box1Bounds = getBoxBounds(boxVertices1);
  const box2Bounds = getBoxBounds(boxVertices2);

  gl.useProgram(bgProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
  gl.vertexAttribPointer(bgPositionLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(bgPositionLoc);

  gl.uniform2f(bgMouseUniformLoc, mouse.x, mouse.y);
  gl.uniform4fv(bgBoxBounds1UniformLoc, box1Bounds);
  gl.uniform4fv(bgBoxBounds2UniformLoc, box2Bounds);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Render first box
  gl.useProgram(boxProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer1);
  gl.vertexAttribPointer(boxPositionLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(boxPositionLoc);

  gl.uniform2f(boxMouseUniformLoc, mouse.x, mouse.y);
  gl.uniform4fv(boxBoxBounds1UniformLoc, box1Bounds);
  gl.uniform4fv(boxBoxBounds2UniformLoc, box2Bounds); // Also pass 2nd box bounds
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Render second box
  gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer2);
  gl.vertexAttribPointer(boxPositionLoc, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

drawScene(); 
