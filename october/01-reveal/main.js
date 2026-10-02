// Beach Detector: Weird Web October, day 1 (Reveal).
// Built on three.js. The sky, sand and sea are custom shaders (shaders.js);
// the detector, finds and critters are modelled in code (models.js).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as S from "./shaders.js";
import { makeDetector, ITEM_BUILDERS, CRITTER_BUILDERS, pebbleGeo, scallopGeo, seaweedClump, driftwood, makeGull, makeBoat } from "./models.js";

// ---------- what's down there ----------
// metal: vdi is the detector's 0-99 target ID (iron low, silver and coins high)
const METAL = [
	{ id: "bolt",     name: "Rusty bolt",       vdi: 6,  value: 0,       tier: "common",    text: "Fell off something important. Probably the pier." },
	{ id: "hook",     name: "Fishhook",         vdi: 9,  value: 0.1,     tier: "common",    text: "Whatever was on the other end got away. Respect." },
	{ id: "anchor",   name: "Tiny anchor",      vdi: 12, value: 3,       tier: "uncommon",  text: "Somewhere out there, a very small boat is drifting away." },
	{ id: "skeleton", name: "Skeleton key",     vdi: 24, value: 15,      tier: "uncommon",  text: "Opens one specific door, in 1887." },
	{ id: "keys",     name: "Car keys",         vdi: 28, value: 0,       tier: "common",    text: "In the parking lot, a Honda waits forever." },
	{ id: "battery",  name: "AA battery",       vdi: 32, value: 0,       tier: "common",    text: "Still 37% charged. That's more than your phone." },
	{ id: "tab",      name: "Pull tab",         vdi: 36, value: 0,       tier: "common",    text: "Detectorists dig about a thousand of these for every ring. Today is one of those days." },
	{ id: "phone",    name: "Someone's phone",  vdi: 39, value: 0,       tier: "uncommon",  text: "47 missed calls from Mom." },
	{ id: "cap",      name: "Bottle cap",       vdi: 42, value: 0,       tier: "common",    text: "Under the cap it says “Sorry, try again.” Fair." },
	{ id: "can",      name: "Soda can",         vdi: 45, value: 0.05,    tier: "common",    text: "Flavor: discontinued. Deposit: 5¢." },
	{ id: "trophy",   name: "Trophy",           vdi: 50, value: 1,       tier: "uncommon",  text: "Sandcastle Contest 2009, 3rd place (out of 3)." },
	{ id: "watch",    name: "Wristwatch",       vdi: 54, value: 35,      tier: "uncommon",  text: "Still ticking. Four hours slow, or twenty hours early." },
	{ id: "ring",     name: "Wedding ring",     vdi: 58, value: 400,     tier: "rare",      text: "Engraved inside: “S + M, forever-ish.”" },
	{ id: "compass",  name: "Brass compass",    vdi: 64, value: 20,      tier: "uncommon",  text: "Points firmly at the snack bar, no matter what." },
	{ id: "spoon",    name: "Silver spoon",     vdi: 74, value: 8,       tier: "common",    text: "Someone was born with this in their mouth, then dropped it." },
	{ id: "quarter",  name: "Quarter",          vdi: 83, value: 0.25,    tier: "common",    text: "1979. George looks tired." },
	{ id: "dollar",   name: "Silver dollar",    vdi: 88, value: 60,      tier: "rare",      text: "1921. Heavy, cold, and somehow still smug about it." },
	{ id: "doubloon", name: "Pirate doubloons", vdi: 95, value: 12000,   tier: "rare",      text: "Arr. (That's the entire note they left.)" },
	{ id: "crown",    name: "Crown",            vdi: 97, value: 50000,   tier: "legendary", text: "Property of the King of This Specific Beach. Long may he tan." },
	{ id: "ufo",      name: "Flying saucer",    vdi: 99, value: 1000000, tier: "legendary", text: "Oh. So that's where it went." }
];
// not metal: the detector can't hear these, you just dig into them
const OTHER = [
	{ id: "flipflop",   name: "Left flip-flop",      value: 0,   tier: "common",   text: "The right one is on a different beach, living its best life." },
	{ id: "scallop",    name: "Scallop shell",       value: 1,   tier: "common",   text: "Perfect, not a chip on it. Somebody's going on the windowsill." },
	{ id: "moonsnail",  name: "Moon snail shell",    value: 2,   tier: "common",   text: "Hold it to your ear. Hear that? It's this website." },
	{ id: "seaglass",   name: "Sea glass",           value: 3,   tier: "common",   text: "Used to be a bottle. Spent forty years in the surf becoming a gem." },
	{ id: "rock",       name: "Rock shaped like Ohio", value: 0, tier: "common",   text: "Uncanny. Cleveland is a little dent." },
	{ id: "sanddollar", name: "Sand dollar",         value: 0,   tier: "uncommon", text: "Not legal tender. We checked." },
	{ id: "shovel",     name: "Toy shovel",          value: 1,   tier: "common",   text: "Abandoned mid-sandcastle. The castle didn't make it either." },
	{ id: "shades",     name: "Sunglasses",          value: 10,  tier: "common",   text: "Still cooler than you." },
	{ id: "duck",       name: "Rubber duck",         value: 2,   tier: "uncommon", text: "Fell off a cargo ship in 1992. Has seen things." },
	{ id: "tooth",      name: "Shark tooth",         value: 15,  tier: "uncommon", text: "Its owner has more. Hundreds more." },
	{ id: "bottle",     name: "Message in a bottle", value: 0,   tier: "rare",     text: "It says: “If you're reading this, I'm out of town. Please water my plants.”" },
	{ id: "oyster",     name: "Oyster",              value: 300, tier: "rare",     text: "There's a pearl inside. It's a bit lumpy. Still counts." }
];
// critters: hiding just under the surface, gone the moment you find them
const CRITTERS = [
	{ id: "crab",     name: "Ghost crab",      tier: "critter", weight: 10, move: "scuttle", speed: 1.0,  text: "Not metal. Extremely upset.", toast: "A ghost crab! It is not metal. It is furious." },
	{ id: "sandcrab", name: "Mole crab",       tier: "critter", weight: 8,  move: "dig",     speed: 0,    text: "Dug back down faster than you dug it up.", toast: "A mole crab. It's already digging itself back in." },
	{ id: "worm",     name: "Lugworm",         tier: "critter", weight: 7,  move: "dig",     speed: 0,    text: "Was already halfway back down by the time you noticed.", toast: "A lugworm. It's already burrowing back down." },
	{ id: "hermit",   name: "Hermit crab",     tier: "critter", weight: 6,  move: "scuttle", speed: 0.35, text: "Looked like a shell. Then it stood up.", toast: "That shell just got up and left." },
	{ id: "turtle",   name: "Baby sea turtle", tier: "critter", weight: 2,  move: "sea",     speed: 0.22, text: "Hatched, blinked at you, and made a run for the ocean.", toast: "A baby sea turtle! Go on, little guy, the ocean's that way." }
];
const GROUPS = [
	{ label: "Metal", kinds: METAL },
	{ label: "Not metal", kinds: OTHER },
	{ label: "Critters", kinds: CRITTERS }
];
const ALL = METAL.concat(OTHER, CRITTERS);
const WEIGHT = { common: 10, uncommon: 5, rare: 2, legendary: 0.7 };
const TIER_LABEL = { common: "Junk", uncommon: "Uncommon", rare: "Rare", legendary: "Legendary", critter: "Critter" };
const DEPTHS = { common: [4, 16], uncommon: [8, 24], rare: [14, 30], legendary: [22, 34] }; // cm
const N_METAL = 13, N_OTHER = 20, N_CRITTER = 12;
const DIG_STEP = 8, MAX_HOLE = 40; // cm
const EMPTY_LINES = [
	"Just sand.",
	"Sand. Some wetter sand.",
	"You found: more beach.",
	"Nothing. The detector looks embarrassed.",
	"A hole! Very nice hole. Empty though.",
	"Sand all the way down, so far."
];

// ---------- the world ----------
const SHORE_Z = -6.2;            // mean waterline
const LAND_SLOPE = 0.045, SEA_SLOPE = 0.04;
const SUN_DIR = new THREE.Vector3(-0.37, 0.5, -0.78).normalize();
const REGION = { x0: -16, z0: -21, w: 32, h: 32 }; // where the sand is baked in detail
const EYE = 1.62;
const REACH_MIN = 1.45, REACH = 2.9;
const WALK = { x0: -10, x1: 10, z0: SHORE_Z + 1.2, z1: 7 };
const SPAWN = { x0: -11.5, x1: 11.5, z0: SHORE_Z + 3.4, z1: 5 };
const DETECT_R = 1.0, REVEAL_METAL = 0.26, REVEAL_OTHER = 0.36;
const ITEM_SCALE = 1.5, CRITTER_SCALE = 1.9;
const params = new URLSearchParams(location.search);

const rand = Math.random;
const rr = (a, b) => a + rand() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function weighted(list, w) {
	let total = 0;
	list.forEach((k) => { total += w(k); });
	let r = rand() * total;
	for (const k of list) { r -= w(k); if (r <= 0) return k; }
	return list[0];
}

