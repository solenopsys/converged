function onTask(task) {
  return { action: "start" };
}

function onIdle(plugin) {
  return { action: "unload" };
}
