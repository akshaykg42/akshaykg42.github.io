function fadeIn(element) {
	element.style.opacity = "1";
}

function fadeOut(element) {
	element.style.opacity = "0";
}

function english() {
	title = document.getElementsByClassName("name")[0];
	subtitle = document.getElementsByClassName("email")[0];
	schedule = document.getElementsByClassName("email")[1];
	links = document.getElementsByClassName("links")[0];

	window.history.pushState("object or string", "Title", "/~akshaykg/english");

	fadeOut(title);

	setTimeout(function(){
		fadeOut(subtitle);
	}, 200);

	setTimeout(function(){
		fadeOut(schedule);
	}, 300);

	setTimeout(function(){
		fadeOut(links);
	}, 350);

	setTimeout(function(){
		window.history.pushState("object or string", "Title", "/~akshaykg");
		title.innerHTML = "Akshay Kumar Gupta";
	}, 700);

	setTimeout(function(){
		subtitle.innerHTML = "From New Delhi, India";
	}, 700);

	setTimeout(function(){
		schedule.innerHTML = "akshaykg@cs.utexas.edu";
	}, 700);

	setTimeout(function(){
		links.innerHTML = "<a href = 'https://unsplash.com/@wizardgupta'>Photos</a> &nbsp; &bull; &nbsp;<a href = 'https://cs.utexas.edu/~akshaykg/Resume.pdf'>Resume</a>";
	}, 700);

	setTimeout(function(){
		fadeIn(title);
	}, 800);

	setTimeout(function(){
		fadeIn(subtitle);
	}, 820); 

	setTimeout(function(){
		fadeIn(schedule);
	}, 850); 

	setTimeout(function(){
		fadeIn(links);
	}, 900); 
}

language = "English";
