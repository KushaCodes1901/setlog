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
    'overhead-tricep-extension': ['triceps', 'Triceps brachii on the back of the upper arm, with the long head labeled.'],
    'chest-press': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'bench-press': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'pec-deck': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'push-up': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'lat-pulldown': ['lat-pulldown', 'Latissimus dorsi and teres major, shown from the back.'],
    'dumbbell-row': ['row', 'Latissimus dorsi, middle trapezius and posterior deltoid, shown from the back.'],
    'bodyweight-squat': ['legs-compound', 'Quadriceps on the front thighs and gluteus maximus at the hips, shown in front and back views.'],
    'leg-press': ['legs-compound', 'Quadriceps on the front thighs and gluteus maximus at the hips, shown in front and back views.'],
    'leg-extension': ['quadriceps', 'Front thigh quadriceps: rectus femoris, vastus lateralis and vastus medialis.'],
    'leg-curl': ['hamstrings', 'Back thigh hamstrings, with biceps femoris and semitendinosus labeled.'],
    'incline-barbell-press': ['upper-chest', 'Pectoralis major, clavicular fibers of the upper chest, and anterior deltoid.'],
    'decline-bench-press': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'chest-fly': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'cable-crossover': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'incline-push-up': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'arnold-press': ['shoulder-press', 'Anterior and middle deltoid at the front and side of the shoulder.'],
    'cable-lateral-raise': ['lateral-raise', 'Middle deltoid at the side of the shoulder.'],
    'front-raise': ['front-deltoid', 'Anterior deltoid at the front of the shoulder.'],
    'reverse-fly': ['rear-shoulder', 'Posterior deltoid, middle trapezius and rhomboids, shown from the back.'],
    'face-pull': ['rear-shoulder', 'Posterior deltoid, middle trapezius and rhomboids, shown from the back.'],
    'upright-row': ['side-deltoid-traps', 'Middle deltoid at the side shoulder and upper trapezius beside the neck.'],
    'shrug': ['upper-trapezius', 'Upper trapezius between the neck and the tops of the shoulders.'],
    'ez-bar-curl': ['elbow-flexors', 'Biceps brachii, brachialis and brachioradialis in the upper arm and forearm.'],
    'preacher-curl': ['elbow-flexors', 'Biceps brachii, brachialis and brachioradialis in the upper arm and forearm.'],
    'concentration-curl': ['elbow-flexors', 'Biceps brachii, brachialis and brachioradialis in the upper arm and forearm.'],
    'cable-curl': ['elbow-flexors', 'Biceps brachii, brachialis and brachioradialis in the upper arm and forearm.'],
    'reverse-curl': ['reverse-curl', 'Brachioradialis in the outer forearm and brachialis near the elbow.'],
    'wrist-curl': ['forearm-flexors', 'Wrist flexor group on the palm side of the forearm.'],
    'tricep-pushdown': ['triceps', 'Triceps brachii on the back of the upper arm.'],
    'dip': ['dip', 'Triceps brachii and pectoralis major at the back of the upper arms and the chest.'],
    'bench-dip': ['triceps', 'Triceps brachii on the back of the upper arm.'],
    'cable-chest-press': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'low-to-high-cable-fly': ['upper-chest', 'Clavicular fibers of the pectoralis major in the upper chest and anterior deltoid.'],
    'mid-height-cable-fly': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'single-arm-cable-fly': ['chest', 'Pectoralis major across the chest and anterior deltoid at the front shoulder.'],
    'barbell-row': ['row', 'Latissimus dorsi, middle trapezius and posterior deltoid, shown from the back.'],
    't-bar-row': ['row', 'Latissimus dorsi, middle trapezius and posterior deltoid, shown from the back.'],
    'chest-supported-row': ['row', 'Latissimus dorsi, middle trapezius and posterior deltoid, shown from the back.'],
    'straight-arm-pulldown': ['lat-pulldown', 'Latissimus dorsi and teres major, shown from the back.'],
    'pull-up': ['lat-pulldown', 'Latissimus dorsi and teres major, shown from the back.'],
    'chin-up': ['lat-pulldown', 'Latissimus dorsi and teres major, shown from the back.'],
    'assisted-pull-up': ['lat-pulldown', 'Latissimus dorsi and teres major, shown from the back.'],
    'dead-hang': ['dead-hang', 'Finger flexors on the palm side of the forearm that maintain the grip during a hang.'],
    'back-extension': ['back-extension', 'Erector spinae beside the spine, gluteus maximus at the hips and hamstrings behind the thighs.'],
    'deadlift': ['deadlift', 'Erector spinae, gluteus maximus, hamstrings and quadriceps, shown in rear and front views.'],
    'dumbbell-pullover': ['pullover', 'Pectoralis major on the chest and latissimus dorsi on the back, shown in front and rear views.']
  };
  function render(slug) {
    const illustration = illustrations[slug];
    if (!illustration) return null;
    const figure = document.createElement('figure');
    figure.className = 'learn-muscles';
    const image = new Image();
    image.fetchPriority = 'high';
    image.src = `assets/media/learning/muscles-${illustration[0]}.webp`;
    image.alt = illustration[1];
    image.width = 1024;
    image.height = 1024;
    image.decoding = 'async';
    figure.append(image);
    return figure;
  }
  return { render };
})();
