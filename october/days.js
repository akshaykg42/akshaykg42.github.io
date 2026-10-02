// Weird Web October 2026, one tiny website per day.
// Themes from https://weirdweboctober.website/
//
// To publish a day: make a folder like october/03-fake/ with an index.html,
// then set that day's `url` below, e.g. url: "03-fake/".
window.WWO_DAYS = [
  { day: 1,  theme: "Reveal" },
  { day: 2,  theme: "Spark" },
  { day: 3,  theme: "Fake" },
  { day: 4,  theme: "Plastic" },
  { day: 5,  theme: "Sheet" },
  { day: 6,  theme: "Analog" },
  { day: 7,  theme: "Organic" },
  { day: 8,  theme: "Skeumorphism" },
  { day: 9,  theme: "Spicy" },
  { day: 10, theme: "Layers" },
  { day: 11, theme: "Stuck" },
  { day: 12, theme: "Pointy" },
  { day: 13, theme: "Scratch" },
  { day: 14, theme: "Origami" },
  { day: 15, theme: "Wooden" },
  { day: 16, theme: "Instant" },
  { day: 17, theme: "Branching" },
  { day: 18, theme: "Geometric" },
  { day: 19, theme: "Distorted" },
  { day: 20, theme: "Undefined" },
  { day: 21, theme: "Illusion" },
  { day: 22, theme: "Skeletons" },
  { day: 23, theme: "Incognito" },
  { day: 24, theme: "Collage" },
  { day: 25, theme: "Ascending" },
  { day: 26, theme: "Net" },
  { day: 27, theme: "Spiral" },
  { day: 28, theme: "Smooth" },
  { day: 29, theme: "The End" },
  { day: 30, theme: "Pastel" },
  { day: 31, theme: "Spooky" }
];

// Which day of October it is in the visitor's timezone: 0 before Oct 1 2026, 32 after Oct 31.
window.wwoToday = function () {
  var now = new Date();
  var start = new Date(2026, 9, 1);
  var end = new Date(2026, 10, 1);
  if (now < start) return 0;
  if (now >= end) return 32;
  return now.getDate();
};
