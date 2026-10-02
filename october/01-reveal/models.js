// Everything on the beach, modelled in code. Sizes are in metres, roughly true to life.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PI = Math.PI;
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

function mesh(geo, mat, parent) {
	const m = new THREE.Mesh(geo, mat);
	m.castShadow = true;
	m.receiveShadow = true;
	if (parent) parent.add(m);
	return m;
}

function canvasTex(w, h, draw, srgb = true) {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	draw(c.getContext("2d"), w, h);
	const t = new THREE.CanvasTexture(c);
	if (srgb) t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	return t;
}

// seeded random so models look the same every visit
let seed = 1;
function srand(s) { seed = s; }
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function rr(a, b) { return a + rnd() * (b - a); }

// value noise for displacing rocks and shells
function hash3(x, y, z) {
	const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
	return s - Math.floor(s);
}
function noise3(x, y, z) {
	const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
	const fx = x - ix, fy = y - iy, fz = z - iz;
	const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
	let v = 0;
	for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
		v += hash3(ix + i, iy + j, iz + k) * (i ? ux : 1 - ux) * (j ? uy : 1 - uy) * (k ? uz : 1 - uz);
	}
	return v;
}

function displace(geo, fn) {
	const p = geo.attributes.position, v = new THREE.Vector3();
	for (let i = 0; i < p.count; i++) {
		v.fromBufferAttribute(p, i);
		fn(v);
		p.setXYZ(i, v.x, v.y, v.z);
	}
	geo.computeVertexNormals();
	return geo;
}

function lump(r, detail, amt, freq, s) {
	let g = new THREE.IcosahedronGeometry(r, detail);
	g.deleteAttribute("normal");
	g.deleteAttribute("uv");
	g = mergeVertices(g);
	return displace(g, (v) => {
		const n = noise3(v.x * freq + s, v.y * freq, v.z * freq) * 0.65 + noise3(v.x * freq * 2.7, v.y * freq * 2.7 + s, v.z * freq * 2.7) * 0.35;
		v.multiplyScalar(1 + (n - 0.5) * amt);
	});
}

// a grid surface from a function of (u, v)
function paramGeo(fn, nu, nv) {
	const pos = [], uv = [], idx = [], v3 = new THREE.Vector3();
	for (let j = 0; j <= nv; j++) {
		for (let i = 0; i <= nu; i++) {
			fn(i / nu, j / nv, v3);
			pos.push(v3.x, v3.y, v3.z);
			uv.push(i / nu, j / nv);
		}
	}
	for (let j = 0; j < nv; j++) {
		for (let i = 0; i < nu; i++) {
			const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
			idx.push(a, c, b, b, c, d);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}

function roundRect(w, h, r) {
	const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
	s.moveTo(x + r, y);
	s.lineTo(x + w - r, y);
	s.quadraticCurveTo(x + w, y, x + w, y + r);
	s.lineTo(x + w, y + h - r);
	s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	s.lineTo(x + r, y + h);
	s.quadraticCurveTo(x, y + h, x, y + h - r);
	s.lineTo(x, y + r);
	s.quadraticCurveTo(x, y, x + r, y);
	return s;
}

// a rounded slab lying flat: w along x, d along z, thickness t along y
function slab(w, d, t, r, b) {
	b = b === undefined ? Math.min(t * 0.3, r * 0.6) : b;
	const g = new THREE.ExtrudeGeometry(roundRect(w - 2 * b, d - 2 * b, Math.max(r - b, 0.0002)), {
		depth: Math.max(t - 2 * b, 0.0001), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 8
	});
	g.center();
	g.rotateX(-PI / 2);
	return g;
}

function extrudeFlat(shape, t, b, curve) {
	const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(t - 2 * b, 0.0001), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 2, curveSegments: curve || 12 });
	g.center();
	g.rotateX(-PI / 2);
	return g;
}

function cyl(rt, rb, h, seg, open) { return new THREE.CylinderGeometry(rt, rb, h, seg || 24, 1, !!open); }

// ---------- materials ----------
const MAT = {
	black: std({ color: 0x141518, roughness: 0.5 }),
	carbon: std({ color: 0x0c0c0d, roughness: 0.28, metalness: 0.25 }),
	rubber: std({ color: 0x1b1b1c, roughness: 0.85 }),
	alu: std({ color: lin(0.91, 0.92, 0.92), metalness: 1, roughness: 0.32 }),
	steel: std({ color: lin(0.56, 0.57, 0.58), metalness: 1, roughness: 0.38 }),
	chrome: std({ color: lin(0.75, 0.76, 0.77), metalness: 1, roughness: 0.12 }),
	gold: std({ color: lin(1.0, 0.77, 0.34), metalness: 1, roughness: 0.2 }),
	silver: std({ color: lin(0.93, 0.92, 0.88), metalness: 1, roughness: 0.24 }),
	tarnish: std({ color: lin(0.62, 0.6, 0.55), metalness: 1, roughness: 0.42 }),
	brass: std({ color: lin(0.88, 0.72, 0.38), metalness: 1, roughness: 0.34 }),
	copper: std({ color: lin(0.86, 0.5, 0.36), metalness: 1, roughness: 0.38 }),
	nickel: std({ color: lin(0.74, 0.73, 0.7), metalness: 1, roughness: 0.3 }),
	orange: std({ color: 0xff6a1a, roughness: 0.4 })
};

const rustTex = canvasTex(256, 256, (c, w, h) => {
	c.fillStyle = "#6b3416";
	c.fillRect(0, 0, w, h);
	srand(7);
	for (let i = 0; i < 900; i++) {
		const t = rnd();
		c.fillStyle = t < 0.4 ? "rgba(140,70,25,0.5)" : t < 0.7 ? "rgba(60,28,12,0.55)" : t < 0.9 ? "rgba(170,95,40,0.45)" : "rgba(40,40,38,0.5)";
		c.beginPath();
		c.arc(rnd() * w, rnd() * h, rr(2, 14), 0, 7);
		c.fill();
	}
});
rustTex.wrapS = rustTex.wrapT = THREE.RepeatWrapping;
MAT.rust = std({ color: 0xffffff, map: rustTex, roughness: 0.92, metalness: 0.35 });
MAT.iron = std({ color: 0x8a8580, map: rustTex, roughness: 0.75, metalness: 0.6 });

// ---------- the detector ----------
class EllipseCurve3 extends THREE.Curve {
	constructor(rx, rz, y) { super(); this.rx = rx; this.rz = rz; this.y = y; }
	getPoint(t, out = new THREE.Vector3()) {
		const a = t * PI * 2;
		return out.set(Math.cos(a) * this.rx, this.y, Math.sin(a) * this.rz);
	}
}
class HelixCurve extends THREE.Curve {
	constructor(r, len, pitch) { super(); this.r = r; this.len = len; this.pitch = pitch; }
	getPoint(t, out = new THREE.Vector3()) {
		const y = t * this.len, a = y / this.pitch * PI * 2;
		return out.set(Math.cos(a) * this.r, y, Math.sin(a) * this.r);
	}
}

