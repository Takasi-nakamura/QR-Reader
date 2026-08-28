"use strict";


const CACHE_NAME =
  "qr-reader-v2";


const CACHE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];


/* ================================
   Install
================================ */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE_NAME)
        .then(cache => {

          return cache.addAll(
            CACHE_FILES
          );

        })

    );


    self.skipWaiting();
  }
);


/* ================================
   Activate
================================ */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(keys => {

          return Promise.all(

            keys
              .filter(
                key =>
                  key !== CACHE_NAME
              )

              .map(
                key =>
                  caches.delete(key)
              )

          );

        })

    );


    self.clients.claim();
  }
);


/* ================================
   Fetch
================================ */

self.addEventListener(
  "fetch",
  event => {

    /*
      自分のアプリファイルは
      Cache First。
    */

    const url =
      new URL(
        event.request.url
      );


    if (
      url.origin ===
      self.location.origin
    ) {

      event.respondWith(

        caches
          .match(event.request)
          .then(cached => {

            if (cached) {
              return cached;
            }

            return fetch(
              event.request
            );
          })

      );

      return;
    }


    /*
      jsQR CDNなど外部リソースは
      Network First。
    */

    event.respondWith(

      fetch(
        event.request
      ).catch(() => {

        return caches.match(
          event.request
        );

      })

    );
  }
););


/* --------------------------------
   Activate
-------------------------------- */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(keys => {

          return Promise.all(

            keys
              .filter(
                key =>
                  key !== CACHE_NAME
              )

              .map(
                key =>
                  caches.delete(key)
              )

          );

        })

    );


    self.clients.claim();
  }
);


/* --------------------------------
   Fetch
-------------------------------- */

self.addEventListener(
  "fetch",
  event => {

    /*
      QR Reader本体はCache First。

      CDNのjsQRはネットワークから取得。
    */

    event.respondWith(

      caches
        .match(event.request)
        .then(cached => {

          if (cached) {
            return cached;
          }


          return fetch(
            event.request
          );

        })

    );
  }
);
