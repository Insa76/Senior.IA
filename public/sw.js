self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients.openWindow("/")
  );
});