export function makeDetector() {
	const root = new THREE.Group();
	const coil = new THREE.Group();
	root.add(coil);

	// an open DD coil: an elliptical frame with a spine down the middle
	const RX = 0.135, RZ = 0.105, IX = 0.104, IZ = 0.076, SP = 0.011;
	const s = new THREE.Shape();
	s.absellipse(0, 0, RX, RZ, 0, PI * 2, false, 0);
	// the spine runs along x, so the holes sit either side of it in y
	const hTop = new THREE.Path(), hBot = new THREE.Path();
	const b0 = Math.asin(SP / IZ);
	hTop.absellipse(0, 0, IX, IZ, b0, PI - b0, false, 0);
	hTop.closePath();
	hBot.absellipse(0, 0, IX, IZ, PI + b0, PI * 2 - b0, false, 0);
	hBot.closePath();
	s.holes.push(hTop, hBot);
	const cg = new THREE.ExtrudeGeometry(s, { depth: 0.011, bevelEnabled: true, bevelThickness: 0.0045, bevelSize: 0.0045, bevelSegments: 3, curveSegments: 72 });
	cg.rotateX(-PI / 2);
	cg.translate(0, 0.0045, 0);
	const coilMat = std({ color: 0x17181b, roughness: 0.55 });
	mesh(cg, coilMat, coil);
	const rim = new THREE.TubeGeometry(new EllipseCurve3(RX - 0.006, RZ - 0.006, 0.0205), 96, 0.0016, 6, true);
	mesh(rim, MAT.orange, coil);
	// yoke ears and the bolt the shaft pivots on
	for (const z of [-0.0105, 0.0105]) {
		const ear = mesh(slab(0.04, 0.03, 0.0045, 0.006), coilMat, coil);
		ear.rotation.x = PI / 2;
		ear.position.set(0, 0.034, z);
	}
	const bolt = mesh(cyl(0.004, 0.004, 0.034, 12), MAT.steel, coil);
	bolt.rotation.x = PI / 2;
	bolt.position.set(0, 0.036, 0);
	const knob = mesh(cyl(0.012, 0.012, 0.007, 18), std({ color: 0x3a3d42, roughness: 0.5 }), coil);
	knob.rotation.x = PI / 2;
	knob.position.set(0, 0.036, 0.017);
	// the shaft: carbon lower tube, cam lock, aluminium upper tube, then box, grip and armrest
	const shaft = new THREE.Group();
	root.add(shaft);
	const lowerG = cyl(0.0105, 0.0105, 1, 18);
	lowerG.translate(0, 0.5, 0);
	const lower = mesh(lowerG, MAT.carbon, shaft);
	const foot = mesh(cyl(0.0125, 0.0125, 0.05, 16), coilMat, shaft);
	foot.position.y = 0.012;
	const upperG = cyl(0.0125, 0.0125, 1, 18);
	upperG.translate(0, 0.5, 0);
	const upper = mesh(upperG, MAT.alu, shaft);
	const collar = mesh(cyl(0.0165, 0.0165, 0.045, 18), std({ color: 0x2a2c30, roughness: 0.45 }), shaft);
	const lever = mesh(slab(0.012, 0.005, 0.034, 0.002), MAT.orange, collar);
	lever.position.set(0.0175, 0.004, 0);
	const head = new THREE.Group();
	shaft.add(head);
	const box = mesh(slab(0.085, 0.15, 0.045, 0.012), std({ color: 0x24262a, roughness: 0.45 }), head);
	box.rotation.x = PI / 2;
	box.position.set(0, 0, 0.032);
	const screen = mesh(new THREE.PlaneGeometry(0.06, 0.04), std({ color: 0x2c3a2e, roughness: 0.15, emissive: 0x1a2a18 }), head);
	screen.position.set(0, 0.02, 0.0552);
	const grip = mesh(cyl(0.017, 0.017, 0.14, 16), MAT.rubber, head);
	grip.position.set(0, 0.16, 0.0);
	const cuff = new THREE.CylinderGeometry(0.045, 0.045, 0.1, 20, 1, true, -PI * 0.7, PI * 1.4);
	const armrest = mesh(cuff, std({ color: 0x1d1f22, roughness: 0.6, side: THREE.DoubleSide }), head);
	armrest.position.set(0, 0.34, 0.03);
	// the coil cable winding up the shaft
	const MAXLEN = 2.8;
	const cable = mesh(new THREE.TubeGeometry(new HelixCurve(0.0124, MAXLEN, 0.2), 420, 0.0017, 6, false), std({ color: 0x0e0e10, roughness: 0.35 }), shaft);

	const Y = new THREE.Vector3(0, 1, 0);
	const tmp = new THREE.Vector3(), xs = new THREE.Vector3(), zs = new THREE.Vector3(), m4 = new THREE.Matrix4();
	root.userData.update = function (coilPos, groundN, handPos) {
		// coil flat to the ground, its long axis pointing back at you
		tmp.subVectors(handPos, coilPos);
		tmp.addScaledVector(groundN, -tmp.dot(groundN)).normalize();
		zs.crossVectors(tmp, groundN).normalize();
		m4.makeBasis(tmp, groundN, zs);
		coil.quaternion.setFromRotationMatrix(m4);
		coil.position.copy(coilPos);
		const pivot = tmp.copy(coilPos).addScaledVector(groundN, 0.036);
		shaft.position.copy(pivot);
		const dir = new THREE.Vector3().subVectors(handPos, pivot);
		const len = dir.length();
		dir.divideScalar(len);
		xs.crossVectors(dir, Y).normalize();
		zs.crossVectors(xs, dir).normalize();
		m4.makeBasis(xs, dir, zs);
		shaft.quaternion.setFromRotationMatrix(m4);
		const L1 = len * 0.58;
		lower.scale.y = L1;
		upper.position.y = L1;
		upper.scale.y = Math.max(0.01, len - L1);
		collar.position.y = L1;
		head.position.y = len - 0.2;
		const used = Math.min(1, (len - 0.3) / MAXLEN);
		cable.geometry.setDrawRange(0, Math.floor(420 * used) * 6 * 6);
	};
	return root;
}

// ---------- coins and their faces ----------
function coinTex(draw) {
	return canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#777";
		c.fillRect(0, 0, w, h);
		c.save();
		c.filter = "blur(1.5px)";
		c.strokeStyle = "#ddd";
		c.lineWidth = 12;
		c.beginPath();
		c.arc(128, 128, 121, 0, 7);
		c.stroke();
		c.strokeStyle = "#555";
		c.lineWidth = 3;
		c.beginPath();
		c.arc(128, 128, 110, 0, 7);
		c.stroke();
		draw(c);
		c.restore();
	}, false);
}
function ringText(c, text, r, size, start) {
	c.font = "bold " + size + "px Georgia, serif";
	c.fillStyle = "#cfcfcf";
	c.textAlign = "center";
	c.textBaseline = "middle";
	let a = start;
	for (const ch of text) {
		const wch = c.measureText(ch).width / r;
		c.save();
		c.translate(128 + Math.cos(a + wch / 2) * r, 128 + Math.sin(a + wch / 2) * r);
		c.rotate(a + wch / 2 + PI / 2);
		c.fillText(ch, 0, 0);
		c.restore();
		a += wch * 1.08;
	}
}
function profile(c, x, y, s) {
	c.fillStyle = "#d4d4d4";
	c.beginPath();
	c.ellipse(x, y, 36 * s, 44 * s, -0.25, 0, 7);
	c.fill();
	c.beginPath();
	c.moveTo(x - 20 * s, y + 30 * s);
	c.lineTo(x + 18 * s, y + 34 * s);
	c.lineTo(x + 26 * s, y + 70 * s);
	c.lineTo(x - 30 * s, y + 70 * s);
	c.fill();
	c.beginPath();
	c.ellipse(x - 34 * s, y - 2 * s, 8 * s, 10 * s, 0, 0, 7);
	c.fill();
	c.fillStyle = "#e8e8e8";
	c.beginPath();
	c.ellipse(x + 8 * s, y - 20 * s, 30 * s, 22 * s, -0.4, PI, PI * 2);
	c.fill();
}
const TEX_QUARTER = coinTex((c) => { profile(c, 128, 118, 1); ringText(c, "LIBERTY", 92, 22, -2.6); ringText(c, "1979", 92, 18, 0.95); });
const TEX_DOLLAR = coinTex((c) => { profile(c, 128, 120, 1.1); ringText(c, "E·PLURIBUS·UNUM", 94, 18, -3.0); ringText(c, "1921", 92, 18, 1.0); });
const TEX_DOUBLOON = coinTex((c) => {
	c.fillStyle = "#d8d8d8";
	c.fillRect(116, 50, 24, 156);
	c.fillRect(50, 116, 156, 24);
	for (const [x, y] of [[80, 80], [176, 80], [80, 176], [176, 176]]) { c.beginPath(); c.arc(x, y, 16, 0, 7); c.fill(); }
});
const TEX_REED = canvasTex(256, 16, (c, w, h) => {
	for (let x = 0; x < w; x += 4) { c.fillStyle = (x / 4) % 2 ? "#444" : "#ccc"; c.fillRect(x, 0, 4, h); }
}, false);
TEX_REED.wrapS = THREE.RepeatWrapping;
TEX_REED.repeat.set(30, 1);

function coin(r, h, mat, face, reeded, irregular) {
	let g = new THREE.CylinderGeometry(r, r, h, 56, 1);
	if (irregular) {
		g = displace(g, (v) => {
			const a = Math.atan2(v.z, v.x);
			const k = 1 + (noise3(Math.cos(a) * 2 + irregular, Math.sin(a) * 2, 0) - 0.5) * 0.18;
			v.x *= k;
			v.z *= k;
		});
	}
	const side = mat.clone();
	if (reeded) { side.bumpMap = TEX_REED; side.bumpScale = 3; }
	const top = mat.clone();
	top.bumpMap = face;
	top.bumpScale = 4;
	return mesh(g, [side, top, top]);
}

// ---------- shells ----------
function bandTex(cols, stripes, bands, s) {
	return canvasTex(256, 256, (c, w, h) => {
		srand(s || 3);
		const g = c.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, cols[0]);
		g.addColorStop(1, cols[1]);
		c.fillStyle = g;
		c.fillRect(0, 0, w, h);
		for (let i = 0; i < bands; i++) {
			c.fillStyle = "rgba(" + cols[2] + "," + rr(0.08, 0.3) + ")";
			c.fillRect(0, rnd() * h, w, rr(2, 10));
		}
		for (let i = 0; i < stripes; i++) {
			c.fillStyle = "rgba(" + cols[3] + "," + rr(0.15, 0.4) + ")";
			c.fillRect(rnd() * w, 0, rr(3, 12), h);
		}
	});
}

