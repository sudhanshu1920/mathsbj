import {
  MCQ_GAME_CAR_CENTER_Z,
  MCQ_GAME_LANE_X,
} from "@/lib/mcqGamePhysics";

type Point3 = readonly [number, number, number];
type Color = readonly [number, number, number];
export interface MCQGateProjection {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  visible: boolean;
}

export interface MCQ3DRenderFrame {
  carX: number;
  scrollOffset: number;
}

export interface MCQ3DScene {
  render(frame: MCQ3DRenderFrame): MCQGateProjection[];
  dispose(): void;
}

interface Mesh {
  buffer: WebGLBuffer;
  vertexCount: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  w: number;
  visible: boolean;
}

const LANE_ACCENTS: readonly Color[] = [
  [0.18, 0.72, 1.0],
  [0.62, 0.51, 1.0],
  [1.0, 0.72, 0.30],
  [0.20, 0.92, 0.73],
];

const NORMAL_TINT: Color = [1, 1, 1];
const FLOATS_PER_VERTEX = 9;
const BYTES_PER_VERTEX = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;

/**
 * Keep a stable 90-degree horizontal field of view across portrait, tablet,
 * and landscape layouts. The car extends toward the camera, so sizing from a
 * fixed vertical FOV can clip its rear corners in wide-but-not-ultrawide views.
 */
export function getMCQ3DVerticalFovDegrees(aspectRatio: number): number {
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0
    ? aspectRatio
    : 1;
  return (2 * Math.atan(1 / safeAspectRatio) * 180) / Math.PI;
}

function normalizeVector(x: number, y: number, z: number): Point3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

class MeshBuilder {
  private readonly vertices: number[] = [];

  private pushVertex(point: Point3, normal: Point3, color: Color): void {
    this.vertices.push(
      point[0], point[1], point[2],
      normal[0], normal[1], normal[2],
      color[0], color[1], color[2],
    );
  }

  private triangle(a: Point3, b: Point3, c: Point3, normal: Point3, color: Color): void {
    this.pushVertex(a, normal, color);
    this.pushVertex(b, normal, color);
    this.pushVertex(c, normal, color);
  }

