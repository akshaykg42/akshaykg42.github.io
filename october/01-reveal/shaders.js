// GLSL for the beach. World units are metres: x runs along the beach, y is up,
// and the sea is toward -z. The mean waterline sits at z = uShoreZ.

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
	           mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
	float a = 0.5, s = 0.0;
	for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
	return s;
}
float fbm3(vec2 p) {
	float a = 0.5, s = 0.0;
	for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
	return s;
}
`;

// the beach profile: sand rising gently inland, the sea floor shelving away offshore
export const GROUND = /* glsl */ `
uniform float uShoreZ;
const float LAND_SLOPE = 0.045;
const float SEA_SLOPE = 0.04;
float baseY(vec2 p) {
	float d = uShoreZ - p.y;
	if (d < 0.0) return -d * LAND_SLOPE;
	float k = max(d - 22.0, 0.0);
	return max(-d * SEA_SLOPE - k * k * 0.004, -14.0);
}
`;

// waves: three in flight, each shoaling, pitching over, breaking into a bore and running up the sand
export const WAVES = /* glsl */ `
uniform float uTime;
uniform float uWl;        // still-water level right now (tide + swash)
uniform float uWlHigh;    // how far up the sand the swash reached lately
uniform float uWaveShore; // where the waves run out of water (moves with the tide)
uniform vec3 uSunDir;

const float WAVE_T = 7.0;

// q.x = along the beach, q.y = metres offshore
float breakers(vec2 q, float t, out float foam, out float glow, out float lean) {
	float h = 0.0;
	foam = 0.0;
	glow = 0.0;
	lean = 0.0;
	float ph = t / WAVE_T;
	for (int k = 0; k < 3; k++) {
		float i = floor(ph) - float(k);
		float a = (ph - i) / 3.0;
		float seed = i * 1.7;
		float D = 44.0 * pow(1.0 - a, 1.25);
		float crest = D + 0.9 * sin(q.x * 0.09 + seed) + 0.5 * sin(q.x * 0.23 - seed * 0.6);
		float dBreak = 7.5 + 2.0 * sin(q.x * 0.05 + seed * 2.3) + 0.9 * sin(q.x * 0.13 + seed);
		float broken = smoothstep(dBreak + 0.3, dBreak - 1.5, D);
		float grow = smoothstep(44.0, dBreak, D);
		float H = (0.08 + 0.42 * grow * grow) * (0.85 + 0.25 * sin(q.x * 0.07 + seed));
		float bore = 0.03 + 0.13 * smoothstep(0.0, 7.0, D);
		H = mix(H, bore * (0.9 + 0.2 * sin(q.x * 0.1 + seed)), broken);
		H *= smoothstep(-0.5, 1.2, D) * smoothstep(44.0, 38.0, D);
		float dy = q.y - crest;
		float front = mix(3.2, 0.85, grow * grow);
		front = mix(front, 1.4, broken);
		float back = mix(7.0, 3.5, grow);
		float prof = dy < 0.0 ? exp(-dy * dy / (front * front)) : exp(-dy * dy / (back * back));
		h += H * prof;
		// the crest throws forward just before it goes
		float pitch = grow * grow * grow * (1.0 - broken);
		lean += H * 0.9 * pitch * exp(-dy * dy / 0.18);
		// sunlight through the thin face
		glow += prof * (1.0 - smoothstep(-0.3, 0.5, dy)) * pitch;
		// whitewater: a churning band at the bore, a fading wake behind it
		float age = clamp((dBreak - D) / 7.0, 0.0, 1.0);
		float band = smoothstep(-front * 1.1, -front * 0.15, dy) * (1.0 - smoothstep(0.3, 1.2 + 8.0 * age, dy));
		foam += broken * band * (1.0 - 0.45 * age);
		// spray feathering off the lip
		foam += smoothstep(dBreak + 2.5, dBreak, D) * (1.0 - broken) * exp(-pow((dy + 0.12) / 0.22, 2.0)) * 0.9;
	}
	return h;
}

float swell(vec2 p, float t) {
	return 0.05 * sin(-p.y * 0.26 + t * 1.1 + vnoise(p * 0.03) * 3.0)
	     + 0.04 * sin(dot(p, vec2(0.09, -0.17)) + t * 0.9)
	     + 0.03 * sin(dot(p, vec2(-0.13, -0.21)) + t * 1.3);
}