export function scallopGeo(size, ribs) {
	return paramGeo((u, v, out) => {
		const ang = (v - 0.5) * 2.5;
		const rib = Math.cos((v - 0.5) * ribs * PI * 2);
		const rim = 1 + 0.025 * rib * u;
		const r = size * u * rim;
		const edge = Math.pow(Math.abs(v - 0.5) * 2, 2.5);
		const dome = size * 0.3 * Math.pow(Math.sin(PI * Math.min(u, 1) * 0.92 + 0.08), 0.8) * (1 - edge * 0.75);
		const y = dome + size * 0.022 * rib * u;
		out.set(Math.sin(ang) * r, y, Math.cos(ang) * r - size * 0.5);
	}, 28, 64);
}

function spiralGeo(turns, r0, a0, c0, scale, open) {
	const k = Math.log(scale) / (turns * PI * 2);
	return paramGeo((u, v, out) => {
		const th = u * turns * PI * 2;
		const g = Math.exp(k * th);
		const R = r0 * g, a = a0 * g, y = -c0 * g;
		const phi = v * PI * 2;
		const cx = Math.cos(th), cz = Math.sin(th);
		const ar = a * (1 + 0.05 * Math.sin(phi * 9 + th * 2) * (open ? 1 : 0.4));
		out.set(cx * (R + ar * Math.cos(phi)), y + ar * Math.sin(phi) * 1.15, cz * (R + ar * Math.cos(phi)));
	}, 140, 24);
}

// ---------- the finds ----------
const B = {};

B.bolt = () => {
	const g = new THREE.Group();
	const headG = cyl(0.0095, 0.0095, 0.007, 6);
	mesh(headG, MAT.rust, g).position.y = 0.0035;
	const sh = mesh(cyl(0.0045, 0.0045, 0.045, 14), MAT.rust, g);
	sh.position.y = 0.007 + 0.0225;
	const nut = mesh(cyl(0.0085, 0.0085, 0.006, 6), MAT.rust, g);
	nut.position.y = 0.04;
	nut.rotation.y = 0.3;
	g.rotation.z = PI / 2;
	return g;
};

B.hook = () => {
	const g = new THREE.Group();
	const pts = [[0, 0.045, 0], [0, 0.012, 0], [0, 0.004, 0], [0.004, -0.004, 0], [0.011, -0.006, 0], [0.016, -0.002, 0], [0.017, 0.008, 0]].map((p) => new THREE.Vector3(...p));
	mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0009, 8), MAT.chrome, g);
	const eye = mesh(new THREE.TorusGeometry(0.0028, 0.0008, 8, 20), MAT.chrome, g);
	eye.position.y = 0.048;
	const barb = mesh(new THREE.ConeGeometry(0.0012, 0.005, 8), MAT.chrome, g);
	barb.position.set(0.0165, 0.009, 0);
	g.rotation.x = -PI / 2;
	return g;
};

B.anchor = () => {
	const g = new THREE.Group();
	const m = MAT.iron;
	mesh(cyl(0.0035, 0.0035, 0.075, 12), m, g).position.y = 0.0375;
	const ring = mesh(new THREE.TorusGeometry(0.008, 0.0022, 8, 24), m, g);
	ring.position.y = 0.083;
	const stock = mesh(cyl(0.0028, 0.0028, 0.05, 10), m, g);
	stock.rotation.z = PI / 2;
	stock.position.y = 0.066;
	const arms = mesh(new THREE.TorusGeometry(0.03, 0.0035, 8, 32, PI), m, g);
	arms.rotation.z = PI;
	arms.position.y = 0.03;
	for (const s of [-1, 1]) {
		const fl = mesh(new THREE.ConeGeometry(0.008, 0.016, 3), m, g);
		fl.position.set(s * 0.03, 0.035, 0);
		fl.scale.z = 0.4;
	}
	g.rotation.x = -PI / 2;
	return g;
};

B.skeleton = () => {
	const g = new THREE.Group();
	const m = std({ color: lin(0.42, 0.33, 0.2), metalness: 1, roughness: 0.55, map: rustTex });
	const bow = mesh(new THREE.TorusGeometry(0.011, 0.0025, 10, 28), m, g);
	bow.position.x = -0.035;
	const sh = mesh(cyl(0.0024, 0.0024, 0.06, 12), m, g);
	sh.rotation.z = PI / 2;
	sh.position.x = 0.006;
	const bit = mesh(new THREE.BoxGeometry(0.006, 0.012, 0.003), m, g);
	bit.position.set(0.03, -0.007, 0);
	const bit2 = mesh(new THREE.BoxGeometry(0.003, 0.007, 0.003), m, g);
	bit2.position.set(0.024, -0.005, 0);
	g.rotation.x = -PI / 2;
	return g;
};

function keyShape() {
	const s = new THREE.Shape();
	s.moveTo(0, -0.003);
	s.lineTo(0.042, -0.003);
	s.lineTo(0.046, 0);
	s.lineTo(0.042, 0.004);
	const teeth = [0.038, 0.034, 0.029, 0.024, 0.019, 0.014];
	teeth.forEach((x, i) => { s.lineTo(x, i % 2 ? 0.006 : 0.0045); s.lineTo(x - 0.0025, 0.0045 + (i % 3) * 0.001); });
	s.lineTo(0.008, 0.0045);
	s.lineTo(0.008, 0.009);
	s.absarc(-0.004, 0, 0.012, 0.85, PI * 2 - 0.85, false);
	s.lineTo(0, -0.003);
	const h = new THREE.Path();
	h.absarc(-0.01, 0, 0.003, 0, PI * 2, true);
	s.holes.push(h);
	return s;
}
B.keys = () => {
	const g = new THREE.Group();
	const ring = mesh(new THREE.TorusGeometry(0.014, 0.0012, 8, 36), MAT.chrome, g);
	ring.rotation.x = PI / 2;
	ring.position.y = 0.002;
	const k1 = mesh(extrudeFlat(keyShape(), 0.002, 0.0004), MAT.nickel, g);
	k1.position.set(0.032, 0.001, 0.004);
	k1.rotation.y = -0.4;
	const k2 = mesh(extrudeFlat(keyShape(), 0.002, 0.0004), MAT.brass, g);
	k2.position.set(0.02, 0.0035, -0.024);
	k2.rotation.y = 0.9;
	const fob = mesh(slab(0.032, 0.058, 0.013, 0.012), std({ color: 0x18191b, roughness: 0.35 }), g);
	fob.position.set(-0.03, 0.0065, 0.012);
	fob.rotation.y = 0.5;
	for (let i = 0; i < 3; i++) {
		const bt = mesh(cyl(0.005, 0.005, 0.002, 16), std({ color: 0x33353a, roughness: 0.6 }), fob);
		bt.position.set(0, 0.0068, -0.016 + i * 0.013);
	}
	return g;
};

B.battery = () => {
	const g = new THREE.Group();
	const label = canvasTex(256, 64, (c, w, h) => {
		c.fillStyle = "#111";
		c.fillRect(0, 0, w, h);
		c.fillStyle = "#c58a2b";
		c.fillRect(0, 0, w * 0.32, h);
		c.fillStyle = "#e9e1d2";
		c.font = "bold 30px sans-serif";
		c.fillText("AA  1.5V", 100, 44);
	});
	const body = mesh(cyl(0.0072, 0.0072, 0.048, 32), [std({ map: label, roughness: 0.35 }), MAT.steel, MAT.steel], g);
	const nub = mesh(cyl(0.0026, 0.0026, 0.002, 16), MAT.steel, g);
	nub.position.y = 0.025;
	g.rotation.z = PI / 2;
	g.rotation.y = 0.4;
	return g;
};

B.tab = () => {
	const s = roundRect(0.022, 0.014, 0.006);
	const h1 = new THREE.Path();
	h1.absellipse(0.003, 0, 0.0065, 0.0042, 0, PI * 2, true);
	const h2 = new THREE.Path();
	h2.absarc(-0.0068, 0, 0.0018, 0, PI * 2, true);
	s.holes.push(h1, h2);
	const g = new THREE.Group();
	mesh(extrudeFlat(s, 0.0009, 0.0002, 24), MAT.alu, g).rotation.y = 0.7;
	return g;
};

B.phone = () => {
	const g = new THREE.Group();
	mesh(slab(0.072, 0.148, 0.0085, 0.009), std({ color: 0x2b2d31, metalness: 0.6, roughness: 0.3 }), g);
	const scr = canvasTex(256, 512, (c, w, h) => {
		const gr = c.createLinearGradient(0, 0, 0, h);
		gr.addColorStop(0, "#1c2b4a");
		gr.addColorStop(1, "#4a2a5a");
		c.fillStyle = gr;
		c.fillRect(0, 0, w, h);
		c.fillStyle = "#fff";
		c.textAlign = "center";
		c.font = "bold 64px sans-serif";
		c.fillText("9:41", w / 2, 120);
		c.fillStyle = "rgba(255,255,255,0.85)";
		c.beginPath();
		c.roundRect(18, 190, w - 36, 92, 18);
		c.fill();
		c.fillStyle = "#222";
		c.font = "bold 22px sans-serif";
		c.textAlign = "left";
		c.fillText("Mom", 36, 228);
		c.font = "20px sans-serif";
		c.fillText("47 missed calls", 36, 260);
	});
	const s = mesh(new THREE.PlaneGeometry(0.066, 0.141), std({ map: scr, emissiveMap: scr, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.06 }), g);
	s.rotation.x = -PI / 2;
	s.position.y = 0.0044;
	g.rotation.y = -0.5;
	return g;
};

