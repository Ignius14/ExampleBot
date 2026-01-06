import "./src/Base/app.js";

console.log("[Startup] Bot process initialized.");

process.on("unhandledRejection", (reason) => {
	console.error("[UnhandledRejection]", reason);
});

process.on("uncaughtException", (error) => {
	console.error("[UncaughtException]", error);
	process.exitCode = 1;
});
