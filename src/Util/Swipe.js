// code from http://www.javascriptkit.com/javatutors/touchevents2.shtml

//USAGE:
/*
var el = document.getElementById('someel')
swipedetect(el, function(swipedir){
    swipedir contains either "none", "left", "right", "top", or "down"
    if (swipedir =='left')
        alert('You just swiped left!')
})
*/

export function swipedetect(el, callback) {
  let swipedir,
    startX,
    startY,
    distX,
    distY,
    threshold = 75, //required min distance traveled to be considered swipe
    restraint = 50, // maximum distance allowed at the same time in perpendicular direction
    allowedTime = 300, // maximum time allowed to travel that distance
    elapsedTime,
    startTime,
    handleswipe = callback || function(swipedir) {};

  el.addEventListener(
    'touchstart',
    function(e) {
      var touchobj = e.changedTouches[0];
      swipedir = 'none';
      distX = 0;
      distY = 0;
      startX = touchobj.pageX;
      startY = touchobj.pageY;
      startTime = Date.now(); // record time when finger first makes contact with surface
    },
    false
  );

  el.addEventListener(
    'touchmove',
    function(e) {
      var touchobj = e.changedTouches[0];
      distX = touchobj.pageX - startX; // get horizontal dist traveled by finger while in contact with surface
      distY = touchobj.pageY - startY; // get vertical dist traveled by finger while in contact with surface
      elapsedTime = Date.now() - startTime; // get time elapsed
      if (elapsedTime <= allowedTime) {
        // first condition for awipe met
        if (Math.abs(distX) >= threshold && Math.abs(distY) <= restraint) {
          // 2nd condition for horizontal swipe met
          swipedir = distX < 0 ? 'left' : 'right'; // if dist traveled is negative, it indicates left swipe
        } else if (Math.abs(distY) >= threshold && Math.abs(distX) <= restraint) {
          // 2nd condition for vertical swipe met
          swipedir = distY < 0 ? 'up' : 'down'; // if dist traveled is negative, it indicates up swipe
        }
      }
      handleswipe(swipedir);
    },
    false
  );
}
