// Plays Day 1 (Beach Detector) on a desktop and a phone viewport and reports anything broken.
//   node tools/playtest/day01-reveal.js [desktop|phone] [--shots DIR]
// Input goes through real keyboard, mouse and touch events where it can; the simulation is
// advanced with beach.step() so the run doesn't depend on how fast software WebGL renders.
const { serve, open, Run, layoutProblems, summary } = require("./lib");

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith("--") && !/[/]/.test(a));
const shotsAt = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const HUD = [".top .tag", ".top .buttons", ".lcd", "#digBtn", "#stick", ".tray", "#toast"];
const FPS = 30;

// Advance the game, checking after every tick that you're on the beach and the coil is in reach.
async function step(page, run, sec, label) {
	const bad = await page.evaluate(([n, fps]) => {
		const out = [];
		for (let i = 0; i < n; i++) {
			beach.step(1, 1 / fps);
			const s = beach.state(), p = s.player, W = s.WALK;
			if (!(p.x >= W.x0 - 1e-6 && p.x <= W.x1 + 1e-6 && p.z >= W.z0 - 1e-6 && p.z <= W.z1 + 1e-6)) out.push("player left the beach at " + p.x.toFixed(2) + "," + p.z.toFixed(2));
			if (!Number.isFinite(p.x + p.z + p.yaw + s.coil.x + s.coil.z)) out.push("NaN in player or coil");
			if (!s.dig.on && !s.home && !(s.walkTarget && s.walkTarget.home)) { // the coil waits over the hole while you dig and step back
				// the coil eases towards where it should be, so only a gap that lasts a third of a second counts
				const d = Math.hypot(s.coil.x - p.x, s.coil.z - p.z);
				window.__coilOff = d < s.REACH_MIN - 0.3 || d > s.REACH + 0.3 ? (window.__coilOff || 0) + 1 : 0;
				if (window.__coilOff > fps / 3) out.push("coil " + d.toFixed(2) + " m from the player");
				// you hold the detector at your hip, so the grip stays at the bottom edge of the view and the coil stays on screen
				if (s.hand.y < 0.8) out.push("detector grip up in the view at " + (s.hand.y * 100).toFixed(0) + "% height");
				const c = s.coilOnScreen;
				if (c.x < 0.02 || c.x > 0.98 || c.y < 0.25 || c.y > 0.97) out.push("coil off screen at " + (c.x * 100).toFixed(0) + "%," + (c.y * 100).toFixed(0) + "%");
			} else window.__coilOff = 0;
		}
		return [...new Set(out)];
	}, [Math.round(sec * FPS), FPS]);
	if (bad.length) run.check("invariants during " + label, false, bad.slice(0, 4).join("; "));
	return bad.length === 0;
}
const S = (page) => page.evaluate(() => beach.state());
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pos = (s) => s.player.x.toFixed(2) + "," + s.player.z.toFixed(2);

async function place(page, x, z, yaw, cx, cz) {
	await page.evaluate(([x, z, yaw, cx, cz]) => {
		beach.teleport(x, z);
		beach.player.yaw = yaw;
		beach.player.vx = beach.player.vz = 0;
		beach.aim(cx, cz);
	}, [x, z, yaw, cx, cz]);
	await step(page, { check() {} }, 0.4, "settle");
}

// Run one dig to the end: close any find cards with Escape and wait until you're back home.
async function finishDig(page, run, label, release) {
	let cards = 0, far = 0;
	const s0 = await S(page);
	const home = s0.home ? { x: s0.home.x, z: s0.home.z } : { x: s0.player.x, z: s0.player.z };
	for (let i = 0; i < 120; i++) {
		const s = await S(page);
		far = Math.max(far, dist(s.player, home));
		if (s.cardOpen) {
			cards++;
			if (release) await release();
			await page.keyboard.press("Escape");
		} else if (!s.dig.on && !s.walkTarget && !s.home && !s.busy) return { s, cards, far, home };
		await step(page, run, 0.25, label);
	}
	const s = await S(page);
	run.check(label + " finishes", false, s.dig);
	return { s, cards, far, home };
}