// the same noise as the shaders, so things sit on the sand
const fract = (x) => x - Math.floor(x);
function hash12(x, y) {
	let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
	const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
	a += d; b += d; c += d;
	return fract((a + b) * c);
}
function vnoise(x, y) {
	const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
	const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
	const a = hash12(ix, iy), b = hash12(ix + 1, iy), c = hash12(ix, iy + 1), d = hash12(ix + 1, iy + 1);
	return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
function fbm(x, y) {
	let a = 0.5, s = 0;
	for (let i = 0; i < 5; i++) { s += a * vnoise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= 0.5; }
	return s;
}
function baseY(z) {
	const d = SHORE_Z - z;
	if (d < 0) return -d * LAND_SLOPE;
	const k = Math.max(d - 22, 0);
	return Math.max(-d * SEA_SLOPE - k * k * 0.004, -14);
}
function holeH(x, z) {
	let h = 0;
	for (const s of holes) {
		const dx = x - s.x, dz = z - s.z, r = s.r;
		if (dx * dx + dz * dz > r * r * 10) continue;
		const dd = Math.hypot(dx, dz) / r;
		let bowl = 1 - smooth(0.15, 1, dd);
		bowl = bowl * bowl * (3 - 2 * bowl);
		h -= s.d * bowl;
		const cx = Math.cos(s.ang), cz = Math.sin(s.ang);
		let px = dx - cx * r * 1.7, pz = dz - cz * r * 1.7;
		const ax = px * cx + pz * cz, az = -px * cz + pz * cx;
		h += Math.exp(-(ax * ax * 1.6 + az * az * 0.8) / (r * r)) * s.d * 0.5;
		h += Math.exp(-Math.pow((dd - 1.08) * 5, 2)) * s.d * 0.12;
	}
	return h;
}
function groundY(x, z) { return baseY(z) + (fbm(x * 0.35, z * 0.35) - 0.5) * 0.1 + holeH(x, z); }
function smoothGroundY(x, z) { return baseY(z) + (fbm(x * 0.35, z * 0.35) - 0.5) * 0.1; }

// ---------- renderer ----------
const canvas = document.getElementById("gl");
let renderer;
try {
	renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
	if (!renderer.capabilities.isWebGL2) throw new Error("WebGL2 needed");
} catch (e) {
	document.getElementById("introText").textContent = "This beach needs WebGL 2, and this browser doesn't have it. Try a recent Chrome, Firefox or Safari.";
	document.getElementById("startBtn").style.display = "none";
	throw e;
}
const isTouch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
let quality = isTouch ? 1.15 : 1.4;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.autoClear = false;
const floatOK = renderer.extensions.has("EXT_color_buffer_float");
const HDR = floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType;

const scene = new THREE.Scene();
const fogColor = new THREE.Color().setRGB(0.50, 0.64, 0.82, THREE.LinearSRGBColorSpace);
scene.fog = new THREE.FogExp2(fogColor, 0.0045);
const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 5000);
camera.rotation.order = "YXZ";
scene.add(camera);

const U = {
	uShoreZ: { value: SHORE_Z },
	uWaveShore: { value: SHORE_Z },
	uTime: { value: 0 },
	uWl: { value: 0 },
	uWlHigh: { value: 0.13 },
	uSunDir: { value: SUN_DIR }
};

// ---------- sky ----------
function skyDome(radius, detail) {
	const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.ShaderMaterial({
		vertexShader: S.SKY_VERT,
		fragmentShader: S.SKY_FRAG,
		uniforms: { uDetail: { value: detail }, uTime: U.uTime, uSunDir: U.uSunDir },
		side: THREE.BackSide,
		depthWrite: false,
		fog: false
	}));
	m.frustumCulled = false;
	m.renderOrder = -1;
	return m;
}
const sky = skyDome(3000, 1);
scene.add(sky);
{
	const envScene = new THREE.Scene();
	envScene.add(skyDome(50, 0));
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
	scene.environmentIntensity = 0.8;
	pmrem.dispose();
}