  addBox(
    centerX: number,
    centerY: number,
    centerZ: number,
    width: number,
    height: number,
    depth: number,
    color: Color,
  ): void {
    const x0 = centerX - width / 2;
    const x1 = centerX + width / 2;
    const y0 = centerY - height / 2;
    const y1 = centerY + height / 2;
    const z0 = centerZ - depth / 2;
    const z1 = centerZ + depth / 2;

    const faces: Array<{ points: [Point3, Point3, Point3, Point3]; normal: Point3 }> = [
      { points: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], normal: [0, 0, 1] },
      { points: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], normal: [0, 0, -1] },
      { points: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], normal: [1, 0, 0] },
      { points: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], normal: [-1, 0, 0] },
      { points: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], normal: [0, 1, 0] },
      { points: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], normal: [0, -1, 0] },
    ];

    faces.forEach((face) => {
      const points = face.points;
      this.triangle(points[0], points[1], points[2], face.normal, color);
      this.triangle(points[0], points[2], points[3], face.normal, color);
    });
  }

  addCone(
    centerX: number,
    baseY: number,
    centerZ: number,
    radius: number,
    height: number,
    color: Color,
    segments = 9,
  ): void {
    const top: Point3 = [centerX, baseY + height, centerZ];
    const bottomCenter: Point3 = [centerX, baseY, centerZ];
    for (let index = 0; index < segments; index += 1) {
      const angleA = (index / segments) * Math.PI * 2;
      const angleB = ((index + 1) / segments) * Math.PI * 2;
      const a: Point3 = [
        centerX + Math.cos(angleA) * radius,
        baseY,
        centerZ + Math.sin(angleA) * radius,
      ];
      const b: Point3 = [
        centerX + Math.cos(angleB) * radius,
        baseY,
        centerZ + Math.sin(angleB) * radius,
      ];
      const mid = (angleA + angleB) / 2;
      const normal = normalizeVector(Math.cos(mid), radius / Math.max(height, 0.1), Math.sin(mid));
      this.triangle(a, b, top, normal, color);
      this.triangle(bottomCenter, b, a, [0, -1, 0], color);
    }
  }

  addCylinderX(
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    width: number,
    color: Color,
    segments = 12,
  ): void {
    const x0 = centerX - width / 2;
    const x1 = centerX + width / 2;
    const center: Point3 = [centerX, centerY, centerZ];

    for (let index = 0; index < segments; index += 1) {
      const angleA = (index / segments) * Math.PI * 2;
      const angleB = ((index + 1) / segments) * Math.PI * 2;
      const aY = centerY + Math.cos(angleA) * radius;
      const aZ = centerZ + Math.sin(angleA) * radius;
      const bY = centerY + Math.cos(angleB) * radius;
      const bZ = centerZ + Math.sin(angleB) * radius;
      const a0: Point3 = [x0, aY, aZ];
      const a1: Point3 = [x1, aY, aZ];
      const b1: Point3 = [x1, bY, bZ];
      const b0: Point3 = [x0, bY, bZ];
      const middleAngle = (angleA + angleB) / 2;
      const normal = normalizeVector(0, Math.cos(middleAngle), Math.sin(middleAngle));
      this.triangle(a0, a1, b1, normal, color);
      this.triangle(a0, b1, b0, normal, color);
      this.triangle([x0, centerY, centerZ], b0, a0, [-1, 0, 0], color);
      this.triangle([x1, centerY, centerZ], a1, b1, [1, 0, 0], color);
    }
  }

  toFloat32Array(): Float32Array {
    return new Float32Array(this.vertices);
  }
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL shader allocation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(shader) || "shader compilation failed";
    gl.deleteShader(shader);
    throw new Error(reason);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexSource = [
    "attribute vec3 aPosition;",
    "attribute vec3 aNormal;",
    "attribute vec3 aColor;",
    "uniform mat4 uMvp;",
    "varying vec3 vNormal;",
    "varying vec3 vColor;",
    "void main() {",
    "  gl_Position = uMvp * vec4(aPosition, 1.0);",
    "  vNormal = aNormal;",
    "  vColor = aColor;",
    "}",
  ].join("\n");

  const fragmentSource = [
    "precision mediump float;",
    "uniform vec3 uTint;",
    "uniform vec3 uLightDirection;",
    "uniform float uOpacity;",
    "varying vec3 vNormal;",
    "varying vec3 vColor;",
    "void main() {",
    "  float diffuse = max(dot(normalize(vNormal), normalize(uLightDirection)), 0.0);",
    "  float lighting = 0.40 + diffuse * 0.60;",
    "  vec3 litColor = vColor * uTint * lighting;",
    "  gl_FragColor = vec4(litColor, uOpacity);",
    "}",
  ].join("\n");

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("WebGL program allocation failed");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const reason = gl.getProgramInfoLog(program) || "shader program linking failed";
    gl.deleteProgram(program);
    throw new Error(reason);
  }
  return program;
}

function uploadMesh(gl: WebGLRenderingContext, builder: MeshBuilder): Mesh {
  const values = builder.toFloat32Array();
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("WebGL geometry buffer allocation failed");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
  return { buffer, vertexCount: values.length / FLOATS_PER_VERTEX };
}

function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const output = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      output[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return output;
}

function perspectiveMatrix(fieldOfViewRadians: number, aspect: number, near: number, far: number): Float32Array {
  const factor = 1 / Math.tan(fieldOfViewRadians / 2);
  const output = new Float32Array(16);
  output[0] = factor / aspect;
  output[5] = factor;
  output[10] = (far + near) / (near - far);
  output[11] = -1;
  output[14] = (2 * far * near) / (near - far);
  return output;
}

