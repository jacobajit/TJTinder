window.addEventListener('load', function() {
  var outputElement = document.getElementById('output');
  navigator.serviceWorker.register('static/service-worker.js', { scope: '/~2017jajit/tjtinder/' })//correct scope?
    .then(function(r) {
      console.log('registered service worker');
    })
    .catch(function(whut) {
      console.error('uh oh... ');
      console.error(whut);
    });
   
  window.addEventListener('beforeinstallprompt', function(e) {
    
  });
});