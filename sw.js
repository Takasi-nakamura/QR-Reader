"use strict";

const CACHE_NAME = "qr-reader-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];


/* =========================================================
   Install
========================================================= */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches.open(CACHE_NAME)
        .then(cache => {

          return cache.addAll(APP_SHELL);

        })
        .then(() => {

          return self.skipWaiting();

        })

    );
  }
);


/* =========================================================
   Activate
========================================================= */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches.keys()
        .then(keys => {

          return Promise.all(

            keys
              .filter(key => key !== CACHE_NAME)
              .map(key => caches.delete(key))

          );

        })
        .then(() => {

          return self.clients.claim();

        })

    );
  }
);


/* =========================================================
   Fetch
========================================================= */

self.addEventListener(
  "fetch",
  event => {

    /*
     * Only handle GET requests.
     */
    if (event.request.method !== "GET") {
      return;
    }

    /*
     * Navigation requests:
     * Network first, cache fallback.
     */
    if (event.request.mode === "navigate") {

      event.respondWith(

        fetch(event.request)
          .then(response => {

            return response;

          })
          .catch(() => {

            return caches.match(
              "./index.html"
            );

          })

      );

      return;
    }


    /*
     * App files:
     * Cache first.
     */
    event.respondWith(

      caches.match(event.request)
        .then(cached => {

          if (cached) {
            return cached;
          }

          return fetch(event.request)
            .then(response => {

              /*
               * Cache successful same-origin files.
               */
              if (
                response &&
                response.status === 200 &&
                response.type === "basic"
              ) {

                const copy =
                  response.clone();

                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(
                      event.request,
                      copy
                    );
                  });
              }

              return response;

            });

        })

    );
  }
);