B.cap = () => {
	const g = new THREE.Group();
	const top = canvasTex(128, 128, (c, w, h) => {
		c.fillStyle = "#c81e1e";
		c.fillRect(0, 0, w, h);
		c.fillStyle = "#fff";
		c.font = "bold 30px Georgia, serif";
		c.textAlign = "center";
		c.fillText("FIZZ", 64, 76);
	});
	let skirt = new THREE.CylinderGeometry(0.0145, 0.0155, 0.006, 63, 2, true);
	skirt = displace(skirt, (v) => {
		const a = Math.atan2(v.z, v.x);
		const k = 1 + 0.07 * Math.max(0, Math.cos(a * 21)) * (0.5 - v.y / 0.006);
		v.x *= k;
		v.z *= k;
	});
	mesh(skirt, std({ color: 0xb02020, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }), g).position.y = 0.003;
	const disc = mesh(new THREE.CircleGeometry(0.0145, 40), std({ map: top, metalness: 0.5, roughness: 0.32 }), g);
	disc.rotation.x = -PI / 2;
	disc.position.y = 0.006;
	g.rotation.set(0.25, 0.4, 0.1);
	return g;
};

B.can = () => {
	const g = new THREE.Group();
	const label = canvasTex(512, 256, (c, w, h) => {
		const gr = c.createLinearGradient(0, 0, w, 0);
		gr.addColorStop(0, "#0d7a3e");
		gr.addColorStop(0.5, "#16a85a");
		gr.addColorStop(1, "#0d7a3e");
		c.fillStyle = gr;
		c.fillRect(0, 0, w, h);
		c.fillStyle = "#fff6d0";
		c.font = "italic bold 90px Georgia, serif";
		c.fillText("Lymon", 60, 160);
		c.fillStyle = "rgba(255,255,255,0.6)";
		c.font = "bold 22px sans-serif";
		c.fillText("DISCONTINUED FLAVOR · 5¢ DEPOSIT", 40, 225);
	});
	let body = new THREE.CylinderGeometry(0.033, 0.033, 0.115, 40, 12, true);
	body = displace(body, (v) => {
		const a = Math.atan2(v.z, v.x);
		const dent = Math.exp(-Math.pow((v.y + 0.01) / 0.025, 2)) * (0.5 + 0.5 * Math.cos(a * 3 + 1)) * 0.22;
		v.x *= 1 - dent;
		v.z *= 1 - dent * 1.4;
	});
	mesh(body, std({ map: label, metalness: 0.55, roughness: 0.32 }), g);
	const lid = new THREE.LatheGeometry([[0, 0.0], [0.024, 0.0], [0.026, 0.004], [0.028, 0.006], [0.029, 0.004], [0.033, -0.004]].map((p) => new THREE.Vector2(p[0], p[1])), 40);
	mesh(lid, MAT.alu, g).position.y = 0.0575;
	const base = mesh(new THREE.CylinderGeometry(0.033, 0.026, 0.008, 40), MAT.alu, g);
	base.position.y = -0.061;
	g.rotation.z = PI / 2;
	g.rotation.y = 0.6;
	return g;
};

B.trophy = () => {
	const g = new THREE.Group();
	const cup = new THREE.LatheGeometry([[0.004, 0.0], [0.012, 0.004], [0.006, 0.02], [0.005, 0.04], [0.012, 0.048], [0.028, 0.062], [0.034, 0.09], [0.035, 0.105], [0.033, 0.106], [0.031, 0.092]].map((p) => new THREE.Vector2(p[0], p[1])), 48);
	const m = std({ color: lin(1.0, 0.77, 0.34), metalness: 1, roughness: 0.28, side: THREE.DoubleSide });
	mesh(cup, m, g).position.y = 0.022;
	for (const s of [-1, 1]) {
		const h = mesh(new THREE.TorusGeometry(0.014, 0.0025, 8, 20, PI * 1.1), m, g);
		h.position.set(s * 0.036, 0.105, 0);
		h.rotation.z = s > 0 ? -PI * 0.55 : PI * 1.45;
	}
	mesh(slab(0.05, 0.05, 0.022, 0.003), std({ color: 0x15130f, roughness: 0.3 }), g).position.y = 0.011;
	const plate = mesh(new THREE.PlaneGeometry(0.03, 0.012), m, g);
	plate.position.set(0, 0.011, 0.0252);
	g.rotation.set(-PI / 2 + 0.05, 0, 0.6);
	return g;
};

B.watch = () => {
	const g = new THREE.Group();
	const dial = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#f2efe6";
		c.fillRect(0, 0, w, h);
		c.translate(128, 128);
		c.fillStyle = "#222";
		for (let i = 0; i < 12; i++) {
			c.save();
			c.rotate(i * PI / 6);
			c.fillRect(-3, -112, 6, i % 3 ? 14 : 24);
			c.restore();
		}
		c.lineCap = "round";
		c.strokeStyle = "#111";
		c.lineWidth = 9;
		c.beginPath();
		c.moveTo(0, 0);
		c.lineTo(Math.sin(4.3) * 60, -Math.cos(4.3) * 60);
		c.stroke();
		c.lineWidth = 6;
		c.beginPath();
		c.moveTo(0, 0);
		c.lineTo(Math.sin(1.1) * 92, -Math.cos(1.1) * 92);
		c.stroke();
		c.strokeStyle = "#c22";
		c.lineWidth = 2;
		c.beginPath();
		c.moveTo(0, 20);
		c.lineTo(Math.sin(2.7) * 100, -Math.cos(2.7) * 100);
		c.stroke();
	});
	const cs = mesh(cyl(0.02, 0.019, 0.009, 48), MAT.steel, g);
	cs.position.y = 0.0045;
	const bezel = mesh(new THREE.TorusGeometry(0.0182, 0.0016, 10, 48), MAT.chrome, g);
	bezel.rotation.x = PI / 2;
	bezel.position.y = 0.009;
	const face = mesh(new THREE.CircleGeometry(0.0172, 48), phys({ map: dial, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.03 }), g);
	face.rotation.x = -PI / 2;
	face.position.y = 0.0092;
	const crown = mesh(cyl(0.0025, 0.0025, 0.004, 12), MAT.steel, g);
	crown.rotation.z = PI / 2;
	crown.position.set(0.021, 0.0045, 0);
	const leather = std({ color: 0x4a2a16, roughness: 0.7 });
	for (const s of [-1, 1]) {
		const st = mesh(slab(0.019, 0.055, 0.003, 0.004), leather, g);
		st.position.set(0, 0.0015, s * 0.045);
		st.rotation.x = s * 0.06;
	}
	return g;
};

B.ring = () => {
	const g = new THREE.Group();
	const band = mesh(new THREE.TorusGeometry(0.0095, 0.0018, 16, 64), MAT.gold, g);
	band.scale.z = 1.25;
	const gem = mesh(new THREE.OctahedronGeometry(0.0036, 0), phys({ color: 0xffffff, roughness: 0, metalness: 0, ior: 2.4, envMapIntensity: 4, iridescence: 0.4, specularIntensity: 1 }), g);
	gem.position.y = 0.0122;
	gem.scale.y = 0.75;
	for (let i = 0; i < 4; i++) {
		const pr = mesh(cyl(0.0006, 0.0006, 0.004, 6), MAT.gold, g);
		const a = i * PI / 2 + PI / 4;
		pr.position.set(Math.cos(a) * 0.0028, 0.0115, Math.sin(a) * 0.0028);
	}
	g.rotation.set(PI / 2 - 0.2, 0, 0.3);
	return g;
};