async function desktop(run, page) {
	await clickEl(page, "#startBtn");
	await step(page, run, 0.5, "start");
	let s = await S(page);
	run.check("start button starts the game", s.started);
	let lay = await layoutProblems(page, HUD);
	run.check("HUD fits and nothing overlaps", lay.length === 0, lay.join("; "));
	await run.shot(page, "start");

	// turning with the arrow keys
	await place(page, 0, 0, 0, 0, -2);
	s = await S(page);
	await page.keyboard.down("ArrowLeft");
	await step(page, run, 1, "turn left");
	await page.keyboard.up("ArrowLeft");
	let s2 = await S(page);
	run.check("ArrowLeft turns you left", s2.player.yaw - s.player.yaw > 1.2 && s2.player.yaw - s.player.yaw < 3, (s2.player.yaw - s.player.yaw).toFixed(2) + " rad");
	run.check("the camera turns with you", Math.abs(s2.camYaw - s2.player.yaw) < 0.05, s2.camYaw.toFixed(2) + " vs " + s2.player.yaw.toFixed(2));
	run.check("the coil swings round with you", dist(s2.coil, s.coil) > 1, pos(s) + " coil moved " + dist(s2.coil, s.coil).toFixed(2));

	// turning by dragging with the right mouse button
	s = s2;
	await page.mouse.move(640, 420);
	await page.mouse.down({ button: "right" });
	await page.mouse.move(840, 420, { steps: 6 });
	await page.mouse.up({ button: "right" });
	await step(page, run, 0.2, "right drag");
	s2 = await S(page);
	run.check("right-drag to the right turns you right", s.player.yaw - s2.player.yaw > 0.8, (s2.player.yaw - s.player.yaw).toFixed(2) + " rad");
	s2 = await S(page);
	run.check("right-drag doesn't start a dig", !s2.dig.on);

	// W walks the way you face, D steps right
	await place(page, 0, 2, -Math.PI / 2, 2, 2); // facing +x, along the beach
	s = await S(page);
	await page.keyboard.down("KeyW");
	await step(page, run, 2, "walk forward");
	await page.keyboard.up("KeyW");
	s2 = await S(page);
	const dx = s2.player.x - s.player.x, dz = s2.player.z - s.player.z;
	run.check("W walks forward", dx > 1.5 && Math.abs(dz) < 0.2, "moved " + dx.toFixed(2) + "," + dz.toFixed(2));
	s = s2;
	await page.keyboard.down("KeyD");
	await step(page, run, 1, "strafe");
	await page.keyboard.up("KeyD");
	s2 = await S(page);
	run.check("D steps to your right (up the beach when facing east)", s2.player.z - s.player.z > 0.5 && Math.abs(s2.player.x - s.player.x) < 0.3, "moved " + (s2.player.x - s.player.x).toFixed(2) + "," + (s2.player.z - s.player.z).toFixed(2));
	await step(page, run, 0.5, "stop");

	// clicking far sand walks you there
	await place(page, 0, 1, -Math.PI / 2, 2, 1);
	let p = await page.evaluate(() => beach.toScreen(9, 1));
	await page.mouse.click(p.x, p.y);
	await step(page, run, 0.1, "click");
	s = await S(page);
	run.check("clicking far sand sets a walk target", !!s.walkTarget && !s.dig.on, JSON.stringify(s.walkTarget));
	await step(page, run, 7, "walk to click");
	s = await S(page);
	run.check("you stop a couple of metres short of where you clicked", Math.abs(s.player.x - 7) < 0.3 && !s.walkTarget, pos(s));

	// clicking out in the sea can't walk you into it
	await place(page, 0, 0, 0, 0, -2);
	p = await page.evaluate(() => beach.toScreen(0, -14));
	await page.mouse.click(p.x, Math.max(p.y, 5));
	await step(page, run, 0.1, "click on the sea");
	s = await S(page);
	run.check("clicking the sea walks you towards it", !!s.walkTarget, JSON.stringify(s.walkTarget));
	await step(page, run, 8, "walk towards the sea");
	s = await S(page);
	run.check("walking towards the sea stops at the water's edge and doesn't keep trying", s.player.z <= s.WALK.z0 + 0.1 && !s.walkTarget, pos(s));

	// the bug Akshay hit: digging over and over must not walk you into the sea
	await page.mouse.move(640, 700); // pointer off the sand so it doesn't steer the coil
	await page.evaluate(() => { document.querySelector("canvas").dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" })); });
	await place(page, 10, 2, 0, 10, 0);
	const start = await S(page);
	let worst = 0, scoops = 0;
	for (let i = 0; i < 6; i++) {
		// aim the coil a little differently each time, like sweeping around
		await page.evaluate(([x, z]) => beach.aim(x, z), [10 + (i % 3 - 1) * 0.9, 0 - (i % 2) * 0.4]);
		await step(page, run, 0.3, "aim");
		await page.keyboard.press("Space");
		await step(page, run, 0.1, "dig " + i);
		s = await S(page);
		if (s.dig.on) scoops++;
		const r = await finishDig(page, run, "dig " + (i + 1));
		worst = Math.max(worst, dist(r.s.player, start.player));
	}
	s = await S(page);
	run.check("six digs in a row all start", scoops === 6, scoops + " of 6");
	run.check("after six digs you're back where you started", dist(s.player, start.player) < 0.2, "start " + pos(start) + " now " + pos(s) + ", worst " + worst.toFixed(2) + " m");
	run.check("each dig leaves a hole", s.holes >= 3, s.holes + " holes");

	// digging again while you're still stepping back keeps the original spot
	await page.keyboard.press("Space");
	for (let i = 0; i < 80; i++) { s = await S(page); if (!s.dig.on) break; if (s.cardOpen) await page.keyboard.press("Escape"); await step(page, run, 0.25, "dig"); }
	await step(page, run, 0.15, "stepping back");
	await page.evaluate(() => beach.aim(10.5, -0.2));
	await step(page, run, 0.1, "aim");
	await page.keyboard.press("Space");
	await finishDig(page, run, "dig while stepping back");
	s = await S(page);
	run.check("a dig started while stepping back still returns you to the first spot", dist(s.player, start.player) < 0.2, pos(s));

	// walking away during the step back cancels it
	await page.keyboard.press("Space");
	for (let i = 0; i < 80; i++) { s = await S(page); if (!s.dig.on) break; if (s.cardOpen) await page.keyboard.press("Escape"); await step(page, run, 0.25, "dig"); }
	await page.keyboard.down("KeyD");
	await step(page, run, 1, "walk away");
	await page.keyboard.up("KeyD");
	await step(page, run, 1.5, "stop");
	s = await S(page);
	run.check("walking during the step back takes over (you don't get pulled back afterwards)", !s.walkTarget && !s.home && s.player.x > start.player.x + 0.8, pos(s));

	// holding Space keeps digging until the scoop can't reach further
	await place(page, -14, 3, 0, -14, 1);
	await page.keyboard.down("Space");
	let maxDepth = 0;
	for (let i = 0; i < 120; i++) {
		s = await S(page);
		maxDepth = Math.max(maxDepth, s.dig.depth || 0);
		if (s.cardOpen) await page.keyboard.press("Escape");
		if (!s.dig.on && i > 2) break;
		await step(page, run, 0.25, "hold dig");
	}
	await page.keyboard.up("Space");
	await finishDig(page, run, "hold dig");
	run.check("holding Space digs down to the bottom of the scoop's reach", maxDepth >= 40, maxDepth + " cm");
	await page.keyboard.press("Space");
	await step(page, run, 0.2, "dig full hole");
	s = await S(page);
	run.check("a hole at full depth says so instead of digging", !s.dig.on && /deep as the scoop/.test(s.toast), s.toast);

	await findThings(run, page, "metal", 3);
	await findThings(run, page, "other", 2);
	await findThings(run, page, "critter", 1);

	// can't dig in the sea
	await place(page, 0, -4.9, 0, 0, -7.0);
	s = await S(page);
	await page.keyboard.press("Space");
	await step(page, run, 0.2, "dig in sea");
	s = await S(page);
	const wet = await page.evaluate(() => beach.under(beach.coil.x, beach.coil.z));
	run.check("digging under water is refused (or allowed when the wave is out)", wet ? !s.dig.on && /under water/.test(s.toast) : true, "coil wet=" + wet + " toast=" + s.toast);
	await finishDig(page, run, "sea dig");

	// the ends of the beach
	for (const side of [1, -1]) {
		await place(page, side * 57, 2, -side * Math.PI / 2, side * 59, 2);
		await page.keyboard.down("KeyW");
		await step(page, run, 4, "walk to the end");
		await page.keyboard.up("KeyW");
		s = await S(page);
		run.check("you stop at the " + (side > 0 ? "east" : "west") + " end of the beach", Math.abs(Math.abs(s.player.x) - 60) < 0.05, pos(s));
		await step(page, run, 0.5, "end");
		await run.shot(page, side > 0 ? "east-end" : "west-end");
	}

	// the tide
	await place(page, 0, 1, 0, 0, -1);
	await clickEl(page, "#tideBtn");
	await step(page, run, 0.2, "tide");
	s = await S(page);
	run.check("the tide button brings the tide in", s.tide);
	await run.shot(page, "tide-start");
	await step(page, run, 4, "tide in");
	await run.shot(page, "tide-high");
	await step(page, run, 4.5, "tide out");
	s = await S(page);
	run.check("the tide goes back out", !s.tide && /tide went out/.test(s.toast), s.toast);
	run.check("the tide smooths the holes over", s.holes === 0, s.holes + " holes");
	run.check("the tide reburies things", s.found === 0, s.found + " still marked found");
	await page.keyboard.press("Space");
	await step(page, run, 0.2, "dig after tide");
	s = await S(page);
	run.check("you can dig after the tide", s.dig.on);
	await finishDig(page, run, "dig after tide");
}

// Walk up to buried things of one kind and dig them out.
async function findThings(run, page, cat, n) {
	const targets = await page.evaluate((cat) => beach.things()
		.filter((b) => !b.found && b.cat === cat && b.depth <= 40 && Math.abs(b.x) < 50 && b.z > -1.5 && b.z < 4.5)
		.sort((a, b) => a.depth - b.depth).slice(0, 6)
		.map((b) => ({ x: b.x, z: b.z, depth: b.depth, id: b.kind.id })), cat);
	run.check("there are " + cat + " finds to dig for", targets.length >= n, targets.length);
	let got = 0;
	for (const t of targets.slice(0, n)) {
		await place(page, t.x, t.z + 2, 0, t.x, t.z);
		let s = await S(page);
		if (cat === "metal") run.check("detector hears the " + t.id + " at " + t.depth + " cm", s.signal > 0.2, "signal " + s.signal.toFixed(2));
		if (await page.evaluate(([x, z]) => beach.under(x, z), [t.x, t.z])) await step(page, run, 4, "wait for the wave");
		const before = s.found;
		await page.keyboard.down("Space");
		let card = false, last = s;
		for (let i = 0; i < 100; i++) {
			s = last = await S(page);
			if (s.cardOpen) { card = true; break; }
			if (s.found > before && cat === "critter") break;
			if (!s.dig.on && i > 2) break;
			await step(page, run, 0.25, "dig for " + t.id);
		}
		await page.keyboard.up("Space");
		const thing = await page.evaluate(([x, z]) => beach.things().find((b) => b.x === x && b.z === z).found, [t.x, t.z]);
		run.check("digging on the " + t.id + " (" + t.depth + " cm) finds it", thing, "depth reached " + last.dig.depth + ", toast: " + last.toast);
		if (card) {
			if (!got) {
				const lay = await layoutProblems(page, []);
				run.check("find card text fits", lay.length === 0, lay.join("; "));
				await run.shot(page, "card-" + cat);
			}
			if (cat !== "critter") {
				const shown = await page.evaluate(() => document.querySelector("#card").textContent.length > 20);
				run.check("the card describes the find", shown);
			}
		}
		if (thing) got++;
		await finishDig(page, run, "dig for " + t.id);
		s = await S(page);
		run.check("back on your spot after digging up the " + t.id, Math.abs(s.player.z - (t.z + 2)) < 0.25 || t.z + 2 > s.WALK.z1, pos(s));
	}
}

// a real mouse click at the middle of an element (page.click waits for "stable" frames, which software WebGL is too slow for)
async function clickEl(page, sel) {
	const c = await centre(page, sel);
	await page.mouse.click(c.x, c.y);
}
async function touch(cdp, type, x, y) {
	await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
}
async function centre(page, sel) {
	return page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, sel);
}

async function phone(run, page, ctx) {
	const cdp = await ctx.newCDPSession(page);
	const sb = await centre(page, "#startBtn");
	await touch(cdp, "touchStart", sb.x, sb.y);
	await touch(cdp, "touchEnd");
	await step(page, run, 0.5, "start");
	let s = await S(page);
	run.check("tapping start starts the game", s.started);
	const lay = await layoutProblems(page, HUD);
	run.check("HUD fits and nothing overlaps on a phone", lay.length === 0, lay.join("; "));
	const vis = await page.evaluate(() => getComputedStyle(document.querySelector("#stick")).display !== "none" && getComputedStyle(document.querySelector("#digBtn")).display !== "none");
	run.check("the stick and DIG button are shown", vis);
	await run.shot(page, "start");

	// the stick: up walks forward, sideways turns
	await place(page, 0, 3, 0, 0, 1);
	const st = await centre(page, "#stick");
	s = await S(page);
	await touch(cdp, "touchStart", st.x, st.y);
	await touch(cdp, "touchMove", st.x, st.y - st.w * 0.4);
	await step(page, run, 2, "stick forward");
	let s2 = await S(page);
	run.check("pushing the stick up walks forward", s.player.z - s2.player.z > 1, "moved " + (s2.player.z - s.player.z).toFixed(2));
	await touch(cdp, "touchMove", st.x + st.w * 0.4, st.y);
	s = s2;
	await step(page, run, 1.5, "stick right");
	s2 = await S(page);
	run.check("pushing the stick right turns right", s.player.yaw - s2.player.yaw > 0.4, (s2.player.yaw - s.player.yaw).toFixed(2) + " rad");
	await touch(cdp, "touchEnd");
	await step(page, run, 0.5, "stick release");
	s = await S(page);
	await step(page, run, 0.5, "stick release");
	s2 = await S(page);
	run.check("letting go of the stick stops you", dist(s.player, s2.player) < 0.02 && Math.abs(s.player.yaw - s2.player.yaw) < 0.01);

	// dragging on the sand moves the coil
	await place(page, 0, 3, 0, 0, 1);
	s = await S(page);
	await touch(cdp, "touchStart", 200, 560);
	await touch(cdp, "touchMove", 120, 520);
	await touch(cdp, "touchMove", 90, 500);
	await step(page, run, 0.4, "drag");
	await touch(cdp, "touchEnd");
	s2 = await S(page);
	run.check("dragging on the sand sweeps the coil", dist(s.coil, s2.coil) > 0.4 && !s2.dig.on, "coil moved " + dist(s.coil, s2.coil).toFixed(2));

	// hold DIG a few times in one place: you must end up where you started
	await place(page, 6, 3, 0, 6, 1);
	const start = await S(page);
	const dig = await centre(page, "#digBtn");
	for (let i = 0; i < 4; i++) {
		await page.evaluate(([x, z]) => beach.aim(x, z), [6 + (i % 2 ? 0.4 : -0.4), 1]);
		await step(page, run, 0.3, "aim");
		await touch(cdp, "touchStart", dig.x, dig.y);
		await step(page, run, 0.3, "dig");
		s = await S(page);
		run.check("holding DIG starts digging (" + (i + 1) + ")", s.dig.on && s.dig.held, s.toast);
		await touch(cdp, "touchEnd");
		await finishDig(page, run, "phone dig " + (i + 1), null);
	}
	s = await S(page);
	run.check("after four digs on a phone you're back where you started", dist(s.player, start.player) < 0.2, "start " + pos(start) + " now " + pos(s));
	await run.shot(page, "after-digs");

	// tapping far sand walks there
	await place(page, 0, 2, -Math.PI / 2, 2, 2);
	const p = await page.evaluate(() => beach.toScreen(8, 2));
	await touch(cdp, "touchStart", p.x, p.y + 70);
	await touch(cdp, "touchEnd");
	await step(page, run, 0.1, "tap");
	s = await S(page);
	if (!s.walkTarget) run.note("tap didn't register as a tap (software rendering can be too slow for the 350 ms tap window)");
	else {
		await step(page, run, 6, "walk to tap");
		s = await S(page);
		run.check("tapping far sand walks you towards it", s.player.x > 4, pos(s));
	}

	// a find card on a phone
	await findThings(run, page, "metal", 1);
}

(async () => {
	const srv = await serve();
	const base = "http://localhost:" + srv.address().port + "/october/01-reveal/?bake=1024";
	const runs = [];
	const configs = [
		["desktop", { width: 1280, height: 720 }, desktop],
		["phone", { width: 390, height: 844, touch: true }, phone]
	].filter(([n]) => !only || n === only);
	for (const [name, vp, play] of configs) {
		const run = new Run(name, shotsAt);
		runs.push(run);
		const { browser, ctx, page } = await open(run, base, vp);
		try {
			await page.waitForFunction(() => document.body.classList.contains("ready") && window.beach, null, { timeout: 240000 });
			const bad = await page.evaluate(() => {
				const s = beach.state();
				return beach.things().filter((b) => b.x < s.WALK.x0 - s.REACH || b.x > s.WALK.x1 + s.REACH || b.z < s.WALK.z0 || b.z > s.WALK.z1 + s.REACH).map((b) => b.kind.id + "@" + b.x.toFixed(1) + "," + b.z.toFixed(1));
			});
			run.check("everything is buried where you can reach it", bad.length === 0, bad.slice(0, 5).join(" "));
			const deep = await page.evaluate(() => beach.things().filter((b) => b.depth > 40).length);
			run.check("nothing is buried deeper than the scoop reaches", deep === 0, deep);
			await play(run, page, ctx);
		} catch (e) {
			run.check("playtest ran to the end", false, e.message.split("\n")[0]);
		}
		await browser.close();
	}
	srv.close();
	process.exit(summary(runs) ? 1 : 0);
})();