float vorEdge(vec2 x, float t) {
	vec2 n = floor(x), f = fract(x);
	float f1 = 8.0, f2 = 8.0;
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			vec2 g = vec2(float(i), float(j));
			vec2 o = hash22(n + g);
			o = 0.5 + 0.42 * sin(t + 6.2831 * o);
			vec2 r = g + o - f;
			float d = dot(r, r);
			if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
		}
	}
	return sqrt(f2) - sqrt(f1);
}

// the bright net of light that ripples throw on the sea floor
float caustics(vec2 p, float t) {
	vec2 q = p * 6.0;
	q += vec2(vnoise(q * 0.7 + t * 0.35), vnoise(q * 0.7 + 5.2 - t * 0.3)) * 1.2;
	float a = vorEdge(q, t * 0.9);
	vec2 q2 = p * 8.4 + 3.1;
	q2 += vec2(vnoise(q2 * 0.6 - t * 0.3), vnoise(q2 * 0.6 + 2.7 + t * 0.4)) * 1.2;
	float b = vorEdge(q2, t * 1.1);
	float la = exp(-a * a * 90.0), lb = exp(-b * b * 120.0);
	return la * 0.55 + lb * 0.35 + la * lb * 1.4;
}
`;

// sky with drifting clouds and a hazy headland (the ridge shape is adapted from Clearwater, MIT)
export const SKY = /* glsl */ `
float ridge(float a) {
	return 0.040 + 0.016 * sin(a * 2.0 + 0.7) + 0.011 * sin(a * 5.0 + 2.1) + 0.006 * sin(a * 11.0 + 0.3) + 0.003 * sin(a * 23.0 + 1.7);
}
const vec3 SKY_HOR = vec3(0.50, 0.64, 0.82);
vec3 skyColor(vec3 d, float detail) {
	float e = d.y;
	float mu = max(dot(d, uSunDir), 0.0);
	vec3 zen = vec3(0.06, 0.19, 0.55);
	vec3 c = mix(SKY_HOR, zen, pow(clamp(e, 0.0, 1.0), 0.5));
	c += vec3(1.0, 0.84, 0.62) * (0.22 * pow(mu, 5.0) + 0.55 * pow(mu, 48.0));
	c += vec3(1.0, 0.93, 0.82) * 40.0 * smoothstep(0.99985, 0.99993, mu) * max(detail, 0.0);
	if (e > 0.0 && detail < -0.5) {
		// seen in the water: the clouds smear into a soft brightening
		c = mix(c, vec3(1.0, 0.98, 0.96), 0.22 * smoothstep(0.0, 0.1, e));
	} else if (e > 0.0) {
		vec2 cp = vec2(d.x, -d.z) / (e + 0.06) * 0.9 + vec2(uTime * 0.004, 0.0);
		float cl = smoothstep(0.56, 0.86, fbm(cp * 2.2));
		vec3 cc = vec3(1.0, 0.98, 0.96) * (0.95 + 0.7 * pow(mu, 4.0));
		c = mix(c, cc, cl * 0.75 * smoothstep(0.0, 0.04, e));
	}
	float a = atan(d.x, -d.z);
	float r = (ridge(a * 1.6) - 0.028) * smoothstep(0.05, -0.35, a);
	if (r > 0.0) {
		float tex = fbm3(vec2(a * 300.0, e * 300.0));
		vec3 land = mix(vec3(0.05, 0.07, 0.05), vec3(0.15, 0.17, 0.14), tex);
		land = mix(land, SKY_HOR * 0.9, 0.62);
		c = mix(c, land, smoothstep(r + 0.0015, r - 0.0015, e) * step(-0.01, e));
	}
	if (e < 0.0) c = mix(SKY_HOR * 0.85, vec3(0.32, 0.26, 0.18), smoothstep(0.0, -0.15, e));
	return c;
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
	vec4 wp = modelMatrix * vec4(position, 1.0);
	vDir = wp.xyz - cameraPosition;
	gl_Position = projectionMatrix * viewMatrix * wp;
	gl_Position.z = gl_Position.w * 0.99999;
}
`;

export const SKY_FRAG = /* glsl */ `
uniform float uDetail;
varying vec3 vDir;
${NOISE}
uniform float uTime;
uniform vec3 uSunDir;
${SKY}
void main() {
	gl_FragColor = vec4(skyColor(normalize(vDir), uDetail), 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

// ---------- the sand, baked in world space into two textures ----------
// albedo (sRGB) and height / pit / sun visibility (half float).
// Stamps are holes (type 0), footprints (1 left, 2 right), crab burrows (3) and worm casts (4).
export const BAKE_VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const BAKE_FRAG = /* glsl */ `
uniform int uMode;
uniform vec2 uTexSize;
uniform vec4 uRegion;
uniform vec4 uStA[64];   // x, z, size, depth
uniform vec4 uStB[64];   // type, angle
uniform int uStN;
uniform vec3 uSunDir;
${NOISE}
${GROUND}

float stampH(vec2 p, out float pit) {
	float h = 0.0;
	pit = 0.0;
	for (int i = 0; i < 64; i++) {
		if (i >= uStN) break;
		vec4 a = uStA[i];
		vec4 b = uStB[i];
		vec2 d = p - a.xy;
		float rr = (b.x > 0.5 && b.x < 2.5) ? 0.2 * a.z : a.z * 3.2;
		if (dot(d, d) > rr * rr) continue;
		if (b.x < 0.5) {
			// a dug hole, with the sand thrown out piled beside it
			float r = a.z;
			float wob = 1.0 + 0.12 * (vnoise(d * 22.0 + a.xy * 7.0) - 0.5);
			float dd = length(d) / (r * wob);
			float bowl = 1.0 - smoothstep(0.15, 1.0, dd);
			bowl = bowl * bowl * (3.0 - 2.0 * bowl);
			h -= a.w * bowl;
			pit = max(pit, smoothstep(1.05, 0.6, dd));
			vec2 dir = vec2(cos(b.y), sin(b.y));
			vec2 sp = d - dir * r * 1.7;
			sp = vec2(dot(sp, dir), dot(sp, vec2(-dir.y, dir.x)));
			float pile = exp(-(sp.x * sp.x * 1.6 + sp.y * sp.y * 0.8) / (r * r));
			h += pile * a.w * 0.5 * (0.75 + 0.5 * vnoise(p * 40.0 + a.xy));
			h += exp(-pow((dd - 1.08) * 5.0, 2.0)) * a.w * 0.12;
		} else if (b.x < 2.5) {
			// a bare footprint: heel, arch, ball and toes, pressed in with a little rim
			float c = cos(b.y), s = sin(b.y);
			vec2 q = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / a.z;
			if (b.x > 1.5) q.x = -q.x;
			float heel = length((q - vec2(0.0, -0.085)) / vec2(0.032, 0.040));
			float arch = length((q - vec2(0.017, -0.015)) / vec2(0.022, 0.060));
			float ball = length((q - vec2(0.004, 0.050)) / vec2(0.044, 0.042));
			float e = min(min(heel, arch), ball);
			for (int j = 0; j < 5; j++) {
				float fj = float(j);
				vec2 tp = vec2(-0.030 + 0.015 * fj, 0.106 - 0.004 * fj * fj);
				float tr = 0.011 - 0.0012 * fj;
				e = min(e, length((q - tp) / vec2(tr * 0.85, tr)) * 1.05);
			}
			float press = 1.0 - smoothstep(0.6, 1.15, e);
			h += -press * a.w + exp(-pow((e - 1.25) * 3.0, 2.0)) * a.w * 0.3;
		} else if (b.x < 3.5) {
			// a crab's burrow: a neat round hole with pellets kicked out around it
			float dd = length(d) / a.z;
			float hole = 1.0 - smoothstep(0.5, 1.0, dd);
			h -= a.w * hole;
			pit = max(pit, hole);
			float ring = exp(-pow((dd - 1.9) / 0.9, 2.0));
			h += ring * a.w * 0.35 * smoothstep(0.55, 0.85, vnoise(p * 160.0));
		} else {
			// a lugworm cast: a little coil of squeezed-out sand
			vec2 q = d / a.z;
			float ang = atan(q.y, q.x) + b.y;
			float rad = length(q);
			float coil = sin(ang * 3.0 + rad * 9.0);
			h += a.w * exp(-rad * rad * 1.2) * (0.6 + 0.4 * coil);
		}
	}
	return h;
}

float sandH(vec2 p, out float pit) {
	float inland = p.y - uShoreZ;
	float h = (fbm(p * 0.35) - 0.5) * 0.10;
	// wind ripples on the dry sand
	vec2 q = p + vec2(fbm(p * 0.6), fbm(p * 0.6 + 5.0)) * 0.8;
	float ph = dot(q, normalize(vec2(1.0, 0.3))) * 50.0;
	float r = sin(ph);
	r = r > 0.0 ? pow(r, 0.7) : -pow(-r, 1.6) * 0.6;
	float dry = smoothstep(3.8, 5.5, inland);
	h += r * 0.0055 * dry * (0.45 + 0.55 * fbm(p * 1.0));
	// backwash rills and swash marks on the wet sand
	h += sin(inland * 26.0 + fbm(p * 2.0) * 9.0) * 0.0012 * (1.0 - dry);
	h += (fbm(p * 5.0) - 0.5) * 0.007;
	float sp;
	h += stampH(p, sp);
	pit = sp;
	return h;
}

void main() {
	vec2 tc = gl_FragCoord.xy / uTexSize;
	vec2 p = uRegion.xy + tc * uRegion.zw;
	float pit;
	if (uMode == 1) {
		float h = sandH(p, pit);
		// holes throw shadows inside themselves
		float vis = 1.0;
		bool near = false;
		for (int i = 0; i < 64; i++) {
			if (i >= uStN) break;
			vec2 d = p - uStA[i].xy;
			float rr = (uStB[i].x > 0.5 && uStB[i].x < 2.5) ? 0.25 : uStA[i].z * 3.5 + 0.1;
			if (dot(d, d) < rr * rr) { near = true; break; }
		}
		if (near) {
			vec2 sd = normalize(uSunDir.xz);
			float tanE = uSunDir.y / length(uSunDir.xz);
			float tmp;
			float h0 = stampH(p, tmp);
			for (int i = 1; i <= 14; i++) {
				float s = float(i) * 0.022;
				float hs = stampH(p + sd * s, tmp);
				vis = min(vis, clamp(1.0 - (hs - (h0 + s * tanE)) * 80.0, 0.0, 1.0));
			}
		}
		gl_FragColor = vec4(h, pit, vis, 1.0);
		return;
	}
	sandH(p, pit);
	float inland = p.y - uShoreZ;
	vec3 alb = mix(vec3(0.66, 0.51, 0.32), vec3(0.59, 0.45, 0.28), smoothstep(0.3, 0.75, fbm(p * 1.2)));
	alb = mix(alb, vec3(0.72, 0.64, 0.50), smoothstep(0.55, 0.8, fbm(p * 3.0 + 3.0)) * 0.45);
	// dark mineral streaks the backwash sorted out
	alb = mix(alb, vec3(0.26, 0.22, 0.19), smoothstep(0.62, 0.8, fbm(vec2(p.x * 0.6, p.y * 4.0) + 11.0)) * (1.0 - smoothstep(2.5, 4.5, inland)) * 0.55);
	float g = hash12(gl_FragCoord.xy);
	float g2 = hash12(gl_FragCoord.xy + 71.3);
	alb *= 0.9 + 0.2 * g;
	alb *= 0.97 + 0.06 * g2;
	// wrack line: dried seaweed where the last high tide reached
	float wy = 4.6 + (fbm(vec2(p.x * 0.4, 1.3)) - 0.5) * 1.6;
	float band = exp(-pow((inland - wy) / 0.3, 2.0));
	float weed = smoothstep(0.64, 0.72, fbm(p * vec2(20.0, 12.0) + 9.0)) * band;
	alb = mix(alb, mix(vec3(0.08, 0.06, 0.025), vec3(0.18, 0.14, 0.06), g), weed * 0.8);
	// freshly dug sand is damp and darker
	alb = mix(alb, alb * vec3(0.76, 0.72, 0.68), pit);
	gl_FragColor = vec4(alb, 1.0);
}
`;

// ---------- the sand surface: injected into MeshStandardMaterial ----------
export const SAND_VERT_PARS = /* glsl */ `
uniform sampler2D uHeightTex;
uniform vec4 uRegion;
varying vec3 vWPos;
${NOISE}
${GROUND}
float sandDetail(vec2 p) {
	vec2 uv = (p - uRegion.xy) / uRegion.zw;
	float e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
	float inside = smoothstep(0.0, 0.02, e);
	float proc = (fbm(p * 0.35) - 0.5) * 0.10;
	if (inside <= 0.0) return proc;
	return mix(proc, textureLod(uHeightTex, uv, 0.0).r, inside);
}
`;

export const SAND_VERT_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
vec4 sandW = modelMatrix * vec4(position, 1.0);
float sandY = baseY(sandW.xz) + sandDetail(sandW.xz);
transformed.y = sandY - modelMatrix[3].y;
vWPos = vec3(sandW.x, sandY, sandW.z);
`;

export const SAND_FRAG_PARS = /* glsl */ `
uniform sampler2D uHeightTex;
uniform sampler2D uAlbedoTex;
uniform vec4 uRegion;
uniform vec2 uTexel;
uniform vec3 uCausticCol;
varying vec3 vWPos;
${NOISE}
${GROUND}
${WAVES}
`;

export const SAND_FRAG_MAP = /* glsl */ `
vec2 sp = vWPos.xz;
vec2 suv = (sp - uRegion.xy) / uRegion.zw;
float se = min(min(suv.x, 1.0 - suv.x), min(suv.y, 1.0 - suv.y));
float sIn = smoothstep(0.0, 0.02, se);
vec4 sH = texture2D(uHeightTex, suv);
vec3 sAlb = texture2D(uAlbedoTex, suv).rgb;
vec3 sProc = mix(vec3(0.66, 0.51, 0.32), vec3(0.55, 0.41, 0.25), smoothstep(0.3, 0.75, fbm3(sp * 1.2)));
sAlb = mix(sProc, sAlb, sIn);
float sPit = sH.g * sIn;
float sVis = mix(1.0, sH.b, sIn);
float sDist = length(vWPos - cameraPosition);
// individual grains, drawn per pixel so they stay sharp up close and fade before they shimmer
{
	float fw = max(length(fwidth(sp)), 1e-6);
	float fine = smoothstep(1.2, 2.5, (1.0 / 1100.0) / fw);
	float coarse = smoothstep(1.2, 2.5, (1.0 / 380.0) / fw);
	float g1 = hash12(floor(sp * 1100.0));
	vec3 grain = vec3(1.0 + (g1 - 0.5) * 0.45 * fine);
	float g3 = hash12(floor(sp * 380.0) + 3.3);
	vec3 odd = g3 > 0.982 ? vec3(0.38, 0.35, 0.33) : g3 > 0.968 ? vec3(1.18, 0.92, 0.80) : g3 < 0.014 ? vec3(1.32, 1.30, 1.24) : vec3(1.0);
	grain *= mix(vec3(1.0), odd, coarse);
	float gm = hash12(floor(sp * 140.0) + 9.1);
	grain *= 1.0 + (gm - 0.5) * 0.12 * coarse;
	sAlb *= grain;
}
float sEdge = (fbm3(vec2(sp.x * 0.8, uTime * 0.22)) - 0.5) * 0.015;
float sAbove = vWPos.y - (uWl + sEdge);
float sWet = 1.0 - smoothstep(0.0, 0.03, vWPos.y - (uWlHigh + sEdge));
float sFilm = sWet * exp(-max(sAbove, 0.0) / 0.006);
sAlb *= mix(vec3(1.0), vec3(0.50, 0.51, 0.53), sWet);
diffuseColor.rgb = sAlb;
`;

export const SAND_FRAG_ROUGH = /* glsl */ `
// dry sand is matte; sand the swash just left is glassy, then dulls as it drains
float roughnessFactor = mix(0.97, 0.42, sWet);
roughnessFactor = mix(roughnessFactor, 0.07, max(sFilm, sWet * smoothstep(0.03, 0.0, vWPos.y - uWlHigh) * 0.85));
`;

export const SAND_FRAG_NORMAL = /* glsl */ `
{
	vec2 du = vec2(uTexel.x, 0.0), dv = vec2(0.0, uTexel.y);
	float hl = texture2D(uHeightTex, suv - du).r, hr = texture2D(uHeightTex, suv + du).r;
	float hd = texture2D(uHeightTex, suv - dv).r, hu = texture2D(uHeightTex, suv + dv).r;
	float ddx = 2.0 * uTexel.x * uRegion.z, ddz = 2.0 * uTexel.y * uRegion.w;
	vec2 grad = vec2((hr - hl) / ddx, (hu - hd) / ddz) * sIn;
	grad.y += (baseY(sp + vec2(0.0, 0.05)) - baseY(sp - vec2(0.0, 0.05))) / 0.1;
	// individual grains catching the light up close
	float gf = exp(-sDist / 1.6) * (1.0 - sWet * 0.7);
	vec2 gq = floor(sp * 700.0);
	grad += (vec2(hash12(gq), hash12(gq + 13.7)) - 0.5) * 0.6 * gf;
	vec3 wn = normalize(vec3(-grad.x, 1.0, -grad.y));
	normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}
`;

export const SAND_FRAG_EMISSIVE = /* glsl */ `
if (vWPos.y < uWl + 0.6) {
	float bf, bg, bl;
	float ws = uWl + breakers(vec2(sp.x, uWaveShore - sp.y), uTime, bf, bg, bl);
	float wd = ws - vWPos.y;
	if (wd > 0.0) {
		float ca = caustics(sp, uTime);
		totalEmissiveRadiance += sAlb * uCausticCol * ca * smoothstep(0.0, 0.06, wd) * exp(-wd * 0.6) * sVis;
	}
}
`;

export const SAND_FRAG_LIGHTS_END = /* glsl */ `
#include <lights_fragment_end>
reflectedLight.directDiffuse *= sVis;
reflectedLight.directSpecular *= sVis * mix(1.0, 0.45, sWet * (1.0 - sFilm));
reflectedLight.indirectDiffuse *= 1.0 - 0.3 * sPit;
reflectedLight.indirectSpecular *= (1.0 - 0.6 * sPit) * mix(0.35, 1.0, sWet);
// sunlight bouncing off the lit walls into the shadowed ones
reflectedLight.directDiffuse += sAlb * 0.3 * sPit;
`;

// ---------- the sea surface ----------
export const WATER_VERT = /* glsl */ `
${NOISE}
${WAVES}
varying vec3 vW;
varying vec2 vQ;
varying float vViewZ;
void main() {
	vec4 wp = modelMatrix * vec4(position, 1.0);
	vec2 q = vec2(wp.x, uWaveShore - wp.z);
	float f, g, l;
	float bh = breakers(q, uTime, f, g, l);
	float y = uWl + bh + swell(wp.xz, uTime) * smoothstep(2.0, 14.0, q.y);
	vec3 p = vec3(wp.x, y, wp.z + l);
	vQ = wp.xz;
	vW = p;
	vec4 mv = viewMatrix * vec4(p, 1.0);
	vViewZ = mv.z;
	gl_Position = projectionMatrix * mv;
}
`;

export const WATER_FRAG = /* glsl */ `
#include <packing>
${NOISE}
${WAVES}
${SKY}
uniform sampler2D uSceneTex;
uniform sampler2D uDepthTex;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uSunCol;
varying vec3 vW;
varying vec2 vQ;
varying float vViewZ;

vec3 surfP(vec2 xz, out float foam, out float glow) {
	float l;
	vec2 q = vec2(xz.x, uWaveShore - xz.y);
	float bh = breakers(q, uTime, foam, glow, l);
	float y = uWl + bh + swell(xz, uTime) * smoothstep(2.0, 14.0, q.y);
	return vec3(xz.x, y, xz.y + l);
}
float detailH(vec2 p, float t) {
	return 0.030 * vnoise(p * 1.1 + t * vec2(0.15, 0.55))
	     + 0.012 * vnoise(p * 2.7 + t * vec2(-0.35, 0.7))
	     + 0.005 * vnoise(p * 6.3 - t * vec2(0.5, -0.9))
	     + 0.0022 * vnoise(p * 15.0 + t * vec2(0.9, 1.3));
}
float sceneDist(vec2 uv) {
	return -perspectiveDepthToViewZ(texture2D(uDepthTex, uv).r, uNear, uFar);
}

void main() {
	float t = uTime;
	vec3 V = cameraPosition - vW;
	float dist = length(V);
	V /= dist;

	float foam, glow, f2, g2;
	// widen the normal footprint with the pixel footprint so far chop doesn't alias into speckle
	vec2 fw = fwidth(vQ);
	float e = max(0.05 + dist * 0.003, max(fw.x, fw.y) * 1.2);
	vec3 P0 = surfP(vQ, foam, glow);
	vec3 Px = surfP(vQ + vec2(e, 0.0), f2, g2);
	vec3 Pz = surfP(vQ + vec2(0.0, e), f2, g2);
	vec3 n = normalize(cross(Pz - P0, Px - P0));
	float lod = exp(-dist / 45.0);
	float de = 0.03;
	float d0 = detailH(vQ, t);
	vec2 dg = vec2(detailH(vQ + vec2(de, 0.0), t) - d0, detailH(vQ + vec2(0.0, de), t) - d0) / de;
	n = normalize(n + vec3(-dg.x, 0.0, -dg.y) * lod * (1.0 - 0.5 * clamp(foam, 0.0, 1.0)));
	// tiny facets up close, so the sun breaks into glitter instead of one blob
	float near = exp(-dist / 12.0);
	vec2 mq = vQ * 46.0 + t * vec2(1.7, 2.9);
	n = normalize(n + vec3(vnoise(mq) - 0.5, 0.0, vnoise(mq + 17.3) - 0.5) * 0.22 * near);

	// what's under the surface, bent by the waves
	vec2 uv = gl_FragCoord.xy / uRes;
	float myZ = -vViewZ;
	float sZ = sceneDist(uv);
	float thick = max(sZ - myZ, 0.0) * dist / myZ;
	vec3 nv = (viewMatrix * vec4(n, 0.0)).xyz;
	vec3 nf = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
	vec2 off = (nv.xy - nf.xy) * 0.09 * clamp(thick * 1.5, 0.0, 1.0);
	vec2 uvR = clamp(uv + off, 0.001, 0.999);
	float sZR = sceneDist(uvR);
	if (sZR < myZ) { uvR = uv; sZR = sZ; }
	float thickR = max(sZR - myZ, 0.0) * dist / myZ;
	vec3 bed = texture2D(uSceneTex, uvR).rgb;

	float vEdge = thick * max(V.y, 0.02);
	float vd = thickR * max(V.y, 0.02);
	float cosT = sqrt(1.0 - (1.0 - V.y * V.y) / 1.777);
	float path = vd / cosT + vd * 1.4;
	float offshore = uWaveShore - vQ.y;
	float turb = (1.0 - smoothstep(4.0, 16.0, offshore)) * 0.55 + clamp(foam, 0.0, 1.0) * 0.35;
	vec3 absorb = mix(vec3(0.42, 0.085, 0.065), vec3(0.6, 0.35, 0.45), turb * 0.6);
	vec3 T = exp(-absorb * path);
	vec3 scat = mix(vec3(0.006, 0.05, 0.085), vec3(0.06, 0.075, 0.05), turb);
	vec3 col = bed * T + scat * (1.0 - T);

	// sky and sun on the surface
	float cosi = max(dot(n, V), 0.0);
	float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
	F *= smoothstep(0.0, 0.03, vEdge);
	vec3 R = reflect(-V, n);
	R.y = abs(R.y);
	float sd = max(dot(R, uSunDir), 0.0);
	// far off, the chop tilts the surface toward you: less mirror, more deep blue
	R.y += 0.12 * smoothstep(20.0, 400.0, dist);
	R = normalize(R);
	col = mix(col, skyColor(R, -1.0) * 0.85, F * mix(1.0, 0.75, smoothstep(30.0, 600.0, dist)));
	float sharp = pow(sd, 1800.0) * 14.0 * exp(-dist / 70.0);
	col += uSunCol * (sharp + pow(sd, 160.0) * 0.06 + pow(sd, 24.0) * 0.03 * smoothstep(40.0, 400.0, dist)) * smoothstep(0.0, 0.02, vEdge);
	// the face of a wave about to break, lit green from behind
	col = mix(col, vec3(0.035, 0.26, 0.21) * 1.3, clamp(glow, 0.0, 1.0) * 0.6);

	// foam: lace at the waterline, whitewater where waves have broken
	vec2 fp = mat2(0.8, -0.6, 0.6, 0.8) * vQ;
	float fn = fbm(fp * vec2(3.0, 5.0) + vec2(t * 0.1, t * 0.3)) * 0.7 + fbm3(fp * 13.0 - vec2(0.0, t * 0.4)) * 0.3;
	// lacy network of bubbles that thickens into solid whitewater
	vec2 lq = vQ * vec2(7.0, 9.5) + vec2(0.0, t * 0.5);
	lq += vec2(fbm3(lq * 0.45 + t * 0.04), fbm3(lq * 0.45 + 4.0 - t * 0.03)) * 2.2;
	float le = vorEdge(lq, t * 0.2);
	float le2 = vorEdge(lq * 2.4 + 5.0, t * 0.3);
	float shore = 1.0 - smoothstep(0.0, 0.05, vEdge);
	float fa = clamp(max(foam * 1.3, shore * 0.8), 0.0, 1.0);
	float lw = 0.015 + 0.3 * fa * fa;
	float lines = max(1.0 - smoothstep(0.0, lw, le), (1.0 - smoothstep(0.0, lw * 0.7, le2)) * 0.55);
	// broken up: patches of net, thin streaks, and bare water in between
	float mask = smoothstep(0.38, 0.62, fbm3(vQ * vec2(1.1, 1.6) + vec2(0.0, t * 0.08)) + fa * 0.45);
	float bub = step(0.955, hash12(floor(vQ * 140.0 + vec2(0.0, t * 3.0)))) * smoothstep(0.3, 0.7, fbm3(vQ * 2.5));
	float lace = max(lines * mask, bub * 0.7) * (0.65 + 0.35 * vnoise(vQ * 9.0));
	float white = fa * mix(lace, 1.0, smoothstep(0.75, 1.0, fa * (0.7 + 0.5 * fn)));
	// whitewater isn't a solid sheet: it tears into clumps and streaks
	white *= mix(1.0, smoothstep(0.28, 0.62, fn + 0.25 * vnoise(fp * vec2(2.0, 9.0))), smoothstep(0.2, 0.8, foam));
	white *= 0.7 + 0.3 * smoothstep(0.3, 0.7, fn);
	float fm = clamp(white, 0.0, 1.0) * mix(lod, 1.0, 0.7);
	// churned whitewater has lumps that catch the sun and shade themselves
	float fh0 = fbm3(fp * 7.0 - vec2(0.0, t * 0.5));
	vec2 fg = vec2(fbm3(fp * 7.0 + vec2(0.05, 0.0) - vec2(0.0, t * 0.5)) - fh0, fbm3(fp * 7.0 + vec2(0.0, 0.05) - vec2(0.0, t * 0.5)) - fh0) * 6.0 * lod;
	vec3 fnrm = normalize(n + vec3(-fg.x, 0.0, -fg.y));
	vec3 foamCol = vec3(0.90, 0.93, 0.94) * (0.5 + 0.95 * max(dot(fnrm, uSunDir), 0.0)) * (0.85 + 0.25 * fh0);
	col = mix(col, foamCol, fm * 0.95);

	col = mix(col, uFogColor, 1.0 - exp(-dist * uFogDensity));
	col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, 1.15), 0.0);
	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

// copies the opaque pass to the screen, depth included, so the sea can depth-test against it
export const COMPOSITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
	vec3 c = texture2D(tColor, vUv).rgb;
	c = max(mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 1.15), 0.0);
	gl_FragColor = vec4(c, 1.0);
	gl_FragDepth = texture2D(tDepth, vUv).r;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

export const SPRAY_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vA;
void main() {
	vec4 mv = modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
	gl_Position = projectionMatrix * mv;
	vA = aAlpha;
}
`;
export const SPRAY_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
	float r = length(gl_PointCoord - 0.5) * 2.0;
	float a = (1.0 - smoothstep(0.2, 1.0, r)) * vA;
	if (a < 0.01) discard;
	gl_FragColor = vec4(uColor, a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;