B.compass = () => {
	const g = new THREE.Group();
	const rose = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#efe4c8";
		c.fillRect(0, 0, w, h);
		c.translate(128, 128);
		c.strokeStyle = "#5b4a2e";
		c.lineWidth = 2;
		c.beginPath();
		c.arc(0, 0, 100, 0, 7);
		c.stroke();
		for (let i = 0; i < 32; i++) {
			c.save();
			c.rotate(i * PI / 16);
			c.fillStyle = "#5b4a2e";
			c.fillRect(-1, -100, 2, i % 4 ? 8 : 16);
			c.restore();
		}
		c.fillStyle = "#3a2c18";
		c.font = "bold 30px Georgia, serif";
		c.textAlign = "center";
		c.textBaseline = "middle";
		[["N", 0], ["E", 1], ["S", 2], ["W", 3]].forEach(([t, i]) => {
			c.fillText(t, Math.sin(i * PI / 2) * 72, -Math.cos(i * PI / 2) * 72);
		});
	});
	const body = mesh(cyl(0.026, 0.026, 0.012, 48), MAT.brass, g);
	body.position.y = 0.006;
	const face = mesh(new THREE.CircleGeometry(0.022, 48), phys({ map: rose, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.02 }), g);
	face.rotation.x = -PI / 2;
	face.position.y = 0.0121;
	const needle = new THREE.Group();
	needle.position.y = 0.0128;
	needle.rotation.y = 2.4;
	g.add(needle);
	const n1 = mesh(new THREE.ConeGeometry(0.0024, 0.016, 4), std({ color: 0xb01818, roughness: 0.4 }), needle);
	n1.rotation.x = PI / 2;
	n1.position.z = -0.008;
	n1.scale.y = 1;
	const n2 = mesh(new THREE.ConeGeometry(0.0024, 0.016, 4), std({ color: 0xdddddd, roughness: 0.4 }), needle);
	n2.rotation.x = -PI / 2;
	n2.position.z = 0.008;
	const loop = mesh(new THREE.TorusGeometry(0.006, 0.0015, 8, 20), MAT.brass, g);
	loop.position.set(0, 0.006, -0.03);
	loop.rotation.x = PI / 2;
	return g;
};

B.spoon = () => {
	const g = new THREE.Group();
	const m = std({ color: lin(0.86, 0.85, 0.82), metalness: 1, roughness: 0.26, side: THREE.DoubleSide });
	const bowl = new THREE.SphereGeometry(0.02, 32, 16, 0, PI * 2, PI * 0.55, PI * 0.45);
	const bm = mesh(bowl, m, g);
	bm.scale.set(0.85, 0.35, 1.3);
	bm.position.set(0, 0.007, -0.04);
	const hs = new THREE.Shape();
	hs.moveTo(-0.003, -0.02);
	hs.lineTo(0.003, -0.02);
	hs.quadraticCurveTo(0.004, 0.05, 0.008, 0.075);
	hs.quadraticCurveTo(0.0, 0.088, -0.008, 0.075);
	hs.quadraticCurveTo(-0.004, 0.05, -0.003, -0.02);
	const hm = mesh(extrudeFlat(hs, 0.0022, 0.0006, 16), m, g);
	hm.rotation.y = PI;
	hm.position.set(0, 0.004, 0.025);
	g.rotation.y = 0.8;
	return g;
};

B.quarter = () => {
	const g = new THREE.Group();
	g.add(coin(0.0121, 0.00175, MAT.nickel, TEX_QUARTER, true));
	g.rotation.set(0.15, 0.5, 0);
	return g;
};

B.dollar = () => {
	const g = new THREE.Group();
	g.add(coin(0.019, 0.0024, MAT.tarnish, TEX_DOLLAR, true));
	g.rotation.set(-0.1, 1.2, 0.05);
	return g;
};

B.doubloon = () => {
	const g = new THREE.Group();
	srand(11);
	for (let i = 0; i < 6; i++) {
		const c = coin(0.017, 0.0022, MAT.gold, TEX_DOUBLOON, false, i + 1);
		c.position.set(rr(-0.02, 0.02), 0.0012 + i * 0.0018, rr(-0.02, 0.02));
		c.rotation.set(rr(-0.15, 0.15), rr(0, 6), rr(-0.15, 0.15));
		g.add(c);
	}
	return g;
};

B.crown = () => {
	const g = new THREE.Group();
	const m = std({ color: lin(1.0, 0.77, 0.34), metalness: 1, roughness: 0.22, side: THREE.DoubleSide });
	let band = new THREE.CylinderGeometry(0.05, 0.045, 0.06, 80, 8, true);
	band = displace(band, (v) => {
		const a = Math.atan2(v.z, v.x);
		const t = (v.y + 0.03) / 0.06;
		const spike = Math.pow(Math.abs(Math.cos(a * 4)), 3);
		v.y = -0.03 + t * (0.035 + 0.045 * spike);
	});
	mesh(band, m, g).position.y = 0.03;
	const rimG = new THREE.TorusGeometry(0.046, 0.004, 10, 64);
	const rim = mesh(rimG, m, g);
	rim.rotation.x = PI / 2;
	rim.position.y = 0.004;
	const velvet = mesh(new THREE.SphereGeometry(0.044, 32, 16, 0, PI * 2, 0, PI / 2), std({ color: 0x7a0f1c, roughness: 0.9 }), g);
	velvet.scale.y = 0.9;
	velvet.position.y = 0.01;
	const gems = [phys({ color: 0xc8102e, roughness: 0.05, clearcoat: 1 }), phys({ color: 0x1d4fd8, roughness: 0.05, clearcoat: 1 }), phys({ color: 0x0f9d58, roughness: 0.05, clearcoat: 1 })];
	for (let i = 0; i < 8; i++) {
		const a = i * PI / 4;
		const gm = mesh(new THREE.SphereGeometry(0.0055, 16, 12), gems[i % 3], g);
		gm.position.set(Math.cos(a) * 0.049, 0.026, Math.sin(a) * 0.049);
		gm.scale.set(1, 1.2, 0.6);
		gm.lookAt(0, 0.026, 0);
		const pearl = mesh(new THREE.SphereGeometry(0.0045, 12, 10), phys({ color: 0xf6f1e8, roughness: 0.2, iridescence: 1 }), g);
		const pa = a + PI / 8 * 0;
		pearl.position.set(Math.cos(pa) * 0.047, 0.083, Math.sin(pa) * 0.047);
	}
	const orb = mesh(new THREE.SphereGeometry(0.01, 20, 14), m, g);
	orb.position.y = 0.065;
	const cross1 = mesh(new THREE.BoxGeometry(0.004, 0.022, 0.004), m, g);
	cross1.position.y = 0.083;
	const cross2 = mesh(new THREE.BoxGeometry(0.014, 0.004, 0.004), m, g);
	cross2.position.y = 0.086;
	g.rotation.set(0.35, 0.3, 0.2);
	return g;
};

B.ufo = () => {
	const g = new THREE.Group();
	const hull = new THREE.LatheGeometry([[0, -0.012], [0.02, -0.011], [0.045, -0.004], [0.05, 0], [0.045, 0.004], [0.02, 0.008], [0, 0.009]].map((p) => new THREE.Vector2(p[0], p[1])), 64);
	mesh(hull, std({ color: lin(0.8, 0.82, 0.85), metalness: 1, roughness: 0.18 }), g).position.y = 0.012;
	const dome = mesh(new THREE.SphereGeometry(0.018, 32, 16, 0, PI * 2, 0, PI / 2), phys({ color: 0x9fd9ff, roughness: 0.02, transmission: 0, transparent: true, opacity: 0.6, clearcoat: 1 }), g);
	dome.position.y = 0.02;
	const lights = [];
	for (let i = 0; i < 12; i++) {
		const a = i * PI / 6;
		const l = mesh(new THREE.SphereGeometry(0.0022, 10, 8), std({ color: 0x222222, emissive: i % 2 ? 0x55ffb0 : 0xffd25a, emissiveIntensity: 3 }), g);
		l.position.set(Math.cos(a) * 0.043, 0.0125, Math.sin(a) * 0.043);
		lights.push(l);
	}
	g.userData.spin = (t) => lights.forEach((l, i) => { l.material.emissiveIntensity = 1 + 3 * Math.max(0, Math.sin(t * 6 - i * 0.6)); });
	g.rotation.set(0.25, 0, 0.15);
	return g;
};

// not metal
B.flipflop = () => {
	const g = new THREE.Group();
	const s = new THREE.Shape();
	s.moveTo(0, -0.12);
	s.bezierCurveTo(0.038, -0.12, 0.04, -0.07, 0.034, -0.03);
	s.bezierCurveTo(0.03, 0.0, 0.05, 0.05, 0.045, 0.09);
	s.bezierCurveTo(0.04, 0.13, -0.035, 0.135, -0.044, 0.09);
	s.bezierCurveTo(-0.05, 0.05, -0.03, 0.0, -0.034, -0.04);
	s.bezierCurveTo(-0.038, -0.09, -0.036, -0.12, 0, -0.12);
	const sole = mesh(extrudeFlat(s, 0.014, 0.003, 24), [std({ color: 0x2176c7, roughness: 0.75 }), std({ color: 0xe8e2d4, roughness: 0.8 })], g);
	sole.position.y = 0.007;
	const strapM = std({ color: 0x1a4f8a, roughness: 0.5 });
	for (const sx of [-1, 1]) {
		const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0.002, 0.014, 0.075), new THREE.Vector3(sx * 0.02, 0.03, 0.035), new THREE.Vector3(sx * 0.036, 0.016, -0.005), new THREE.Vector3(sx * 0.036, 0.013, -0.02)]);
		mesh(new THREE.TubeGeometry(c, 24, 0.0035, 8), strapM, g).scale.set(1, 1, 1);
	}
	g.rotation.y = 0.9;
	return g;
};