const sun = new THREE.DirectionalLight(0xffe9cc, 4.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -3.6;
sun.shadow.camera.right = 3.6;
sun.shadow.camera.top = 3.6;
sun.shadow.camera.bottom = -3.6;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.012;
scene.add(sun);
scene.add(sun.target);

// ---------- the sand, baked in world space ----------
const BAKE = Math.min(renderer.capabilities.maxTextureSize, parseInt(params.get("bake") || "", 10) || 2048);
function bakeTarget(type, srgb) {
	const rt = new THREE.WebGLRenderTarget(BAKE, BAKE, {
		type, depthBuffer: false, generateMipmaps: true,
		minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
		wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping
	});
	if (srgb) rt.texture.colorSpace = THREE.SRGBColorSpace;
	rt.texture.anisotropy = 8;
	return rt;
}
const rtAlb = bakeTarget(THREE.UnsignedByteType, true);
const rtHgt = bakeTarget(HDR, false);
const MAX_ST = 64;
const stA = Array.from({ length: MAX_ST }, () => new THREE.Vector4());
const stB = Array.from({ length: MAX_ST }, () => new THREE.Vector4());
const bakeMat = new THREE.ShaderMaterial({
	vertexShader: S.BAKE_VERT,
	fragmentShader: S.BAKE_FRAG,
	uniforms: {
		uMode: { value: 0 },
		uTexSize: { value: new THREE.Vector2(BAKE, BAKE) },
		uRegion: { value: new THREE.Vector4(REGION.x0, REGION.z0, REGION.w, REGION.h) },
		uStA: { value: stA },
		uStB: { value: stB },
		uStN: { value: 0 },
		uShoreZ: U.uShoreZ,
		uSunDir: U.uSunDir
	},
	depthTest: false,
	depthWrite: false
});
function fullscreenTri() {
	const g = new THREE.BufferGeometry();
	g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
	return g;
}
const bakeScene = new THREE.Scene();
const bakeQuad = new THREE.Mesh(fullscreenTri(), bakeMat);
bakeQuad.frustumCulled = false;
bakeScene.add(bakeQuad);
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// stamps: holes (0), footprints (1, 2), crab burrows (3), worm casts (4)
let stamps = [];
let holes = [];
function stampReach(s) { return s.type === 1 || s.type === 2 ? 0.3 : s.r * 3.5 + 0.1; }
function bakeRect(x0, z0, x1, z1, mips) {
	const px0 = clamp(Math.floor((x0 - REGION.x0) / REGION.w * BAKE), 0, BAKE);
	const px1 = clamp(Math.ceil((x1 - REGION.x0) / REGION.w * BAKE), 0, BAKE);
	const py0 = clamp(Math.floor((z0 - REGION.z0) / REGION.h * BAKE), 0, BAKE);
	const py1 = clamp(Math.ceil((z1 - REGION.z0) / REGION.h * BAKE), 0, BAKE);
	if (px1 <= px0 || py1 <= py0) return;
	const near = [];
	for (let i = stamps.length - 1; i >= 0 && near.length < MAX_ST; i--) {
		const s = stamps[i], m = stampReach(s);
		if (s.x + m > x0 && s.x - m < x1 && s.z + m > z0 && s.z - m < z1) near.push(s);
	}
	near.forEach((s, i) => {
		stA[i].set(s.x, s.z, s.r, s.d);
		stB[i].set(s.type, s.ang, 0, 0);
	});
	bakeMat.uniforms.uStN.value = near.length;
	for (const [rt, mode] of [[rtAlb, 0], [rtHgt, 1]]) {
		rt.texture.generateMipmaps = mips;
		rt.scissor.set(px0, py0, px1 - px0, py1 - py0);
		rt.scissorTest = true;
		bakeMat.uniforms.uMode.value = mode;
		renderer.setRenderTarget(rt);
		renderer.render(bakeScene, orthoCam);
		rt.scissorTest = false;
	}
	renderer.setRenderTarget(null);
}
function bakeAll() {
	const T = 16, tw = REGION.w / T, th = REGION.h / T;
	for (let j = 0; j < T; j++) {
		for (let i = 0; i < T; i++) {
			const last = i === T - 1 && j === T - 1;
			bakeRect(REGION.x0 + i * tw, REGION.z0 + j * th, REGION.x0 + (i + 1) * tw, REGION.z0 + (j + 1) * th, last);
		}
	}
}
function bakeAround(s) {
	const m = stampReach(s) + 0.05;
	bakeRect(s.x - m, s.z - m, s.x + m, s.z + m, true);
}

// ---------- grids ----------
function ramp(near, step, grow, max) {
	const out = [];
	let x = step, s = step;
	while (x < max) {
		out.push(x);
		if (x > near) s *= grow;
		x += s;
	}
	out.push(max);
	return out;
}
function gridGeo(xs, zs) {
	const pos = new Float32Array(xs.length * zs.length * 3);
	let k = 0;
	for (const z of zs) for (const x of xs) { pos[k++] = x; pos[k++] = 0; pos[k++] = z; }
	const idx = [];
	const nx = xs.length;
	for (let j = 0; j < zs.length - 1; j++) {
		for (let i = 0; i < nx - 1; i++) {
			const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
			idx.push(a, c, b, b, c, d);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
	const n = new Float32Array(pos.length);
	for (let i = 1; i < n.length; i += 3) n[i] = 1;
	g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
	g.setIndex(idx);
	return g;
}
function symmetric(arr) { return arr.slice().reverse().map((v) => -v).concat([0], arr); }

const NEAR_STEP = isTouch ? 0.045 : 0.032;
const sandGeo = (() => {
	const xs = symmetric(ramp(3.0, NEAR_STEP, 1.035, 320));
	const fwd = ramp(3.6, NEAR_STEP, 1.035, 450).map((v) => -v).reverse();
	const back = ramp(2.2, NEAR_STEP, 1.05, 30);
	return gridGeo(xs, fwd.concat([0], back));
})();

const sandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
const sandUniforms = {
	uHeightTex: { value: rtHgt.texture },
	uAlbedoTex: { value: rtAlb.texture },
	uRegion: { value: new THREE.Vector4(REGION.x0, REGION.z0, REGION.w, REGION.h) },
	uTexel: { value: new THREE.Vector2(1 / BAKE, 1 / BAKE) },
	uCausticCol: { value: new THREE.Color(1.0, 0.95, 0.82).multiplyScalar(1.4) }
};
sandMat.onBeforeCompile = (sh) => {
	Object.assign(sh.uniforms, sandUniforms, U);
	sh.vertexShader = sh.vertexShader
		.replace("#include <common>", "#include <common>\n" + S.SAND_VERT_PARS)
		.replace("#include <begin_vertex>", S.SAND_VERT_BEGIN);
	sh.fragmentShader = sh.fragmentShader
		.replace("#include <common>", "#include <common>\n" + S.SAND_FRAG_PARS)
		.replace("#include <map_fragment>", S.SAND_FRAG_MAP)
		.replace("#include <roughnessmap_fragment>", S.SAND_FRAG_ROUGH)
		.replace("#include <normal_fragment_maps>", S.SAND_FRAG_NORMAL)
		.replace("#include <emissivemap_fragment>", S.SAND_FRAG_EMISSIVE)
		.replace("#include <lights_fragment_end>", S.SAND_FRAG_LIGHTS_END);
};
const sand = new THREE.Mesh(sandGeo, sandMat);
sand.frustumCulled = false;
sand.receiveShadow = true;
scene.add(sand);

// ---------- the sea ----------
const sceneRT = new THREE.WebGLRenderTarget(4, 4, { type: HDR, depthTexture: new THREE.DepthTexture(4, 4), samples: 0 });
sceneRT.depthTexture.type = THREE.UnsignedIntType;
const waterGeo = (() => {
	const xs = symmetric(ramp(11, 0.11, 1.04, 3600));
	const surf = [];
	for (let z = SHORE_Z + 9; z > SHORE_Z - 26; z -= 0.1) surf.push(z);
	const out = ramp(0, 0.12, 1.035, 3600).map((v) => SHORE_Z - 26 - v);
	return gridGeo(xs, surf.concat(out).reverse());
})();
const waterMat = new THREE.ShaderMaterial({
	vertexShader: S.WATER_VERT,
	fragmentShader: S.WATER_FRAG,
	uniforms: Object.assign({
		uSceneTex: { value: sceneRT.texture },
		uDepthTex: { value: sceneRT.depthTexture },
		uRes: { value: new THREE.Vector2(1, 1) },
		uNear: { value: camera.near },
		uFar: { value: camera.far },
		uFogColor: { value: fogColor },
		uFogDensity: { value: 0.0011 },
		uSunCol: { value: new THREE.Color(1.0, 0.94, 0.84) }
	}, U),
	fog: false
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.frustumCulled = false;
water.layers.set(1);
scene.add(water);

const compMat = new THREE.ShaderMaterial({
	vertexShader: S.COMPOSITE_VERT,
	fragmentShader: S.COMPOSITE_FRAG,
	uniforms: { tColor: { value: sceneRT.texture }, tDepth: { value: sceneRT.depthTexture } },
	depthTest: true,
	depthWrite: true,
	depthFunc: THREE.AlwaysDepth
});
const compScene = new THREE.Scene();
const compQuad = new THREE.Mesh(fullscreenTri(), compMat);
compQuad.frustumCulled = false;
compScene.add(compQuad);

// spray thrown off the breaking crests
const SPRAY_N = 700;
const sprayPos = new Float32Array(SPRAY_N * 3), spraySize = new Float32Array(SPRAY_N), sprayAlpha = new Float32Array(SPRAY_N);
const sprayVel = new Float32Array(SPRAY_N * 3), sprayLife = new Float32Array(SPRAY_N);
const sprayGeo = new THREE.BufferGeometry();
sprayGeo.setAttribute("position", new THREE.BufferAttribute(sprayPos, 3));
sprayGeo.setAttribute("aSize", new THREE.BufferAttribute(spraySize, 1));
sprayGeo.setAttribute("aAlpha", new THREE.BufferAttribute(sprayAlpha, 1));
const spray = new THREE.Points(sprayGeo, new THREE.ShaderMaterial({
	vertexShader: S.SPRAY_VERT,
	fragmentShader: S.SPRAY_FRAG,
	uniforms: { uScale: { value: 400 }, uColor: { value: new THREE.Color(0.95, 0.97, 1.0) } },
	transparent: true,
	depthWrite: false
}));
spray.frustumCulled = false;
spray.layers.set(1);
scene.add(spray);
let sprayHead = 0;

// ---------- the detector ----------
const detector = makeDetector();
scene.add(detector);

// ---------- decor: pebbles, shells, seaweed, driftwood, gulls, a boat ----------
const decor = new THREE.Group();
scene.add(decor);
function scatterInstanced(geo, mat, n, place) {
	const im = new THREE.InstancedMesh(geo, mat, n);
	im.castShadow = true;
	im.receiveShadow = true;
	const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(), e = new THREE.Euler();
	for (let i = 0; i < n; i++) {
		place(p, e, s, c);
		q.setFromEuler(e);
		m.compose(p, q, s);
		im.setMatrixAt(i, m);
		im.setColorAt(i, c);
	}
	decor.add(im);
	return im;
}
function decorSpot(p, zMin, zMax) {
	p.x = rr(REGION.x0 + 1, REGION.x0 + REGION.w - 1);
	p.z = rr(zMin, zMax);
	p.y = smoothGroundY(p.x, p.z);
}
function buildDecor() {
	decor.clear();
	const pebbleTones = [[0.35, 0.32, 0.29], [0.22, 0.2, 0.18], [0.5, 0.47, 0.42], [0.42, 0.3, 0.22], [0.15, 0.15, 0.16]];
	scatterInstanced(pebbleGeo(3), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 260, (p, e, s, c) => {
		decorSpot(p, SHORE_Z + 0.5, 9);
		const k = rr(0.006, 0.022);
		s.set(k, k, k);
		p.y += k * 0.2;
		e.set(rr(-0.3, 0.3), rr(0, 6.3), rr(-0.3, 0.3));
		const t = pebbleTones[Math.floor(rand() * pebbleTones.length)];
		c.setRGB(t[0], t[1], t[2], THREE.LinearSRGBColorSpace);
	});
	const shellTones = [[0.62, 0.52, 0.42], [0.58, 0.38, 0.3], [0.66, 0.6, 0.52], [0.5, 0.42, 0.34], [0.7, 0.55, 0.45]];
	scatterInstanced(scallopGeo(1, 14), new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide }), 45, (p, e, s, c) => {
		decorSpot(p, SHORE_Z + 1.5, 9);
		const k = rr(0.01, 0.024);
		s.set(k, k, k);
		const flip = rand() < 0.3;
		e.set(flip ? Math.PI : rr(-0.15, 0.15), rr(0, 6.3), rr(-0.15, 0.15));
		if (flip) p.y += k * 0.25;
		const t = shellTones[Math.floor(rand() * shellTones.length)];
		c.setRGB(t[0], t[1], t[2], THREE.LinearSRGBColorSpace);
	});
	// seaweed along the wrack line
	const weedMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.12, 0.085, 0.03, THREE.LinearSRGBColorSpace), roughness: 0.5 });
	for (let i = 0; i < 26; i++) {
		const m = new THREE.Mesh(seaweedClump(i + 1), weedMat);
		const x = rr(REGION.x0 + 1, REGION.x0 + REGION.w - 1);
		const z = SHORE_Z + 4.6 + (fbm(x * 0.4, 1.3) - 0.5) * 1.6 + rr(-0.3, 0.3);
		m.position.set(x, smoothGroundY(x, z), z);
		m.rotation.y = rr(0, 6.3);
		m.castShadow = true;
		m.receiveShadow = true;
		decor.add(m);
	}
	for (const [x, z, s] of [[-4.2, SHORE_Z + 4.9, 2], [6.8, SHORE_Z + 5.4, 5]]) {
		const log = driftwood(s);
		log.position.set(x, smoothGroundY(x, z) + 0.03, z);
		log.rotation.y = rr(-0.6, 0.6);
		decor.add(log);
	}
}
const gulls = [0, 1, 2].map((i) => {
	const g = makeGull();
	g.userData.i = i;
	scene.add(g);
	return g;
});
const boat = makeBoat();
boat.position.set(-260, 0, -950);
scene.add(boat);

