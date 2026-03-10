window.HELP_IMPROVE_VIDEOJS = false;

var INTERP_BASE = './static/interpolation/stacked';
var NUM_INTERP_FRAMES = 240;

var interp_images = [];
function preloadInterpolationImages() {
  for (var i = 0; i < NUM_INTERP_FRAMES; i++) {
    var path = INTERP_BASE + '/' + String(i).padStart(6, '0') + '.jpg';
    interp_images[i] = new Image();
    interp_images[i].src = path;
  }
}

function setInterpolationImage(i) {
  var image = interp_images[i];
  if (!image) return;
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  $('#interpolation-image-wrapper').empty().append(image);
}

function formatMethodName(file) {
  return file.replace('.mp4', '').replace(/_bpp[0-9.]+$/, '').replace(/_/g, ' ');
}

function extractBitrate(file) {
  var match = file.match(/bpp([0-9.]+)/);
  return match ? match[1] : '';
}

function formatBitrateLabel(bitrate) {
  return bitrate.replace(/\./g, '') + ' bpp';
}

function getUnsupportedSuffix(method) {
  return method.isSupported === false ? ' (unsupported codec)' : '';
}

function initVideoComparison() {
  var container = document.getElementById('video-compare');
  if (!container) return;

  var leftVideo = document.getElementById('left-video');
  var rightVideo = document.getElementById('right-video');
  var overlay = document.getElementById('compare-overlay');
  var divider = document.getElementById('compare-divider');
  var label = document.getElementById('selected-method-label');
  var methodGroups = document.getElementById('method-groups');

  var groupedMethods = {
    'Baselines': [
      'DCVCRT_bpp0.01052.mp4',
      'GLVCvideo_bpp0.0099.mp4',
      'VTM_bpp0.01489.mp4'
    ],
    'VOV': [
      'VOV_bpp0.010346.mp4',
      'VOV_bpp0.004473.mp4'
    ],
    'VOV Scaling': [
      'VOV_scaling_bpp0.010655.mp4',
      'VOV_scaling_bpp0.004782.mp4'
    ]
  };

  var methods = [];
  Object.keys(groupedMethods).forEach(function(groupName) {
    groupedMethods[groupName].forEach(function(fileName) {
      methods.push({
        group: groupName,
        file: fileName,
        src: './static/videos/' + fileName,
        name: formatMethodName(fileName),
        bitrate: extractBitrate(fileName),
        isSupported: null,
        cardElement: null,
        bitrateElement: null
      });
    });
  });

  var selectedMethod = methods[0];
  var dragging = false;

  function renderSelectedLabel() {
    var text = 'Left: Ground Truth | Right: ' + selectedMethod.name + ' (' + formatBitrateLabel(selectedMethod.bitrate) + ')';
    if (selectedMethod.isSupported === false) {
      text += ' - video could not be loaded in this browser';
    }
    label.textContent = text;
  }

  function clearRightVideo() {
    rightVideo.pause();
    rightVideo.removeAttribute('src');
    rightVideo.load();
  }

  function updateMethodCard(method) {
    if (!method.cardElement || !method.bitrateElement) return;
    method.cardElement.classList.toggle('is-unsupported', method.isSupported === false);
    method.bitrateElement.textContent = formatBitrateLabel(method.bitrate) + getUnsupportedSuffix(method);
  }

  function setMethodSupport(method, isSupported) {
    if (method.isSupported === isSupported) return;
    method.isSupported = isSupported;
    updateMethodCard(method);

    if (selectedMethod.file === method.file) {
      if (isSupported === false) {
        clearRightVideo();
      }
      renderSelectedLabel();
    }
  }

  function setSplit(percent) {
    var clamped = Math.max(0, Math.min(100, percent));
    overlay.style.clipPath = 'inset(0 0 0 ' + clamped + '%)';
    divider.style.left = clamped + '%';
  }

  function splitFromClientX(clientX) {
    var rect = container.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function selectMethod(method) {
    selectedMethod = method;

    if (method.isSupported === false) {
      clearRightVideo();
      renderSelectedLabel();
    } else {
      rightVideo.src = method.src;
      rightVideo.load();
      rightVideo.currentTime = leftVideo.currentTime || 0;
      rightVideo.play().catch(function() {});
      renderSelectedLabel();
    }

    var cards = methodGroups.querySelectorAll('.method-card');
    cards.forEach(function(card) {
      card.classList.toggle('is-selected', card.dataset.file === method.file);
    });
  }

  function renderMethodCards() {
    methodGroups.innerHTML = '';

    var grid = document.createElement('div');
    grid.className = 'method-grid';

    methods.forEach(function(method) {
      var card = document.createElement('div');
      card.className = 'method-card';
      card.dataset.file = method.file;

      var preview = document.createElement('video');
      preview.src = method.src;
      preview.muted = true;
      preview.defaultMuted = true;
      preview.loop = true;
      preview.autoplay = true;
      preview.preload = 'auto';
      preview.playsInline = true;
      preview.setAttribute('muted', '');
      preview.setAttribute('playsinline', '');

      var name = document.createElement('div');
      name.className = 'method-name';
      name.textContent = method.name;

      var bitrate = document.createElement('div');
      bitrate.className = 'method-bitrate';
      bitrate.textContent = formatBitrateLabel(method.bitrate);

      preview.addEventListener('loadeddata', function() {
        setMethodSupport(method, true);
      });
      preview.addEventListener('error', function() {
        setMethodSupport(method, false);
      });

      method.cardElement = card;
      method.bitrateElement = bitrate;

      card.appendChild(preview);
      card.appendChild(name);
      card.appendChild(bitrate);
      card.addEventListener('click', function() {
        selectMethod(method);
      });

      grid.appendChild(card);
    });

    methodGroups.appendChild(grid);
  }

  function syncToLeft() {
    if (Math.abs(rightVideo.currentTime - leftVideo.currentTime) > 0.08) {
      rightVideo.currentTime = leftVideo.currentTime;
    }
  }

  container.addEventListener('pointerdown', function(event) {
    dragging = true;
    container.setPointerCapture(event.pointerId);
    setSplit(splitFromClientX(event.clientX));
    event.preventDefault();
  });

  container.addEventListener('pointermove', function(event) {
    if (!dragging) return;
    setSplit(splitFromClientX(event.clientX));
  });

  container.addEventListener('pointerup', function() {
    dragging = false;
  });

  container.addEventListener('pointercancel', function() {
    dragging = false;
  });

  leftVideo.addEventListener('play', function() {
    rightVideo.play().catch(function() {});
  });
  leftVideo.addEventListener('pause', function() {
    rightVideo.pause();
  });
  leftVideo.addEventListener('seeking', syncToLeft);
  leftVideo.addEventListener('timeupdate', syncToLeft);
  rightVideo.addEventListener('loadeddata', function() {
    setMethodSupport(selectedMethod, true);
  });
  rightVideo.addEventListener('error', function() {
    setMethodSupport(selectedMethod, false);
  });

  renderMethodCards();
  selectMethod(selectedMethod);
  setSplit(50);
}

$(document).ready(function() {
  $('.navbar-burger').click(function() {
    $('.navbar-burger').toggleClass('is-active');
    $('.navbar-menu').toggleClass('is-active');
  });

  var options = {
    slidesToScroll: 1,
    slidesToShow: 3,
    loop: true,
    infinite: true,
    autoplay: false,
    autoplaySpeed: 3000
  };

  var carousels = bulmaCarousel.attach('.carousel', options);
  for (var i = 0; i < carousels.length; i++) {
    carousels[i].on('before:show', function(state) {
      console.log(state);
    });
  }

  if ($('#interpolation-image-wrapper').length && $('#interpolation-slider').length) {
    preloadInterpolationImages();
    $('#interpolation-slider').on('input', function() {
      setInterpolationImage(this.value);
    });
    setInterpolationImage(0);
    $('#interpolation-slider').prop('max', NUM_INTERP_FRAMES - 1);
  }

  bulmaSlider.attach();
  initVideoComparison();
});