const SCALLOP_TEX = bandTex(["#f3c9a4", "#c96a3c", "160,70,30", "255,235,210"], 6, 30, 5);
B.scallop = () => {
	const g = new THREE.Group();
	mesh(scallopGeo(0.07, 20), std({ map: SCALLOP_TEX, roughness: 0.55, side: THREE.DoubleSide }), g);
	for (const s of [-1, 1]) {
		const ear = mesh(new THREE.ConeGeometry(0.009, 0.012, 3), std({ map: SCALLOP_TEX, roughness: 0.6 }), g);
		ear.rotation.set(PI / 2, 0, s * 0.8);
		ear.scale.y = 0.3;
		ear.position.set(s * 0.008, 0.002, -0.033);
	}
	g.rotation.y = -0.5;
	return g;
};

const SNAIL_TEX = bandTex(["#efe3cf", "#b7987a", "120,90,60", "90,60,40"], 3, 12, 9);
B.moonsnail = () => {
	const g = new THREE.Group();
	const sh = mesh(spiralGeo(3.3, 0.0012, 0.0012, 0.0006, 22, true), std({ map: SNAIL_TEX, roughness: 0.35, side: THREE.DoubleSide }), g);
	sh.rotation.x = -PI / 2 - 0.4;
	sh.position.y = 0.02;
	return g;
};

B.seaglass = () => {
	const g = new THREE.Group();
	const geo = lump(0.016, 3, 0.35, 70, 3);
	geo.scale(1.3, 0.38, 0.9);
	const m = phys({ color: 0x5fbf86, roughness: 0.6, metalness: 0, transparent: true, opacity: 0.88, sheen: 1, sheenColor: 0xbfffe0, sheenRoughness: 0.6, emissive: 0x0b2a18 });
	mesh(geo, m, g).position.y = 0.006;
	return g;
};

const DOLLAR_TEX = canvasTex(256, 256, (c, w, h) => {
	c.fillStyle = "#e9e1cf";
	c.fillRect(0, 0, w, h);
	c.translate(128, 128);
	c.fillStyle = "rgba(120,98,70,0.85)";
	for (let i = 0; i < 5; i++) {
		c.save();
		c.rotate(i * PI * 2 / 5);
		c.beginPath();
		c.ellipse(0, -48, 13, 38, 0, 0, 7);
		c.fill();
		c.restore();
	}
	srand(4);
	for (let i = 0; i < 500; i++) { c.fillStyle = "rgba(120,100,80,0.25)"; c.fillRect(rr(-128, 128), rr(-128, 128), 2, 2); }
});
B.sanddollar = () => {
	const g = new THREE.Group();
	const geo = new THREE.SphereGeometry(0.04, 48, 16);
	geo.scale(1, 0.12, 1);
	mesh(geo, std({ map: DOLLAR_TEX, bumpMap: DOLLAR_TEX, bumpScale: 2, roughness: 0.8 }), g).position.y = 0.004;
	return g;
};

B.tooth = () => {
	const g = new THREE.Group();
	const s = new THREE.Shape();
	s.moveTo(-0.014, 0);
	s.quadraticCurveTo(-0.006, 0.012, 0.002, 0.034);
	s.quadraticCurveTo(0.006, 0.014, 0.014, 0);
	s.quadraticCurveTo(0.0, -0.006, -0.014, 0);
	const m = std({ color: 0x23211f, roughness: 0.25 });
	mesh(extrudeFlat(s, 0.006, 0.0022, 16), m, g).position.y = 0.003;
	const root = mesh(slab(0.03, 0.009, 0.0068, 0.003), std({ color: 0x5a4632, roughness: 0.7 }), g);
	root.position.set(0, 0.0034, 0.015);
	g.rotation.y = 0.4;
	return g;
};

B.rock = () => {
	const g = new THREE.Group();
	const geo = lump(0.035, 3, 0.4, 40, 8);
	// squash it into something very roughly Ohio-shaped
	displace(geo, (v) => {
		v.y *= 0.45;
		if (v.x > 0 && v.z > 0) v.x *= 0.85;
		v.z *= 1.1;
	});
	mesh(geo, std({ map: speckleTex("#8f8a83", ["rgba(60,58,55,0.6)", "rgba(200,196,188,0.6)", "rgba(120,100,80,0.4)"], 12), roughness: 0.85 }), g).position.y = 0.014;
	return g;
};

B.duck = () => {
	const g = new THREE.Group();
	const y = std({ color: 0xffcc1a, roughness: 0.38 });
	const body = mesh(new THREE.SphereGeometry(0.035, 32, 20), y, g);
	body.scale.set(1, 0.75, 1.25);
	body.position.y = 0.026;
	const head = mesh(new THREE.SphereGeometry(0.022, 28, 18), y, g);
	head.position.set(0, 0.06, 0.024);
	const beak = mesh(new THREE.SphereGeometry(0.01, 16, 10), std({ color: 0xff6a10, roughness: 0.4 }), g);
	beak.scale.set(1.1, 0.45, 1.3);
	beak.position.set(0, 0.056, 0.046);
	for (const s of [-1, 1]) {
		const e = mesh(new THREE.SphereGeometry(0.0032, 12, 8), std({ color: 0x0a0a0a, roughness: 0.1 }), g);
		e.position.set(s * 0.012, 0.067, 0.04);
	}
	const tail = mesh(new THREE.ConeGeometry(0.012, 0.02, 12), y, g);
	tail.rotation.x = -PI * 0.65;
	tail.position.set(0, 0.04, -0.045);
	g.rotation.set(0.5, -0.7, 0.4);
	return g;
};

B.shades = () => {
	const g = new THREE.Group();
	const frameM = std({ color: 0x111111, roughness: 0.3 });
	const lensM = std({ color: 0x0a0a0c, roughness: 0.04, metalness: 0.5 });
	for (const s of [-1, 1]) {
		const ls = roundRect(0.05, 0.038, 0.016);
		const lens = mesh(extrudeFlat(ls, 0.003, 0.001, 16), lensM, g);
		lens.position.set(s * 0.032, 0.0015, 0);
		const fr = mesh(new THREE.TorusGeometry(0.024, 0.0022, 6, 32), frameM, g);
		fr.rotation.x = PI / 2;
		fr.scale.set(1.08, 0.82, 1);
		fr.position.set(s * 0.032, 0.002, 0);
		const arm = mesh(new THREE.BoxGeometry(0.004, 0.003, 0.12), frameM, g);
		arm.position.set(s * 0.055, 0.006, -0.03);
		arm.rotation.y = s * 0.9;
	}
	const bridge = mesh(new THREE.BoxGeometry(0.016, 0.003, 0.004), frameM, g);
	bridge.position.set(0, 0.003, 0.012);
	g.rotation.y = 0.3;
	return g;
};

