// Small bits of weirdness shared by every page.
(function () {
	var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	var glyphs = ["✦", "✧", "★", "✺", "❋", "✿"];
	var colors = ["#ff6b1a", "#ff8fd0", "#c6f432", "#6ec3ff", "#b28dff"];

	function pick(list) {
		return list[Math.floor(Math.random() * list.length)];
	}

	function sparkle(x, y, size) {
		var s = document.createElement("span");
		s.className = "sparkle";
		s.textContent = pick(glyphs);
		s.style.left = x + "px";
		s.style.top = y + "px";
		s.style.color = pick(colors);
		if (size) s.style.fontSize = size + "px";
		document.body.appendChild(s);
		setTimeout(function () { s.remove(); }, 900);
	}

	// cursor trail, throttled so it stays light
	var last = 0;
	if (!reduced) {
		document.addEventListener("pointermove", function (e) {
			var now = Date.now();
			if (now - last < 45) return;
			last = now;
			sparkle(e.clientX + 6, e.clientY + 6);
		});

		// double-click anywhere for a burst
		document.addEventListener("dblclick", function (e) {
			for (var i = 0; i < 14; i++) {
				sparkle(e.clientX + (Math.random() - 0.5) * 120, e.clientY + (Math.random() - 0.5) * 120, 14 + Math.random() * 20);
			}
		});
	}

	// old-school visitor counter (counts your visits in this browser)
	var counter = document.querySelector("[data-counter]");
	if (counter) {
		var n = 1;
		try {
			n = parseInt(localStorage.getItem("visits") || "0", 10) + 1;
			localStorage.setItem("visits", String(n));
		} catch (err) {}
		var digits = String(n).padStart(6, "0").split("");
		counter.innerHTML = digits.map(function (d) { return "<b>" + d + "</b>"; }).join("");
	}

	// split the big name into letters that jump on hover
	var name = document.querySelector("[data-wobble]");
	if (name) {
		name.innerHTML = name.textContent.trim().split(" ").map(function (word) {
			return '<span class="word">' + word.split("").map(function (c) {
				return "<span>" + c + "</span>";
			}).join("") + "</span>";
		}).join(" ");
	}
})();