// ---------- game state ----------
let things = [];
let runners = [];
let risers = [];
const player = { x: 0, z: -0.8, vx: 0, vz: 0, bob: 0, stride: 0, foot: 1 };
const coil = { x: 0.3, z: -2.9, tx: 0.3, tz: -2.9, y: 0 };
let pointer = { sx: 0, sy: 0, has: false, touch: false };
let walkTarget = null;
let busy = false, started = false, tide = null;
let cardQueue = [];
const signal = { s: 0, target: null, dist: 0 };
let finds = {};
try { finds = JSON.parse(localStorage.getItem("wwo-01-reveal-finds") || "{}") || {}; } catch (e) { finds = {}; }
function saveFinds() { try { localStorage.setItem("wwo-01-reveal-finds", JSON.stringify(finds)); } catch (e) {} }

function holeR(depthCm) { return 0.1 + depthCm * 0.003; }

function spot(minGap, cat) {
	for (let tries = 0; tries < 300; tries++) {
		const x = rr(SPAWN.x0, SPAWN.x1), z = rr(SPAWN.z0, SPAWN.z1);
		const crowded = things.some((b) => b.cat === cat && Math.hypot(b.x - x, b.z - z) < minGap);
		if (!crowded || tries > 220) return { x, z };
	}
	return { x: 0, z: -2 };
}

function bury() {
	things = [];
	for (let i = 0; i < N_METAL; i++) {
		const k = weighted(METAL, (m) => WEIGHT[m.tier]);
		const s = spot(2.4, "metal");
		const dr = DEPTHS[k.tier];
		things.push({ cat: "metal", kind: k, x: s.x, z: s.z, depth: Math.round(rr(dr[0], dr[1])), found: false });
	}
	for (let i = 0; i < N_OTHER; i++) {
		const k = weighted(OTHER, (m) => WEIGHT[m.tier]);
		const s = spot(1.2, "other");
		things.push({ cat: "other", kind: k, x: s.x, z: s.z, depth: Math.round(rr(3, 28)), found: false });
	}
	for (let i = 0; i < N_CRITTER; i++) {
		const k = weighted(CRITTERS, (m) => m.weight);
		const s = spot(1.2, "critter");
		things.push({ cat: "critter", kind: k, x: s.x, z: s.z, depth: Math.round(rr(2, 8)), found: false });
	}
	updateLeft();
}

// signs of life: crab burrows and worm casts, plus footprints left by someone earlier
function surfaceStamps() {
	things.forEach((b) => {
		if (b.cat !== "critter") return;
		if (b.kind.id === "worm") stamps.push({ type: 4, x: b.x + rr(-0.05, 0.05), z: b.z + rr(-0.05, 0.05), r: 0.022, d: 0.01, ang: rr(0, 6.3) });
		else if (b.kind.id !== "turtle") stamps.push({ type: 3, x: b.x + rr(-0.04, 0.04), z: b.z + rr(-0.04, 0.04), r: b.kind.id === "crab" ? 0.022 : 0.012, d: 0.035, ang: 0 });
	});
	let x = rr(-6, 6), z = REGION.z0 + REGION.h - 1;
	const drift = rr(-0.25, 0.25), wob = rr(0, 6);
	for (let i = 0; z > SHORE_Z + 3.0; i++) {
		const dx = drift + Math.sin(i * 0.12 + wob) * 0.25;
		const len = Math.hypot(dx, 1);
		const dirx = dx / len, dirz = -1 / len;
		const side = i % 2 ? 1 : -1;
		const ang = Math.atan2(dirx, -dirz);
		stamps.push({ type: side > 0 ? 2 : 1, x: x - dirz * side * 0.09, z: z + dirx * side * 0.09, r: 1, d: 0.014, ang: -ang + rr(-0.06, 0.06) });
		x += dirx * 0.72;
		z += dirz * 0.72;
	}
}