B.bottle = () => {
	const g = new THREE.Group();
	const prof = [[0, 0], [0.03, 0], [0.032, 0.004], [0.032, 0.11], [0.028, 0.13], [0.013, 0.155], [0.011, 0.19], [0.0125, 0.195], [0.0125, 0.2]].map((p) => new THREE.Vector2(p[0], p[1]));
	const glass = mesh(new THREE.LatheGeometry(prof, 48), phys({ color: 0x3c8a5a, roughness: 0.12, transparent: true, opacity: 0.45, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), g);
	glass.castShadow = false;
	const cork = mesh(cyl(0.0105, 0.0095, 0.022, 20), std({ color: 0xb08a5a, roughness: 0.95 }), g);
	cork.position.y = 0.2;
	const paper = mesh(cyl(0.012, 0.012, 0.09, 20), std({ color: 0xe8dcc0, roughness: 0.9 }), g);
	paper.position.y = 0.055;
	const tie = mesh(new THREE.TorusGeometry(0.0123, 0.0012, 6, 24), std({ color: 0x9a2a1f, roughness: 0.7 }), g);
	tie.rotation.x = PI / 2;
	tie.position.y = 0.055;
	g.rotation.set(0, 0.5, PI / 2);
	return g;
};

B.oyster = () => {
	const g = new THREE.Group();
	const out = std({ color: 0x8c877c, roughness: 0.9, map: rustTex });
	const nacre = phys({ color: 0xe9e6e0, roughness: 0.2, iridescence: 1, iridescenceIOR: 1.6, side: THREE.DoubleSide });
	const mk = (s) => {
		const geo = lump(0.04, 3, 0.25, 30, s);
		geo.scale(1, 0.22, 0.75);
		return geo;
	};
	mesh(mk(2), out, g).position.y = 0.005;
	const inner = mesh(new THREE.SphereGeometry(0.034, 32, 12, 0, PI * 2, 0, PI / 2), nacre, g);
	inner.scale.set(1, 0.12, 0.72);
	inner.rotation.x = PI;
	inner.position.y = 0.012;
	const top = mesh(mk(5), out, g);
	top.position.set(0, 0.02, -0.018);
	top.rotation.x = -0.6;
	const pearl = mesh(new THREE.SphereGeometry(0.008, 24, 16), phys({ color: 0xfbf7f0, roughness: 0.15, iridescence: 1, sheen: 1, sheenColor: 0xffe6f0 }), g);
	pearl.position.set(0.005, 0.016, 0.006);
	pearl.scale.set(1, 0.92, 1.05);
	return g;
};

B.shovel = () => {
	const g = new THREE.Group();
	const red = std({ color: 0xe8301c, roughness: 0.45, side: THREE.DoubleSide });
	const blade = new THREE.SphereGeometry(0.06, 24, 12, 0, PI * 2, 0, PI * 0.32);
	const bm = mesh(blade, red, g);
	bm.scale.set(0.9, 0.5, 1.2);
	bm.rotation.x = PI;
	bm.position.set(0, 0.022, 0.05);
	const handle = mesh(cyl(0.0065, 0.0065, 0.15, 12), red, g);
	handle.rotation.x = PI / 2 - 0.12;
	handle.position.set(0, 0.016, -0.03);
	const gr = mesh(new THREE.TorusGeometry(0.014, 0.005, 8, 20), red, g);
	gr.position.set(0, 0.024, -0.112);
	gr.rotation.x = PI / 2 - 0.12;
	g.rotation.y = -0.4;
	return g;
};

// ---------- critters ----------
function legSet(g, mat, count, xr, zs, len1, len2, rad) {
	const legs = [];
	for (const side of [-1, 1]) {
		for (let i = 0; i < count; i++) {
			const hip = new THREE.Group();
			hip.position.set(side * xr, 0, zs[i]);
			g.add(hip);
			const up = new THREE.Group();
			hip.add(up);
			up.rotation.z = side * 0.5;
			up.rotation.y = side * (0.35 - i * 0.25);
			const s1 = mesh(cyl(rad, rad * 0.8, len1, 6), mat, up);
			s1.rotation.z = side * -PI / 2;
			s1.position.x = side * len1 / 2;
			const knee = new THREE.Group();
			knee.position.x = side * len1;
			up.add(knee);
			knee.rotation.z = side * -1.9;
			const s2 = mesh(cyl(rad * 0.8, rad * 0.35, len2, 6), mat, knee);
			s2.rotation.z = side * -PI / 2;
			s2.position.x = side * len2 / 2;
			legs.push({ up, knee, side, i, phase: i * 1.6 + (side > 0 ? PI : 0) });
		}
	}
	return legs;
}

function crabFront(g, mat, scale, eyeY, eyeZ) {
	const eyeM = std({ color: 0x0a0a0a, roughness: 0.15 });
	for (const s of [-1, 1]) {
		const st = mesh(cyl(0.0016 * scale, 0.0016 * scale, 0.012 * scale, 6), mat, g);
		st.position.set(s * 0.01 * scale, eyeY + 0.005 * scale, eyeZ);
		st.rotation.z = s * -0.25;
		const ey = mesh(new THREE.SphereGeometry(0.0034 * scale, 10, 8), eyeM, g);
		ey.position.set(s * 0.0115 * scale, eyeY + 0.011 * scale, eyeZ);
	}
	const claws = [];
	for (const s of [-1, 1]) {
		const big = s > 0 ? 1.35 : 1;
		const arm = new THREE.Group();
		arm.position.set(s * 0.02 * scale, eyeY - 0.004 * scale, eyeZ - 0.004 * scale);
		g.add(arm);
		const a1 = mesh(cyl(0.0028 * scale, 0.0025 * scale, 0.018 * scale, 6), mat, arm);
		a1.rotation.x = PI / 2;
		a1.rotation.z = s * 0.7;
		a1.position.set(s * 0.005 * scale, 0, 0.007 * scale);
		const claw = mesh(new THREE.SphereGeometry(0.0065 * scale * big, 14, 10), mat, arm);
		claw.scale.set(0.8, 0.7, 1.35);
		claw.position.set(s * 0.011 * scale, 0.002 * scale, 0.017 * scale);
		const pin = mesh(new THREE.ConeGeometry(0.0022 * scale * big, 0.011 * scale * big, 6), mat, arm);
		pin.rotation.x = PI / 2;
		pin.position.set(s * 0.012 * scale, 0.003 * scale, 0.029 * scale * big);
		claws.push(arm);
	}
	return claws;
}

function speckleTex(base, dots, s) {
	return canvasTex(128, 128, (c, w, h) => {
		c.fillStyle = base;
		c.fillRect(0, 0, w, h);
		srand(s);
		for (let i = 0; i < 260; i++) {
			c.fillStyle = dots[i % dots.length];
			c.beginPath();
			c.arc(rnd() * w, rnd() * h, rr(0.6, 2.4), 0, 7);
			c.fill();
		}
	});
}

const C = {};

C.crab = () => {
	const g = new THREE.Group();
	const body = new THREE.Group();
	g.add(body);
	const m = std({ map: speckleTex("#d8c7a6", ["rgba(120,95,60,0.6)", "rgba(240,230,210,0.7)"], 3), roughness: 0.55 });
	const shell = new THREE.SphereGeometry(1, 28, 18);
	displace(shell, (v) => { v.x *= 1 + 0.18 * Math.max(0, v.z); });
	const sm = mesh(shell, m, body);
	sm.scale.set(0.022, 0.011, 0.018);
	body.position.y = 0.02;
	const legs = legSet(body, m, 4, 0.017, [0.007, 0.0, -0.007, -0.013], 0.022, 0.028, 0.0019);
	const claws = crabFront(body, m, 1, 0.003, 0.016);
	g.userData.animate = (t, speed) => {
		legs.forEach((L) => {
			const ph = t * 22 * speed + L.phase;
			L.up.rotation.z = L.side * (0.5 + Math.sin(ph) * 0.3 * speed);
			L.up.rotation.x = Math.cos(ph) * 0.25 * speed;
		});
		claws.forEach((c, i) => { c.rotation.y = Math.sin(t * 6 + i) * 0.2; });
		body.position.y = 0.02 + Math.abs(Math.sin(t * 22 * speed)) * 0.002 * speed;
	};
	g.userData.facing = PI / 2; // runs sideways
	return g;
};

C.hermit = () => {
	const g = new THREE.Group();
	const sh = mesh(spiralGeo(4.2, 0.0011, 0.0009, 0.0014, 16, true), std({ map: SNAIL_TEX, roughness: 0.4, side: THREE.DoubleSide }), g);
	sh.rotation.set(-PI / 2 + 0.3, 0, PI);
	sh.position.set(0, 0.016, -0.004);
	const m = std({ map: speckleTex("#b5462c", ["rgba(250,200,160,0.6)", "rgba(90,30,20,0.6)"], 5), roughness: 0.5 });
	const front = new THREE.Group();
	front.position.set(0, 0.011, 0.012);
	g.add(front);
	const legs = legSet(front, m, 2, 0.008, [0.002, -0.004], 0.012, 0.016, 0.0016);
	crabFront(front, m, 0.75, 0.003, 0.008);
	g.userData.animate = (t, speed) => {
		legs.forEach((L) => {
			const ph = t * 16 * speed + L.phase;
			L.up.rotation.z = L.side * (0.5 + Math.sin(ph) * 0.35 * speed);
			L.up.rotation.x = Math.cos(ph) * 0.3 * speed;
		});
		g.children[0].rotation.z = PI + Math.sin(t * 16 * speed) * 0.05 * speed;
	};
	g.userData.facing = 0;
	return g;
};

C.sandcrab = () => {
	const g = new THREE.Group();
	const m = std({ map: speckleTex("#a59a86", ["rgba(70,65,55,0.5)", "rgba(220,210,190,0.5)"], 8), roughness: 0.45 });
	const b = mesh(new THREE.SphereGeometry(1, 24, 16), m, g);
	b.scale.set(0.011, 0.008, 0.018);
	b.position.y = 0.008;
	const legs = legSet(g, m, 3, 0.008, [0.004, -0.002, -0.008], 0.008, 0.008, 0.0012);
	legs.forEach((L) => { L.up.parent.position.y = 0.006; });
	for (const s of [-1, 1]) {
		const ant = mesh(cyl(0.0004, 0.0002, 0.022, 4), m, g);
		ant.position.set(s * 0.004, 0.014, 0.022);
		ant.rotation.x = 0.9;
		ant.rotation.z = s * 0.3;
	}
	g.userData.animate = (t, speed) => {
		legs.forEach((L) => { L.up.rotation.x = Math.sin(t * 30 + L.phase) * 0.5 * speed; });
	};
	g.userData.facing = 0;
	return g;
};

C.worm = () => {
	const g = new THREE.Group();
	const m = std({ color: 0x7a2e22, roughness: 0.3 });
	const segs = [];
	for (let i = 0; i < 16; i++) {
		const r = 0.0042 * (1 - Math.pow(i / 16, 2) * 0.55);
		const s = mesh(new THREE.SphereGeometry(r, 12, 8), i > 10 ? std({ color: 0x9a6a4a, roughness: 0.4 }) : m, g);
		s.scale.z = 1.4;
		segs.push(s);
	}
	g.userData.animate = (t, speed) => {
		segs.forEach((s, i) => {
			const z = 0.025 - i * 0.0048;
			s.position.set(Math.sin(t * 7 - i * 0.6) * 0.007 * (0.4 + speed), 0.004, z);
		});
	};
	g.userData.animate(0, 1);
	g.userData.facing = 0;
	return g;
};

const SCUTE_TEX = canvasTex(256, 256, (c, w, h) => {
	c.fillStyle = "#3d3a26";
	c.fillRect(0, 0, w, h);
	c.strokeStyle = "rgba(200,190,150,0.55)";
	c.lineWidth = 4;
	for (let y = 0; y < 5; y++) {
		for (let x = 0; x < 5; x++) {
			const cx = x * 56 + (y % 2) * 28, cy = y * 52 + 20;
			c.beginPath();
			for (let k = 0; k < 6; k++) {
				const a = k * PI / 3;
				c.lineTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 26);
			}
			c.closePath();
			c.stroke();
		}
	}
});
C.turtle = () => {
	const g = new THREE.Group();
	const skin = std({ color: 0x3a3a34, roughness: 0.55 });
	const shell = mesh(new THREE.SphereGeometry(1, 28, 16, 0, PI * 2, 0, PI / 2), std({ map: SCUTE_TEX, roughness: 0.4 }), g);
	shell.scale.set(0.024, 0.011, 0.03);
	shell.position.y = 0.006;
	const belly = mesh(new THREE.CircleGeometry(1, 28), std({ color: 0xc9bb98, roughness: 0.7 }), g);
	belly.rotation.x = PI / 2;
	belly.scale.set(0.023, 0.029, 1);
	belly.position.y = 0.0058;
	const head = mesh(new THREE.SphereGeometry(0.0085, 16, 12), skin, g);
	head.scale.set(0.9, 0.8, 1.2);
	head.position.set(0, 0.009, 0.036);
	for (const s of [-1, 1]) {
		const e = mesh(new THREE.SphereGeometry(0.0018, 8, 6), std({ color: 0x050505, roughness: 0.1 }), g);
		e.position.set(s * 0.0055, 0.011, 0.04);
	}
	const fl = [];
	for (const s of [-1, 1]) {
		for (const fz of [0.016, -0.022]) {
			const p = new THREE.Group();
			p.position.set(s * 0.02, 0.006, fz);
			g.add(p);
			const big = fz > 0 ? 1 : 0.55;
			const f = mesh(new THREE.SphereGeometry(1, 12, 8), skin, p);
			f.scale.set(0.022 * big, 0.002, 0.008 * big);
			f.position.x = s * 0.018 * big;
			f.rotation.y = s * (fz > 0 ? -0.5 : 0.6);
			fl.push({ p, s, front: fz > 0 });
		}
	}
	g.userData.animate = (t, speed) => {
		fl.forEach((F) => {
			const ph = t * 5 + (F.front ? 0 : PI);
			F.p.rotation.y = F.s * Math.sin(ph) * 0.6 * speed;
			F.p.rotation.z = F.s * (Math.cos(ph) * 0.3 * speed);
		});
		head.position.z = 0.036 + Math.sin(t * 5) * 0.002;
	};
	g.userData.facing = 0;
	return g;
};