function lookAtMatrix(eye: Point3, target: Point3, up: Point3): Float32Array {
  const forward = normalizeVector(target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]);
  const side = normalizeVector(
    forward[1] * up[2] - forward[2] * up[1],
    forward[2] * up[0] - forward[0] * up[2],
    forward[0] * up[1] - forward[1] * up[0],
  );
  const correctedUp: Point3 = [
    side[1] * forward[2] - side[2] * forward[1],
    side[2] * forward[0] - side[0] * forward[2],
    side[0] * forward[1] - side[1] * forward[0],
  ];

  return new Float32Array([
    side[0], correctedUp[0], -forward[0], 0,
    side[1], correctedUp[1], -forward[1], 0,
    side[2], correctedUp[2], -forward[2], 0,
    -(side[0] * eye[0] + side[1] * eye[1] + side[2] * eye[2]),
    -(correctedUp[0] * eye[0] + correctedUp[1] * eye[1] + correctedUp[2] * eye[2]),
    forward[0] * eye[0] + forward[1] * eye[1] + forward[2] * eye[2],
    1,
  ]);
}

function translationMatrix(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

function projectPoint(matrix: Float32Array, point: Point3, width: number, height: number): ProjectedPoint {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  const clipZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (!Number.isFinite(clipW) || clipW <= 0.01) {
    return { x: 0, y: 0, depth: 1, w: clipW, visible: false };
  }

  const normalizedX = clipX / clipW;
  const normalizedY = clipY / clipW;
  const normalizedZ = clipZ / clipW;
  return {
    x: (normalizedX * 0.5 + 0.5) * width,
    y: (1 - (normalizedY * 0.5 + 0.5)) * height,
    depth: normalizedZ,
    w: clipW,
    visible: normalizedX >= -1.15 && normalizedX <= 1.15 &&
      normalizedY >= -1.15 && normalizedY <= 1.15 &&
      normalizedZ >= -1.1 && normalizedZ <= 1.1,
  };
}

function buildWorldMesh(): MeshBuilder {
  const builder = new MeshBuilder();
  builder.addBox(0, -0.38, -6, 160, 0.16, 80, [0.025, 0.12, 0.105]);
  builder.addBox(0, -0.18, -6, 9.6, 0.2, 52, [0.075, 0.095, 0.13]);

  builder.addBox(-4.76, -0.065, -6, 0.20, 0.06, 52, [0.22, 0.28, 0.34]);
  builder.addBox(4.76, -0.065, -6, 0.20, 0.06, 52, [0.22, 0.28, 0.34]);
  builder.addBox(-4.61, -0.055, -6, 0.055, 0.018, 52, [0.17, 0.82, 0.98]);
  builder.addBox(4.61, -0.055, -6, 0.055, 0.018, 52, [0.17, 0.82, 0.98]);

  for (const side of [-1, 1]) {
    builder.addBox(side * 5.08, 0.02, -6, 0.13, 0.42, 49, [0.18, 0.23, 0.30]);
    builder.addBox(side * 5.08, 0.25, -6, 0.10, 0.055, 49, [0.19, 0.66, 0.83]);
    builder.addBox(side * 5.08, -0.13, -6, 0.20, 0.09, 49, [0.10, 0.14, 0.18]);
  }

  // Static, low-poly mountain silhouettes and a restrained moon add depth
  // without a skybox texture, extra draw calls, or per-frame allocations.
  builder.addCone(-15.0, -0.18, -33, 7.2, 6.5, [0.018, 0.040, 0.095], 7);
  builder.addCone(-20.2, -0.18, -39, 8.6, 8.2, [0.025, 0.060, 0.13], 7);
  builder.addCone(14.2, -0.18, -35, 8.4, 7.4, [0.018, 0.045, 0.11], 7);
  builder.addCone(20.1, -0.18, -42, 9.5, 9.0, [0.028, 0.075, 0.16], 7);
  builder.addCone(12.2, 9.4, -36, 0.82, 0.12, [0.70, 0.83, 1.0], 12);
  for (const star of [
    [-15, 10.2, -30], [-9, 12.1, -38], [-2, 9.2, -34],
    [3, 12.5, -40], [8, 10.8, -31], [18, 12.4, -39],
  ] as const) {
    builder.addBox(star[0], star[1], star[2], 0.055, 0.055, 0.04, [0.42, 0.66, 0.95]);
  }
  return builder;
}

function buildScrollingMesh(): MeshBuilder {
  const builder = new MeshBuilder();
  const laneSeparators = [-2.30, 0, 2.30];
  // Four-unit dash spacing divides the eight-unit recycle cycle exactly.
  for (let z = -32; z <= 20; z += 4.0) {
    for (const x of laneSeparators) {
      builder.addBox(x, -0.068, z, 0.045, 0.018, 1.48, [0.72, 0.80, 0.88]);
    }
  }

  for (let z = -30; z <= 18; z += 8) {
    for (const side of [-1, 1]) {
      const x = side * 5.42;
      builder.addBox(x, 1.48, z, 0.075, 2.85, 0.075, [0.28, 0.35, 0.43]);
      builder.addBox(x - side * 0.30, 2.92, z, 0.74, 0.075, 0.075, [0.30, 0.40, 0.52]);
      builder.addBox(x - side * 0.58, 2.86, z, 0.26, 0.11, 0.18, [0.98, 0.66, 0.30]);
      builder.addBox(x - side * 0.58, 2.80, z, 0.30, 0.035, 0.20, [1.0, 0.82, 0.48]);
      builder.addBox(x, -0.08, z, 0.28, 0.09, 0.28, [0.12, 0.19, 0.24]);

      const treeX = side * 7.15;
      builder.addBox(treeX, 0.05, z + 1.0, 0.24, 0.44, 0.24, [0.30, 0.20, 0.13]);
      builder.addCone(treeX, 0.20, z + 1.0, 0.66, 1.05, [0.045, 0.31, 0.25]);
      builder.addCone(treeX, 0.72, z + 1.0, 0.49, 0.92, [0.055, 0.43, 0.32]);
      builder.addCone(treeX, 1.18, z + 1.0, 0.31, 0.76, [0.08, 0.55, 0.39]);
    }
  }
  return builder;
}

function buildCarMesh(): MeshBuilder {
  const builder = new MeshBuilder();
  const body: Color = [0.025, 0.39, 0.72];
  const brightBody: Color = [0.07, 0.78, 0.97];
  const glass: Color = [0.025, 0.105, 0.18];
  const rubber: Color = [0.018, 0.026, 0.04];
  const tailLight: Color = [1.0, 0.055, 0.19];

  // Lower, wider rear body and a narrower cabin create a sports-coupe profile
  // without adding textures, runtime mesh rebuilds, or extra draw calls.
  builder.addBox(0, 0.28, 0.02, 1.08, 0.34, 2.42, body);
  builder.addBox(0, 0.39, -0.57, 0.94, 0.15, 0.96, brightBody);
  builder.addBox(0, 0.56, -0.14, 0.76, 0.30, 0.98, body);
  builder.addBox(0, 0.64, -0.20, 0.62, 0.14, 0.70, glass);
  builder.addBox(0, 0.73, -0.22, 0.54, 0.045, 0.62, brightBody);
  builder.addBox(0, 0.38, -1.18, 0.76, 0.10, 0.16, [0.98, 0.82, 0.48]);

  // Distinct rear light bars, diffuser and raised spoiler read clearly from
  // the player's rear-facing camera at the existing low polygon budget.
  builder.addBox(-0.35, 0.40, 1.235, 0.32, 0.075, 0.045, tailLight);
  builder.addBox(0.35, 0.40, 1.235, 0.32, 0.075, 0.045, tailLight);
  builder.addBox(0, 0.39, 1.238, 0.15, 0.04, 0.04, [1.0, 0.32, 0.40]);
  builder.addBox(0, 0.17, 1.12, 0.92, 0.075, 0.20, rubber);
  builder.addBox(-0.51, 0.29, 0.25, 0.045, 0.12, 0.60, [0.025, 0.16, 0.25]);
  builder.addBox(0.51, 0.29, 0.25, 0.045, 0.12, 0.60, [0.025, 0.16, 0.25]);
  builder.addBox(0, 0.70, 1.04, 0.84, 0.045, 0.12, [0.025, 0.20, 0.34]);
  builder.addBox(0, 0.79, 1.13, 1.22, 0.065, 0.14, brightBody);

  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.82, 0.84]) {
      builder.addCylinderX(x, 0.13, z, 0.235, 0.16, rubber, 12);
      builder.addCylinderX(x + (x > 0 ? 0.085 : -0.085), 0.13, z, 0.105, 0.025, [0.43, 0.61, 0.70], 10);
    }
  }
  return builder;
}