// ---------- audio ----------
let AC = null, master = null, muted = false, surfGain = null;
function startAudio() {
	const Ctx = window.AudioContext || window.webkitAudioContext;
	if (!Ctx) return;
	AC = new Ctx();
	master = AC.createGain();
	master.gain.value = 0.9;
	master.connect(AC.destination);
	const len = AC.sampleRate * 3;
	const buf = AC.createBuffer(1, len, AC.sampleRate);
	const data = buf.getChannelData(0);
	let last = 0;
	for (let i = 0; i < len; i++) {
		last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
		data[i] = last * 3.5;
	}
	const src = AC.createBufferSource();
	src.buffer = buf;
	src.loop = true;
	const lp = AC.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.value = 700;
	surfGain = AC.createGain();
	surfGain.gain.value = 0.2;
	src.connect(lp);
	lp.connect(surfGain);
	surfGain.connect(master);
	src.start();
}
function tone(freq, dur, type, vol, when) {
	if (!AC) return;
	const t0 = AC.currentTime + (when || 0);
	const o = AC.createOscillator(), g = AC.createGain();
	o.type = type || "square";
	o.frequency.value = freq;
	g.gain.setValueAtTime(0, t0);
	g.gain.linearRampToValueAtTime(vol || 0.06, t0 + 0.005);
	g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	o.connect(g);
	g.connect(master);
	o.start(t0);
	o.stop(t0 + dur + 0.02);
}
function noiseBurst(dur, freq, vol, when) {
	if (!AC) return;
	const t0 = AC.currentTime + (when || 0);
	const len = Math.floor(AC.sampleRate * dur);
	const buf = AC.createBuffer(1, len, AC.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
	const s = AC.createBufferSource();
	s.buffer = buf;
	const f = AC.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = freq;
	f.Q.value = 0.8;
	const g = AC.createGain();
	g.gain.value = vol;
	s.connect(f);
	f.connect(g);
	g.connect(master);
	s.start(t0);
}
function digSound(depth) {
	const f = 1500 - depth * 15;
	noiseBurst(0.12, f, 0.5, 0);
	noiseBurst(0.12, f * 0.8, 0.45, 0.13);
	noiseBurst(0.14, f * 0.65, 0.4, 0.26);
}
function findJingle(tier) {
	const notes = {
		common: [392, 330],
		uncommon: [523, 659, 784],
		rare: [523, 659, 784, 1047],
		legendary: [523, 659, 784, 1047, 784, 1047, 1319, 1568],
		critter: [880, 1175]
	}[tier];
	notes.forEach((f, i) => tone(f, 0.22, "triangle", 0.11, 0.3 + i * 0.09));
}

// ---------- the sea: waves, swash and tide ----------
const WAVE_T = 7;
function swash(t) {
	const s = (t / WAVE_T) % 1;
	return s < 0.3 ? Math.sin(s / 0.3 * Math.PI / 2) : Math.cos((s - 0.3) / 0.7 * Math.PI / 2);
}
function waveAt(x, t, k) {
	const ph = t / WAVE_T;
	const i = Math.floor(ph) - k;
	const a = (ph - i) / 3;
	const seed = i * 1.7;
	const D = 44 * Math.pow(1 - a, 1.25);
	return {
		D,
		crest: D + 0.9 * Math.sin(x * 0.09 + seed) + 0.5 * Math.sin(x * 0.23 - seed * 0.6),
		dBreak: 7.5 + 2.0 * Math.sin(x * 0.05 + seed * 2.3) + 0.9 * Math.sin(x * 0.13 + seed),
		H: (0.08 + 0.42 * Math.pow(smooth(44, 7.5, D), 2)) * (0.85 + 0.25 * Math.sin(x * 0.07 + seed))
	};
}
let waterNow = 0, waterHigh = 0.13, tideZ = 0, lastBreakD = 99;
const TIDE_IN = 3200, TIDE_HOLD = 900, TIDE_OUT = 3600, TIDE_FULL = 0.78;
function updateWater(t, now, dt) {
	tideZ = tideOffset(now);
	const sw = swash(t);
	waterNow = tideZ - 0.04 + 0.17 * sw;
	waterHigh = Math.max(tideZ + 0.13, waterNow + 0.01, waterHigh - dt * 0.004);
	U.uWl.value = waterNow;
	U.uWlHigh.value = waterHigh;
	U.uWaveShore.value = SHORE_Z + tideZ / LAND_SLOPE;
	// the crash as the nearest wave breaks in front of you
	const w = waveAt(player.x, t, 2);
	if (w.D < w.dBreak && lastBreakD >= w.dBreak && AC && !muted) {
		noiseBurst(1.5, 380, 0.5, 0);
		noiseBurst(1.0, 1500, 0.16, 0.05);
	}
	lastBreakD = w.D;
	if (surfGain && AC) {
		const s = (t / WAVE_T) % 1;
		surfGain.gain.setTargetAtTime(0.14 + 0.22 * Math.max(0, Math.sin(s * Math.PI * 1.4)) + (tide ? 0.3 : 0), AC.currentTime, 0.3);
	}
}
function startTide() {
	if (tide || busy) return;
	tide = { start: performance.now(), swapped: false };
}
function tideOffset(now) {
	if (!tide) return 0;
	const t = now - tide.start;
	if (t < TIDE_IN) { const a = t / TIDE_IN; return TIDE_FULL * a * a * (3 - 2 * a); }
	if (t < TIDE_IN + TIDE_HOLD) {
		if (!tide.swapped) {
			tide.swapped = true;
			stamps = [];
			holes = [];
			runners.forEach((r) => scene.remove(r.obj));
			runners = [];
			bury();
			surfaceStamps();
			bakeAll();
		}
		return TIDE_FULL;
	}
	if (t < TIDE_IN + TIDE_HOLD + TIDE_OUT) {
		const b = (t - TIDE_IN - TIDE_HOLD) / TIDE_OUT;
		return TIDE_FULL * (1 - b * b * (3 - 2 * b));
	}
	tide = null;
	toast("The tide went out. New stuff washed in.");
	return 0;
}

function updateSpray(t, dt) {
	// throw spray where a crest is pitching over
	for (let k = 0; k < 3; k++) {
		for (let n = 0; n < 6; n++) {
			const x = player.x + rr(-30, 30);
			const w = waveAt(x, t, k);
			const g = w.D - w.dBreak;
			if (g > 1.2 || g < -0.6 || rand() > 0.7) continue;
			const i = sprayHead;
			sprayHead = (sprayHead + 1) % SPRAY_N;
			const z = U.uWaveShore.value - w.crest;
			sprayPos[i * 3] = x;
			sprayPos[i * 3 + 1] = waterNow + w.H * 0.9 + rr(0, 0.1);
			sprayPos[i * 3 + 2] = z + rr(-0.15, 0.15);
			sprayVel[i * 3] = rr(-0.2, 0.2);
			sprayVel[i * 3 + 1] = rr(0.6, 1.8);
			sprayVel[i * 3 + 2] = rr(0.5, 1.6);
			sprayLife[i] = 1;
			spraySize[i] = rr(0.04, 0.12);
		}
	}
	for (let i = 0; i < SPRAY_N; i++) {
		if (sprayLife[i] <= 0) { sprayAlpha[i] = 0; continue; }
		sprayLife[i] -= dt * 0.9;
		sprayVel[i * 3 + 1] -= 4.5 * dt;
		sprayPos[i * 3] += sprayVel[i * 3] * dt;
		sprayPos[i * 3 + 1] += sprayVel[i * 3 + 1] * dt;
		sprayPos[i * 3 + 2] += sprayVel[i * 3 + 2] * dt;
		spraySize[i] += dt * 0.12;
		sprayAlpha[i] = Math.max(0, sprayLife[i]) * 0.32;
	}
	sprayGeo.attributes.position.needsUpdate = true;
	sprayGeo.attributes.aSize.needsUpdate = true;
	sprayGeo.attributes.aAlpha.needsUpdate = true;
}

// ---------- detector ----------
let nextBeep = 0, beepFlash = 0;
function vdiKind(v) {
	if (v < 20) return "IRON";
	if (v < 35) return "FOIL";
	if (v < 50) return "TAB";
	if (v < 63) return "GOLD?";
	if (v < 80) return "BRASS";
	if (v < 90) return "COIN";
	return "!!!";
}
function holeDepthAt(x, z) {
	let best = 0;
	holes.forEach((h) => { if (Math.hypot(h.x - x, h.z - z) < h.r + 0.05) best = Math.max(best, h.depth); });
	return best;
}
function updateSignal() {
	let best = 0, target = null, bestD = 0;
	if (started && !tide && !busy) {
		things.forEach((b) => {
			if (b.found || b.cat !== "metal") return;
			const d = Math.hypot(b.x - coil.x, b.z - coil.z);
			if (d > DETECT_R) return;
			const left = Math.max(0, b.depth - holeDepthAt(b.x, b.z));
			const s = (1 - d / DETECT_R) * (1 - left / 70);
			if (s > best) { best = s; target = b; bestD = d; }
		});
	}
	signal.s = best;
	signal.target = target;
	signal.dist = bestD;
}
const lcdId = document.getElementById("lcdId");
const lcdKind = document.getElementById("lcdKind");
const depthEl = document.getElementById("depth");
const barsEl = document.getElementById("bars");
const bars = [];
for (let i = 0; i < 10; i++) { const b = document.createElement("i"); barsEl.appendChild(b); bars.push(b); }
let lastLcd = "";
function updateLcd() {
	const s = signal.s, tg = signal.target;
	const lit = Math.round(s * 10);
	const showId = s > 0.2 && tg;
	const key = lit + "|" + (showId ? tg.kind.vdi : "-") + "|" + (showId && signal.dist < REVEAL_METAL);
	if (key === lastLcd && rand() > 0.12) return;
	lastLcd = key;
	const id = showId ? clamp(tg.kind.vdi + Math.round((rand() - 0.5) * (1 - s) * 10), 0, 99) : 0;
	lcdId.textContent = showId ? (id < 10 ? "0" + id : id) : "--";
	lcdKind.textContent = showId ? vdiKind(tg.kind.vdi) : "";
	if (showId && signal.dist < REVEAL_METAL) {
		depthEl.textContent = "DIG ~" + Math.max(2, Math.round((tg.depth - holeDepthAt(tg.x, tg.z)) / 2 + rand() * 2) * 2) + "cm";
		depthEl.className = "lbl hot";
	} else {
		depthEl.textContent = "";
		depthEl.className = "lbl";
	}
	bars.forEach((b, i) => { b.className = i < lit ? (i >= 8 ? "on hot" : "on") : ""; });
}
function beepTick(now) {
	const s = signal.s;
	if (s <= 0.02 || !signal.target || busy) return;
	if (now < nextBeep) return;
	const base = 200 + signal.target.kind.vdi * 9;
	tone(base * (1 + 0.25 * s), 0.05 + 0.04 * s, "square", 0.035 + 0.05 * s);
	beepFlash = 1;
	nextBeep = now + (720 - 650 * Math.pow(s, 0.7));
}

// ---------- digging ----------
const sandBits = (() => {
	const n = 500;
	const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95 }), n);
	im.castShadow = true;
	im.frustumCulled = false;
	const c = new THREE.Color();
	for (let i = 0; i < n; i++) {
		const v = rr(0.75, 1.05);
		c.setRGB(0.5 * v, 0.39 * v, 0.26 * v, THREE.LinearSRGBColorSpace);
		im.setColorAt(i, c);
		im.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
	}
	scene.add(im);
	return { im, n, head: 0, p: new Float32Array(n * 3), v: new Float32Array(n * 3), life: new Float32Array(n), s: new Float32Array(n), rot: new Float32Array(n) };
})();
function throwSand(x, z, dirAng, count) {
	const B = sandBits;
	const y = groundY(x, z);
	for (let k = 0; k < count; k++) {
		const i = B.head;
		B.head = (B.head + 1) % B.n;
		const a = dirAng + rr(-0.9, 0.9), sp = rr(0.4, 1.4);
		B.p[i * 3] = x + rr(-0.05, 0.05);
		B.p[i * 3 + 1] = y + 0.02;
		B.p[i * 3 + 2] = z + rr(-0.05, 0.05);
		B.v[i * 3] = Math.cos(a) * sp;
		B.v[i * 3 + 1] = rr(1.0, 2.4);
		B.v[i * 3 + 2] = Math.sin(a) * sp;
		B.life[i] = 1;
		B.s[i] = rr(0.004, 0.012);
		B.rot[i] = rr(0, 6);
	}
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function updateSand(dt) {
	const B = sandBits;
	for (let i = 0; i < B.n; i++) {
		if (B.life[i] <= 0) continue;
		B.v[i * 3 + 1] -= 9.8 * dt;
		B.p[i * 3] += B.v[i * 3] * dt;
		B.p[i * 3 + 1] += B.v[i * 3 + 1] * dt;
		B.p[i * 3 + 2] += B.v[i * 3 + 2] * dt;
		const gy = groundY(B.p[i * 3], B.p[i * 3 + 2]);
		if (B.p[i * 3 + 1] < gy) {
			B.p[i * 3 + 1] = gy;
			B.v[i * 3] *= 0.3;
			B.v[i * 3 + 2] *= 0.3;
			B.v[i * 3 + 1] = 0;
			B.life[i] -= dt * 1.6;
		}
		const sc = B.s[i] * clamp(B.life[i] * 2, 0, 1);
		_e.set(B.rot[i], B.rot[i] * 1.3, 0);
		_q.setFromEuler(_e);
		_p.set(B.p[i * 3], B.p[i * 3 + 1], B.p[i * 3 + 2]);
		_s.set(sc, sc * 0.7, sc);
		_m.compose(_p, _q, _s);
		B.im.setMatrixAt(i, _m);
	}
	B.im.instanceMatrix.needsUpdate = true;
}

function dig(x, z) {
	if (busy || tide || !started) return;
	if (groundY(x, z) < waterHigh + 0.008) {
		toast("That's the sea. You can't dig the sea.");
		return;
	}
	let hole = null, hd = Infinity;
	holes.forEach((h) => {
		const d = Math.hypot(h.x - x, h.z - z);
		if (d < h.r && d < hd) { hole = h; hd = d; }
	});
	if (hole && hole.depth >= MAX_HOLE) {
		toast("That's deep enough. Any deeper and you'll come out the other side.");
		return;
	}
	if (!hole) {
		const ang = Math.atan2(player.z - z, player.x - x) + rr(-0.9, 0.9) + (rand() < 0.5 ? 1.2 : -1.2);
		hole = { type: 0, x, z, depth: 0, r: holeR(0), d: 0, ang };
		holes.push(hole);
		stamps.push(hole);
	}
	hole.depth = Math.min(MAX_HOLE, hole.depth + DIG_STEP);
	hole.r = holeR(hole.depth);
	hole.d = hole.depth / 100;
	bakeAround(hole);
	throwSand(hole.x, hole.z, hole.ang, 40);
	digSound(hole.depth);

	const found = [];
	let deeperMetal = false;
	things.forEach((b) => {
		if (b.found) return;
		const d = Math.hypot(b.x - hole.x, b.z - hole.z);
		const reach = b.cat === "metal" ? REVEAL_METAL : REVEAL_OTHER;
		if (d > Math.max(reach, hole.r + 0.04)) return;
		if (b.depth <= hole.depth) found.push(b);
		else if (b.cat === "metal") deeperMetal = true;
	});
	if (!found.length) {
		tone(110, 0.18, "sine", 0.15, 0.3);
		if (deeperMetal) toast(hole.depth < 20 ? "The signal's still under you. Keep digging." : "Deeper still. You can hear it humming.");
		else toast(EMPTY_LINES[Math.floor(rand() * EMPTY_LINES.length)] + (hole.depth > DIG_STEP ? " (" + hole.depth + " cm down)" : ""));
		return;
	}
	found.forEach((b) => {
		b.found = true;
		const isNew = !finds[b.kind.id];
		finds[b.kind.id] = (finds[b.kind.id] || 0) + 1;
		if (b.cat === "critter") {
			releaseCritter(b.kind, hole);
			toast(b.kind.toast);
			findJingle("critter");
			renderTray(b.kind.id);
		} else {
			cardQueue.push({ kind: b.kind, isNew, depth: b.depth, hole });
		}
	});
	saveFinds();
	if (cardQueue.length && !busy) nextCard();
}

function buildItem(kind) {
	const o = ITEM_BUILDERS[kind.id]();
	o.scale.multiplyScalar(ITEM_SCALE);
	const wrap = new THREE.Group();
	wrap.add(o);
	const box = new THREE.Box3().setFromObject(o);
	o.position.y -= box.min.y;
	o.position.x -= (box.min.x + box.max.x) / 2;
	o.position.z -= (box.min.z + box.max.z) / 2;
	wrap.userData.height = box.max.y - box.min.y;
	wrap.userData.inner = o;
	return wrap;
}

function nextCard() {
	const c = cardQueue.shift();
	if (!c) return;
	busy = true;
	const obj = buildItem(c.kind);
	const y0 = groundY(c.hole.x, c.hole.z) - 0.02;
	obj.position.set(c.hole.x, y0, c.hole.z);
	scene.add(obj);
	risers.push({ obj, kind: c.kind, y0, t: 0, out: 0 });
	findJingle(c.kind.tier);
	throwSand(c.hole.x, c.hole.z, c.hole.ang, 25);
	setTimeout(() => showCard(c.kind, c.isNew, true, c.depth), 1000);
}

function updateRisers(dt, now) {
	risers = risers.filter((r) => {
		r.t += dt;
		const a = Math.min(1, r.t / 0.8);
		const ease = 1 - Math.pow(1 - a, 3);
		let y = r.y0 + ease * 0.32;
		if (r.out > 0) {
			r.out += dt;
			const b = Math.min(1, r.out / 0.45);
			y += b * b * 0.6;
			r.obj.scale.setScalar(Math.max(0.001, 1 - b));
			if (b >= 1) { scene.remove(r.obj); return false; }
		}
		r.obj.position.y = y + Math.sin(now / 500) * 0.01 * ease;
		r.obj.rotation.y += dt * 0.9;
		const sp = r.obj.userData.inner.userData.spin;
		if (sp) sp(now / 1000);
		return true;
	});
}

// ---------- critters running away ----------
function releaseCritter(kind, hole) {
	const obj = CRITTER_BUILDERS[kind.id]();
	obj.scale.setScalar(CRITTER_SCALE);
	scene.add(obj);
	const awayAng = Math.atan2(hole.z - player.z, hole.x - player.x);
	let heading;
	if (kind.move === "sea") heading = -Math.PI / 2 + rr(-0.3, 0.3);
	else if (kind.id === "crab") heading = (rand() < 0.5 ? 0 : Math.PI) + rr(-0.5, 0.5) * 0.6 + (Math.sin(awayAng) < 0 ? -0.3 : 0.3);
	else heading = awayAng + rr(-0.8, 0.8);
	runners.push({ obj, kind, x: hole.x, z: hole.z, heading, t: 0, sink: 0, holeD: hole.d, life: kind.move === "dig" ? 1.6 : 9 });
}
function updateRunners(dt) {
	runners = runners.filter((r) => {
		r.t += dt;
		const k = r.kind;
		let speed = 0, sinkRate = 0, anim = 1;
		if (k.move === "scuttle") {
			speed = k.speed * (r.t < 0.35 ? r.t / 0.35 : 1);
			if (k.id === "crab" && rand() < dt * 0.8) r.heading += rr(-0.6, 0.6);
			if (r.t > 4.5) { sinkRate = 0.03; speed *= 0.4; }
		} else if (k.move === "dig") {
			anim = 1.5;
			if (r.t > 0.5) sinkRate = 0.04;
		} else if (k.move === "sea") {
			speed = k.speed;
			anim = 1;
		}
		r.x += Math.cos(r.heading) * speed * dt;
		r.z += Math.sin(r.heading) * speed * dt;
		r.sink += sinkRate * dt;
		const emerge = Math.min(1, r.t / 0.35);
		const gy = groundY(r.x, r.z);
		const under = waterNow - gy;
		if (under > 0.02) r.sink += dt * 0.06;
		r.obj.position.set(r.x, gy - (1 - emerge) * r.holeD * 0.6 - r.sink, r.z);
		const face = r.obj.userData.facing || 0;
		r.obj.rotation.y = Math.PI / 2 - r.heading - face;
		if (r.obj.userData.animate) r.obj.userData.animate(r.t, speed > 0 || k.move === "dig" ? anim : 0.2);
		const gone = r.sink > 0.06 || r.t > r.life + 6;
		if (gone) scene.remove(r.obj);
		return !gone;
	});
}

// ---------- the player, the coil and the camera ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function screenToGround(sx, sy) {
	ndc.set(sx / W * 2 - 1, -(sy / H) * 2 + 1);
	raycaster.setFromCamera(ndc, camera);
	const o = raycaster.ray.origin, d = raycaster.ray.direction;
	if (d.y > -0.02) return null;
	let t = (o.y - smoothGroundY(o.x, o.z)) / -d.y;
	for (let i = 0; i < 6; i++) {
		const px = o.x + d.x * t, pz = o.z + d.z * t, py = o.y + d.y * t;
		t += (py - smoothGroundY(px, pz)) / -d.y;
	}
	return { x: o.x + d.x * t, z: o.z + d.z * t, t };
}
function reachClamp(p) {
	let dx = p.x - player.x, dz = p.z - player.z;
	if (dz > -0.4) dz = -0.4;
	const len = Math.hypot(dx, dz);
	const L = clamp(len, REACH_MIN, REACH);
	return { x: player.x + dx / len * L, z: player.z + dz / len * L, beyond: len > REACH + 0.15 };
}