// ---------- decor ----------
export function pebbleGeo(s) { const g = lump(1, 2, 0.35, 2.2, s); g.scale(1, 0.55, 0.8); return g; }

export function seaweedClump(s) {
	srand(s);
	const geos = [];
	const n = 3 + Math.floor(rnd() * 4);
	for (let i = 0; i < n; i++) {
		const pts = [];
		let x = rr(-0.04, 0.04), z = rr(-0.04, 0.04), a = rr(0, 6.28);
		const len = rr(0.08, 0.2);
		for (let k = 0; k < 5; k++) {
			pts.push(new THREE.Vector3(x, 0.003 + rnd() * 0.004, z));
			a += rr(-0.7, 0.7);
			x += Math.cos(a) * len / 4;
			z += Math.sin(a) * len / 4;
		}
		const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, rr(0.006, 0.012), 6);
		tg.scale(1, 0.28, 1);
		geos.push(tg);
	}
	for (let i = 0; i < 14; i++) {
		const b = new THREE.SphereGeometry(rr(0.004, 0.007), 8, 6);
		b.translate(rr(-0.08, 0.08), 0.004, rr(-0.08, 0.08));
		geos.push(b);
	}
	geos.forEach((gg) => { if (gg.attributes.uv) gg.deleteAttribute("uv"); });
	return mergeGeometries(geos.map((gg) => gg.index ? gg.toNonIndexed() : gg));
}

export function driftwood(s) {
	srand(s);
	const len = rr(0.8, 1.6);
	let g = new THREE.CylinderGeometry(0.05, 0.065, len, 18, 20);
	g = displace(g, (v) => {
		const n = noise3(v.x * 30, v.y * 4 + s, v.z * 30);
		const k = 1 + (n - 0.5) * 0.5 + Math.sin(v.y * 9) * 0.04;
		v.x *= k;
		v.z *= k;
		v.x += Math.sin(v.y * 2.4 + s) * 0.04;
	});
	g.rotateZ(PI / 2);
	const bark = canvasTex(256, 64, (c, w, h) => {
		c.fillStyle = "#9c9286";
		c.fillRect(0, 0, w, h);
		for (let i = 0; i < 140; i++) {
			c.strokeStyle = rnd() < 0.5 ? "rgba(90,82,72,0.5)" : "rgba(200,192,180,0.4)";
			c.lineWidth = rr(0.5, 2);
			const y = rnd() * h;
			c.beginPath();
			c.moveTo(0, y);
			c.bezierCurveTo(w * 0.3, y + rr(-6, 6), w * 0.6, y + rr(-6, 6), w, y + rr(-4, 4));
			c.stroke();
		}
	});
	const m = new THREE.Mesh(g, std({ map: bark, roughness: 0.95 }));
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}

export function makeGull() {
	const g = new THREE.Group();
	const white = std({ color: 0xf2f2f0, roughness: 0.8 });
	const grey = std({ color: 0x9ea4aa, roughness: 0.8, side: THREE.DoubleSide });
	const body = mesh(new THREE.SphereGeometry(0.1, 12, 8), white, g);
	body.scale.set(0.7, 0.7, 2.2);
	const head = mesh(new THREE.SphereGeometry(0.06, 10, 8), white, g);
	head.position.set(0, 0.04, 0.2);
	const wings = [];
	for (const s of [-1, 1]) {
		const p = new THREE.Group();
		g.add(p);
		const ws = new THREE.Shape();
		ws.moveTo(0, 0.08);
		ws.lineTo(0.35, 0.05);
		ws.lineTo(0.62, -0.06);
		ws.lineTo(0.3, -0.08);
		ws.lineTo(0, -0.08);
		const wg = new THREE.ShapeGeometry(ws);
		wg.rotateX(-PI / 2);
		if (s < 0) wg.scale(-1, 1, 1);
		mesh(wg, grey, p);
		wings.push({ p, s });
	}
	g.userData.flap = (t) => wings.forEach((w) => { w.p.rotation.z = w.s * Math.sin(t) * 0.5; });
	g.traverse((o) => { o.castShadow = false; });
	return g;
}

export function makeBoat() {
	const g = new THREE.Group();
	const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 7), std({ color: 0xf2f2ee, roughness: 0.5 }));
	hull.position.y = 0.25;
	g.add(hull);
	const sail = new THREE.Shape();
	sail.moveTo(0, 0);
	sail.lineTo(0, 9);
	sail.lineTo(3.5, 0.3);
	const sm = new THREE.Mesh(new THREE.ShapeGeometry(sail), std({ color: 0xf7f6f1, roughness: 0.8, side: THREE.DoubleSide }));
	sm.position.y = 0.6;
	sm.rotation.y = PI / 2 - 0.3;
	g.add(sm);
	const jib = new THREE.Shape();
	jib.moveTo(0, 0);
	jib.lineTo(0, 7.5);
	jib.lineTo(-2.6, 0.2);
	const jm = new THREE.Mesh(new THREE.ShapeGeometry(jib), std({ color: 0xe8e6de, roughness: 0.8, side: THREE.DoubleSide }));
	jm.position.set(0, 0.6, 0.6);
	jm.rotation.y = PI / 2 - 0.3;
	g.add(jm);
	return g;
}

export const ITEM_BUILDERS = B;
export const CRITTER_BUILDERS = C;