function buildGateMesh(accent: Color): MeshBuilder {
  const builder = new MeshBuilder();
  const panel: Color = [0.045, 0.075, 0.13];
  const darkEdge: Color = [0.08, 0.16, 0.25];

  builder.addBox(0, 1.20, -0.035, 1.42, 0.82, 0.18, panel);
  builder.addBox(0, 1.20, 0.075, 1.28, 0.68, 0.035, darkEdge);
  builder.addBox(-0.68, 0.95, 0, 0.13, 1.90, 0.16, accent);
  builder.addBox(0.68, 0.95, 0, 0.13, 1.90, 0.16, accent);
  builder.addBox(0, 1.88, 0, 1.52, 0.16, 0.18, accent);
  builder.addBox(0, 0.13, 0.035, 1.56, 0.17, 0.34, [0.14, 0.20, 0.28]);
  builder.addBox(0, 0.22, 0.035, 1.37, 0.045, 0.36, accent);
  builder.addBox(-0.48, 1.97, 0.01, 0.11, 0.055, 0.20, [0.60, 0.90, 1.0]);
  builder.addBox(0.48, 1.97, 0.01, 0.11, 0.055, 0.20, [0.60, 0.90, 1.0]);
  return builder;
}

export function createMCQ3DScene(canvas: HTMLCanvasElement): MCQ3DScene {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    depth: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("WebGL 1.0 is unavailable");

  const program = createProgram(gl);
  const positionLocation = gl.getAttribLocation(program, "aPosition");
  const normalLocation = gl.getAttribLocation(program, "aNormal");
  const colorLocation = gl.getAttribLocation(program, "aColor");
  const mvpLocation = gl.getUniformLocation(program, "uMvp");
  const tintLocation = gl.getUniformLocation(program, "uTint");
  const lightLocation = gl.getUniformLocation(program, "uLightDirection");
  const opacityLocation = gl.getUniformLocation(program, "uOpacity");

  if (positionLocation < 0 || normalLocation < 0 || colorLocation < 0 ||
      !mvpLocation || !tintLocation || !lightLocation || !opacityLocation) {
    gl.deleteProgram(program);
    throw new Error("Required WebGL shader bindings are unavailable");
  }

  const worldMesh = uploadMesh(gl, buildWorldMesh());
  const scrollingMesh = uploadMesh(gl, buildScrollingMesh());
  const carMesh = uploadMesh(gl, buildCarMesh());
  const gateMeshes = LANE_ACCENTS.map((accent) => uploadMesh(gl, buildGateMesh(accent)));
  const allMeshes = [worldMesh, scrollingMesh, carMesh, ...gateMeshes];

  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0.018, 0.032, 0.065, 1);
  gl.uniform3f(lightLocation, -0.38, 0.88, 0.42);

  let viewportWidth = 0;
  let viewportHeight = 0;
  let disposed = false;

  const syncViewport = () => {
    const cssWidth = Math.max(1, canvas.clientWidth || canvas.width || 320);
    const cssHeight = Math.max(1, canvas.clientHeight || canvas.height || 360);
    const pixelRatio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(cssWidth * pixelRatio));
    const height = Math.max(1, Math.round(cssHeight * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (viewportWidth !== width || viewportHeight !== height) {
      viewportWidth = width;
      viewportHeight = height;
      gl.viewport(0, 0, width, height);
    }
    return { width: cssWidth, height: cssHeight };
  };

  // Keep the camera horizontally fixed. Screen-space answer anchors are
  // projected at the car's fixed depth, so steering moves the car underneath
  // the options instead of moving the options with a tracking camera.
  const makeViewProjection = (width: number, height: number) => {
    const aspect = width / height;
    const verticalFovDegrees = getMCQ3DVerticalFovDegrees(aspect);
    const eye: Point3 = [0, 3.45, 7.20];
    const target: Point3 = [0, 0.92, -4.85];
    const projection = perspectiveMatrix((verticalFovDegrees * Math.PI) / 180, aspect, 0.1, 100);
    const view = lookAtMatrix(eye, target, [0, 1, 0]);
    return multiplyMatrices(projection, view);
  };

  const drawMesh = (
    mesh: Mesh,
    mvp: Float32Array,
    tint: Color,
  ) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.enableVertexAttribArray(normalLocation);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, BYTES_PER_VERTEX, 0);
    gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, BYTES_PER_VERTEX, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, BYTES_PER_VERTEX, 6 * Float32Array.BYTES_PER_ELEMENT);
    gl.uniformMatrix4fv(mvpLocation, false, mvp);
    gl.uniform3f(tintLocation, tint[0], tint[1], tint[2]);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
  };

  return {
    render(frame: MCQ3DRenderFrame): MCQGateProjection[] {
      if (disposed) return [];
      const viewport = syncViewport();
      const viewProjection = makeViewProjection(viewport.width, viewport.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);

      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.uniform1f(opacityLocation, 1);
      drawMesh(worldMesh, viewProjection, NORMAL_TINT);
      const scrollMatrix = multiplyMatrices(
        viewProjection,
        translationMatrix(0, 0, frame.scrollOffset % 8),
      );
      drawMesh(scrollingMesh, scrollMatrix, NORMAL_TINT);

      // The gate frames share a fixed depth with the car's interaction
      // plane. Their transforms are independent from the scrolling road.
      MCQ_GAME_LANE_X.forEach((laneX, index) => {
        const gateMatrix = multiplyMatrices(
          viewProjection,
          translationMatrix(laneX, 0, MCQ_GAME_CAR_CENTER_Z),
        );
        drawMesh(gateMeshes[index], gateMatrix, NORMAL_TINT);
      });

      const carMatrix = multiplyMatrices(
        viewProjection,
        translationMatrix(frame.carX, 0, MCQ_GAME_CAR_CENTER_Z),
      );
      drawMesh(carMesh, carMatrix, NORMAL_TINT);

      // Project four gates at a constant car-relative depth. Neither
      // road scroll, speed nor car steering participates in these anchors.
      // The DOM labels and the car collision zones share this same lane order.
      const projections = MCQ_GAME_LANE_X.map((laneX) => {
        const gateZ = MCQ_GAME_CAR_CENTER_Z;
        const center = projectPoint(viewProjection, [laneX, 1.20, gateZ], viewport.width, viewport.height);
        const left = projectPoint(viewProjection, [laneX - 0.65, 1.20, gateZ], viewport.width, viewport.height);
        const right = projectPoint(viewProjection, [laneX + 0.65, 1.20, gateZ], viewport.width, viewport.height);
        const top = projectPoint(viewProjection, [laneX, 1.58, gateZ], viewport.width, viewport.height);
        const bottom = projectPoint(viewProjection, [laneX, 0.82, gateZ], viewport.width, viewport.height);
        const projectedWidth = Math.abs(right.x - left.x) * 0.91;
        const projectedHeight = Math.abs(bottom.y - top.y) * 0.75;
        const visible = center.visible && left.w > 0 && right.w > 0 && top.w > 0 && bottom.w > 0;
        return {
          x: center.x,
          y: center.y,
          width: Math.min(150, Math.max(40, projectedWidth)),
          height: Math.min(76, Math.max(28, projectedHeight)),
          fontSize: Math.min(17, Math.max(10, projectedWidth * 0.20)),
          visible,
        };
      });
      return projections;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      allMeshes.forEach((mesh) => gl.deleteBuffer(mesh.buffer));
      gl.deleteProgram(program);
    },
  };
}