const walkRing = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
walkRing.rotation.x = -Math.PI / 2;
walkRing.visible = false;
scene.add(walkRing);

const keys = {};
const handPos = new THREE.Vector3(), coilPos = new THREE.Vector3(), groundN = new THREE.Vector3();
let pitch = 0.38;
function updatePlayer(dt, t) {
	let ix = 0, iz = 0;
	if (keys.KeyA || keys.ArrowLeft) ix -= 1;
	if (keys.KeyD || keys.ArrowRight) ix += 1;
	if (keys.KeyW || keys.ArrowUp) iz -= 1;
	if (keys.KeyS || keys.ArrowDown) iz += 1;
	if (ix || iz) walkTarget = null;
	let tx = 0, tz = 0;
	if (walkTarget) {
		const dx = walkTarget.x - player.x, dz = walkTarget.z + 2.0 - player.z;
		const d = Math.hypot(dx, dz);
		if (d < 0.08) walkTarget = null;
		else { tx = dx / d; tz = dz / d; }
	} else if (ix || iz) {
		const l = Math.hypot(ix, iz);
		tx = ix / l;
		tz = iz / l;
	}
	const speed = busy || tide ? 0 : 1.35;
	const k = 1 - Math.exp(-dt * 8);
	player.vx += (tx * speed - player.vx) * k;
	player.vz += (tz * speed - player.vz) * k;
	const nx = clamp(player.x + player.vx * dt, WALK.x0, WALK.x1);
	const nz = clamp(player.z + player.vz * dt, WALK.z0, WALK.z1);
	const moved = Math.hypot(nx - player.x, nz - player.z);
	if (walkTarget && moved < 1e-4 && (nx === WALK.x0 || nx === WALK.x1 || nz === WALK.z0 || nz === WALK.z1)) walkTarget = null;
	player.x = nx;
	player.z = nz;
	player.bob += moved * 8.7;
	player.stride += moved;
	// leave footprints
	if (player.stride > 0.36 && moved > 0) {
		player.stride = 0;
		player.foot *= -1;
		const hx = player.vx, hz = player.vz, hl = Math.hypot(hx, hz) || 1;
		const ang = Math.atan2(hx / hl, -hz / hl);
		const fx = player.x - hz / hl * player.foot * 0.1, fz = player.z + hx / hl * player.foot * 0.1;
		const wet = groundY(fx, fz) < waterHigh + 0.03;
		const pr = { type: player.foot > 0 ? 2 : 1, x: fx, z: fz, r: 1, d: wet ? 0.008 : 0.014, ang: -ang };
		stamps.push(pr);
		if (stamps.length > 900) stamps.splice(0, 1);
		bakeAround(pr);
	}
	const gy = smoothGroundY(player.x, player.z);
	const bobY = Math.sin(player.bob) * 0.018 * clamp(Math.hypot(player.vx, player.vz), 0, 1);
	camera.position.set(player.x + Math.sin(player.bob * 0.5) * 0.01, gy + EYE + bobY, player.z + 0.15);
	camera.rotation.set(-pitch, 0, Math.sin(player.bob * 0.5) * 0.004);
	camera.updateMatrixWorld();

	// the coil follows the pointer, as far as your arms reach
	if (pointer.has) {
		const g = screenToGround(pointer.sx, pointer.sy - (pointer.touch ? 70 : 0));
		if (g) {
			const c = reachClamp(g);
			coil.tx = c.x;
			coil.tz = c.z;
			walkRing.visible = c.beyond && !busy && !tide;
			if (walkRing.visible) walkRing.position.set(g.x, smoothGroundY(g.x, g.z) + 0.01, g.z);
		} else walkRing.visible = false;
	} else {
		const c = reachClamp({ x: coil.tx, z: coil.tz });
		coil.tx = c.x;
		coil.tz = c.z;
	}
	const ck = 1 - Math.exp(-dt * 12);
	coil.x += (coil.tx - coil.x) * ck;
	coil.z += (coil.tz - coil.z) * ck;
	// ride over piles and dip a little into holes
	let top = -Infinity;
	for (let i = 0; i < 5; i++) {
		const a = i * 1.2566;
		top = Math.max(top, groundY(coil.x + Math.cos(a) * 0.11 * (i ? 1 : 0), coil.z + Math.sin(a) * 0.09 * (i ? 1 : 0)));
	}
	const sway = Math.sin(t * 1.3) * 0.004;
	coil.y += (top + 0.03 + sway - coil.y) * (1 - Math.exp(-dt * 18));
	const e = 0.15;
	groundN.set(smoothGroundY(coil.x - e, coil.z) - smoothGroundY(coil.x + e, coil.z), 2 * e, smoothGroundY(coil.x, coil.z - e) - smoothGroundY(coil.x, coil.z + e)).normalize();
	coilPos.set(coil.x, coil.y, coil.z);
	handPos.set(player.x + 0.27 + (coil.x - player.x) * 0.12, gy + 1.0 + bobY, player.z - 0.3);
	detector.visible = started && !tide;
	if (detector.visible) detector.userData.update(coilPos, groundN, handPos);

	// shadows cover the patch you're working
	sun.target.position.set(player.x, gy, player.z - 1.5);
	sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 25);
	sand.position.set(Math.round(player.x / NEAR_STEP) * NEAR_STEP, 0, Math.round(player.z / NEAR_STEP) * NEAR_STEP);
	water.position.x = Math.round(player.x / 0.11) * 0.11;
	sky.position.copy(camera.position);
}

