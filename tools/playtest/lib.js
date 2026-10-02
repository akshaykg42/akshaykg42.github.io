// Shared harness for the October playtests: serves the repo, opens a page in headless
// Chromium (software WebGL), records errors, and collects PASS/FAIL checks.
//
// Setup once:  cd tools/playtest && npm i three@0.170.0
// Playwright comes from $PLAYWRIGHT, /opt/node-tools, or a normal `require("playwright")`.
const http = require("http");
const fs = require("fs");
const path = require("path");

function loadPlaywright() {
	for (const p of [process.env.PLAYWRIGHT, "/opt/node-tools/node_modules/playwright", "playwright"]) {
		if (!p) continue;
		try { return require(p); } catch (e) {}
	}
	throw new Error("playwright not found; set PLAYWRIGHT to its module path");
}

const ROOT = path.resolve(__dirname, "../..");
const THREE_DIR = process.env.THREE_DIR || path.join(__dirname, "node_modules/three");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json" };

function serve() {
	return new Promise((resolve) => {
		const srv = http.createServer((req, res) => {
			let p = decodeURIComponent(req.url.split("?")[0]);
			if (p.endsWith("/")) p += "index.html";
			const f = path.join(ROOT, p);
			if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
			res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
			fs.createReadStream(f).pipe(res);
		});
		srv.listen(0, () => resolve(srv));
	});
}

class Run {
	constructor(name, outDir) {
		this.name = name;
		this.outDir = outDir;
		this.results = [];
		this.errors = [];
	}
	check(label, ok, detail) {
		this.results.push({ label, ok: !!ok, detail });
		console.log((ok ? "PASS " : "FAIL ") + "[" + this.name + "] " + label + (detail !== undefined ? "  " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""));
		return ok;
	}
	note(msg) { console.log("     [" + this.name + "] " + msg); }
	async shot(page, file) {
		if (!this.outDir) return;
		fs.mkdirSync(this.outDir, { recursive: true });
		try { await page.screenshot({ path: path.join(this.outDir, this.name + "-" + file + ".png"), timeout: 150000 }); }
		catch (e) { this.note("screenshot failed: " + e.message.slice(0, 120)); }
	}
}

async function open(run, url, { width, height, touch }) {
	const { chromium } = loadPlaywright();
	const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
	const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
	const page = await ctx.newPage();
	page.on("console", (m) => { if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) run.errors.push("console: " + m.text().slice(0, 400)); });
	page.on("requestfailed", (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) run.errors.push("request failed: " + r.url()); });
	page.on("pageerror", (e) => run.errors.push("pageerror: " + e.message.slice(0, 400)));
	if (fs.existsSync(THREE_DIR)) {
		await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, (route) => {
			const rel = route.request().url().replace(/^.*\/npm\/three@[^/]+\//, "");
			route.fulfill({ path: path.join(THREE_DIR, rel), contentType: "application/javascript" });
		});
	}
	await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
	await page.goto(url);
	return { browser, ctx, page };
}

// Everything visible on screen that holds text should fit inside its box and the viewport,
// and the named HUD pieces should not sit on top of each other.
async function layoutProblems(page, hudSelectors) {
	return page.evaluate((hud) => {
		const out = [];
		const vw = innerWidth, vh = innerHeight;
		const shown = (e) => {
			for (let n = e; n && n !== document.body; n = n.parentElement) {
				const cs = getComputedStyle(n);
				if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false;
			}
			const r = e.getBoundingClientRect();
			return r.width > 0 && r.height > 0;
		};
		const name = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : "");
		for (const e of document.querySelectorAll("body *")) {
			if (e.tagName === "CANVAS" || !shown(e)) continue;
			const ownText = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
			const cs = getComputedStyle(e);
			if (ownText && (cs.overflow !== "visible" || cs.textOverflow === "ellipsis") && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1))
				out.push("text clipped in " + name(e) + ": " + e.textContent.trim().slice(0, 50));
			let scroller = false;
			for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) if (/auto|scroll/.test(getComputedStyle(n).overflowX + getComputedStyle(n).overflowY)) scroller = true;
			if (ownText && !scroller) {
				const r = e.getBoundingClientRect();
				if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.push("off screen: " + name(e) + " " + e.textContent.trim().slice(0, 40));
			}
		}
		const boxes = hud.map((s) => [s, document.querySelector(s)]).filter(([, e]) => e && shown(e)).map(([s, e]) => [s, e.getBoundingClientRect()]);
		for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
			const a = boxes[i][1], b = boxes[j][1];
			const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
			if (w > 2 && h > 2) out.push("overlap: " + boxes[i][0] + " and " + boxes[j][0]);
		}
		return out;
	}, hudSelectors);
}

function summary(runs) {
	let fails = 0, total = 0;
	for (const r of runs) {
		total += r.results.length;
		fails += r.results.filter((x) => !x.ok).length;
		if (r.errors.length) {
			fails++;
			console.log("FAIL [" + r.name + "] page errors:\n  " + [...new Set(r.errors)].slice(0, 20).join("\n  "));
		}
	}
	console.log("\n" + (fails ? fails + " problem(s)" : "all clear") + " across " + total + " checks");
	return fails;
}

module.exports = { serve, open, Run, layoutProblems, summary, ROOT };
