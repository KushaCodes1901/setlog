// Original generated equipment-sticker illustrations; labels are part of each image.
const learningMuscles = (() => {
  const illustrations = {
    'dumbbell-bench-press': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'incline-dumbbell-press': ['upper-chest', 'Upper pectoralis, clavicular fibers, and anterior deltoid.'],
    'shoulder-press': ['shoulder-press', 'Anterior deltoid and middle deltoid at the front and side of the shoulder.'],
    'lateral-raise': ['lateral-raise', 'Middle deltoid at the side of the shoulder.'],
    'seated-cable-row': ['row', 'Latissimus dorsi, middle trapezius and posterior deltoid, shown from the back.'],
    'bicep-curl': ['elbow-flexors', 'Biceps brachii, brachialis and brachioradialis in the upper arm and forearm.'],
    'hammer-curl': ['elbow-flexors', 'Biceps brachii, brachialis and brachioradialis in the upper arm and forearm.'],
    'skull-crusher': ['triceps', 'Triceps brachii on the back of the upper arm, with the long head labeled.'],
    'tricep-kickback': ['triceps', 'Triceps brachii on the back of the upper arm, with the long head labeled.'],
    'overhead-tricep-extension': ['triceps', 'Triceps brachii on the back of the upper arm, with the long head labeled.']
  };
  function render(slug) {
    const illustration = illustrations[slug];
    if (!illustration) return null;
    const figure = document.createElement('figure');
    figure.className = 'learn-muscles';
    const image = new Image();
    image.src = `assets/media/learning/muscles-${illustration[0]}.png`;
    image.alt = illustration[1];
    image.width = 1254;
    image.height = 1254;
    image.decoding = 'async';
    figure.append(image);
    return figure;
  }
  return { render };
})();