function updateLife(t, dt) {
	gulls.forEach((g) => {
		const i = g.userData.i;
		const a = t * (0.09 + i * 0.02) + i * 2.1;
		const R = 14 + i * 5;
		g.position.set(player.x - 6 + Math.cos(a) * R, 14 + i * 4 + Math.sin(t * 0.3 + i) * 2, -28 + Math.sin(a) * R * 0.5);
		g.rotation.y = -a;
		g.rotation.z = Math.cos(a) * 0.3;
		const glide = Math.sin(t * 0.4 + i * 3) > 0.2;
		g.userData.flap(glide ? 0.15 : t * 7 + i);
	});
	boat.position.x = -260 + Math.sin(t * 0.004) * 140;
	boat.position.y = Math.sin(t * 0.8) * 0.15;
}

// ---------- render ----------
let W = 1, H = 1;
function resize() {
	W = window.innerWidth;
	H = window.innerHeight;
	const portrait = W < H;
	camera.fov = portrait ? 74 : 58;
	pitch = (portrait ? 27 : 22) * Math.PI / 180;
	camera.aspect = W / H;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality));
	renderer.setSize(W, H, false);
	const pw = Math.round(W * renderer.getPixelRatio()), ph = Math.round(H * renderer.getPixelRatio());
	sceneRT.setSize(pw, ph);
	waterMat.uniforms.uRes.value.set(pw, ph);
	spray.material.uniforms.uScale.value = ph / (2 * Math.tan(camera.fov * Math.PI / 360));
}

function render() {
	renderer.shadowMap.needsUpdate = true;
	camera.layers.set(0);
	renderer.setRenderTarget(sceneRT);
	renderer.clear();
	renderer.render(scene, camera);
	renderer.setRenderTarget(null);
	renderer.clear();
	renderer.render(compScene, orthoCam);
	camera.layers.set(1);
	renderer.render(scene, camera);
}

let last = performance.now(), frameAvg = 16, slowFrames = 0, fixedTime = null;
function frame(now) {
	const dt = Math.min(0.05, (now - last) / 1000);
	frameAvg = frameAvg * 0.95 + (now - last) * 0.05;
	last = now;
	const t = fixedTime !== null ? fixedTime : (now / 1000) % 980;
	U.uTime.value = t;
	updateWater(t, now, dt);
	updatePlayer(dt, t);
	updateSignal();
	beepTick(now);
	beepFlash = Math.max(0, beepFlash - dt * 6);
	updateLcd();
	updateRunners(dt);
	updateRisers(dt, now);
	updateSand(dt);
	updateSpray(t, dt);
	updateLife(t, dt);
	if (frameAvg > 26 && quality > 0.6 && fixedTime === null) {
		if (++slowFrames > 90) { quality *= 0.85; resize(); slowFrames = 0; frameAvg = 16; }
	} else slowFrames = 0;
	render();
	if (cardOpen) renderPreview(now);
	requestAnimationFrame(frame);
}

// ---------- the card preview and the tray thumbnails ----------
const pvCanvas = document.createElement("canvas");
pvCanvas.className = "pv";
const pv = new THREE.WebGLRenderer({ canvas: pvCanvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
pv.toneMapping = THREE.ACESFilmicToneMapping;
pv.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const pvScene = new THREE.Scene();
{
	const pm = new THREE.PMREMGenerator(pv);
	pvScene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
	pvScene.environmentIntensity = 0.9;
	const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
	key.position.set(2, 4, 3);
	pvScene.add(key);
}
const pvCam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
let pvObj = null, cardOpen = false, pvStart = 0;
function stagePreview(kind) {
	if (pvObj) pvScene.remove(pvObj);
	const isCritter = kind.tier === "critter";
	const o = isCritter ? CRITTER_BUILDERS[kind.id]() : ITEM_BUILDERS[kind.id]();
	const pivot = new THREE.Group();
	pivot.add(o);
	const box = new THREE.Box3().setFromObject(o);
	const c = box.getCenter(new THREE.Vector3());
	o.position.sub(c);
	const r = box.getSize(new THREE.Vector3()).length() / 2 || 0.05;
	pivot.scale.setScalar(1 / r);
	pvScene.add(pivot);
	pvObj = pivot;
	pvCam.position.set(0, 1.55, 3.3);
	pvCam.lookAt(0, 0, 0);
	if (isCritter && o.userData.animate) o.userData.animate(0.3, 0);
	return o;
}
function renderPreview(now) {
	if (!pvObj) return;
	pvObj.rotation.y = (now - pvStart) / 1000 * 0.7 + 0.4;
	const inner = pvObj.children[0];
	if (inner.userData.spin) inner.userData.spin(now / 1000);
	pv.render(pvScene, pvCam);
}
const thumbs = {};
function makeThumbs(done) {
	const list = ALL.slice();
	pv.setSize(112, 112, false);
	pvCam.aspect = 1;
	pvCam.updateProjectionMatrix();
	function step() {
		if (cardOpen) { setTimeout(step, 300); return; }
		const k = list.shift();
		if (!k) { done(); return; }
		try {
			pv.setSize(112, 112, false);
			pvCam.aspect = 1;
			pvCam.updateProjectionMatrix();
			stagePreview(k);
			pvObj.rotation.y = 0.5;
			pv.render(pvScene, pvCam);
			thumbs[k.id] = pvCanvas.toDataURL("image/png");
			const el = slotEls[k.id];
			if (el) el.querySelector(".e").innerHTML = '<img alt="" src="' + thumbs[k.id] + '">';
		} catch (e) { console.error(e); }
		setTimeout(step, 0);
	}
	step();
}

// ---------- UI ----------
const toastEl = document.getElementById("toast");
let toastTimer = null;
function toast(msg) {
	toastEl.textContent = msg;
	toastEl.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}
function money(v) { return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const slotsEl = document.getElementById("slots");
const slotEls = {};
GROUPS.forEach((grp) => {
	const lbl = document.createElement("span");
	lbl.className = "group";
	lbl.textContent = grp.label;
	slotsEl.appendChild(lbl);
	grp.kinds.forEach((k) => {
		const b = document.createElement("button");
		b.className = "slot";
		b.innerHTML = '<span class="e"></span>';
		b.addEventListener("click", () => { if (finds[k.id] && !busy && !tide) showCard(k, false, false); });
		slotsEl.appendChild(b);
		slotEls[k.id] = b;
	});
});
document.getElementById("kindCount").textContent = ALL.length;
function renderTray(popId) {
	let count = 0, haul = 0;
	ALL.forEach((k) => {
		const n = finds[k.id] || 0, el = slotEls[k.id];
		el.classList.toggle("found", n > 0);
		el.title = n ? k.name : "???";
		let badge = el.querySelector(".n");
		if (n > 1) {
			if (!badge) { badge = document.createElement("span"); badge.className = "n"; el.appendChild(badge); }
			badge.textContent = n;
		} else if (badge) badge.remove();
		if (n) count++;
		haul += n * (k.value || 0);
	});
	document.getElementById("foundCount").textContent = count;
	document.getElementById("haul").textContent = money(haul);
	if (popId) {
		const el = slotEls[popId];
		el.classList.remove("pop");
		void el.offsetWidth;
		el.classList.add("pop");
		el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
	}
}
function updateLeft() {
	const left = things.filter((b) => b.cat === "metal" && !b.found).length;
	document.getElementById("left").textContent = left ? left + " metal signals here" : "Beach cleared!";
}

const cardOverlay = document.getElementById("cardOverlay");
const cardEl = document.getElementById("card");
let pendingPop = null;
function showCard(k, isNew, fresh, depth) {
	busy = true;
	pendingPop = fresh ? k.id : null;
	const worth = k.tier === "critter" ? "" : '<div class="worth">' + (k.value ? "Worth " + money(k.value) : "Worth nothing. Keep it anyway.") + "</div>";
	cardEl.innerHTML =
		'<div class="big"></div>' +
		(isNew ? '<div class="new">NEW FIND!</div>' : "") +
		'<div class="tier ' + k.tier + '">' + TIER_LABEL[k.tier] + "</div>" +
		"<h2>" + k.name + "</h2>" +
		"<p>" + k.text + "</p>" + worth +
		(depth ? '<div class="where">Found ' + depth + " cm down" + ("vdi" in k ? "" : ", no beep at all") + "</div>" : "") +
		'<button class="go" id="pocket">' + (fresh ? "Pocket it" : "Nice") + "</button>";
	cardEl.querySelector(".big").appendChild(pvCanvas);
	pv.setSize(240, 170, false);
	pvCam.aspect = 240 / 170;
	pvCam.updateProjectionMatrix();
	stagePreview(k);
	pvStart = performance.now();
	cardOpen = true;
	cardEl.style.animation = "none";
	void cardEl.offsetWidth;
	cardEl.style.animation = "";
	cardOverlay.classList.add("show");
	const btn = document.getElementById("pocket");
	btn.addEventListener("click", closeCard);
	btn.focus();
}
function closeCard() {
	cardOverlay.classList.remove("show");
	cardOpen = false;
	busy = false;
	risers.forEach((r) => { if (!r.out) r.out = 0.0001; });
	renderTray(pendingPop);
	if (pendingPop) {
		pendingPop = null;
		if (cardQueue.length) { nextCard(); return; }
		updateLeft();
		if (things.every((b) => b.cat !== "metal" || b.found)) {
			toast("Beach cleared! Here comes the tide…");
			setTimeout(startTide, 1400);
		}
	}
}
cardOverlay.addEventListener("click", (e) => { if (e.target === cardOverlay) closeCard(); });

// ---------- input ----------
let touchStart = null;
canvas.addEventListener("pointermove", (e) => {
	pointer.sx = e.clientX;
	pointer.sy = e.clientY;
	pointer.has = true;
	pointer.touch = e.pointerType === "touch";
	if (pointer.touch) document.body.classList.add("touch");
});
canvas.addEventListener("pointerdown", (e) => {
	pointer.sx = e.clientX;
	pointer.sy = e.clientY;
	pointer.has = true;
	pointer.touch = e.pointerType === "touch";
	if (!started) return;
	if (pointer.touch) {
		document.body.classList.add("touch");
		touchStart = { x: e.clientX, y: e.clientY, t: performance.now() };
		return;
	}
	const g = screenToGround(e.clientX, e.clientY);
	if (g && reachClamp(g).beyond) walkTarget = { x: g.x, z: g.z };
	else dig(coil.x, coil.z);
});
canvas.addEventListener("pointerup", (e) => {
	if (!touchStart || !started) return;
	const moved = Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y);
	if (moved < 12 && performance.now() - touchStart.t < 350) {
		const g = screenToGround(e.clientX, e.clientY - 70);
		if (g && reachClamp(g).beyond) walkTarget = { x: g.x, z: g.z };
	}
	touchStart = null;
});
canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") walkRing.visible = false; });
document.getElementById("digBtn").addEventListener("click", () => dig(coil.x, coil.z));
window.addEventListener("keydown", (e) => {
	keys[e.code] = true;
	if (e.code === "Space" && !busy && started) { e.preventDefault(); dig(coil.x, coil.z); }
	if (e.code === "Escape" && busy && cardOverlay.classList.contains("show")) closeCard();
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

const muteBtn = document.getElementById("muteBtn");
muteBtn.addEventListener("click", () => {
	muted = !muted;
	muteBtn.textContent = muted ? "🔇" : "🔊";
	if (master) master.gain.value = muted ? 0 : 0.9;
});
document.getElementById("tideBtn").addEventListener("click", () => { if (started) startTide(); });
if (isTouch) {
	document.body.classList.add("touch");
	document.getElementById("digHint").textContent = "Drag to sweep, tap far sand to walk there, and tap DIG to dig.";
}
document.getElementById("startBtn").addEventListener("click", () => {
	document.getElementById("introOverlay").classList.remove("show");
	started = true;
	try { startAudio(); } catch (e) {}
});

let resizeTimer = null;
window.addEventListener("resize", () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(resize, 120);
});

// ---------- go ----------
resize();
bury();
surfaceStamps();
bakeAll();
buildDecor();
renderTray();
updatePlayer(0.016, 0);
document.body.classList.add("ready");
{
	const sb = document.getElementById("startBtn");
	sb.disabled = false;
	sb.textContent = "Switch it on 🔊";
}
requestAnimationFrame((now) => { last = now; frame(now); });
makeThumbs(() => {});

// for poking at it from the console (and for tests)
window.beach = {
	things: () => things,
	player,
	coil,
	dig: (x, z) => dig(x, z),
	setTime: (t) => { fixedTime = t; },
	start: () => document.getElementById("startBtn").click(),
	tide: () => startTide(),
	walkTo: (x, z) => { walkTarget = { x, z }; },
	teleport: (x, z) => { player.x = x; player.z = z; },
	aim: (x, z) => { pointer.has = false; coil.tx = x; coil.tz = z; },
	release: (id) => releaseCritter(CRITTERS.find((c) => c.id === id), { x: coil.x, z: coil.z, d: 0.05 }),
	reveal: (id) => { const k = ALL.find((c) => c.id === id); cardQueue.push({ kind: k, isNew: false, depth: 12, hole: { x: coil.x, z: coil.z, ang: 0 } }); nextCard(); },
	frameAvg: () => frameAvg
};
